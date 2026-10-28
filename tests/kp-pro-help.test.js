// PRO tour, PRO Hjálp, clear Smíða/Yfirferð issue texts and the Tilboð discount guard
// (kitchen-planner-pro-help.js, PRO UX audit 2026-10-28 #6 #8 #11 #13).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, root), "utf8");
await import("../kitchen-planner-pro-help.js");
const { KPHELP_PRO, KPPROTOUR, KPPROTEXT } = globalThis;

test("PRO Hjálp: every entry has a group, question and answer, and the PRO words are explained", () => {
  assert.ok(KPHELP_PRO.length >= 8);
  KPHELP_PRO.forEach((h, i) => ["cat", "q", "a"].forEach((k) => assert.ok(typeof h[k] === "string" && h[k].trim().length > 1, `entry ${i} ${k}`)));
  const all = KPHELP_PRO.map((h) => h.q + " " + h.a).join(" ");
  ["Sk", "Smíða", "Yfirferð", "Klár til framleiðslu", "Tilboð", "Opna til breytinga"].forEach((w) => assert.ok(all.includes(w), "explains " + w));
});

test("the customers' Hjálp and the chatbot never carry PRO entries", async () => {
  const { buildStudioPrompt } = await import("../api/_chatbot-faq-prompt.js");
  const p = buildStudioPrompt();
  KPHELP_PRO.forEach((h) => assert.ok(!p.includes(h.a), "chatbot would repeat: " + h.q));
  assert.ok(!read("kitchen-planner-help.js").includes("Klár til framleiðslu"));
});

test("PRO tour: intro + 5 steps + end card, every step has text and points at controls that exist", () => {
  assert.equal(KPPROTOUR.length, 7);
  assert.ok(KPPROTOUR[0].center && KPPROTOUR[KPPROTOUR.length - 1].center);
  KPPROTOUR.forEach((t, i) => { assert.ok(t.title && t.html && t.next, "step " + i); assert.ok(t.center || (t.sel && t.sel.length), "target " + i); });
  const page = read("kitchen-planner.html");
  ["edNewUnit", "proTilbodToggle", "proSave"].forEach((id) => assert.ok(page.includes(`id="${id}"`), "#" + id));
  assert.ok(page.includes('data-sec="efni"'));
  // the last selector of a step may be a fallback that always exists
  assert.ok(KPPROTOUR.filter((t) => t.sel).every((t) => t.sel.length >= 1));
});

test("the page runs the PRO tour and PRO help in PRO, and loads the file", () => {
  const page = read("kitchen-planner.html");
  assert.ok(page.includes('<script src="kitchen-planner-pro-help.js"></script>'));
  assert.ok(page.includes("function tourSteps(){ return PRO_TOUR_STEPS || TOUR_STEPS; }"));
  assert.ok(page.includes("PRO ? window.KPHELP_PRO : window.KPHELP"));
  assert.ok(page.includes('PRO ? "bjorninn:kitchenPlanner:proTourDone"'), "PRO has its own seen flag");
  assert.ok(!/TOUR_STEPS\[/.test(page), "no code reads the customer steps directly");
});

test("issue texts say what is wrong and what to click", () => {
  const t = [
    KPPROTEXT.drawerSum(640, 680), KPPROTEXT.drawerMin("lítil", 80.4, 100),
    KPPROTEXT.hingeCount("Hurð 1", 1200, 3, 2), KPPROTEXT.hingeCount("Hurð 1", 2100, 5, 3),
    KPPROTEXT.hingeHit("Hurð 1", "↓300", "hillugötum hillunnar í 500", ""), KPPROTEXT.hingeHit("Hurð 1", "↑80", "braut innskúffu A", "innskúffuna")
  ];
  t.forEach((x) => { assert.ok(x.includes("ýttu á „Laga“"), x); assert.ok(x.length < 220, x); });
  assert.match(t[0], /640 mm .* 680 mm .*40 mm vantar/);
  assert.match(t[1], /80 mm, minnst 100 mm/);
  assert.match(t[2], /bæta einni við/);
  assert.match(t[3], /bæta 2 við/);
  assert.match(t[4], /færðu hilluna/);
  assert.match(t[5], /færðu innskúffuna/);
  assert.match(KPPROTEXT.drawerSum(700, 680), /20 mm of mikið/);
});

test("the page builds its issue texts through KPPROTEXT (no old wording left)", () => {
  const page = read("kitchen-planner.html");
  ["drawerSum", "drawerMin", "hingeCount", "hingeHit"].forEach((f) => assert.ok(page.includes("KPPROTEXT." + f + "("), f));
  assert.ok(!page.includes("þurfa að fylla"));
  assert.ok(!page.includes("undir \" + KP3D.slotMin"));
});

test("Tilboð discount: 0-30 allowed, above 15 asks, nothing typed is zero", () => {
  assert.deepEqual(KPPROTEXT.tilbodDiscount(""), { value: 0, clamped: false, confirm: false });
  assert.deepEqual(KPPROTEXT.tilbodDiscount("2"), { value: 2, clamped: false, confirm: false });
  assert.deepEqual(KPPROTEXT.tilbodDiscount("15"), { value: 15, clamped: false, confirm: false });
  assert.deepEqual(KPPROTEXT.tilbodDiscount("20"), { value: 20, clamped: false, confirm: true });
  assert.deepEqual(KPPROTEXT.tilbodDiscount("55"), { value: 30, clamped: true, confirm: true });
  assert.deepEqual(KPPROTEXT.tilbodDiscount("-5"), { value: 0, clamped: false, confirm: false });
  assert.deepEqual(KPPROTEXT.tilbodDiscount("abc"), { value: 0, clamped: false, confirm: false });
  assert.deepEqual(KPPROTEXT.tilbodDiscount("7,5"), { value: 7.5, clamped: false, confirm: false });
});

test("Yfirferð lines name the click: Laga → on the row", () => {
  const page = read("kitchen-planner.html");
  ["opna rýmið og teikna", "veldu í Efni-valmyndinni", "opna skápinn í Smíða", "opna borðplötuna"].forEach((x) => assert.ok(page.includes(x), x));
});

test("Tilboð note names the discount and markup that are already in the price", () => {
  assert.match(KPPROTEXT.tilbodFactors(5, "Smáverk 20%"), /5 % afsláttur og álagning Smáverk 20% er þegar inni í því/);
  assert.doesNotMatch(KPPROTEXT.tilbodFactors(0, ""), /þegar inni/);
  assert.match(KPPROTEXT.tilbodFactors(0, ""), /sem viðskiptavinurinn sér/);
});
