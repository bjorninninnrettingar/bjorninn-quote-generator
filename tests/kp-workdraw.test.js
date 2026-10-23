// api/kp-workdraw.js — PRO work drawings PDF → Tækifæri "Vinnuteikningar (drög) 📐", newest replaces older.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { fileName } from "../api/kp-workdraw.js";
import { mockRes } from "./helpers.js";

const REC = "recAAAAAAAAAAAAAA";
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(200, 32)]);

test("needs the key, a record id and a real PDF", async () => {
  process.env.AIRTABLE_TOKEN = "t"; process.env.VERK_KEY = "secret";
  let res = mockRes(); await handler({ method: "POST", query: { k: "x", recordId: REC }, body: PDF }, res); assert.equal(res.statusCode, 403);
  res = mockRes(); await handler({ method: "POST", query: { k: "secret", recordId: "nope" }, body: PDF }, res); assert.equal(res.statusCode, 400);
  res = mockRes(); await handler({ method: "POST", query: { k: "secret", recordId: REC }, body: Buffer.alloc(300, 65) }, res); assert.equal(res.statusCode, 400);
});

test("uploads, then keeps only the newest draft", async () => {
  const calls = [];
  const f = async (url, o = {}) => {
    calls.push({ url, method: o.method || "GET", body: o.body && JSON.parse(o.body) });
    const body = url.includes("uploadAttachment") ? { fields: { fld7EnKg6thzULUYj: [{ id: "attOLD" }, { id: "attNEW" }] } } : { fields: { "Heiti tækifæris / verkefnis": "T-32 | Ísak" } };
    return { ok: true, status: 200, json: async () => body, text: async () => "" };
  };
  const res = mockRes();
  await handler({ method: "POST", query: { k: "secret", recordId: REC }, body: PDF }, res, f);
  assert.equal(res.statusCode, 200);
  const up = calls.find((c) => c.url.includes("uploadAttachment"));
  assert.match(up.body.filename, /^T-32 vinnuteikningar drog \d{4}-\d\d-\d\d\.pdf$/);
  assert.deepEqual(calls.find((c) => c.method === "PATCH").body.fields.fld7EnKg6thzULUYj, [{ id: "attNEW" }]);
  assert.equal(fileName("", "2026-01-01"), "verkefni vinnuteikningar drog 2026-01-01.pdf");
});
