// BJÖRNINN STUDIO Hjálp ("Hvernig…?", kitchen-planner-help.js): every entry is complete in IS + EN, and the
// chatbot's Studio prompt carries the very same answers (one source — a fix in the help file reaches both).
// Also: the tour and the help never name controls that are gone.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, root), "utf8");

test("every Hjálp entry has a group, question and answer in Icelandic and English", async () => {
  await import("../kitchen-planner-help.js");
  const list = globalThis.KPHELP;
  assert.ok(Array.isArray(list) && list.length >= 25, "the help list is there");
  list.forEach((h, i) => ["cat", "q", "a"].forEach((k) => ["is", "en"].forEach((l) =>
    assert.ok(h[k] && typeof h[k][l] === "string" && h[k][l].trim().length > 1, `entry ${i} ${k}.${l}`))));
});

test("the chatbot's Studio prompt includes every Hjálp answer", async () => {
  const { buildStudioPrompt } = await import("../api/_chatbot-faq-prompt.js");
  const p = buildStudioPrompt();
  globalThis.KPHELP.forEach((h) => { assert.ok(p.includes(h.q.is), h.q.is); assert.ok(p.includes(h.a.is), h.q.is); });
});

test("the tour, the help and the chatbot name no control that was removed", () => {
  const gone = ["Skotmarkið", "Myndavélin", "Gangandi maðurinn", "Toppur og vaskur", "Tækjaskápar“ undir „＋ Ný eining“ (eldhús og fataskápar)"];
  const page = read("kitchen-planner.html"), tour = page.slice(page.indexOf("var TOUR_STEPS"), page.indexOf("function startTour"));
  [tour, read("kitchen-planner-help.js"), read("api/_chatbot-faq-prompt.js")].forEach((txt) =>
    gone.forEach((g) => assert.ok(!txt.includes(g), "still names: " + g)));
});
