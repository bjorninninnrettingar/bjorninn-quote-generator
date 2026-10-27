import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { buildSummary, addDays } from "../api/morgunyfirlit.js";

const WON = "🏆 Tækifæri unnið";
const P = (name, f) => ({ id: name, fields: { "Heiti tækifæris / verkefnis": name + " - Gata 1", "Staða í söluferli": WON, ...f } });
const TODAY = "2026-10-27";

test("addDays crosses month ends", () => assert.equal(addDays("2026-10-30", 5), "2026-11-04"));

test("each of the four checks picks the right projects", () => {
  const s = buildSummary([
    P("T-1", { "Áætlaður afhendingardagur Björninn (internal)": "2026-11-01", "Staða í framleiðslu": "Verk í vinnslu 🔨" }),   // seint
    P("T-2", { "Áætlaður afhendingardagur Björninn (internal)": "2026-12-01", "Staða í framleiðslu": "Verk í vinnslu 🔨" }),   // far off
    P("T-3", { "Áætlaður afhendingardagur Björninn (internal)": "2026-11-01", "Staða í framleiðslu": "Má Afhenda 🚚" }),        // booked → nothing
    P("T-4", { "Áætlaður afhendingardagur Björninn (internal)": "2026-10-20", "Staða í framleiðslu": "Má Afhenda 🚚" }),        // not booked
    P("T-5", { "Upphafs framleiðsludagur verks": "2026-10-30" }),                                                            // efni missing
    P("T-6", { "Upphafs framleiðsludagur verks": "2026-10-30", "5. Efni lent í húsi": true }),                                // efni ok
    P("T-7", { "Áætlaður afhendingardagur Björninn (internal)": "2026-10-28", "Staða í framleiðslu": "Afhent (LOKIÐ ✅)" }),   // done
  ], [
    { fields: { "Vandamálið": "Hurð", "Ábyrgðarmaður": "Jóel", "Skiladagur": "2026-10-23", "Staða": "Í vinnslu" } },        // overdue
    { fields: { "Vandamálið": "Lamir", "Staða": "opið 😠" } },                                                                 // no owner
    { fields: { "Vandamálið": "Skúffa", "Ábyrgðarmaður": "Ísak", "Skiladagur": "2026-11-02" } },                             // fine
  ], TODAY);
  const by = Object.fromEntries(s.sections.map((x) => [x.heading, x.rows]));
  assert.deepEqual(by["Afhending innan 7 daga, ekki í Má afhenda"].map((r) => r.split(" ")[0]), ["T-1"]);
  assert.deepEqual(by["Má afhenda án bókaðs tíma"], ["T-4"]);
  assert.equal(by["Quick Fix fram yfir / án eiganda"].length, 2);
  assert.deepEqual(by["Byrjar innan 5 daga en efni ekki komið"].map((r) => r.split(" ")[0]), ["T-5"]);
  assert.equal(s.count, 5);
});

test("nothing to report → empty", () => {
  assert.equal(buildSummary([], [], TODAY).count, 0);
});

test("refused without cron secret or key; by hand is a dry run", async () => {
  process.env.VERK_KEY = "lykill"; process.env.CRON_SECRET = "cs"; process.env.AIRTABLE_TOKEN = "x";
  let status, json;
  const res = { status(s) { status = s; return this; }, json(j) { json = j; return this; } };
  const realFetch = global.fetch; const calls = [];
  global.fetch = async (url, opts = {}) => { calls.push({ url: String(url), opts }); return { ok: true, json: async () => ({ records: [] }) }; };
  try {
    await handler({ query: { k: "rangt" }, headers: {} }, res);
    assert.equal(status, 403);
    await handler({ query: { k: "lykill" }, headers: {} }, res);
    assert.equal(status, 200);
    assert.equal(json.dry, true);
    assert.equal(calls.some((c) => c.opts.method === "POST"), false);
  } finally { global.fetch = realFetch; }
});
