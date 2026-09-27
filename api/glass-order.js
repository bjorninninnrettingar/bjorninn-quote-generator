// api/glass-order.js
// Björninn ehf. — "🪟 Panta gler" button on a Tækifæri.
// Collects the project's not-yet-sent rows from "Gler & speglar 🪟" into one
// Ísspan order in Pantaðir listar (reusing an order that is still
// "Í undirbúningi"), links the rows to it and renders the order PDF.
// Nothing is emailed here — "📧 Senda glerpöntun" on the order does that,
// so the PDF can be checked first.

import {
  T, G, O, P, COMPANY_NAME, STATUS_PREP,
  at, getRecord, getRecords, patchRecords, rowView, missingInfo, renderGlassOrder,
} from "./_glass.js";

const SUPPLIER_MATCH = "isspan"; // matched against Fyrirtæki name, accents ignored

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function findSupplier(token) {
  let offset;
  do {
    const q = `fields%5B%5D=${COMPANY_NAME}&returnFieldsByFieldId=true` + (offset ? `&offset=${offset}` : "");
    const data = await at(token, `${T.companies}?${q}`);
    const hit = data.records.find((r) => norm(r.fields[COMPANY_NAME]).includes(SUPPLIER_MATCH));
    if (hit) return hit.id;
    offset = data.offset;
  } while (offset);
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (req.headers["x-webhook-secret"] !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: "AIRTABLE_TOKEN not configured" });

  const { recordId } = req.body || {};
  if (!recordId) return res.status(400).json({ error: "recordId is required" });

  try {
    const project = await getRecord(token, T.projects, recordId);
    const projectName = project[P.name] || recordId;

    const rows = await getRecords(token, T.glass, project[P.glass] || []);
    const open = rows.filter((r) => Number(r.fields[G.open]) === 1);

    if (!open.length) {
      return res.status(400).json({ error: "Ekkert ópantað gler / spegill á þessu verki." });
    }

    // All or nothing: a half-specified piece must never slip into an order.
    const incomplete = open
      .map((r) => ({ v: rowView(r.fields), missing: missingInfo(rowView(r.fields)) }))
      .filter((x) => x.missing.length)
      .map((x) => `${x.v.desc || "(ónefnt)"}: vantar ${x.missing.join(", ")}`);
    if (incomplete.length) {
      return res.status(400).json({ error: `Laga þarf línur áður en pantað er:\n- ${incomplete.join("\n- ")}` });
    }

    // Reuse an order still in preparation, otherwise start a new one.
    let orderId = open.map((r) => (r.fields[G.order] || [])[0]).find(Boolean) || null;

    if (!orderId) {
      const supplierId = await findSupplier(token);
      if (!supplierId) {
        return res.status(400).json({ error: "Ísspan fannst ekki í Fyrirtæki 🏢 — stofnaðu það (með netfangi) fyrst." });
      }
      const created = await at(token, T.orders, {
        method: "POST",
        body: JSON.stringify({
          typecast: true,
          records: [{
            fields: {
              [O.name]: `${projectName} — Ísspan (gler)`,
              [O.status]: STATUS_PREP,
              [O.project]: [recordId],
              [O.supplier]: [supplierId],
            },
          }],
        }),
      });
      orderId = created.records[0].id;
    }

    await patchRecords(token, T.glass, open.map((r) => ({ id: r.id, fields: { [G.order]: [orderId] } })));

    const lineCount = await renderGlassOrder(token, orderId);

    return res.status(200).json({ success: true, orderId, lineCount });
  } catch (err) {
    console.error("glass-order failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
