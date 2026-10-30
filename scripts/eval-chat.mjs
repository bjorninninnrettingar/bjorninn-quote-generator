// `npm run eval:chat` — asks the chatbots a fixed set of questions and checks each answer for its key fact, plus
// that no answer leaks a PIN-like number, a kennitala, pay figures (staff bots) or a phone number.
//
//   node scripts/eval-chat.mjs [--static] [--drafts] [--app labels] [--bot staff|studio|public] [--url http://localhost:4322]
//
// SAFE BY CONSTRUCTION: by default the chat handler (api/chat.js) is imported and called IN-PROCESS — nothing goes to
// bjorninn.vercel.app, and chat.js itself never writes to Airtable (the widget does the logging, not this script).
// The only network call is Anthropic's API, with ANTHROPIC_API_KEY from the environment or .env.local. Without a
// key it runs the static checks only and says so. --url accepts a LOCAL server only (localhost / 127.0.0.1).
// Staff questions use a throwaway key generated here, never the real VERK_KEY. --drafts switches on the draft FAQ
// answers (CHATBOT_INCLUDE_DRAFTS=1) so the Studio questions on the public bot are checked too.
import fs from "node:fs";
import crypto from "node:crypto";
import { CASES, staticProblems } from "./eval-chat-cases.mjs";
import { STAFF_LINKS } from "../api/_chatbot-staff-prompts.js";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };

// tiny .env.local reader — only the one key we need, never printed
function envLocal(name) {
  try {
    const m = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
  } catch { return ""; }
}
if (!process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = envLocal("ANTHROPIC_API_KEY");
const DRAFTS = flag("drafts");
if (DRAFTS) process.env.CHATBOT_INCLUDE_DRAFTS = "1";
const TEST_KEY = "eval-" + crypto.randomBytes(12).toString("hex");
process.env.VERK_KEY = TEST_KEY;

const URL_ARG = opt("url");
if (URL_ARG && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/.test(URL_ARG)) {
  console.error("Refusing: --url must be a local server (localhost / 127.0.0.1). This script never calls production /api/chat.");
  process.exit(2);
}

const LEAK = {
  all: [/\b\d{6}-?\d{4}\b/, /\b\d{3}[ -]\d{4}\b/],           // kennitala-like, phone-like
  staff: [/\b\d{4,}\b/, /\d[\d.]*\s?(kr\b|krónur)/i, /@[a-z0-9-]+\.[a-z]{2,}/i], // PIN-like numbers, pay amounts, emails
};

// Sum the per-request usage the handler logs (chat_usage) so the run prints real token / cost totals.
const USAGE = { n: 0, input: 0, cache_read: 0, cache_creation: 0, output: 0, short: 0 };
const realLog = console.log;
console.log = (...a) => {
  if (typeof a[0] === "string" && a[0].startsWith('{"chat_usage"')) {
    const u = JSON.parse(a[0]).chat_usage;
    if (u.shortCircuit) USAGE.short++; else { USAGE.n++; for (const k of ["input", "cache_read", "cache_creation", "output"]) USAGE[k] += u[k] || 0; }
    return;
  }
  realLog(...a);
};
function usageSummary() {
  const cents = (USAGE.input * 1 + USAGE.cache_read * 0.1 + USAGE.cache_creation * 1.25 + USAGE.output * 5) / 1e6 * 100; // Haiku 4.5 $/MTok
  return `Usage: ${USAGE.n} model calls (+${USAGE.short} short-circuited) — input ${USAGE.input}, cache_read ${USAGE.cache_read}, cache_write ${USAGE.cache_creation}, output ${USAGE.output} tokens ≈ ${cents.toFixed(1)}¢ (${USAGE.n ? (cents / USAGE.n).toFixed(2) : 0}¢ per answer)`;
}

function fakeRes() {
  return { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; }, end() { return this; } };
}
let ipN = 0;
async function ask(c, handler) {
  const body = { messages: [{ role: "user", content: c.q }] };
  if (c.bot === "staff") { body.context = { app: c.app, context: "eval" }; body.k = TEST_KEY; }
  if (c.bot === "studio") body.context = { app: "studio", ...(c.ctx || {}) };
  if (URL_ARG) {
    const r = await fetch(URL_ARG.replace(/\/$/, "") + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j?.degraded) throw new Error("API unavailable — the bot returned its friendly fallback");
    return j;
  }
  const res = fakeRes();
  await handler({ method: "POST", headers: { "x-forwarded-for": `10.77.${(ipN >> 8) & 255}.${ipN++ & 255}` }, body }, res);
  if (res.code !== 200 && !res.body?.answer) throw new Error(`HTTP ${res.code}: ${res.body?.error || ""}`);
  if (res.body?.degraded) throw new Error("API unavailable — the bot returned its friendly fallback (see the server error log; credits? key?)");
  return res.body;
}

