// api/kp-price.js — the PRO live quote: Airtable's Line Item price formula, reproduced.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { unitPrice, validate, num, price } from "../api/kp-price.js";
import { mockRes } from "./helpers.js";

const A = "recAAAAAAAAAAAAAA", B = "recBBBBBBBBBBBBBB", C = "recCCCCCCCCCCCCCC";
// Útfærslur fields by id: price, V3 price, % af plötu skrokkar, fm fronta, % borðplata, % hurð, metrar KL
const variants = {
  [A]: { fld36kgODkNOZNOeU: 8866.666666666666, fldpDs9vsXO1neZU6: [0.1], fldVq3i01NtRfM5sz: 0.2, fldBncYRtRGpEN5G3: [0.05], fldnSzFZvb5QHv4dr: [4] },
  [B]: { fld36kgODkNOZNOeU: 12000, fldVq3i01NtRfM5sz: 0.3 },
  [C]: { fld730X4XCEc23o1r: 5000 },
};
const mat = { carcass: 20000, front: 30000, top: 40000, door: 0, kl: 120 };

test("unit price = (V1+V2+V3 + material × markup) / 1.24 × discounts × smáverk", () => {
  // material = 20000×0.1 + 30000×(0.2+0.3) + 40000×0.05 + 120×4 = 2000+15000+2000+480 = 19480
  const gross = 8866.666666666666 + 12000 + 5000 + 19480 * 2.05;
  const got = unitPrice({ v1: [A], v2: [B], v3: [C], qty: 2, disc: 0.05, markup: 2.05 }, variants, mat, { hidden: 0.1, small: 1.1 });
  assert.ok(Math.abs(got - gross / 1.24 * 0.95 * 0.9 * 1.1) < 1e-6);
  assert.equal(unitPrice({ v1: [A], qty: 0 }, variants, mat, { hidden: 0, small: 1 }), 0); // Magn 0 → 0, like Airtable's IF({Magn}, …, 0)
});

test("matches a real T-32 line (Úthlið á grunnskáp: V1 8866.67, efniskostnaður×álagning 3231.31, no smáverk)", () => {
  // Airtable: Einingarverð (lifandi) = 9756.433271555466 = (8866.666… + 3231.31…) / 1.24
  const v = { [A]: { fld36kgODkNOZNOeU: 8866.666666666666, fldpDs9vsXO1neZU6: 1 } };
  const got = unitPrice({ v1: [A], qty: 1, markup: 2.05 }, v, { carcass: 3231.3105900621117 / 2.05, front: 0, top: 0, door: 0, kl: 0 }, { hidden: 0, small: 1 });
  assert.ok(Math.abs(got - 9756.433271555466) < 0.01);
});

test("a Frontaefni #2 line prices its fronts on FR2's plate", () => {
  const m2 = Object.assign({}, mat, { front2: 50000 });
  const fr1 = unitPrice({ v1: [A], qty: 1, markup: 2.05 }, variants, m2, { hidden: 0, small: 1 });
  const fr2 = unitPrice({ v1: [A], qty: 1, markup: 2.05, front2: true }, variants, m2, { hidden: 0, small: 1 });
  assert.ok(Math.abs((fr2 - fr1) - (50000 - 30000) * 0.2 * 2.05 / 1.24) < 1e-6); // V1's 0.2 m² of front at the other plate
  assert.equal(unitPrice({ v1: [A], qty: 1, front2: true }, variants, mat, { hidden: 0, small: 1 }), unitPrice({ v1: [A], qty: 1 }, variants, mat, { hidden: 0, small: 1 })); // no FR2 on the project → FR1, like Airtable's AND()
});

test("num() sums lookup arrays and reads text formulas", () => {
  assert.equal(num([1, 2, [3]]), 6);
  assert.equal(num("400"), 400);
  assert.equal(num(undefined), 0);
});

