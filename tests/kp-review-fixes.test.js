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
