// api/kp-pro.js — pro-mode save: designer state back to the Tækifæri, Smíðagögn onto Line Items by 🔑.
import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { save, validate, orphans, retire, validateOrphanAction } from "../api/kp-pro.js";
import { makeAirtable } from "../api/kp-submit.js";
import { mockRes, fakeFetch as rawFetch, byLink } from "./helpers.js";

const OPP = "recAAAAAAAAAAAAAA";
const fakeFetch = (r) => rawFetch(byLink(r, { opp: OPP })); // lines are found through the Tækifæri's link field
const SM = (h) => ({ v: 1, doors: [{ h, type: "hinged", hinges: [{ from: "bottom", mm: 80 }, { from: "top", mm: 80 }] }] });
const routes = (call) => {
  if (call.method === "GET" && call.url.includes(`tbl4LMXlQjp66RFKI/${OPP}`))
    return { status: 200, body: { id: OPP, fields: { "Heiti tækifæris / verkefnis": "T-227 | Prófun", "Sjálfsafgreiðsla skipulag (JSON) 📐": JSON.stringify({ submissionId: "sid-1" }) } } };
  if (call.method === "GET" && call.url.includes("tblFcsUoGxsuUwNEH"))
    return { status: 200, body: { records: [
      { id: "recL1", fields: { "🔑": "Sk1", "Tækifæri 📣 (projects)": [OPP], "Smíðagögn (JSON) 🔧": JSON.stringify(SM(797)) } },
      { id: "recL2", fields: { "🔑": "Sk2", "Tækifæri 📣 (projects)": [OPP] } },
      { id: "recLX", fields: { "🔑": "Sk3", "Tækifæri 📣 (projects)": ["recOTHERPROJECT00"] } },
    ] } };
  return { status: 200, body: { records: [] } };
};

test("writes the state (keeping submissionId) and only the Smíðagögn that changed; reports keys it can't find", async () => {
  const f = fakeFetch(routes);
  const out = await save(makeAirtable("t", { fetchImpl: f, delays: [] }), { recordId: OPP, state: { walls: [] }, smida: { Sk1: SM(797), Sk2: SM(467), Sk3: SM(400) } });
  assert.deepEqual([out.updated, out.unchanged, out.missing], [1, 1, ["Sk3"]]);  // Sk3 belongs to another project
  const proj = f.calls.find((c) => c.method === "PATCH" && c.url.includes("tbl4LMXlQjp66RFKI"));
  const lines = f.calls.find((c) => c.method === "PATCH" && c.url.includes("tblFcsUoGxsuUwNEH"));
  assert.equal(JSON.parse(proj.body.records[0].fields["Sjálfsafgreiðsla skipulag (JSON) 📐"]).submissionId, "sid-1");
  assert.deepEqual(lines.body.records.map((r) => r.id), ["recL2"]);
});

test("needs the office key and valid input", async () => {
  process.env.AIRTABLE_TOKEN = "t"; process.env.VERK_KEY = "secret";
  const res = mockRes();
  await handler({ method: "POST", body: { k: "wrong", recordId: OPP, state: { walls: [] }, smida: {} } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: { "Sk1; DROP": null } }), "Ógilt 🔑: Sk1; DROP");
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: { Sk1: { v: 2 } } }), "Ógild Smíðagögn: Sk1");
});

