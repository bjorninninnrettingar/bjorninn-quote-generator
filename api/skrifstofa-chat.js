// api/skrifstofa-chat.js — read-only helper chatbot for the office pages (2026-10-29, docs/skrifstofa-chat.md)
// POST { k, messages:[{role,content}] } -> { answer, links:[{label,url}] }
//
// - Requires the full VERK_KEY (body.k or x-verk-key); a floor token or a customer never gets in.
// - Claude gets exactly two tools, both GET-only against Airtable with the server-side PAT:
//     find_project(query)        T-number or name search in Tækifæri
//     list_active_projects()     won projects not yet delivered (framleiðsla / sein)
//   Nothing here can write, trigger an automation or send a message.
// - The model never writes a URL: it returns page KEYS (api/_skrifstofa-prompt.js PAGES) and project record ids
//   that a tool returned in THIS request; every link is built here.

import { isFullKey } from "./_auth.js";
import { PAGE_MAP, RECORD_ID_RE, buildSkrifstofaPrompt, projectLinks } from "./_skrifstofa-prompt.js";
import { extractFirstJsonObject } from "./chat.js";

const MODEL = process.env.SKRIFSTOFA_CHAT_MODEL || process.env.CHATBOT_MODEL || "claude-haiku-4-5-20251001";
const MAX_TOKENS = 700;
const MAX_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 1000;
const MAX_TOOL_ROUNDS = 4;
const MAX_PAGES = 2;
const MAX_PROJECTS = 3;
const MAX_QUERY_CHARS = 60;
const MAX_ROWS = 40;

const BASE = "https://api.airtable.com/v0/app91U15z9K704Okd";
const PROJECTS = "tbl4LMXlQjp66RFKI";
const WON = "🏆 Tækifæri unnið";
const DELIVER = "Má Afhenda 🚚";
const DONE = "Afhent (LOKIÐ ✅)";
const F = {
  name: "Heiti tækifæris / verkefnis",
  sala: "Staða í söluferli",
  skip: "Staða í skipulagi",
  fram: "Staða í framleiðslu",
  due: "Áætlaður afhendingardagur Björninn (internal)",
};
const FIELDS = [F.name, F.sala, F.skip, F.fram, F.due];
const FALLBACK = "Því miður gat ég ekki svarað þessu núna. Prófaðu aftur eða notaðu valmyndina til vinstri.";

export const TOOLS = [
  {
    name: "find_project",
    description: "Leitar að verkefni (Tækifæri) eftir T-númeri (t.d. T-32) eða hluta af nafni. Skilar allt að 5 verkefnum með nafni, stöðu í söluferli, skipulagi og framleiðslu og áætluðum afhendingardegi. Aðeins lestur.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "T-númer eða hluti af nafni, mest 60 stafir" } }, required: ["query"], additionalProperties: false },
  },
  {
    name: "list_active_projects",
    description: "Listar unnin verkefni sem eru ekki afhent enn (í skipulagi/framleiðslu), raðað eftir afhendingardegi, með flaggið late þegar afhendingardagur er liðinn. Aðeins lestur.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

// ── limiter (per IP, in-memory like api/chat.js) ──────────────────────────────────────────────────
const hits = new Map();
export function skrifstofaRateLimited(ip, now = Date.now()) {
  const day = 24 * 60 * 60 * 1000;
  if (hits.size > 2000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > day) hits.delete(k);
  const list = (hits.get(ip) || []).filter((t) => now - t < day);
  const lastMinute = list.filter((t) => now - t < 60 * 1000).length;
  if (lastMinute >= 15 || list.length >= 300) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  return false;
}
export function _resetSkrifstofaLimiter() { hits.clear(); }
const clientIp = (req) => String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim() || req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "unknown";

// ── input validation ──────────────────────────────────────────────────────────────────────────────
export function validateMessages(messages) {
  if (!Array.isArray(messages) || !messages.length) return { error: "messages[] required" };
  if (messages.length > MAX_MESSAGES) return { error: "Too many messages" };
  const out = [];
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return { error: "Invalid message shape" };
    out.push({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) });
  }
  while (out.length && out[0].role !== "user") out.shift();
  if (!out.length || out[out.length - 1].role !== "user") return { error: "Conversation must end with a user message" };
  return { messages: out };
}

// Search term -> safe, lower-cased text for a formula string literal (letters, digits, space, - . only).
export function cleanQuery(q) {
  const s = String(q == null ? "" : q).normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N} .\-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_CHARS);
  return s;
}
export function searchFormula(q) {
  const s = cleanQuery(q);
  if (s.length < 2) return null;
  const n = `LOWER({${F.name}})`;
  const t = /^t-?(\d{1,4})$/.exec(s);
  // "t-3" must not match "t-32": match the number followed by a space / end of the name's first token
  if (t) return `OR(FIND("t-${t[1]} ",${n}&" ")=1,FIND("t${t[1]} ",${n}&" ")=1)`;
  return `SEARCH("${s}",${n})`;
}

