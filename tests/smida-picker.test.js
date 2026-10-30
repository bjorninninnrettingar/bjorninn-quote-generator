// smida.html project picker — pure list/filter helpers, extracted from the page between markers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../smida.html", import.meta.url), "utf8");
const src = html.split("// PICKER-PURE-START")[1].split("// PICKER-PURE-END")[0];
const ctx = {};
vm.runInNewContext(src + "\nthis.pickerRows=pickerRows;this.pickerFilter=pickerFilter;this.pickerHref=pickerHref;this.pickerCounts=pickerCounts;", ctx);
const N = "Heiti", S = "Staða";
const recs = [
  { id: "recA", fields: { [N]: "T-9 | Jón Jónsson", [S]: "Yfirfara" } },
  { id: "recB", fields: { [N]: "T-32 | Anna Eldhús", [S]: "Klárt til framleiðslu" } },
  { id: "recC", fields: {} },
];

test("rows: newest T-number first, counts and status attached", () => {
  const rows = ctx.pickerRows(recs, { "T-32": 4, "T-9": 1 }, N, S);
  assert.deepEqual(rows.map((r) => r.id), ["recB", "recA", "recC"]);
  assert.equal(rows[0].count, 4);
  assert.equal(rows[1].status, "Yfirfara");
  assert.equal(rows[2].count, null);
  assert.equal(ctx.pickerRows(recs, {}, N, S)[1].count, 0);
  assert.equal(ctx.pickerRows(recs, null, N, S)[0].count, null);
});
test("filter: by name or status, case-insensitive, empty keeps all", () => {
  const rows = ctx.pickerRows(recs, {}, N, S);
  assert.equal(ctx.pickerFilter(rows, "").length, 3);
  assert.deepEqual(ctx.pickerFilter(rows, "  ANNA ").map((r) => r.id), ["recB"]);
  assert.deepEqual(ctx.pickerFilter(rows, "yfirfara").map((r) => r.id), ["recA"]);
  assert.equal(ctx.pickerFilter(rows, "xyz").length, 0);
});
test("href forwards k and encodes", () => {
  assert.equal(ctx.pickerHref("recA", ""), "/smida?recordId=recA");
  assert.equal(ctx.pickerHref("recA", "a b"), "/smida?recordId=recA&k=a%20b");
});
test("counts cabinets per T-number", () => {
  const f = "F";
  const c = ctx.pickerCounts([{ fields: { [f]: "T-32 | a" } }, { fields: { [f]: "T-32 | b" } }, { fields: { [f]: "T-9 | c" } }, { fields: {} }], f);
  assert.deepEqual({ ...c }, { "T-32": 2, "T-9": 1 });
});
