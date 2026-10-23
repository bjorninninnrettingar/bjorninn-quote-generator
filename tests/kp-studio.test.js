// api/kp-studio.js — ✨ Studio photos → Tækifæri "Studio myndir 📸": PRO with the key, customers only right after their own submission.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { fileName, MAX_KEEP } from "../api/kp-studio.js";
import { mockRes } from "./helpers.js";

const REC = "recAAAAAAAAAAAAAA";
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 1)]);
function fake(fields, created, uploaded){
  const calls = [];
  const f = async (url, o = {}) => {
    calls.push({ url, method: o.method || "GET", body: o.body && JSON.parse(o.body) });
    const body = url.includes("uploadAttachment") ? { fields: { fldTzXvmfE1kaiuPN: uploaded || [{ id: "att1" }] } } : { createdTime: created, fields };
    return { ok: true, status: 200, json: async () => body, text: async () => "" };
  };
  return { f, calls };
}

test("rejects a wrong key, a bad id and anything that isn't a JPEG", async () => {
  process.env.AIRTABLE_TOKEN = "t"; process.env.VERK_KEY = "secret";
  let res = mockRes(); await handler({ method: "POST", query: { k: "x", recordId: REC }, body: JPG }, res); assert.equal(res.statusCode, 403);
  res = mockRes(); await handler({ method: "POST", query: { k: "secret", recordId: "nope" }, body: JPG }, res); assert.equal(res.statusCode, 400);
  res = mockRes(); await handler({ method: "POST", query: { k: "secret", recordId: REC }, body: Buffer.alloc(300, 65) }, res); assert.equal(res.statusCode, 400);
});

test("without the key: only a fresh planner submission, at most 3 photos", async () => {
  const fresh = new Date().toISOString(), old = new Date(Date.now() - 3600e3).toISOString();
  let m = fake({}, fresh); let res = mockRes(); await handler({ method: "POST", query: { recordId: REC }, body: JPG }, res, m.f); assert.equal(res.statusCode, 403);
  m = fake({ "Sjálfsafgreiðsla skipulag (JSON) 📐": "{}" }, old); res = mockRes(); await handler({ method: "POST", query: { recordId: REC }, body: JPG }, res, m.f); assert.equal(res.statusCode, 403);
  m = fake({ "Sjálfsafgreiðsla skipulag (JSON) 📐": "{}", "Studio myndir 📸": [1, 2, 3] }, fresh); res = mockRes(); await handler({ method: "POST", query: { recordId: REC }, body: JPG }, res, m.f); assert.equal(res.statusCode, 409);
  m = fake({ "Sjálfsafgreiðsla skipulag (JSON) 📐": "{}" }, fresh); res = mockRes(); await handler({ method: "POST", query: { recordId: REC }, body: JPG }, res, m.f); assert.equal(res.statusCode, 200);
});

test("PRO: keeps only the newest 12", async () => {
  const many = Array.from({ length: MAX_KEEP + 1 }, (_, i) => ({ id: "att" + i }));
  const m = fake({ "Heiti tækifæris / verkefnis": "T-32 | Ísak" }, new Date(0).toISOString(), many);
  const res = mockRes(); await handler({ method: "POST", query: { k: "secret", recordId: REC }, body: JPG }, res, m.f);
  assert.equal(res.statusCode, 200);
  assert.match(m.calls.find((c) => c.url.includes("uploadAttachment")).body.filename, /^T-32 studio /);
  const kept = m.calls.find((c) => c.method === "PATCH").body.fields.fldTzXvmfE1kaiuPN;
  assert.equal(kept.length, MAX_KEEP); assert.equal(kept[0].id, "att1");
  assert.equal(fileName("", "x"), "verkefni studio x.jpg");
});