// ── Airtable read (GET only) ──────────────────────────────────────────────────────────────────────
async function airtableGet(params) {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) throw new Error("AIRTABLE_TOKEN not configured");
  const url = new URL(`${BASE}/${PROJECTS}`);
  for (const [k, v] of params) url.searchParams.append(k, v);
  FIELDS.forEach((f) => url.searchParams.append("fields[]", f));
  const r = await fetch(url.toString().replace(/\+/g, "%20"), { method: "GET", headers: { Authorization: `Bearer ${token}` } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Airtable " + r.status);
  return data;
}

const d10 = (v) => (v ? String(v).slice(0, 10) : "");
const tNumber = (name) => { const m = /^\s*(T-?\d+)/i.exec(String(name || "")); return m ? m[1].toUpperCase().replace(/^T(\d)/, "T-$1") : ""; };
const strip = (v) => (v == null ? "" : String(v));

export function shapeProject(rec, today) {
  const f = rec.fields || {};
  const due = d10(f[F.due]);
  return {
    id: rec.id,
    nafn: strip(f[F.name]),
    t: tNumber(f[F.name]),
    soluferli: strip(f[F.sala]),
    skipulag: strip(f[F.skip]),
    framleidsla: strip(f[F.fram]),
    afhending: due,
    late: !!(due && due < today && f[F.fram] !== DONE && f[F.fram] !== DELIVER),
  };
}

export async function runTool(name, input, today) {
  if (name === "find_project") {
    const formula = searchFormula(input && input.query);
    if (!formula) return { error: "query too short" };
    const data = await airtableGet([["filterByFormula", formula], ["maxRecords", "5"]]);
    return { projects: (data.records || []).map((r) => shapeProject(r, today)) };
  }
  if (name === "list_active_projects") {
    const formula = `AND({${F.sala}}="${WON}",{${F.fram}}!="${DONE}")`;
    let rows = [];
    let offset;
    for (let i = 0; i < 3; i++) {
      const p = [["filterByFormula", formula], ["pageSize", "100"]];
      if (offset) p.push(["offset", offset]);
      const data = await airtableGet(p);
      rows = rows.concat(data.records || []);
      offset = data.offset;
      if (!offset) break;
    }
    const shaped = rows.map((r) => shapeProject(r, today)).sort((a, b) => (a.afhending || "9").localeCompare(b.afhending || "9"));
    return { total: shaped.length, late: shaped.filter((p) => p.late).length, projects: shaped.slice(0, MAX_ROWS) };
  }
  return { error: "unknown tool" };
}

// Final model JSON -> { answer, links }. Only whitelisted page keys and ids a tool returned this request survive.
export function buildReply(text, seen) {
  // Icelandic „…" quotes the model closes with a plain " would end the JSON string early (same repair as api/chat.js)
  const repaired = text.replace(/„([^"„“\n]{0,80})"/g, "„$1“");
  let obj = null;
  for (const t of repaired === text ? [text] : [text, repaired]) {
    const c = extractFirstJsonObject(t);
    if (!c) continue;
    try { obj = JSON.parse(c); break; } catch {}
  }
  if (!obj || typeof obj !== "object") return { answer: FALLBACK, links: [] };
  const answer = typeof obj.answer === "string" && obj.answer.trim() ? obj.answer.trim() : FALLBACK;
  const links = [];
  const add = (l) => { if (l && !links.some((x) => x.url === l.url)) links.push(l); };
  for (const id of (Array.isArray(obj.projects) ? obj.projects : []).slice(0, MAX_PROJECTS)) {
    if (typeof id !== "string" || !RECORD_ID_RE.test(id) || !seen.has(id)) continue;
    projectLinks(seen.get(id)).forEach(add);
  }
  for (const key of (Array.isArray(obj.pages) ? obj.pages : []).slice(0, MAX_PAGES)) {
    const p = typeof key === "string" ? PAGE_MAP.get(key) : null;
    if (p) add({ label: p.label + " →", url: p.url });
  }
  return { answer, links };
}

async function callClaude(apiKey, system, messages) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, temperature: 0, system, tools: TOOLS, messages }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || "Claude API error");
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const k = String(req.body?.k || req.headers?.["x-verk-key"] || "");
  if (!isFullKey(k)) return res.status(403).json({ error: "Forbidden" });
  if (skrifstofaRateLimited(clientIp(req))) {
    res.setHeader?.("Retry-After", "60");
    return res.status(429).json({ error: "Of margar fyrirspurnir", answer: FALLBACK, links: [] });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  const cleaned = validateMessages(req.body?.messages);
  if (cleaned.error) return res.status(400).json({ error: cleaned.error });

  const today = new Date().toISOString().slice(0, 10);
  const system = [{ type: "text", text: buildSkrifstofaPrompt(today) }];
  const convo = cleaned.messages.slice();
  const seen = new Map(); // record id -> shaped project, from tool results of THIS request only
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const data = await callClaude(apiKey, system, convo);
      const uses = (data.content || []).filter((b) => b.type === "tool_use");
      if (data.stop_reason !== "tool_use" || !uses.length || round === MAX_TOOL_ROUNDS) {
        const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
        return res.status(200).json(buildReply(text, seen));
      }
      convo.push({ role: "assistant", content: data.content });
      const results = [];
      for (const u of uses) {
        let out;
        try {
          out = await runTool(u.name, u.input || {}, today);
          (out.projects || []).forEach((p) => seen.set(p.id, p));
        } catch (e) {
          out = { error: "Uppflettingin mistókst" };
        }
        results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out) });
      }
      convo.push({ role: "user", content: results });
    }
  } catch (e) {
    return res.status(502).json({ error: "Failed to reach Claude API", answer: FALLBACK, links: [] });
  }
  return res.status(200).json({ answer: FALLBACK, links: [] });
}
