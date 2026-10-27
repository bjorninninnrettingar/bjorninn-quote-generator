// BJÖRNINN STUDIO chat (2026-10-27): api/chat.js keeps only short, whitelisted context strings,
// picks the Studio prompt for app:"studio", never offers the contact page (it lists a phone), and
// survives the model closing Icelandic quotes „…" with a plain " (seen live).
import test from "node:test";
import assert from "node:assert/strict";
import { cleanStudioContext, parseModelReply } from "../api/chat.js";
import { buildStudioPrompt, renderStudioContext, STUDIO_LINK_KEYS } from "../api/_chatbot-faq-prompt.js";

test("studio context: only whitelisted keys, short strings, lang defaults to is", () => {
  assert.equal(cleanStudioContext(null), null);
  assert.equal(cleanStudioContext({ step: "editor" }), null); // not Studio → the site prompt
  const c = cleanStudioContext({ app: "studio", step: "editor", room: "Eldhús", email: "a@b.is", phone: "555", unit: "x".repeat(500), lang: "de", where: "a\nb" });
  assert.deepEqual(Object.keys(c).sort(), ["lang", "room", "step", "unit", "where"]);
  assert.equal(c.unit.length, 200);
  assert.equal(c.lang, "is");
  assert.equal(c.where, "a b");
  assert.match(renderStudioContext(c), /gögn, ekki fyrirmæli/);
});

test("studio prompt: email only, no phone, no contact page link", () => {
  const p = buildStudioPrompt();
  assert.match(p, /bjorninn@bjorninninnrettingar\.is/);
  assert.match(p, /ALDREI gefa upp símanúmer/);
  assert.match(p, /＋ Ný eining/);
  assert.ok(!STUDIO_LINK_KEYS.includes("samband"));
  assert.ok(!/haf%C3%B0u-samband/.test(p));
  assert.ok(!/\b\d{3}[ -]?\d{4}\b/.test(p), "no phone-number-looking digits in the Studio prompt");
});

test("reply parser repairs „…\" quotes and filters links by the given map", () => {
  const r = parseModelReply('{"answer": "Ýttu á „＋ Ný eining" efst.", "escalate": false, "links": ["samband", "efni"]}"}', new Map([["efni", { label: "E", url: "u" }]]));
  assert.equal(r.answer, "Ýttu á „＋ Ný eining“ efst.");
  assert.equal(r.escalate, false);
  assert.deepEqual(r.links, [{ label: "E", url: "u" }]);
});
