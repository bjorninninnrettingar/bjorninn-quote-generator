// Owner-confirmed facts (2026-10-30) must reach every bot, and no prompt may go back to "email only".
import test from "node:test";
import assert from "node:assert/strict";
import { buildSystemPrompt, buildStudioPrompt } from "../api/_chatbot-faq-prompt.js";
import { fallbackPayload } from "../api/chat.js";

const pub = buildSystemPrompt();
const studio = buildStudioPrompt();

test("public prompt states the five owner facts", () => {
  assert.match(pub, /Mælingin á staðnum er innifalin í tilboðinu/);
  assert.match(pub, /ekki ef þú ert ekki í verkefni hjá okkur/);
  assert.match(pub, /8–12 vikur, mögulega fyrr/);
  assert.match(pub, /flækjustigi/);
  assert.match(pub, /Tilboðið gildir í 15 daga/);
  assert.match(pub, /Ábyrgðin er 2 ár/);
  assert.match(pub, /779-5777/);
  assert.match(pub, /bjorninn@bjorninninnrettingar\.is/);
});

test("studio prompt states the facts and may give phone and email", () => {
  for (const re of [/innifalin í tilboði/, /8–12 vikur, mögulega fyrr/, /15 daga/, /2 ár/, /779-5777/, /bjorninn@bjorninninnrettingar\.is/])
    assert.match(studio, re);
});

test("nothing says email-only any more, and no guard claims measurement price is unknown", () => {
  for (const p of [pub, studio]) {
    assert.doesNotMatch(p, /ALDREI gefa upp símanúmer/);
    assert.doesNotMatch(p, /ALDREI bjóða símtal/);
    assert.doesNotMatch(p, /kostnaður við mælingu kemur ekki fram/);
  }
});

test("apology fallbacks offer phone and email", () => {
  for (const [kind, lang] of [["public"], ["studio", "is"], ["studio", "en"]]) {
    const a = fallbackPayload(kind, lang).answer;
    assert.match(a, /779-5777/, kind);
    assert.match(a, /bjorninn@bjorninninnrettingar\.is/, kind);
  }
});

test("round 2 owner facts (design packages, install/delivery/demolition quotes, HQ stone, storage, showroom, fronts)", () => {
  for (const re of [/380\.000 kr/, /240\.000 kr/, /100\.000 kr/, /50% ganga upp í tilboð/, /alltaf sérstakt tilboð/, /hq\.is/, /15% afslátt/, /ekki upp á geymslu/, /ekki alltaf tök á því/, /Efnisúrval/])
    assert.match(pub, re);
  for (const re of [/hq\.is/, /15% afsláttur/, /380\.000/, /engin geymsla/, /aðeins opinn eftir bókun/]) assert.match(studio, re);
  for (const p of [pub, studio]) {
    assert.doesNotMatch(p, /selur ekki steinplötur/);
    assert.doesNotMatch(p, /geymslugjöld/);
  }
});
