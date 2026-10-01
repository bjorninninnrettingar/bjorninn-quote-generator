// Every page's inline <script> must at least parse — catches the "one missing bracket takes a page down
// in production" class of mistake. Plus sanity checks on generated data files.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const pages = fs.readdirSync(root).filter((f) => f.endsWith(".html"));

for (const page of pages) {
  test(`${page}: inline scripts parse`, () => {
    const html = fs.readFileSync(new URL(page, root), "utf8");
    const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
    let m, i = 0;
    while ((m = re.exec(html))) {
      const attrs = m[1] || "";
      if (/\bsrc=/.test(attrs) || /type=["'](importmap|application\/(ld\+)?json|text\/template)/.test(attrs)) continue;
      i++;
      const isModule = /type=["']module["']/.test(attrs);
      try {
        new vm.Script(isModule ? `(async () => {\n${m[2].replace(/^\s*import\s[^;]+;/gm, "")}\n})` : m[2], { filename: `${page}#script${i}` });
      } catch (e) {
        assert.fail(`${page} script #${i}: ${e.message}`);
      }
    }
  });
}

for (const js of fs.readdirSync(root).filter((f) => /^kitchen-planner.*\.js$/.test(f) || f === "chat-widget.js")) {
  test(`${js}: parses`, () => { new vm.Script(fs.readFileSync(new URL(js, root), "utf8"), { filename: js }); });
}

test("kitchen-planner-linemap.js: every product id is a real record id", () => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(new URL("kitchen-planner-linemap.js", root), "utf8"), ctx);
  const map = ctx.window.KP_LINEMAP;
  assert.ok(map && map.v1 && map.v2Drawers, "KP_LINEMAP loaded");
  let n = 0;
  (function walk(o) {
    for (const v of Object.values(o)) {
      if (v && typeof v === "object") { if ("id" in v) { assert.match(v.id, /^rec[A-Za-z0-9]{14}$/); n++; } walk(v); }
    }
  })(map);
  assert.ok(n > 200, `found ${n} ids`);
});
