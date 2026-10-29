// cnc-export.js (2026-10-29): /smida writes the CNC files itself now. The golden file was produced by the OLD /cnc page
// (cnc.html's own inline writeUsb, run on these same fixtures and stand-in masters just before the move) — so passing
// means the export still writes the same files byte for byte, the same Hurðaskrá / CNC skrá, the same Airtable tick
// and the same bell message.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
await import("../cnc-doors.js");
await import("../cnc-sides.js");
await import("../cnc-data.js");
await import("../cnc-export.js");
const { PROJECT, fakeFetch, Dir, dump, putMasters } = await import("./cnc-export-fixture.js");
const E = globalThis.CNCEXPORT;
const golden = JSON.parse(fs.readFileSync(new URL("./fixtures/cnc-export-golden.json", import.meta.url), "utf8"));

async function run(opts) {
  const calls = [], realFetch = globalThis.fetch, realLocale = Date.prototype.toLocaleString;
  globalThis.fetch = fakeFetch(calls); Date.prototype.toLocaleString = () => "TS";
  try {
    const P = await E.loadProject({ proxy: "/api/airtable", key: "KEY", id: PROJECT.id, name: PROJECT.name });
    E.planSides(P, null);
    const stick = new Dir("STICK"), root = await stick.getDirectoryHandle("[01] - AÐALMÖPPUR 09_06_2026", { create: true });
    await putMasters(root, globalThis.CNCSIDES, globalThis.CNCDOORS);
    const lines = [], result = await E.writeUsb(P, opts && opts.pickRoot ? root : stick, { log: (s) => lines.push(s) });
    await new Promise((r) => setTimeout(r, 20));
    const files = dump(stick); for (const k of Object.keys(files)) if (k.startsWith("[01]")) delete files[k];
    return { files, calls, result, lines };
  } finally { globalThis.fetch = realFetch; Date.prototype.toLocaleString = realLocale; }
}

test("the export writes exactly what the old /cnc wrote (byte for byte, 16 files)", async () => {
  const { files, calls, result } = await run();
  const want = Object.assign({}, golden), wantCalls = want.__calls; delete want.__calls;
  assert.deepEqual(Object.keys(files).sort(), Object.keys(want).sort());
  for (const k of Object.keys(want)) assert.equal(files[k], want[k], k);
  assert.equal(JSON.stringify(calls), wantCalls); // "6. CNC yfirfarið" tick + "CNC-skrár komnar á USB" Virkni line
  assert.equal(result.made.length, 13);
  assert.equal(result.missing.length, 0);
  assert.equal(result.folder, "T-77 Prufuverkefni");
  assert.equal(result.preview.length, 13);
});

test("the sheet and the Virkni line carry the same wording as before", async () => {
  const { calls, files } = await run();
  assert.match(files["T-77 Prufuverkefni/T-77 CNC skrá.txt"], /^CNC \x97 T-77 \| Prufuverkefni\r\nBúið til: TS\r\n/);
  const virkni = JSON.parse(calls.find((c) => c.url === "/api/virkni").body);
  assert.equal(virkni.texti, "CNC-skrár komnar á USB — 13 skrár, 8 ⚠");
  assert.equal(virkni.tengill, "/fraesing?recordId=" + PROJECT.id);
  assert.equal(JSON.parse(calls.find((c) => c.method === "PATCH").body).fields["6. CNC yfirfarið"], true);
});

test("picked folder without masters → nothing written, throws the ⛔ line", async () => {
  const P = await (async () => { const f = globalThis.fetch; globalThis.fetch = fakeFetch([]); try { const p = await E.loadProject({ proxy: "/api/airtable", key: "KEY", id: PROJECT.id, name: PROJECT.name }); E.planSides(p, null); return p; } finally { globalThis.fetch = f; } })();
  await assert.rejects(() => E.writeUsb(P, new Dir("TOM"), {}), /Fann ekki masterana/);
});

test("/smida has no /cnc frame left and /cnc is no longer linked from the tools", () => {
  const smida = fs.readFileSync(new URL("../smida.html", import.meta.url), "utf8");
  assert.doesNotMatch(smida, /cncFrame|CNC_API|iframe/);
  assert.match(smida, /CNCEXPORT\.writeUsb/);
  assert.match(smida, /<script src="\/cnc-export\.js">/);
});
