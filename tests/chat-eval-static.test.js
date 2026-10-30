// The chatbot question set (scripts/eval-chat-cases.mjs): every case's key fact must exist in that bot's knowledge text.
// The live run (`npm run eval:chat`) is not part of `npm test` — it needs an Anthropic key and costs real calls.
import test from "node:test";
import assert from "node:assert/strict";
import { CASES, staticProblems } from "../scripts/eval-chat-cases.mjs";
import { STAFF_APPS } from "../api/_chatbot-staff-prompts.js";

test("eval question set: every staff app has 5+ questions, ~25 public/Studio, and each key fact is in the prompt", () => {
  for (const a of STAFF_APPS) assert.ok(CASES.filter((c) => c.bot === "staff" && c.app === a).length >= 5, a);
  assert.ok(CASES.filter((c) => c.bot !== "staff").length >= 25);
  assert.deepEqual(staticProblems(), []);
});
