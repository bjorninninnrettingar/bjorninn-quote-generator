// api/kp-workdraw.js
// PRO "📐 Teikningar → 💾 Vista á Tækifæri" (2026-10-23): the browser renders the A3 work-drawing sheets
// (kitchen-planner-workdraw.js) into a PDF and POSTs the raw bytes here:
//   POST /api/kp-workdraw?recordId=recXXX&k=<VERK_KEY>, Content-Type application/octet-stream
// → Tækifæri "Vinnuteikningar (drög) 📐". These are DRAFTS (user, 2026-10-23): the newest replaces the older one,
// so the field always holds exactly one, current PDF. When the job is confirmed and polished they're moved to
// "Loka teikningar verkefnis 📋" by hand — the drawings the job is built from. Behind VERK_KEY.

const AIRTABLE_BASE = "app91U15z9K704Okd";
const PROJECTS = "tbl4LMXlQjp66RFKI";
const FIELD_ID = "fld7EnKg6thzULUYj";             // Vinnuteikningar (drög) 📐
const PROJECT_NAME = "Heiti tækifæris / verkefnis";
const MAX_BYTES = 4.3 * 1024 * 1024;              // Vercel's request body cap is 4.5 MB

async function readRaw(req) {
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BYTES) throw Object.assign(new Error("PDF er of stórt"), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

export function fileName(projectName, date) {
  const prefix = String(projectName || "").split("|")[0].trim().replace(/[^A-Za-z0-9-]/g, "") || "verkefni";
  return `${prefix} vinnuteikningar drog ${date}.pdf`;
}

export default async function handler(req, res, fetchImpl = fetch) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const token = process.env.AIRTABLE_TOKEN, key = process.env.VERK_KEY;
  if (!token || !key) return res.status(500).json({ error: "AIRTABLE_TOKEN / VERK_KEY vantar" });
  const q = req.query || {};
  if (String(q.k || "") !== key) return res.status(403).json({ error: "Rangur lykill" });
  const recordId = String(q.recordId || "");
  if (!/^rec[A-Za-z0-9]{14}$/.test(recordId)) return res.status(400).json({ error: "Ógilt recordId" });

  let pdf;
  try { pdf = Buffer.isBuffer(req.body) ? req.body : typeof req.body === "string" ? Buffer.from(req.body, "latin1") : await readRaw(req); }
  catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  if (pdf.length > MAX_BYTES) return res.status(413).json({ error: "PDF er of stórt" });
  if (pdf.length < 100 || pdf.subarray(0, 5).toString("latin1") !== "%PDF-") return res.status(400).json({ error: "Ekki PDF" });

  const auth = { Authorization: `Bearer ${token}` };
  const rec = await fetchImpl(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROJECTS}/${recordId}`, { headers: auth });
  if (!rec.ok) return res.status(404).json({ error: "Tækifæri fannst ekki" });
  const name = ((await rec.json()).fields || {})[PROJECT_NAME];

  const up = await fetchImpl(`https://content.airtable.com/v0/${AIRTABLE_BASE}/${recordId}/${FIELD_ID}/uploadAttachment`, {
    method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, auth),
    body: JSON.stringify({ filename: fileName(name, new Date().toISOString().slice(0, 10)), contentType: "application/pdf", file: pdf.toString("base64") }),
  });
  if (!up.ok) return res.status(502).json({ error: `Airtable ${up.status}: ${(await up.text()).slice(0, 300)}` });
  // uploadAttachment APPENDS — keep only the one just uploaded (it's the last in the returned list)
  const list = (((await up.json()).fields || {})[FIELD_ID]) || [];
  if (list.length > 1) {
    const keep = list[list.length - 1];
    const p = await fetchImpl(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROJECTS}/${recordId}`, {
      method: "PATCH", headers: Object.assign({ "Content-Type": "application/json" }, auth),
      body: JSON.stringify({ fields: { [FIELD_ID]: [{ id: keep.id }] } }),
    });
    if (!p.ok) return res.status(502).json({ error: `Airtable ${p.status} (eldri drög ekki fjarlægð)` });
  }
  return res.status(200).json({ ok: true, bytes: pdf.length });
}
