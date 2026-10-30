// api/chat.js
// Site chatbot widget backend (see memory: project_chatbot). chat-widget.js
// POSTs the full conversation so far —
// { messages: [{role:"user"|"assistant", content:string}, ...] } — and gets
// back { answer, escalate, links: [{label,url}] }. Stateless on purpose: the
// widget keeps the conversation client-side and resends it each turn, same
// as any simple chat completion API; there's no server-side session to
// manage.
//
// Grounding is entirely the system prompt's job (see
// _chatbot-faq-prompt.js) — this file never touches FAQ content directly,
// it just calls Claude with that prompt and parses the JSON reply it's
// instructed to produce.
//
// Logging a finished conversation into Airtable's Vefspjall 💬 table is
// NOT done here — that table was already added to CREATABLE_FIELDS in
// api/airtable.js during Phase 0, so the widget frontend can POST straight
// to /api/airtable?path=tbltD1UNpqj05WtMx itself once a conversation ends.
// No second logging endpoint needed.

import { buildSystemPrompt, buildStudioPrompt, renderStudioContext, LINKS, STUDIO_LINK_KEYS } from "./_chatbot-faq-prompt.js";
import { applyCors } from "./_cors.js";
import { STAFF_APPS, buildStaffPrompt, renderStaffContext, staffLinkMap } from "./_chatbot-staff-prompts.js";
import { keyLevel, verifyPieceToken, isPieceTokenShape } from "./_auth.js";

const MODEL = process.env.CHATBOT_MODEL || "claude-haiku-4-5-20251001";
const MAX_TOKENS = 500;
// Bounds on the untrusted input this endpoint accepts, since every request
// costs a real Claude API call — cheap to check, expensive to skip.
const MAX_MESSAGES = 20;
// Cost (2026-10-30): the whole history is re-sent (and billed as input) every turn, so only the last few messages
// go to the model. The widget still keeps and logs the full conversation.
const MAX_HISTORY = 6;
const UPSTREAM_TIMEOUT_MS = 25000;
const MAX_MESSAGE_CHARS = 2000;
const MAX_LINKS = 2;
// The model can only pick link KEYS out of this table (see
// _chatbot-faq-prompt.js's "Tenglar sem þú mátt vísa í") — never a free-text
// URL. Resolving here, from the same table the prompt was built from, means
// a hallucinated or malformed link can never reach a visitor.
const LINK_MAP = new Map(LINKS.map((l) => [l.key, { label: l.label, url: l.url }]));
// BJÖRNINN STUDIO (2026-10-27): the widget inside kitchen-planner.html sends
// { context: { app:"studio", where, step, room, ... } } — a small snapshot of
// where the customer is, never personal data. Only these keys survive, as short
// plain strings; it's rendered into the system prompt as data, not instructions.
const STUDIO_CONTEXT_KEYS = ["where", "step", "room", "rooms", "shape", "phase", "unit", "units", "materials", "view", "lang"];
const MAX_CONTEXT_CHARS = 200;
const STUDIO_LINK_MAP = new Map([...LINK_MAP].filter(([k]) => STUDIO_LINK_KEYS.includes(k)));

// One friendly text for every failure (credits out, 429/5xx, timeout, unparsable output). Never the raw upstream error.
const FALLBACK_ANSWER = "Því miður get ég ekki svarað núna. Hafðu samband við okkur beint og við hjálpum þér.";
const STUDIO_EMAIL = "bjorninn@bjorninninnrettingar.is";
const STAFF_FALLBACK_ANSWER = "Því miður get ég ekki svarað núna. Spurðu Ísak eða Rakel.";
const STUDIO_FALLBACK = {
  is: `Því miður get ég ekki svarað núna. Sendu okkur tölvupóst á ${STUDIO_EMAIL} og við hjálpum þér.`,
  en: `Sorry, I can't answer right now. Please email us at ${STUDIO_EMAIL} and we'll help you.`,
};
// The payload the widget gets instead of an error. `degraded` lets scripts (eval) tell it from a real answer.
export function fallbackPayload(kind, lang) {
  if (kind === "staff") return { answer: STAFF_FALLBACK_ANSWER, escalate: false, links: [], degraded: true };
  if (kind === "studio") return { answer: STUDIO_FALLBACK[lang === "en" ? "en" : "is"], escalate: true, links: [], degraded: true };
  const contact = LINK_MAP.get("samband");
  return { answer: FALLBACK_ANSWER, escalate: true, links: contact ? [contact] : [], degraded: true };
}