test("validates input and needs the office key", async () => {
  assert.equal(validate({ recordId: A, lines: [{ key: "Sk1", v1: [A] }] }), null);
  assert.equal(validate({ recordId: "x", lines: [] }), "Ógilt recordId");
  assert.equal(validate({ recordId: A, lines: [{ key: "Sk1; DROP" }] }), "Ógilt 🔑");
  assert.equal(validate({ recordId: A, lines: [{ key: "Sk1", v1: ["') OR TRUE()"] }] }), "Ógild tenging");
  assert.equal(validate({ recordId: A, lines: [], materials: { front: "nope" } }), "Ógilt efni");
  process.env.AIRTABLE_TOKEN = "t"; process.env.VERK_KEY = "secret";
  const res = mockRes();
  await handler({ method: "POST", body: { k: "wrong", recordId: A, lines: [] } }, res);
  assert.equal(res.statusCode, 403);
});

// D3 (2026-10-26): the live quote is compared with the same lines + handles as Airtable has them now, not with the
// Tækifæri's whole Tilboðsupphæð (which also holds parts that aren't lines) — T-32 showed "−4,154,620 þegar þú vistar".
test("airtableLinesTotal = Airtable's own lines × Einingarverð + handles, apart from the Tækifæri's Tilboðsupphæð", async () => {
  const opp = { id: "recOPP0000000000a", fields: { fldDC7LI0D4cUeCds: "T-99 | Prófun", fldeXc2zWOrmaGtkC: 5000000, fldYsA3vFjGHXYN3B: 12400 } };
  const rows = [
    { id: "recLINE000000000a", fields: { "🔑": "Sk1", "Magn": 2, "Einingarverð": 100000, "Tækifæri 📣 (projects)": [opp.id] } },
    { id: "recLINE000000000b", fields: { "🔑": "Annað", "Magn": 1, "Einingarverð": 50000, "Tækifæri 📣 (projects)": [opp.id] } },
    { id: "recLINE000000000c", fields: { "🔑": "Sk9", "Magn": 0, "Einingarverð": 99999, "Tækifæri 📣 (projects)": [opp.id] } },
  ];
  const at = async (method, path) => path.startsWith("tbl4LMXlQjp66RFKI/") ? opp : path.startsWith("tblFcsUoGxsuUwNEH") ? { records: rows } : { records: [] };
  const d = await price(at, { recordId: opp.id, lines: [] });
  assert.equal(d.airtableTotal, 5000000);
  assert.equal(d.airtableLinesTotal, Math.round((2 * 100000 + 50000) * 1.24 + 12400));
});

// 2026-10-26: the Tilboð panel previews Ósýnilegur afsláttur / Smáverka álagning while they're typed, and marks the
// lines whose amount changes against Airtable (`was`).
test("project override scales unchanged lines (not price-locked ones) and every line carries its Airtable amount", async () => {
  const opp = { id: "recOPP0000000000a", fields: { fldDC7LI0D4cUeCds: "T-99 | Prófun", fldxxGsEY1GkEw4BB: 0.1 } };
  const rows = [
    { id: "recLINE000000000a", fields: { "🔑": "Sk1", "Magn": 1, "Einingarverð": 90000, "Tækifæri 📣 (projects)": [opp.id] } },
    { id: "recLINE000000000b", fields: { "🔑": "Annað", "Magn": 1, "Einingarverð": 45000, "Læstur verðlykill 🔒": "x", "Verðlykill": "x", "Tækifæri 📣 (projects)": [opp.id] } },
  ];
  const at = async (method, path) => path.startsWith("tbl4LMXlQjp66RFKI/") ? opp : path.startsWith("tblFcsUoGxsuUwNEH") ? { records: rows } : { records: [] };
  const d = await price(at, { recordId: opp.id, lines: [{ key: "Sk1", qty: 1 }], project: { hidden: 0.2, small: "Smáverk 10%" } });
  assert.equal(d.lines[0].was, Math.round(90000 * 1.24));
  assert.equal(d.lines[0].total, Math.round(90000 * (0.8 * 1.1) / 0.9 * 1.24));
  assert.equal(d.other[0].total, Math.round(45000 * 1.24)); // locked: untouched
  assert.equal(d.small, "Smáverk 10%");
  assert.equal(validate({ recordId: A, lines: [], project: { hidden: 1.5 } }), "Ógildur afsláttur");
  assert.equal(validate({ recordId: A, lines: [], project: { small: "Smáverk 99%" } }), "Ógild smáverka álagning");
});
