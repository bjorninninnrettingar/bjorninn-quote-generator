// api/field-check.js — the daily "does every field the site uses still exist?" check.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { checkFields, allDeps } from "../api/field-check.js";
import { mockRes, fakeFetch } from "./helpers.js";

test("finds every unknown field, one 422 at a time", async () => {
  const gone = new Set(["Gamalt nafn", "Annað gamalt"]);
  const f = fakeFetch((c) => {
    const asked = new URL(c.url).searchParams.getAll("fields[]");
    const bad = asked.find((n) => gone.has(n));
    return bad ? { status: 422, body: { error: { type: "UNKNOWN_FIELD_NAME", message: `Unknown field name: "${bad}"` } } } : { status: 200, body: { records: [] } };
  });
  const out = await checkFields({ tblA: new Set(["Gott", "Gamalt nafn", "Annað gamalt"]), tblB: new Set(["Gott"]) }, "t", f);
  assert.deepEqual(out.missing, [{ table: "tblA", field: "Gamalt nafn" }, { table: "tblA", field: "Annað gamalt" }]);
  assert.deepEqual(out.errors, []);
});

test("other errors are reported, not looped on", async () => {
  const f = fakeFetch(() => ({ status: 403, body: { error: { type: "INVALID_PERMISSIONS" } } }));
  const out = await checkFields({ tblA: new Set(["x"]) }, "t", f);
  assert.equal(out.errors.length, 1);
  assert.equal(f.calls.length, 1);
});

test("covers the proxy and the planner submission", () => {
  const d = allDeps();
  assert.ok(d.tbl4LMXlQjp66RFKI.has("Skilaboð til skipulags"));           // Tækifæri note (the 2026-09-29 miss)
  assert.ok(d.tblFcsUoGxsuUwNEH.has("Vöru reitur 3"));                     // Line Items
  assert.ok(d.tblhglpjQkczdG1AY.has("PIN 🔢"));                            // used only in a filter formula
});

test("needs the cron secret or ?k=VERK_KEY", async () => {
  process.env.AIRTABLE_TOKEN = "t"; process.env.CRON_SECRET = "c"; process.env.VERK_KEY = "v";
  const res = mockRes();
  await handler({ headers: {}, query: {} }, res);
  assert.equal(res.statusCode, 401);
});