// Greetings / thanks need no model call (each one would otherwise cost a full cached-prompt read).
const GREETINGS = new Set(["hæ", "hæ hæ", "halló", "hallo", "sæl", "sæll", "sæl og blessuð", "góðan daginn", "góðan dag", "gott kvöld", "hello", "hi", "hey", "hæ hæ hæ", ""]);
const THANKS = new Set(["takk", "takk fyrir", "takk kærlega", "takk fyrir mig", "kærar þakkir", "þakka þér", "þakka þér fyrir", "bless", "bless bless", "ok takk", "ok", "ókei"]);
export function shortCircuit(text, kind) {
  const t = String(text || "").toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();
  const topic = kind === "staff" ? "þetta tól" : kind === "studio" ? "hönnunartólið" : "sérsmíði, verð eða ferlið";
  if (GREETINGS.has(t)) return { answer: `Hæ! Hvað viltu vita um ${topic}?`, escalate: false, links: [] };
  if (THANKS.has(t)) return { answer: "Verði þér að góðu! Spurðu endilega ef þú vilt vita meira.", escalate: false, links: [] };
  return null;
}

// Per-IP limiter (2026-10-28): every request is a paid Claude call and the endpoint is anonymous. In-memory per
// warm instance (best effort, like the other limiters here) — 20 per minute and 200 per day per IP.
const hits = new Map(); // ip -> [timestamps within the last 24 h]
export function chatRateLimited(ip, now = Date.now()) {
  const day = 24 * 60 * 60 * 1000;
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > day) hits.delete(k);
  const list = (hits.get(ip) || []).filter((t) => now - t < day);
  const lastMinute = list.filter((t) => now - t < 60 * 1000).length;
  if (lastMinute >= 20 || list.length >= 200) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  return false;
}
export function _resetChatLimiter() { hits.clear(); }
function clientIp(req) {
  const xf = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (chatRateLimited(clientIp(req))) {
    res.setHeader?.("Retry-After", "60");
    return res.status(429).json({ error: "Of margar fyrirspurnir", answer: FALLBACK_ANSWER, escalate: true, links: [] });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  const cleaned = validateMessages(req.body?.messages);
  if (cleaned.error) return res.status(400).json({ error: cleaned.error });
  // Staff tools (2026-10-30): context.app is one of STAFF_APPS → internal prompt, ONLY with a floor/office key
  // (or a piece token from a scanned label). Without it nothing is answered and no prompt text leaves the server.
  const staff = cleanStaffContext(req.body?.context);
  if (staff && !staffKeyOk(req.body?.k)) {
    return res.status(401).json({ error: "Floor key required", answer: STAFF_NO_KEY_ANSWER, escalate: false, links: [] });
  }
  const studio = staff ? null : cleanStudioContext(req.body?.context);
  const kind = staff ? "staff" : studio ? "studio" : "public";
  const lang = studio?.lang;
  const label = staff ? `staff:${staff.app}` : kind;

  if (!(studio && lang === "en")) {
    const quick = shortCircuit(cleaned.messages[cleaned.messages.length - 1].content, kind);
    if (quick) { console.log(JSON.stringify({ chat_usage: { bot: label, shortCircuit: true } })); return res.status(200).json(quick); }
  }
  if (!apiKey) { console.error("chat: ANTHROPIC_API_KEY not configured"); return res.status(200).json(fallbackPayload(kind, lang)); }

  // The static guide is the cached prefix (byte-identical every request); only the small per-question context
  // comes after the cache breakpoint. Public used to send a plain string, i.e. no caching at all.
  const system = staff
    ? [{ type: "text", text: buildStaffPrompt(staff.app), cache_control: { type: "ephemeral" } }, { type: "text", text: renderStaffContext(staff.app, staff.context) }]
    : studio
    ? [{ type: "text", text: buildStudioPrompt(), cache_control: { type: "ephemeral" } }, { type: "text", text: renderStudioContext(studio) }]
    : [{ type: "text", text: buildSystemPrompt(), cache_control: { type: "ephemeral" } }];

  const started = Date.now();
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), UPSTREAM_TIMEOUT_MS);
    let anthropicRes, data;
    try {
      anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          temperature: 0,
          system,
          messages: recentMessages(cleaned.messages),
        }),
        signal: ctl.signal,
      });
      data = await anthropicRes.json();
    } finally { clearTimeout(timer); }
    if (!anthropicRes.ok) throw new Error(`Anthropic ${anthropicRes.status}: ${data?.error?.type || ""} ${data?.error?.message || ""}`.trim());

    const u = data.usage || {};
    console.log(JSON.stringify({ chat_usage: { bot: label, input: u.input_tokens, cache_read: u.cache_read_input_tokens || 0, cache_creation: u.cache_creation_input_tokens || 0, output: u.output_tokens, stop: data.stop_reason, ms: Date.now() - started } }));

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const reply = parseModelReply(text, staff ? staffLinkMap() : studio ? STUDIO_LINK_MAP : LINK_MAP);
    if (reply.answer === FALLBACK_ANSWER) { console.error("chat: unparsable model output, stop=" + data.stop_reason); return res.status(200).json(fallbackPayload(kind, lang)); }
    return res.status(200).json(reply);
  } catch (err) {
    // Credits out (402/400 billing text), 429, 5xx, overload, network, timeout, garbage: log the real reason here only.
    console.error("chat: upstream failure — " + (err?.name === "AbortError" ? "timeout" : err?.message || err));
    return res.status(200).json(fallbackPayload(kind, lang));
  }
}

