// Fixes for docs/review-planner-2026-10-31.md: each test fails on the code before its fix.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../kitchen-planner.html", import.meta.url), "utf8");
function fnBody(name) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start >= 0, name + " exists");
  return html.slice(start, html.indexOf("\n  function ", start + 10));
}

// ---- 1. wtResult inside withEachCategory must not save() a parked room's drawing over the live one
test("(1) worktop re-keying inside withEachCategory: no save()/undo step while a parked room is swapped in; one save + toast after", () => {
  const log = [];
  const src = ["wtOn", "wtResult", "withEachCategory"].concat(html.includes("function wtMovedNote(") ? ["wtMovedNote"] : []).map(fnBody).join("\n") + "\nvar WT_MOVED = [];";
  const ROOM_FIELDS = ["walls"];
  const sb = {
    SK_CAT: null, SK_SAVED_ACTIVE: null, ROOM_FIELDS,
    window: { KPWT: { reconcile: () => [{ label: "1" }], compute: () => ({}) } }, KPWT: null, KP3D: {},
    categoryDef: () => null, freezeSk() {}, toast: (t) => log.push("toast"),
    save() { log.push("save:" + sb.state.walls); },
    state: { activeCategory: "thvottahus", categoryQueue: ["thvottahus", "eldhus"], walls: "ACTIVE", categoryData: { eldhus: { walls: "PARKED" } } },
  };
  sb.KPWT = sb.window.KPWT;
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(src + "\nthis.withEachCategory = withEachCategory; this.wtResult = wtResult;", sb);
  sb.withEachCategory(() => { sb.wtResult(); });
  assert.ok(!log.includes("save:PARKED"), "never saved while the parked room was swapped in");
  assert.equal(log.filter((x) => x.startsWith("save")).length, 1, "one save for the whole loop");
  assert.equal(log.filter((x) => x === "toast").length, 1, "one toast");
  assert.equal(log[log.length - 2], "save:ACTIVE", "saved after the real room was restored");
});

// ---- 2. Afturkalla / Endurgera after Vista must show "óvistað"
test("(2) PRO: stepHistory marks the drawing dirty and refreshes the bar (chip no longer says 'vistað' after undo)", () => {
  const store = {}; let bars = 0;
  const sb = {
    PRO: {}, STORAGE_KEY: "k", localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    histIdx: 1, undoStack: ['{"walls":1}', '{"walls":2}'], steppingHistory: false, selectedBlockId: null,
    state: { proSavedAt: "t", liSent: {} }, findBlock() {}, updateHistoryButtons() {}, refreshAfterEdit() {}, proBar: () => { bars++; },
  };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext(fnBody("stepHistory") + "\n" + fnBody("proDirty") + "\nthis.stepHistory = stepHistory; this.proDirty = proDirty;", sb);
  assert.equal(sb.proDirty(), false);
  sb.stepHistory(-1);
  assert.equal(sb.proDirty(), true, "dirty after Afturkalla");
  assert.ok(bars >= 1, "the bar was refreshed");
  assert.equal(sb.state.proSavedAt, "t", "save stamps still kept");
});

// ---- 3. island: Til baka on the first Smíða screen takes the úthliðar added with the unit away again
test("(3) smUndoNew on an island restores both rows exactly (úthliðar added during placement are removed)", () => {
  const start = { a: [{ id: "x1", type: "grunnskapur", widthMm: 600 }], b: [] };
  const isl = { a: JSON.parse(JSON.stringify(start.a)), b: [] };
  const snap = { isl, a: JSON.stringify(isl.a), b: JSON.stringify(isl.b) };
  // placement: the new tall unit + two úthliðar around it, and the neighbour got a gap
  isl.a.push({ id: "t1", type: "hataskapur", widthMm: 600 }, { id: "u1", type: "uthlidhar", widthMm: 19 }, { id: "u2", type: "uthlidhar", widthMm: 19 });
  isl.a[0].gapMm = 5;
  const sb = {
    uw: { b: { id: "t1" }, smNew: { gaps: [[isl.a[0], undefined]], pre: { id: "pre" }, hadSmida: false, isl: snap } },
    findBlock: (id) => { const i = isl.a.findIndex((x) => x.id === id); return i < 0 ? null : { block: isl.a[i], wall: { floor: isl.a }, zone: "floor" }; },
    detachBlock: (w, z, id) => { const i = w[z].findIndex((x) => x.id === id); if (i >= 0) w[z].splice(i, 1); },
    landedBlockId: 1, selectedBlockId: 1, selectedWallId: 1, uwPrevKey: "x", save() {}, renderUnitWizard() {},
  };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext(fnBody("smUndoNew") + "\nthis.smUndoNew = smUndoNew;", sb);
  sb.smUndoNew();
  assert.equal(JSON.stringify(isl.a), JSON.stringify(start.a), "the island row equals the starting row");
});