test("cabinets without a Line Item get one (same fields as a submission); lines no longer drawn are reported, never deleted", async () => {
  const f = fakeFetch(routes);
  const li = (k, extra) => Object.assign({ "🔑": k, "Rými 🏡": "Eldhús", "Magn": 1, "Vöru reitur 1": ["recV1V1V1V1V1V1V1"], "Smíðagögn (JSON) 🔧": '{"v":1,"w":600}', "Bull": "x" }, extra);
  const out = await save(makeAirtable("t", { fetchImpl: f, delays: [] }), {
    recordId: OPP, state: { walls: [] }, smida: { Sk1: SM(797), Sk4: { v: 1, w: 600 } }, lineItems: [li("Sk1"), li("Sk4")] });
  assert.deepEqual([out.created, out.updated, out.removed], [1, 0, ["Sk2"]]);
  const post = f.calls.find((c) => c.method === "POST");
  assert.equal(post.body.typecast, true);
  assert.deepEqual(post.body.records, [{ fields: { "Tækifæri 📣 (projects)": [OPP], "Rými 🏡": "Eldhús", "Magn": 1, "Vöru reitur 1": ["recV1V1V1V1V1V1V1"], "🔑": "Sk4", "Smíðagögn (JSON) 🔧": '{"v":1,"w":600}' } }]);
  assert.ok(!f.calls.some((c) => c.method === "DELETE"));
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: {}, lineItems: [{ "🔑": "Sk 1" }] }), "Ógilt 🔑 á línu");
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: {}, lineItems: [{ "🔑": "Sk1", "Vöru reitur 1": ["nope"] }] }), "Ógild tenging");
});

test("V1/V2/V3: the drawing updates what Airtable hasn't touched, keeps Rakel's hand picks, asks when both changed", async () => {
  const A = "recAAAAAAAAAAAAA1", B = "recBBBBBBBBBBBBB2", C = "recCCCCCCCCCCCCC3", D = "recDDDDDDDDDDDDD4";
  const rows = [
    { id: "recS1", fields: { "🔑": "Sk1", "Vöru reitur 2": [A] } }, // drawing changed A → B, Airtable still A → write B
    { id: "recS2", fields: { "🔑": "Sk2", "Vöru reitur 2": [C] } }, // Airtable changed A → C, drawing still A → keep C
    { id: "recS3", fields: { "🔑": "Sk3", "Vöru reitur 2": [C] } }, // both changed → conflict
    { id: "recS4", fields: { "🔑": "Sk4", "Vöru reitur 2": [D] } }, // never sent (old line) and different → conflict
  ].map((r) => (r.fields["Tækifæri 📣 (projects)"] = [OPP], r));
  const sent = { Sk1: ["", A, ""], Sk2: ["", A, ""], Sk3: ["", A, ""] };
  const route = (call) => {
    if (call.method === "GET" && call.url.includes(`tbl4LMXlQjp66RFKI/${OPP}`))
      return { status: 200, body: { id: OPP, fields: { "Heiti tækifæris / verkefnis": "T-227 | P", "Sjálfsafgreiðsla skipulag (JSON) 📐": JSON.stringify({ liSent: sent }) } } };
    if (call.method === "GET" && call.url.includes("tblFcsUoGxsuUwNEH")) return { status: 200, body: { records: rows } };
    if (call.method === "GET" && call.url.includes("tbl8HjvBwNJ41cTV0"))
      return { status: 200, body: { records: [{ id: B, fields: { fldbG3jw1tEPEchGr: "Merivo E-skúff" } }, { id: C, fields: { fldbG3jw1tEPEchGr: "Merivo M-E" } }] } };
    return { status: 200, body: { records: [] } };
  };
  const li = (k, v2) => ({ "🔑": k, "Vöru reitur 2": [v2] });
  const body = { recordId: OPP, state: { walls: [] }, smida: { Sk1: null, Sk2: null, Sk3: null, Sk4: null },
    lineItems: [li("Sk1", B), li("Sk2", A), li("Sk3", B), li("Sk4", B)] };
  let f = fakeFetch(route);
  let out = await save(makeAirtable("t", { fetchImpl: f, delays: [] }), body);
  const linePatch = f.calls.find((c) => c.method === "PATCH" && c.url.includes("tblFcsUoGxsuUwNEH"));
  assert.deepEqual(linePatch.body.records, [{ id: "recS1", fields: { "Vöru reitur 2": [B] } }]);
  assert.deepEqual(out.conflicts.map((c) => [c.key, c.field, c.drawingNames, c.airtableNames]),
    [["Sk3", "V2", ["Merivo E-skúff"], ["Merivo M-E"]], ["Sk4", "V2", ["Merivo E-skúff"], [D]]]);
  const saved = JSON.parse(f.calls.find((c) => c.method === "PATCH" && c.url.includes("tbl4LMXlQjp66RFKI")).body.records[0].fields["Sjálfsafgreiðsla skipulag (JSON) 📐"]).liSent;
  assert.deepEqual(saved, { Sk1: ["", B, ""], Sk2: ["", A, ""], Sk3: ["", A, ""], Sk4: ["", null, ""] });

  // Rakel settles them: Sk3 → the drawing, Sk4 → Airtable (and Sk4 stays quiet afterwards).
  f = fakeFetch(route);
  out = await save(makeAirtable("t", { fetchImpl: f, delays: [] }), Object.assign({}, body, { resolve: { Sk3: "drawing", Sk4: "airtable" } }));
  assert.deepEqual(f.calls.find((c) => c.method === "PATCH" && c.url.includes("tblFcsUoGxsuUwNEH")).body.records.map((r) => r.id), ["recS1", "recS3"]);
  assert.deepEqual(out.conflicts, []);
  assert.deepEqual(out.liSent.Sk4, ["", B, ""]);
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: {}, resolve: { Sk1: "maybe" } }), "Ógilt resolve: Sk1");
});

