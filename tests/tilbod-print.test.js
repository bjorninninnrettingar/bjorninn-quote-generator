// api/tilbod-print.js — "Prenta tilboð" from PRO / CRM (G3 + G13, 2026-10-27): needs the office key, answers with the PDF.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/tilbod-print.js";
import { mockRes, fakeFetch } from "./helpers.js";

const REC = "recAAAAAAAAAAAAAA";
process.env.WEBHOOK_SECRET = "w"; process.env.VERK_KEY = "secret"; process.env.AIRTABLE_TOKEN = "t";
const req = (body) => ({ method: "POST", headers: { host: "bjorninn.vercel.app" }, body });

test("no key / wrong key / bad id: nothing is printed", async () => {
  const f = fakeFetch(() => ({ status: 200, body: {} }));
  for (const [body, code] of [[{ recordId: REC }, 403], [{ recordId: REC, k: "nope" }, 403], [{ recordId: "x", k: "secret" }, 400]]) {
    const res = mockRes();
    await handler(req(body), res, { fetchImpl: f });
    assert.equal(res.statusCode, code);
  }
  assert.equal(f.calls.length, 0);
});

test("prints through generate-quote and returns the new PDF links", async () => {
  const f = fakeFetch((c) => c.url.includes("/api/generate-quote") ? { status: 200, body: { success: true, total: 100 } }
    : { status: 200, body: { id: REC, fields: { flddIR5JAm8ZM753V: [{ url: "https://dl.airtable/x.pdf", filename: "T-1 | A (Tilboð).pdf" }] } } });
  const res = mockRes();
  await handler(req({ recordId: REC, k: "secret" }), res, { fetchImpl: f });
  assert.equal(res.statusCode, 200);
  assert.equal(f.calls[0].body.recordId, REC);
  assert.deepEqual(res.body.files, [{ url: "https://dl.airtable/x.pdf", filename: "T-1 | A (Tilboð).pdf" }]);
  assert.equal(res.body.total, 100);
});
