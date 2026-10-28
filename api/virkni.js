// api/virkni.js — Tilkynningar v1 (2026-10-27)
// One activity feed for the whole company: Virkni 🔔 in Airtable. The app writes a line
// itself when something happens in the app (Klárt til framleiðslu, Quick Fix, efni komið…);
// Airtable's own "🔔 Virkni-logg — Stöður" automation writes the status lines. The 🔔 bell
// in /skrifstofa and /app reads it from here.
//
// GET  ?k=&til=Skrifstofa|Verkstæði[&t=recProject]  → { items: [...] } newest first
// POST { k, texti, tegund, til, t?, tengill?, hver?, chat? } → { ok, id, chat }
//
// Both need VERK_KEY. Google Chat is sent from HERE, never from the browser: the webhook
// URLs live in Vercel env vars (GOOGLE_CHAT_WEBHOOK_ALMENNT for Verkstæði/Allir,
// GOOGLE_CHAT_WEBHOOK_SKRIFSTOFA for Skrifstofa). A missing var just means no chat post —
// the Virkni line is still written. Chat text is built server-side from validated fields,
// the link is always a relative app path on our own origin, and chat posts are rate limited.

import { checkFloorOrFullKey } from "./_auth.js";

const BASE = "https://api.airtable.com/v0/app91U15z9K704Okd";
const VIRKNI = "tblPPMTlFhW0snk24";
const PROJECTS = "tbl4LMXlQjp66RFKI";
const ORIGIN = "https://bjorninn.vercel.app";

export const TIL = ["Skrifstofa", "Verkstæði", "Allir"];
export const TEGUND = ["staða", "klart", "quickfix", "efni", "cnc", "afhending", "seint", "til_baka", "annað"];
// Only these may go to Google Chat — a status echo or "annað" never pings a room.
export const CHAT_TEGUND = ["klart", "quickfix", "efni", "cnc", "afhending", "seint", "til_baka"];
const FLOKKUR_FOR = { klart: "Skipulag", til_baka: "Skipulag", efni: "Skipulag", cnc: "Framleiðsla", quickfix: "Framleiðsla", afhending: "Framleiðsla", seint: "Framleiðsla" };

// Which lines each role sees. An empty Til (all lines from before 2026-10-27) = Skrifstofa.
export function visibleTo(role, til) {
  const t = til || "Skrifstofa";
  if (t === "Allir") return true;
  return t === role;
}