test("materials/handles: the drawing's pick reaches the Tækifæri unless only Airtable changed it", async () => {
  const F1 = "recFRONT111111111", F2 = "recFRONT222222222", F3 = "recFRONT333333333";
  const run = async (airtableFront, projSent, drawingFront) => {
    const f = fakeFetch((call) => {
      if (call.method === "GET" && call.url.includes(`tbl4LMXlQjp66RFKI/${OPP}`))
        return { status: 200, body: { id: OPP, fields: { "Heiti tækifæris / verkefnis": "T-227 | Prófun", "Fronta efni viðskiptavinar 🖼️": [airtableFront], "Magn Halda 1": 765,
          "Sjálfsafgreiðsla skipulag (JSON) 📐": JSON.stringify({ submissionId: "sid-1", projSent }) } } };
      return routes(call);
    });
    const out = await save(makeAirtable("t", { fetchImpl: f, delays: [] }), { recordId: OPP, state: { walls: [] }, smida: {},
      project: { "Fronta efni viðskiptavinar 🖼️": [drawingFront], "Magn Halda 1": 40 } });
    const proj = f.calls.find((c) => c.method === "PATCH" && c.url.includes("tbl4LMXlQjp66RFKI")).body.records[0].fields;
    return { out, proj };
  };
  // never sent before (old project): drawing wins, also fixes a wrong hand count
  let r = await run(F1, undefined, F2);
  assert.deepEqual(r.proj["Fronta efni viðskiptavinar 🖼️"], [F2]);
  assert.equal(r.proj["Magn Halda 1"], 40);
  assert.deepEqual(r.out.projectUpdated.sort(), ["Fronta efni viðskiptavinar 🖼️", "Magn Halda 1"].sort());
  // Rakel picked F3 by hand in Airtable, drawing still has what it sent (F2) → Airtable stays
  r = await run(F3, { "Fronta efni viðskiptavinar 🖼️": F2 }, F2);
  assert.equal(r.proj["Fronta efni viðskiptavinar 🖼️"], undefined);
  assert.equal(JSON.parse(r.proj["Sjálfsafgreiðsla skipulag (JSON) 📐"]).projSent["Fronta efni viðskiptavinar 🖼️"], F2);
  // changed in the drawing since → drawing wins
  r = await run(F3, { "Fronta efni viðskiptavinar 🖼️": F2 }, F1);
  assert.deepEqual(r.proj["Fronta efni viðskiptavinar 🖼️"], [F1]);
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: {}, project: { "Skilaboð til skipulags": "x" } }), "Ógilt efnisval: Skilaboð til skipulags");
});

test("room doors are their own lines (HU1…), validated like cabinets", () => {
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: { HU1: { v: 1, door: { widthMm: 800 } } },
    lineItems: [{ "🔑": "HU1", "Vöru reitur 1": ["rec5kbxFHLWvM02rt"], "Smíðagögn (JSON) 🔧": '{"v":1,"door":{}}' }] }), null);
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: { XX1: null } }), "Ógilt 🔑: XX1");
});

