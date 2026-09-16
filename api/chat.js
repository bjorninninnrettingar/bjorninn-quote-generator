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

import { buildSystemPrompt, LINKS } from "./_chatbot-faq-prompt.js";
import { applyCors } from "./_cors.js";

const MODEL = process.env.CHATBOT_MODEL || "claude-haiku-4-5-20251001";
const MAX_TOKENS = 500;
// Bounds on the untrusted input this endpoint accepts, since every request
// costs a real Claude API call — cheap to check, expensive to skip.
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 2000;
const MAX_LINKS = 2;
// The model can only pick link KEYS out of this table (see
// _chatbot-faq-prompt.js's "Tenglar sem þú mátt vísa í") — never a free-text
// URL. Resolving here, from the same table the prompt was built from, means
// a hallucinated or malformed link can never reach a visitor.
const LINK_MAP = new Map(LINKS.map((l) => [l.key, { label: l.label, url: l.url }]));

const FALLBACK_ANSWER = "Því miður gat ég ekki svarað þessu núna. Endilega hafðu samband beint.";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  const cleaned = validateMessages(req.body?.messages);
  if (cleaned.error) return res.status(400).json({ error: cleaned.error });

  let anthropicRes;
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
        system: buildSystemPrompt(),
        messages: cleaned.messages,
      }),
    });
  } catch (err) {
    return res.status(502).json({ error: "Failed to reach Claude API" });
  }

  const data = await anthropicRes.json();
  if (!anthropicRes.ok) {
    return res.status(502).json({ error: data?.error?.message || "Claude API error" });
  }

  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  return res.status(200).json(parseModelReply(text));
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
function parseModelReply(text) {
  const candidate = extractFirstJsonObject(text);
  if (candidate) {
    try {
      return normalizeReply(JSON.parse(candidate));
    } catch {}
  }
  return { answer: FALLBACK_ANSWER, escalate: true, links: [] };
}

function extractFirstJsonObject(text) {
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

function normalizeReply(obj) {
  const hasAnswer = typeof obj.answer === "string" && obj.answer.trim().length > 0;
  const links = [];
  if (Array.isArray(obj.links)) {
    for (const key of obj.links) {
      const entry = LINK_MAP.get(key);
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
