// faq.html's DATA is the source of truth for /adstod; api/_chatbot-faq-prompt.js mirrors it for the chatbot.
// This fails when the two drift (a question missing, or an answer edited on one side only).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { FAQ_CORPUS } from "../api/_chatbot-faq-prompt.js";

const html = fs.readFileSync(new URL("../faq.html", import.meta.url), "utf8");
const i = html.indexOf("const DATA = [");
const j = html.indexOf("\n];", i) + 3;
const DATA = vm.runInNewContext(html.slice(i, j).replace("const DATA =", "DATA =") + ";DATA");
const clean = (s) => s.replace(/<[^>]+>/g, " ").replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️]/gu, "").replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();

test("faq.html DATA and chatbot FAQ_CORPUS carry the same questions and answers", () => {
  const faq = new Map(DATA.flatMap((c) => c.questions.map((q) => [q.q, clean(q.a)])));
  const bot = new Map(FAQ_CORPUS.flatMap((c) => c.questions.map((q) => [q[0], clean(q[1])])));
  assert.ok(faq.size > 50, "parsed the faq");
  for (const [q, a] of faq) {
    assert.ok(bot.has(q), `chatbot prompt is missing: ${q}`);
    assert.equal(bot.get(q), a, `answer differs for: ${q}`);
  }
  for (const q of bot.keys()) assert.ok(faq.has(q), `only in the chatbot prompt: ${q}`);
});