const STAFF_NO_KEY_ANSWER = "Þetta tæki er ekki tengt. Opnaðu verkstæðisappið í tækinu sem er parað við kerfið, eða spurðu Ísak.";
export function staffKeyOk(k) {
  if (typeof k !== "string" || !k) return false;
  return keyLevel(k) !== null || (isPieceTokenShape(k) && verifyPieceToken(k).ok);
}
// Staff context: { app, context } — app must be a known staff app, context is a short plain string from the page's
// data-context. Returns null for anything else (public / Studio paths never see this).
export function cleanStaffContext(ctx) {
  if (!ctx || typeof ctx !== "object" || typeof ctx.app !== "string" || !STAFF_APPS.includes(ctx.app)) return null;
  const c = typeof ctx.context === "string" ? ctx.context.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, MAX_CONTEXT_CHARS) : "";
  return { app: ctx.app, context: c };
}

export function cleanStudioContext(ctx) {
  if (!ctx || typeof ctx !== "object" || ctx.app !== "studio") return null;
  const out = {};
  for (const k of STUDIO_CONTEXT_KEYS) {
    const v = ctx[k];
    if (typeof v !== "string" && typeof v !== "number") continue;
    const s = String(v).replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, MAX_CONTEXT_CHARS);
    if (s) out[k] = s;
  }
  out.lang = out.lang === "en" ? "en" : "is";
  return out;
}

// Last MAX_HISTORY messages, never starting on an assistant turn (the API wants a user message first).
export function recentMessages(messages) {
  const out = messages.slice(-MAX_HISTORY);
  while (out.length > 1 && out[0].role !== "user") out.shift();
  return out;
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { error: "messages[] required" };
  }
  if (messages.length > MAX_MESSAGES) {
    return { error: "Too many messages" };
  }
  const cleaned = [];
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      return { error: "Invalid message shape" };
    }
    cleaned.push({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) });
  }
  // Claude's API requires alternation to start with "user" — trim a stray
  // leading assistant turn rather than erroring, since the widget always
  // opens with the visitor's own first message anyway.
  while (cleaned.length && cleaned[0].role !== "user") cleaned.shift();
  if (!cleaned.length || cleaned[cleaned.length - 1].role !== "user") {
    return { error: "Conversation must end with a user message" };
  }
  return { messages: cleaned };
}

// The model is instructed (see _chatbot-faq-prompt.js) to reply with ONLY
// {"answer","escalate"} JSON, but that's not guaranteed output from an LLM.
// Confirmed live during Phase 1 testing: on longer answers, claude-haiku-4-5
// sometimes appends stray trailing characters after the object closes (e.g.
// `{"answer": "...", "escalate": false}"}`) — a naive `text.match(/\{.*\}/)`
// greedily grabs through to the LAST "}" in the string, which includes that
// garbage and fails to parse too. A real reply got thrown away as a false
// escalation this way during testing. extractFirstJsonObject walks brace
// depth (tracking string/escape state so a "}" inside an answer string
// doesn't miscount) to find exactly where the first top-level object closes,
// ignoring anything after — robust to trailing garbage and to a stray code
// fence before the "{".
export function parseModelReply(text, linkMap = LINK_MAP) {
  // Icelandic quotes: the model opens with „ and sometimes closes with a plain " — which ends the JSON
  // string early (seen live in Studio answers quoting button names, 2026-10-27). Close them with “ instead.
  const repaired = text.replace(/„([^"„“\n]{0,80})"/g, "„$1“");
  for (const t of repaired === text ? [text] : [text, repaired]) {
    const candidate = extractFirstJsonObject(t);
    if (!candidate) continue;
    try {
      return normalizeReply(JSON.parse(candidate), linkMap);
    } catch {}
  }
  return { answer: FALLBACK_ANSWER, escalate: true, links: [] };
}

export function extractFirstJsonObject(text) {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function normalizeReply(obj, linkMap) {
  const hasAnswer = typeof obj.answer === "string" && obj.answer.trim().length > 0;
  const links = [];
  if (Array.isArray(obj.links)) {
    for (const key of obj.links) {
      const entry = linkMap.get(key);
      if (entry && !links.some((l) => l.url === entry.url)) links.push(entry);
      if (links.length >= MAX_LINKS) break;
    }
  }
  return {
    answer: hasAnswer ? obj.answer.trim() : FALLBACK_ANSWER,
    // Default to escalating when the field is missing/malformed — safer to
    // over-escalate (an extra "hafðu samband" offer) than to silently drop
    // a question the model couldn't actually answer.
    escalate: typeof obj.escalate === "boolean" ? obj.escalate : true,
    links: links,
  };
}
