// api/kp-drawings.js
// Kitchen planner (/skipuleggja) → drawings PDF onto the Tækifæri it just created.
// The browser builds the PDF itself (X-ray wall elevations, corner views, top view — it has the 3D
// scene) and POSTs the raw bytes here: POST /api/kp-drawings?recordId=recXXX, Content-Type
// application/octet-stream (the runtime drops an application/pdf body — req.body undefined, empty stream).
//
// This endpoint is open to the internet like /api/airtable, so it only ever writes ONE field and only
// on a record that (a) was created by the planner (its planner-JSON field is filled), (b) is less than
// 30 minutes old, and (c) doesn't already have a drawing — i.e. the submission that just happened.

const AIRTABLE_BASE = "app91U15z9K704Okd";
const PROJECTS_TABLE = "tbl4LMXlQjp66RFKI";                 // Tækifæri 📣 (projects)
const DRAWINGS_FIELD_ID = "fldO6cbhBV2FQTmLx";              // Teikningar úr skipuleggjara 📐
const DRAWINGS_FIELD_NAME = "Teikningar úr skipuleggjara 📐";
const PLANNER_JSON_FIELD = "Sjálfsafgreiðsla skipulag (JSON) 📐";
const MAX_AGE_MS = 30 * 60 * 1000;
const MAX_BYTES = 4.3 * 1024 * 1024;                          // Vercel's request body cap is 4.5 MB

async function readRaw(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BYTES) throw Object.assign(new Error("PDF er of stórt"), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: "AIRTABLE_TOKEN vantar" });

  const recordId = String((req.query || {}).recordId || "");
  if (!/^rec[A-Za-z0-9]{14}$/.test(recordId)) return res.status(400).json({ error: "Ógilt recordId" });

  // Vercel's runtime has usually buffered the body already (req.body = Buffer for a non-JSON type);
  // fall back to reading the stream ourselves if it hasn't.
  let pdf;
  try {
    pdf = Buffer.isBuffer(req.body) ? req.body : typeof req.body === "string" ? Buffer.from(req.body, "latin1") : await readRaw(req);
  } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  if (pdf.length > MAX_BYTES) return res.status(413).json({ error: "PDF er of stórt" });
  if (pdf.length < 100 || pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return res.status(400).json({ error: "Ekki PDF" });
  }

  const recRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROJECTS_TABLE}/${recordId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!recRes.ok) return res.status(404).json({ error: "Tækifæri fannst ekki" });
  const rec = await recRes.json();
  const f = rec.fields || {};
  if (!f[PLANNER_JSON_FIELD]) return res.status(403).json({ error: "Ekki innsending úr skipuleggjara" });
  if (Date.now() - Date.parse(rec.createdTime) > MAX_AGE_MS) return res.status(403).json({ error: "Of seint" });
  if (Array.isArray(f[DRAWINGS_FIELD_NAME]) && f[DRAWINGS_FIELD_NAME].length) {
    return res.status(409).json({ error: "Teikningar eru þegar komnar" });
  }

  const date = new Date().toISOString().slice(0, 10);
  const up = await fetch(
    `https://content.airtable.com/v0/${AIRTABLE_BASE}/${recordId}/${DRAWINGS_FIELD_ID}/uploadAttachment`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: `eldhus-teikningar-${date}.pdf`,
        contentType: "application/pdf",
        file: pdf.toString("base64"),
      }),
    }
  );
  if (!up.ok) return res.status(502).json({ error: `Airtable ${up.status}: ${await up.text()}` });
  return res.status(200).json({ ok: true, bytes: pdf.length });
}