test("FR2 / inner fronts on existing lines: drawing writes its picks, never clears a hand-set FR2 it never sent", async () => {
  const run = async (rowFields, liExtra, li) => {
    const f = fakeFetch((call) => {
      if (call.method === "GET" && call.url.includes(`tbl4LMXlQjp66RFKI/${OPP}`))
        return { status: 200, body: { id: OPP, fields: { "Heiti tækifæris / verkefnis": "T-227 | Prófun", "Sjálfsafgreiðsla skipulag (JSON) 📐": JSON.stringify({ submissionId: "sid-1", liExtra }) } } };
      if (call.method === "GET" && call.url.includes("tblFcsUoGxsuUwNEH"))
        return { status: 200, body: { records: [{ id: "recL1", fields: Object.assign({ "🔑": "Sk1", "Tækifæri 📣 (projects)": [OPP] }, rowFields) }] } };
      return { status: 200, body: { records: [] } };
    });
    await save(makeAirtable("t", { fetchImpl: f, delays: [] }), { recordId: OPP, state: { walls: [] }, smida: { Sk1: null }, lineItems: [Object.assign({ "🔑": "Sk1" }, li)] });
    const p = f.calls.find((c) => c.method === "PATCH" && c.url.includes("tblFcsUoGxsuUwNEH"));
    return p ? p.body.records[0].fields : {};
  };
  assert.deepEqual(await run({}, undefined, { "Frontaefni #2": true, "Tegund innskúffu fronts": "Frontaefni 2" }), { "Frontaefni #2": true, "Tegund innskúffu fronts": "Frontaefni 2" });
  assert.deepEqual(await run({ "Frontaefni #2": true }, undefined, { "Frontaefni #2": false }), {});            // hand-set, drawing never sent → kept
  assert.deepEqual(await run({ "Frontaefni #2": true }, { Sk1: { "Frontaefni #2": "1" } }, { "Frontaefni #2": false }), { "Frontaefni #2": false }); // drawing turned it off
});

// two computers (2026-10-26): Airtable's proSavedAt newer than what this copy was based on → 409, nothing written
const savedRoutes = (savedAt) => (call) => {
  if (call.method === "GET" && call.url.includes(`tbl4LMXlQjp66RFKI/${OPP}`))
    return { status: 200, body: { id: OPP, fields: { "Sjálfsafgreiðsla skipulag (JSON) 📐": JSON.stringify(savedAt ? { proSavedAt: savedAt } : {}) } } };
  return { status: 200, body: { records: [] } };
};
test("a newer save from another computer stops Vista with 409 (savedAt), force overwrites, no basedOn = not checked", async () => {
  const T1 = "2026-10-26T10:00:00.000Z", T2 = "2026-10-26T11:30:00.000Z";
  process.env.AIRTABLE_TOKEN = "t"; process.env.VERK_KEY = "secret";
  const body = (extra) => Object.assign({ k: "secret", recordId: OPP, state: { walls: [] }, smida: {} }, extra);
  // based on T1, Airtable has T2 → conflict, no PATCH at all
  let f = fakeFetch(savedRoutes(T2));
  await assert.rejects(save(makeAirtable("t", { fetchImpl: f, delays: [] }), body({ basedOn: T1 })), (e) => e.status === 409 && e.savedAt === T2);
  assert.ok(!f.calls.some((c) => c.method !== "GET"));
  // based on nothing (null) but Airtable has a PRO save → conflict too
  f = fakeFetch(savedRoutes(T2));
  await assert.rejects(save(makeAirtable("t", { fetchImpl: f, delays: [] }), body({ basedOn: null })), (e) => e.status === 409);
  // same version → saves, returns the new stamp
  f = fakeFetch(savedRoutes(T2));
  const ok = await save(makeAirtable("t", { fetchImpl: f, delays: [] }), body({ basedOn: T2 }));
  assert.ok(Date.parse(ok.proSavedAt) > Date.parse(T2));
  const json = JSON.parse(f.calls.find((c) => c.method === "PATCH").body.records[0].fields["Sjálfsafgreiðsla skipulag (JSON) 📐"]);
  assert.equal(json.proSavedAt, ok.proSavedAt);
  // force → writes over the newer one
  f = fakeFetch(savedRoutes(T2));
  await save(makeAirtable("t", { fetchImpl: f, delays: [] }), body({ basedOn: T1, force: true }));
  assert.ok(f.calls.some((c) => c.method === "PATCH"));
  // an old page with no basedOn → not checked
  f = fakeFetch(savedRoutes(T2));
  await save(makeAirtable("t", { fetchImpl: f, delays: [] }), body({}));
  assert.ok(f.calls.some((c) => c.method === "PATCH"));
  // a never-PRO-saved drawing (customer submission) with basedOn null → saves
  f = fakeFetch(savedRoutes(null));
  await save(makeAirtable("t", { fetchImpl: f, delays: [] }), body({ basedOn: null }));
  assert.ok(f.calls.some((c) => c.method === "PATCH"));
  // the handler answers 409 with the time
  const res = mockRes();
  const orig = globalThis.fetch; globalThis.fetch = fakeFetch(savedRoutes(T2));
  try { await handler({ method: "POST", body: body({ basedOn: T1 }) }, res); } finally { globalThis.fetch = orig; }
  assert.equal(res.statusCode, 409);
  assert.deepEqual([res.body.conflict, res.body.savedAt], [true, T2]);
  assert.equal(validate(body({ basedOn: "nope" })), "Ógilt basedOn");
  assert.equal(validate(body({ force: "yes" })), "Ógilt force");
});

