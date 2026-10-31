import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cfg = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const ignore = readFileSync(new URL("../.vercelignore", import.meta.url), "utf8").split("\n");

test("office pages cannot be framed by other sites", () => {
  const rule = cfg.headers.find((h) => h.source.includes("skrifstofa"));
  assert.ok(rule, "frame rule for office pages exists");
  const keys = rule.headers.map((h) => h.key);
  assert.ok(keys.includes("X-Frame-Options") && keys.includes("Content-Security-Policy"));
  // the customer portal is embedded in the Wix site on purpose
  assert.ok(!/verkefni|skipuleggja/.test(rule.source));
});

test("internal docs and the floorplan are not deployed", () => {
  for (const p of ["docs", "CLAUDE.md", "floorplan", "scripts"]) assert.ok(ignore.includes(p), p);
});
