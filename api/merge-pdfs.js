// api/merge-pdfs.js
// Björninn ehf. — Merge final drawings into one "loka prent" PDF
// pdf-lib, pure JS, no native deps. Mirrors generate-quote.js's Airtable plumbing.

import { PDFDocument } from "pdf-lib";

const AIRTABLE_BASE      = "app91U15z9K704Okd";
const PROJECTS_TABLE     = "tbl4LMXlQjp66RFKI"; // Tækifæri 📣 (projects)
const SOURCE_FIELD_NAME  = "Loka teikningar verkefnis 📋";
const DEST_FIELD_ID      = "fldlTmH5X3G3e5rU2"; // Loka prent 🖨️✅
const PROJECT_NAME_FIELD = "Heiti tækifæris / verkefnis";

// ── Airtable ──────────────────────────────────────────────────────────────────

async function airtableFetch(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getProject(token, recordId) {
  const data = await airtableFetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROJECTS_TABLE}/${recordId}`,
    token
  );
  return data.fields;
}

async function clearDest(token, recordId) {
  const res = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE}/${PROJECTS_TABLE}/${recordId}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { [DEST_FIELD_ID]: [] } }),
    }
  );
  if (!res.ok) console.warn(`clearDest: ${res.status} ${await res.text()}`);
}

async function uploadPdf(token, recordId, pdfBytes, filename) {
  const res = await fetch(
    `https://content.airtable.com/v0/${AIRTABLE_BASE}/${recordId}/${DEST_FIELD_ID}/uploadAttachment`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filename,
        contentType: "application/pdf",
        file: Buffer.from(pdfBytes).toString("base64"),
      }),
    }
  );
  if (!res.ok) throw new Error(`Upload ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Merge ─────────────────────────────────────────────────────────────────────

function isPdfAttachment(att) {
  return att.type === "application/pdf" || /\.pdf$/i.test(att.filename || "");
}

// Attachments merge in the order Airtable returns them, i.e. the order they're
// arranged in on the record — so arranging them there controls page order here.
async function mergePdfs(attachments) {
  const merged = await PDFDocument.create();
  for (const att of attachments) {
    const res = await fetch(att.url);
    if (!res.ok) throw new Error(`Failed to download ${att.filename}: ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const src = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  return merged.save();
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = req.headers["x-webhook-secret"];
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: "AIRTABLE_TOKEN not configured" });

  const { recordId } = req.body || {};
  if (!recordId) return res.status(400).json({ error: "recordId is required" });

  try {
    console.log(`Merging loka prent for record: ${recordId}`);

    const project = await getProject(token, recordId);
    const source = project[SOURCE_FIELD_NAME] || [];
    const pdfAttachments = source.filter(isPdfAttachment);

    if (pdfAttachments.length === 0) {
      return res.status(400).json({ error: `No PDF attachments found in "${SOURCE_FIELD_NAME}"` });
    }

    const safeTitle = (project[PROJECT_NAME_FIELD] || recordId)
      .replace(/[/\\:*?"<>]/g, "-")
      .trim();

    console.log(`Merging ${pdfAttachments.length} PDF(s)…`);
    const mergedBytes = await mergePdfs(pdfAttachments);

    console.log("Clearing old Loka prent attachment…");
    await clearDest(token, recordId);

    await uploadPdf(token, recordId, mergedBytes, `${safeTitle} loka prent.pdf`);

    console.log("Done.");
    return res.status(200).json({
      success: true,
      recordId,
      mergedCount: pdfAttachments.length,
      skippedNonPdf: source.length - pdfAttachments.length,
    });
  } catch (err) {
    console.error("Failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
