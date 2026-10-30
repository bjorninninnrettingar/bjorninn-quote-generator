// api/kp-drawings.js — PRO replace must upload the new drawing FIRST and never leave the project without one.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/kp-drawings.js";
import { mockRes, fakeFetch } from "./helpers.js";

const OPP = "recAAAAAAAAAAAAAA";
const FLD = "fldO6cbhBV2FQTmLx";
const NAME = "Teikningar úr skipuleggjara 📐";
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(200, 32)]);
const realFetch = globalThis.fetch;
beforeEach(() => { process.env.AIRTABLE_TOKEN = "t"; process.env.VERK_KEY = "secret"; });
afterEach(() => { globalThis.fetch = realFetch; });

const run = async (routes, k = "secret") => {
  const f = fakeFetch(routes);
  globalThis.fetch = f;
  const res = mockRes();
  await handler({ method: "POST", query: { recordId: OPP, k }, body: PDF }, res);
  return { f, res };
};
const rec = (atts) => ({ status: 200, body: { id: OPP, createdTime: "2026-01-01T00:00:00.000Z", fields: { [NAME]: atts } } });

test("PRO replace: uploads first, then keeps only the new attachment", async () => {
  const { f, res } = await run((c) => {
    if (c.method === "GET") return rec([{ id: "attOld1" }]);
    if (c.url.includes("uploadAttachment")) return { status: 200, body: { id: OPP, fields: { [FLD]: [{ id: "attOld1" }, { id: "attNew1" }] } } };
    if (c.method === "PATCH") return { status: 200, body: {} };
  });
  assert.equal(res.statusCode, 200);
  const order = f.calls.map((c) => (c.url.includes("uploadAttachment") ? "upload" : c.method));
  assert.deepEqual(order, ["GET", "upload", "PATCH"]);
  assert.deepEqual(f.calls[2].body.fields[FLD], [{ id: "attNew1" }]);
});

test("PRO replace: a failed upload touches nothing — the old drawing stays", async () => {
  const { f, res } = await run((c) => {
    if (c.method === "GET") return rec([{ id: "attOld1" }]);
    if (c.url.includes("uploadAttachment")) return { status: 500, body: { error: "boom" } };
  });
  assert.equal(res.statusCode, 502);
  assert.equal(f.calls.filter((c) => c.method === "PATCH").length, 0);
});

test("PRO replace: if the tidy-up PATCH fails the new drawing is still there (200 + warning), old not lost", async () => {
  const { res } = await run((c) => {
    if (c.method === "GET") return rec([{ id: "attOld1" }]);
    if (c.url.includes("uploadAttachment")) return { status: 200, body: { id: OPP, fields: { [FLD]: [{ id: "attOld1" }, { id: "attNew1" }] } } };
    if (c.method === "PATCH") return { status: 500, body: {} };
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.warning);
});

test("PRO first drawing (nothing to replace): just the upload, no PATCH", async () => {
  const { f, res } = await run((c) => {
    if (c.method === "GET") return rec([]);
    if (c.url.includes("uploadAttachment")) return { status: 200, body: { id: OPP, fields: {} } };
  });
  assert.equal(res.statusCode, 200);
  assert.equal(f.calls.filter((c) => c.method === "PATCH").length, 0);
});
