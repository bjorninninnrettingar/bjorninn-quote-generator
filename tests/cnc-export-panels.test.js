// The pieces that are not a plain carcass side (2026-10-29): end panel with LED, dishwasher front with milled grip, drawer
// bottom with the water-trap notch — end to end through the real writer onto an in-memory USB, with stand-in masters.
import { test } from "node:test";
import assert from "node:assert/strict";
await import("../cnc-doors.js");
await import("../cnc-sides.js");
await import("../cnc-data.js");
await import("../cnc-export.js");
const { Dir, dump, putMasters } = await import("./cnc-export-fixture.js");
const E = globalThis.CNCEXPORT, S = globalThis.CNCSIDES;

const PROJ = { id: "recPROJpanelsaaaaa", name: "T-78 | Panelar" };
const rw = (u, teg) => (Partur, H, B, Þ, M) => ({ id: "recS" + u + Partur.length + H, fields: { Partur, H, B, "Þ": Þ, M, "Tegund einingu": [teg], "Eyðublað ✏️": [{ id: u }] } });
const sink = rw("recSINK", "Grunnskápur"), end = rw("recENDP", "Úthlið"), dw = rw("recUTHV", "Stakur frontur");
const ROWS = [sink("Skápur hlið", 800, 580, 16, 2), sink("Skúffufrontur K - Merivo", 397, 1197, 19, 1), sink("Skúffufrontur E - Merivo", 397, 1197, 19, 1), sink("Skúffubotn - Merivo", 432, 1132, 16, 2),
  end("Úthlið", 580, 720, 19, 2), dw("Frontur", 700, 597, 19, 1)];
const UNITS = [
  { id: "recSINK", fields: { Athugasemd: "Sk4 | Vaskskápur", "Fjöldi eininga": 1, "Hæð": 800, "Smíðagögn (JSON) 🔧": JSON.stringify({ v: 1, ready: true, urtak: { drawer: "E", place: "midja" } }) } },
  { id: "recENDP", fields: { Athugasemd: "Sk20 | Úthlið", "Fjöldi eininga": 2, "Hæð": 720, "Smíðagögn (JSON) 🔧": JSON.stringify({ v: 1, ready: true, led: [{ where: "hlid", y: 50 }] }) } },
  { id: "recUTHV", fields: { Athugasemd: "Sk30 | UÞV frontur", "Fjöldi eininga": 1, "Hæð": 700, "Smíðagögn (JSON) 🔧": JSON.stringify({ v: 1, ready: true, frontGrip: "efst" }) } },
];
function fakeFetch() {
  return async (url) => {
    const u = new URL(url, "http://x"), path = u.searchParams.get("path") || "", recs = (rs) => ({ ok: true, json: async () => ({ records: rs }) });
    if (path === "tbl0WcyHhz63pSzZX") return recs(UNITS);
    if (path === "tblhdgyvTcBfP8kov") return recs(ROWS);
    if (path === "tbl4LMXlQjp66RFKI") return recs([{ id: PROJ.id, fields: { "Heiti tækifæris / verkefnis": PROJ.name } }]);
    return recs([]);
  };
}

test("end panel, dishwasher front and the drawer bottom notch are written as their own files", async () => {
  const realFetch = globalThis.fetch; globalThis.fetch = fakeFetch();
  try {
    const P = await E.loadProject({ proxy: "/api/airtable", key: "KEY", id: PROJ.id, name: PROJ.name });
    E.planSides(P, null);
    const stick = new Dir("STICK"), root = await stick.getDirectoryHandle("[01] - AÐALMÖPPUR 09_06_2026", { create: true });
    await putMasters(root, S, globalThis.CNCDOORS);
    const result = await E.writeUsb(P, stick, { log: () => {} });
    const files = dump(stick); for (const k of Object.keys(files)) if (k.startsWith("[01]")) delete files[k];
    const names = Object.keys(files).filter((k) => /\.bpp$/.test(k)).sort();
    assert.deepEqual(result.missing, []);
    assert.ok(names.includes("T-78 Panelar/Skápar/Sk20 - Úthlið/Úthlið.bpp"), names.join("\n"));
    assert.ok(names.includes("T-78 Panelar/Skápar/Sk30 - Stakur frontur/Uppþvottavélarfrontur 700.bpp") || names.some((n) => /Uppþvottavélarfrontur 700\.bpp$/.test(n)), names.join("\n"));
    assert.ok(names.some((n) => /Sk4 .*\/Skúffubotn E úrtak\.bpp$/.test(n)), names.join("\n"));
    assert.ok(!names.some((n) => /Sk30.*Hliðar|Sk20.*Hliðar/.test(n))); // no side files for those two
    const panel = files[names.find((n) => /Úthlið\.bpp$/.test(n))];
    assert.match(panel, /LED 4x8 \(Smíða Y 50\)/); assert.ok(panel.includes("PAN=LPX|720|"));
    assert.ok(result.made.some((m) => /Úthlið\.bpp +\(720×580×19, keyra ×2\)/.test(m)), result.made.join("\n"));
    const gr = files[names.find((n) => /Uppþvottavélarfrontur/.test(n))];
    assert.ok(gr.includes("@ HARDVIDAR_GRIP_ENDA_TIL_ENDA") && gr.includes(": 700, 30") && gr.includes("PAN=LPX|597|"));
    const ur = files[names.find((n) => /úrtak\.bpp$/.test(n))];
    assert.ok(ur.includes("@ URTAK_F_VATNSLAS") && ur.includes(": lpx/2, midja, merivo") && ur.includes("PAN=LPX|1132|"));
  } finally { globalThis.fetch = realFetch; }
});