// G1 (2026-10-27): handles go as per-SKU counts; Vista writes Airtable's two priced slots. A one-SKU drawing never
// clears a Halda 2 that was set by hand (the drawing never sent one).
test("handleSkus → Höldur ✊ / ✊2.0 slots, Halda 2 set by hand survives a one-SKU drawing", async () => {
  const H1 = "recHANDLE11111111", H2 = "recHANDLE22222222", H3 = "recHANDLE33333333", HX = "recHANDLEXXXXXXXX";
  const prices = { [H1]: 10000, [H2]: 12000, [H3]: 20000 };
  const run = async (skus, oppExtra, projSent) => {
    const f = fakeFetch((call) => {
      if (call.method === "GET" && call.url.includes(`tbl4LMXlQjp66RFKI/${OPP}`))
        return { status: 200, body: { id: OPP, fields: Object.assign({ "Heiti tækifæris / verkefnis": "T-227 | Prófun",
          "Sjálfsafgreiðsla skipulag (JSON) 📐": JSON.stringify({ submissionId: "sid-1", projSent }) }, oppExtra) } };
      if (call.method === "GET" && call.url.includes("tblzuuRSRkeXaLWxC"))
        return { status: 200, body: { records: Object.keys(prices).filter((id) => decodeURIComponent(call.url).includes(id)).map((id) => ({ id, fields: { fldCJjSJWoUWyT7iv: prices[id] } })) } };
      return routes(call);
    });
    await save(makeAirtable("t", { fetchImpl: f, delays: [] }), { recordId: OPP, state: { walls: [] }, smida: {}, project: {}, handleSkus: skus });
    return f.calls.find((c) => c.method === "PATCH" && c.url.includes("tbl4LMXlQjp66RFKI")).body.records[0].fields;
  };
  let p = await run([{ id: H1, n: 10 }, { id: H3, n: 2 }], { "Höldur Viðskiptavinar ✊": [H1, H2, H3], "Magn Halda 1": 12 });
  assert.deepEqual(p["Höldur Viðskiptavinar ✊"], [H1]);
  assert.equal(p["Magn Halda 1"], 10);
  assert.deepEqual(p["Höldur Viðskiptavinar ✊2.0"], [H3]);
  assert.equal(p["Magn halda 2.0"], 2);
  // one SKU, Halda 2 set by hand in Airtable, drawing never sent a Halda 2 → untouched
  p = await run([{ id: H1, n: 10 }], { "Höldur Viðskiptavinar ✊": [H1], "Magn Halda 1": 4, "Höldur Viðskiptavinar ✊2.0": [HX], "Magn halda 2.0": 3 });
  assert.equal(p["Magn Halda 1"], 10);
  assert.equal(p["Höldur Viðskiptavinar ✊2.0"], undefined);
  assert.equal(p["Magn halda 2.0"], undefined);
  // …but one the drawing wrote itself is cleared when it drops to one SKU
  p = await run([{ id: H1, n: 10 }], { "Höldur Viðskiptavinar ✊": [H1], "Magn Halda 1": 10, "Höldur Viðskiptavinar ✊2.0": [H3], "Magn halda 2.0": 2 },
    { "Höldur Viðskiptavinar ✊2.0": H3, "Magn halda 2.0": "2" });
  assert.deepEqual(p["Höldur Viðskiptavinar ✊2.0"], []);
  assert.equal(p["Magn halda 2.0"], 0);
  // three SKUs: the planner JSON keeps the real ones for the quote PDF, with the slot key it wrote
  p = await run([{ id: H1, n: 6 }, { id: H2, n: 8 }, { id: H3, n: 3 }], {});
  const hp = JSON.parse(p["Sjálfsafgreiðsla skipulag (JSON) 📐"]).handlesPrint;
  assert.deepEqual(hp.skus.map((x) => [x.id, x.n]), [[H1, 6], [H2, 8], [H3, 3]]);
  assert.equal(hp.key, [p["Höldur Viðskiptavinar ✊"].join(","), p["Magn Halda 1"], p["Höldur Viðskiptavinar ✊2.0"].join(","), p["Magn halda 2.0"]].join("|"));
  assert.equal(validate({ recordId: OPP, state: { walls: [] }, smida: {}, handleSkus: [{ id: H1, n: -1 }] }), "Ógildar höldur");
});