// A link is an in-app path only: "/verk?t=rec…", "/app#qf". No host, no scheme, no key.
export function cleanLink(s) {
  if (s == null || s === "") return "";
  s = String(s);
  if (!/^\/[A-Za-z0-9\-_/?=&#.%]*$/.test(s) || s.startsWith("//") || /[?&]k=/.test(s) || s.length > 200) return null;
  return s;
}

export function chatText({ texti, projectName, hver, tengill }) {
  const lines = ["🔔 *" + texti + "*"];
  if (projectName) lines.push(projectName);
  if (hver) lines.push("— " + hver);
  if (tengill) lines.push("<" + ORIGIN + tengill + "|Opna í appinu>");
  return lines.join("\n");
}

const chatTimes = [];
export function chatAllowed(now = Date.now()) {
  while (chatTimes.length && now - chatTimes[0] > 10 * 60 * 1000) chatTimes.shift();
  if (chatTimes.length >= 30) return false;
  chatTimes.push(now);
  return true;
}

async function at(path, opts = {}) {
  const r = await fetch(`${BASE}/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(body?.error?.message || `Airtable ${r.status}`), { status: r.status });
  return body;
}

function toItem(r) {
  const f = r.fields || {};
  const link = f["Tengill"] ? String(f["Tengill"]).replace(ORIGIN, "") : "";
  return {
    id: r.id,
    texti: f["Texti"] || "",
    timi: f["Tími"] || r.createdTime || "",
    flokkur: f["Flokkur"] || "",
    tegund: f["Tegund"] || "",
    til: f["Til"] || "",
    tengill: cleanLink(link) || "",
    hver: f["Hver"] || "",
    t: (f["Tækifæri"] || [])[0] || "",
  };
}

// Posts to the Google Chat room for `til` from the env webhook. Never throws.
// Returns "sent" | "no-webhook" | "bad-webhook" | "rate-limited" | "failed".
export async function sendChat(til, text) {
  try {
    const hook = til === "Skrifstofa" ? process.env.GOOGLE_CHAT_WEBHOOK_SKRIFSTOFA : process.env.GOOGLE_CHAT_WEBHOOK_ALMENNT;
    if (!hook) return "no-webhook";
    if (!/^https:\/\/chat\.googleapis\.com\//.test(hook)) return "bad-webhook";
    if (!chatAllowed()) return "rate-limited";
    const r = await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify({ text }) });
    return r.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

// Server-side writer for other endpoints (verk-status, cron). Fields must already be valid;
// never throws — a missing Virkni line must not fail the action that caused it.
// chat:true also posts to Google Chat (trusted server callers only; any tegund) — a missing webhook env is silent.
export async function addLine({ texti, tegund, til, t, tengill, hver, chat, projectName }) {
  let id = null;
  if (!process.env.AIRTABLE_TOKEN) return null; // not configured (tests, local): no line, no chat, no error
  try {
    const fields = { "Texti": String(texti).slice(0, 300), "Tegund": tegund, "Til": til, "Flokkur": FLOKKUR_FOR[tegund] || "Framleiðsla" };
    if (t) fields["Tækifæri"] = [t];
    if (tengill) fields["Tengill"] = ORIGIN + tengill;
    if (hver) fields["Hver"] = hver;
    const rec = await at(VIRKNI, { method: "POST", body: JSON.stringify({ fields }) });
    id = rec.id;
  } catch (e) {
    console.error("virkni addLine:", e.message);
  }
  if (chat === true) await sendChat(til, chatText({ texti: String(texti).slice(0, 300), projectName, hver, tengill }));
  return id;
}

async function list(req, res) {
  const q = req.query || {};
  // "Allt" = the /skrifstofa Virkni panel, which filters client-side (Allt / Mitt / Verkstæði / Skrifstofa).
  const role = q.til === "Verkstæði" ? "Verkstæði" : q.til === "Allt" ? "Allt" : "Skrifstofa";
  const t = q.t && /^rec[A-Za-z0-9]{14}$/.test(q.t) ? q.t : "";
  const qs = ["pageSize=100", "sort%5B0%5D%5Bfield%5D=" + encodeURIComponent("Tími"), "sort%5B0%5D%5Bdirection%5D=desc"]
    .concat(["Texti", "Tími", "Flokkur", "Tegund", "Til", "Tengill", "Hver", "Tækifæri"].map((f) => "fields%5B%5D=" + encodeURIComponent(f)))
    .join("&");
  const d = await at(`${VIRKNI}?${qs}`);
  const items = (d.records || []).map(toItem)
    .filter((it) => role === "Allt" || visibleTo(role, it.til))
    .filter((it) => !t || it.t === t)
    .slice(0, 50);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ items });
}

async function create(req, res) {
  const b = req.body || {};
  const texti = String(b.texti || "").trim().slice(0, 300);
  if (!texti) return res.status(400).json({ error: "Texti vantar" });
  const tegund = TEGUND.includes(b.tegund) ? b.tegund : null;
  if (!tegund) return res.status(400).json({ error: "Ógild tegund" });
  const til = TIL.includes(b.til) ? b.til : null;
  if (!til) return res.status(400).json({ error: "Ógilt Til" });
  const tengill = cleanLink(b.tengill);
  if (tengill === null) return res.status(400).json({ error: "Ógildur tengill" });
  const t = b.t ? String(b.t) : "";
  if (t && !/^rec[A-Za-z0-9]{14}$/.test(t)) return res.status(400).json({ error: "Ógilt verk" });
  const hver = String(b.hver || "").trim().slice(0, 60);

  let projectName = "";
  if (t) {
    try {
      const p = await at(`${PROJECTS}/${t}?fields%5B%5D=${encodeURIComponent("Heiti tækifæris / verkefnis")}`);
      projectName = p.fields?.["Heiti tækifæris / verkefnis"] || "";
    } catch {
      return res.status(404).json({ error: "Verkið fannst ekki" });
    }
  }

  const fields = { "Texti": texti, "Tegund": tegund, "Til": til, "Flokkur": FLOKKUR_FOR[tegund] || "Framleiðsla" };
  if (t) fields["Tækifæri"] = [t];
  if (tengill) fields["Tengill"] = ORIGIN + tengill;
  if (hver) fields["Hver"] = hver;
  const rec = await at(VIRKNI, { method: "POST", body: JSON.stringify({ fields }) });

  let chat = "off";
  if (b.chat === true && CHAT_TEGUND.includes(tegund)) chat = await sendChat(til, chatText({ texti, projectName, hver, tengill }));
  return res.status(200).json({ ok: true, id: rec.id, chat });
}

export default async function handler(req, res) {
  const k = req.method === "GET" ? (req.query || {}).k : (req.body || {}).k;
  if (!checkFloorOrFullKey(k)) return res.status(403).json({ error: "Ógildur lykill" });
  try {
    if (req.method === "GET") return await list(req, res);
    if (req.method === "POST") return await create(req, res);
    return res.status(405).json({ error: "GET eða POST" });
  } catch (e) {
    console.error("virkni:", e);
    return res.status(500).json({ error: e.message });
  }
}
