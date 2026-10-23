// api/kp-studio.js
// ✨ Studio mynd → Tækifæri "Studio myndir 📸" (2026-10-23, H5). The browser path-traces the photo itself and POSTs
// the JPEG bytes: POST /api/kp-studio?recordId=recXXX[&k=<VERK_KEY>], Content-Type application/octet-stream.
//   • with the key (PRO "Vista á Tækifæri"): any Tækifæri; the field keeps the newest MAX_KEEP photos.
//   • without it (the customer's photos, sent right after their own submission): like /api/kp-drawings, only a
//     record the planner created (planner JSON filled) less than 30 minutes ago, and at most MAX_PUBLIC photos.
// One field only, JPEG only.

const AIRTABLE_BASE = "app91U15z9K704Okd";
const PROJECTS = "tbl4LMXlQjp66RFKI";
const FIELD_ID = "fldTzXvmfE1kaiuPN";                // Studio myndir 📸
const FIELD_NAME = "Studio myndir 📸";
const PLANNER_JSON_FIELD = "Sjálfsafgreiðsla skipulag (JSON) 📐";
const PROJECT_NAME = "Heiti tækifæris / verkefnis";
const MAX_AGE_MS = 30 * 60 * 1000;
const MAX_BYTES = 4.3 * 1024 * 1024;
export const MAX_KEEP = 12, MAX_PUBLIC = 3;

async function readRaw(req) {
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BYTES) throw Object.assign(new Error("Myndin er of stór"), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

export function fileName(projectName, stamp) {
  const prefix = String(projectName || "").split("|")[0].trim().replace(/[^A-Za-z0-9-]/g, "") || "verkefni";
  return `${prefix} studio ${stamp}.jpg`;
}

export default async function handler(req, res, fetchImpl = fetch) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const token = process.env.AIRTABLE_TOKEN, key = process.env.VERK_KEY;
  if (!token) return res.status(500).json({ error: "AIRTABLE_TOKEN vantar" });
  const q = req.query || {};
  const pro = !!q.k;
  if (pro && (!key || String(q.k) !== key)) return res.status(403).json({ error: "Rangur lykill" });
  const recordId = String(q.recordId || "");
  if (!/^rec[A-Za-z0-9]{14}$/.test(recordId)) return res.status(400).json({ error: "Ógilt recordId" });

  let jpg;
  try { jpg = Buffer.isBuffer(req.body) ? req.body : typeof req.body === "string" ? Buffer.from(req.body, "latin1") : await readRaw(req); }
  catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  if (jpg.length > MAX_BYTES) return res.status(413).json({ error: "Myndin er of stór" });
  if (jpg.length < 100 || jpg[0] !== 0xff || jpg[1] !== 0xd8) return res.status(400).json({ error: "Ekki JPEG" });

  const auth = { Authorization: `Bearer ${token}` };
  const recRes = await fetchImpl(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROJECTS}/${recordId}`, { headers: auth });
  if (!recRes.ok) return res.status(404).json({ error: "Tækifæri fannst ekki" });
  const rec = await recRes.json(), f = rec.fields || {};
  const have = Array.isArray(f[FIELD_NAME]) ? f[FIELD_NAME].length : 0;
  if (!pro) {
    if (!f[PLANNER_JSON_FIELD]) return res.status(403).json({ error: "Ekki innsending úr skipuleggjara" });
    if (Date.now() - Date.parse(rec.createdTime) > MAX_AGE_MS) return res.status(403).json({ error: "Of seint" });
    if (have >= MAX_PUBLIC) return res.status(409).json({ error: "Myndirnar eru þegar komnar" });
  }

  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", "");
  const up = await fetchImpl(`https://content.airtable.com/v0/${AIRTABLE_BASE}/${recordId}/${FIELD_ID}/uploadAttachment`, {
    method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, auth),
    body: JSON.stringify({ filename: fileName(f[PROJECT_NAME], stamp), contentType: "image/jpeg", file: jpg.toString("base64") }),
  });
  if (!up.ok) return res.status(502).json({ error: `Airtable ${up.status}: ${(await up.text()).slice(0, 300)}` });
  // uploadAttachment appends: past MAX_KEEP, drop the oldest (the front of the list)
  const list = (((await up.json()).fields || {})[FIELD_ID]) || [];
  if (list.length > MAX_KEEP) {
    const p = await fetchImpl(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROJECTS}/${recordId}`, {
      method: "PATCH", headers: Object.assign({ "Content-Type": "application/json" }, auth),
      body: JSON.stringify({ fields: { [FIELD_ID]: list.slice(-MAX_KEEP).map((a) => ({ id: a.id })) } }),
    });
    if (!p.ok) return res.status(502).json({ error: `Airtable ${p.status} (eldri myndir ekki fjarlægðar)` });
  }
  return res.status(200).json({ ok: true, bytes: jpg.length, count: Math.min(list.length, MAX_KEEP) });
}