// ---- PRO save path fixes (2026-10-28: P-01, P-03, P-04) ----
const PJ = "Sjálfsafgreiðsla skipulag (JSON) 📐";
test("P-01: planner JSON over 99 000 chars drops measurement/proAck/categoryData first and says so; never-fits = 413 before any write", async () => {
  const big = "x".repeat(60000);
  let f = fakeFetch(routes);
  const out = await save(makeAirtable("t", { fetchImpl: f, delays: [] }), { recordId: OPP, state: { walls: [], measurement: big, proAck: big }, smida: { Sk1: SM(797) } });
  assert.deepEqual(out.trimmed, ["measurement"]);
  const proj = f.calls.find((c) => c.method === "PATCH" && c.url.includes("tbl4LMXlQjp66RFKI"));
  const saved = JSON.parse(proj.body.records[0].fields[PJ]);
  assert.ok(!("measurement" in saved) && "proAck" in saved);
  f = fakeFetch(routes);
  await assert.rejects(save(makeAirtable("t", { fetchImpl: f, delays: [] }), { recordId: OPP, state: { walls: [], x: "y".repeat(100000) }, smida: { Sk2: SM(467) } }), (e) => e.status === 413);
  assert.ok(!f.calls.some((c) => c.method === "PATCH" || c.method === "POST"), "nothing written when the JSON can never fit");
});

test("P-03: handleSkus [] clears both handle slots; undefined (no handle info) leaves them alone", async () => {
  const withHandles = (call) => {
    const o = routes(call);
    if (call.method === "GET" && call.url.includes(`tbl4LMXlQjp66RFKI/${OPP}`)) o.body.fields = Object.assign({}, o.body.fields, { "Höldur Viðskiptavinar ✊": ["recH1H1H1H1H1H1H1"], "Magn Halda 1": 12 });
    return o;
  };
  let f = fakeFetch(withHandles);
  const out = await save(makeAirtable("t", { fetchImpl: f, delays: [] }), { recordId: OPP, state: { walls: [] }, smida: {}, handleSkus: [] });
  const fields = f.calls.find((c) => c.method === "PATCH" && c.url.includes("tbl4LMXlQjp66RFKI")).body.records[0].fields;
  assert.deepEqual(fields["Höldur Viðskiptavinar ✊"], []);
  assert.equal(fields["Magn Halda 1"], 0);
  assert.ok(out.projectUpdated.includes("Magn Halda 1"));
  f = fakeFetch(withHandles);
  const out2 = await save(makeAirtable("t", { fetchImpl: f, delays: [] }), { recordId: OPP, state: { walls: [] }, smida: {} });
  assert.ok(!out2.projectUpdated.includes("Magn Halda 1"));
});