test("(3) the placement hands the island's row snapshot to Smíða's undo", () => {
  assert.ok(/smIsl = PRO && wall\.island/.test(html) && /pocket:pocketNew, isl:smIsl/.test(html));
  assert.ok(/isl:o\.isl/.test(fnBody("smEnterNew")));
});

// ---- 4. Studio keeps its pre-áfella behaviour while AF lines stay off for customers
test("(4) Studio gating: no wide áfella / 'no úthlið beside it' unless PRO or the AF lines go out in Studio too", () => {
  assert.ok(/var AFELLA_WIDE = !!\(PRO \|\| AFELLA_LINES_IN_STUDIO_SUBMIT\)/.test(html));
  assert.ok(/KP3D\.afellaNarrow = !AFELLA_WIDE/.test(html));
  assert.ok(/function hasAf\(side, b\)\{ return AFELLA_WIDE && /.test(html), "missingEndPanels' hasAf is gated");
  const d3 = fs.readFileSync(new URL("../kitchen-planner-3d.js", import.meta.url), "utf8");
  assert.ok(/afellaNarrow\) ends = ends\.filter\(function\(e\)\{ return Math\.abs\(e\.mm - AFELLA_MM\) < 1; \}\)/.test(d3), "3D draws only the 19 mm filler in Studio");
});

// ---- 5. Enter on an empty Smíða field must not disable that field's later change commit
test("(5) every Enter handler in Smíða clears __sent again, so a later change still commits", () => {
  const sets = html.match(/inp\.__sent = true;[^\n]{0,80}/g) || [];
  assert.ok(sets.length >= 4, "the four Enter handlers exist");
  sets.forEach((x) => assert.ok(/setTimeout\(function\(\)\{ inp\.__sent = false; \}, 0\)/.test(x), x));
});

test("(5) behaviour: Enter on an empty field, then typing + change still commits", async () => {
  const handlers = {}; const committed = [];
  const inp = { dataset: { smIn: "w" }, value: "", addEventListener: (t, f) => { handlers[t] = f; } };
  const line = html.match(/inp\.addEventListener\("change", function\(\)\{ if \(!inp\.__sent\) smCommit[^\n]*\n[^\n]*keydown[^\n]*/)[0];
  const sb = { inp, smCommit: (k, v) => { if (v !== "") committed.push(v); }, setTimeout };
  vm.createContext(sb); vm.runInContext(line, sb);
  handlers.keydown({ key: "Enter", preventDefault() {} });
  await new Promise((r) => setTimeout(r, 5));
  inp.value = "600"; handlers.change();
  assert.deepEqual(committed, ["600"]);
});

// ---- 7. afKeyOf never reuses an AF number that is already in Airtable
test("(7) afKeyOf seeds its max from liSent too: no afKeys but liSent AF1 -> next is AF2", () => {
  const sb = { SK_CAT: null, state: { activeCategory: "eldhus", liSent: { AF1: [], Sk3: [] } } };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext(fnBody("afKeyOf") + "\nthis.afKeyOf = afKeyOf;", sb);
  assert.equal(sb.afKeyOf("v:W1:start"), "AF2");
  assert.equal(sb.afKeyOf("v:W1:start"), "AF2", "stable once given");
  assert.equal(sb.afKeyOf("v:W2:end"), "AF3");
});