function judge(c, r) {
  const a = String(r.answer || "");
  const problems = [];
  if (!c.expect.some((t) => a.toLowerCase().includes(t.toLowerCase()))) problems.push(`missing key phrase (${c.expect.join(" | ")})`);
  if (typeof c.escalate === "boolean" && r.escalate !== c.escalate) problems.push(`escalate=${r.escalate}, wanted ${c.escalate}`);
  if (c.links) {
    const url = STAFF_LINKS.find((l) => l.key === c.links)?.url;
    if (!(r.links || []).some((l) => l.url === url)) problems.push(`link "${c.links}" not offered`);
  }
  for (const re of c.forbid || []) if (re.test(a)) problems.push(`forbidden: ${re}`);
  for (const re of [...LEAK.all, ...(c.bot === "staff" ? LEAK.staff : [])]) if (re.test(a)) problems.push(`LEAK ${re}`);
  return problems;
}

const sp = staticProblems();
console.log(`Static checks: ${sp.length ? sp.length + " problem(s)" : "all " + CASES.length + " cases have their key fact in the bot's knowledge"}`);
sp.forEach((p) => console.log("  ✖ " + p));
if (sp.length) process.exitCode = 1;

if (flag("static") || (!process.env.ANTHROPIC_API_KEY && !URL_ARG)) {
  console.log(flag("static") ? "--static: live answers NOT exercised." : "No ANTHROPIC_API_KEY (env or .env.local): live answers NOT exercised — only the static checks ran.");
  process.exit(process.exitCode || 0);
}

const { default: handler, _resetChatLimiter } = await import("../api/chat.js");
const want = CASES.filter((c) => (!opt("app") || c.app === opt("app")) && (!opt("bot") || c.bot === opt("bot")) && (DRAFTS || !c.needsDrafts));
console.log(`Live: ${want.length} questions via ${URL_ARG ? URL_ARG : "in-process handler"}${DRAFTS ? " (drafts ON)" : ""}\n`);
let fail = 0, n = 0;
const queue = [...want];
async function worker() {
  while (queue.length) {
    const c = queue.shift();
    _resetChatLimiter();
    let line, problems;
    try { const r = await ask(c, handler); problems = judge(c, r); line = r.answer; }
    catch (e) {
      if (/credit balance|invalid x-api-key|authentication|API unavailable/i.test(e.message)) { console.error(`\nAborted — the Anthropic API refused the key: ${e.message}`); process.exit(3); }
      problems = [`call failed: ${e.message}`]; line = "";
    }
    n++;
    const tag = `${c.bot}${c.app ? ":" + c.app : ""}`;
    if (problems.length) { fail++; console.log(`✖ [${tag}] ${c.q}\n    ${problems.join("; ")}\n    → ${String(line).slice(0, 300)}`); }
    else console.log(`✔ [${tag}] ${c.q}`);
  }
}
await Promise.all([worker(), worker(), worker()]);
console.log(`\n${n - fail}/${n} passed${fail ? `, ${fail} FAILED` : ""}`);
console.log(usageSummary());
process.exit(fail || process.exitCode ? 1 : 0);