test("P-04: the final state write is retried; if it never lands the handler answers partial with what was written", async () => {
  let n = 0;
  const flaky = (call) => {
    if (call.method === "PATCH" && call.url.includes("tbl4LMXlQjp66RFKI")) { n++; return n < 3 ? { status: 503, body: { error: "x" } } : routes(call); }
    return routes(call);
  };
  const out = await save(makeAirtable("t", { fetchImpl: fakeFetch(flaky), delays: [] }), { recordId: OPP, state: { walls: [] }, smida: { Sk2: SM(467) } });
  assert.equal(out.updated, 1);
  const dead = (call) => (call.method === "PATCH" && call.url.includes("tbl4LMXlQjp66RFKI") ? { status: 503, body: { error: "x" } } : routes(call));
  const res = mockRes();
  process.env.AIRTABLE_TOKEN = "t"; process.env.VERK_KEY = "secret";
  const orig = globalThis.fetch; globalThis.fetch = fakeFetch(dead);
  try { await handler({ method: "POST", body: { k: "secret", recordId: OPP, state: { walls: [] }, smida: { Sk2: SM(467) } } }, res); } finally { globalThis.fetch = orig; }
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.partial, true);
  assert.equal(res.body.updated, 1);
});

test("P-02: orphans lists lines not in the drawing; retire deletes only those, never a drawn key or a line with an Eyðublað", async () => {
  const rows = (call) => {
    if (call.method === "GET" && call.url.includes("tblFcsUoGxsuUwNEH"))
      return { status: 200, body: { records: [
        { id: "recL1", fields: { "🔑": "Sk1", "Tækifæri 📣 (projects)": [OPP] } },
        { id: "recL2", fields: { "🔑": "Sk2", "Tækifæri 📣 (projects)": [OPP] } },
        { id: "recL3", fields: { "🔑": "Sk3", "Tækifæri 📣 (projects)": [OPP], "Eyðublað búið til ✏️": ["recEY"] } },
      ] } };
    return routes(call);
  };
  const smida = { Sk1: null };
  const f = fakeFetch(rows);
  const list = await orphans(makeAirtable("t", { fetchImpl: f, delays: [] }), { recordId: OPP, smida });
  assert.deepEqual(list.map((o) => [o.key, o.eydublad]), [["Sk2", false], ["Sk3", true]]);
  assert.ok(!f.calls.some((c) => c.method === "DELETE"));
  const f2 = fakeFetch(rows);
  const out = await retire(makeAirtable("t", { fetchImpl: f2, delays: [] }), { recordId: OPP, smida, keys: ["Sk1", "Sk2", "Sk3"] });
  assert.deepEqual([out.deleted, out.blocked], [["Sk2"], ["Sk3"]]);
  const del = f2.calls.filter((c) => c.method === "DELETE");
  assert.equal(del.length, 1);
  assert.ok(del[0].url.includes("records%5B%5D=recL2") && !del[0].url.includes("recL1") && !del[0].url.includes("recL3"));
});

test("P-02: the orphan actions need the office key and valid input", async () => {
  process.env.AIRTABLE_TOKEN = "t"; process.env.VERK_KEY = "secret";
  const res = mockRes();
  await handler({ method: "POST", body: { k: "wrong", action: "retire", recordId: OPP, smida: {}, keys: ["Sk1"] } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(validateOrphanAction({ action: "retire", recordId: OPP, smida: {}, keys: [] }), "Ógild 🔑 til að eyða");
  assert.equal(validateOrphanAction({ action: "retire", recordId: OPP, smida: {}, keys: ["Sk1; x"] }), "Ógild 🔑 til að eyða");
  assert.equal(validateOrphanAction({ action: "orphans", recordId: OPP, smida: { Sk1: null } }), null);
  assert.equal(validateOrphanAction({ action: "orphans", recordId: "bad", smida: {} }), "Ógilt recordId");
});
