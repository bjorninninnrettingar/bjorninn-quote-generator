import { test } from "node:test";
import assert from "node:assert/strict";
import { mergedLedger, ledgerFromLog, planSync, tickFor, isOverdue, kontoErrors, paymentRows } from "../api/_konto-ledger.js";
import handler from "../api/konto-paid-sync.js";
import { summarize } from "../api/greidslur.js";

const LOG = "2026-10-01 · G1 · drög guid-1 · 500.000 kr. · (x)\n2026-10-20 · G2 · ❌ boom\n2026-10-21 · LOK · drög guid-3 · 100.000 kr. · (x)";

test("ledger falls back to the log; JSON wins", () => {
  const l = ledgerFromLog(LOG);
  assert.equal(l.G1.guid, "guid-1"); assert.equal(l.G1.amount, 500000); assert.equal(l.LOK.guid, "guid-3");
  const m = mergedLedger(JSON.stringify({ G1: { guid: "other", paid: "2026-10-05" } }), LOG);
  assert.equal(m.G1.guid, "other"); assert.equal(m.LOK.guid, "guid-3");
  assert.deepEqual(mergedLedger("not json", ""), {});
});

test("tickFor maps invoices to Greiðsla ticks by split", () => {
  assert.equal(tickFor("G1", "100%"), "g1");
  assert.equal(tickFor("G2", "40% - 30% - 30%"), "g2");
  assert.equal(tickFor("LOK", "40% - 30% - 30%"), "g3");
  assert.equal(tickFor("LOK", "50% - 50%"), "g2");
  assert.equal(tickFor("LOK", "100%"), null);
  assert.equal(tickFor("UPPGJOR", "50% - 50%"), null);
});

test("planSync: paid ticks + announces once; second run is a no-op", () => {
  const inv = new Map([["guid-3", { status: "Paid", paid_date: "2026-10-27", due_date: "2026-10-25" }]]);
  const a = planSync({ ledger: mergedLedger("", LOG), split: "40% - 30% - 30%", ticks: {}, inv, today: "2026-10-28" });
  assert.deepEqual(a.patch, { "Greiðsla 3 greidd": true });
  assert.deepEqual(a.lines.map((l) => l.texti), ["Lokagreiðsla komin"]);
  assert.equal(a.ledger.LOK.paid, "2026-10-27");
  const b = planSync({ ledger: a.ledger, split: "40% - 30% - 30%", ticks: { g3: true }, inv, today: "2026-10-28" });
  assert.equal(b.changed, false); assert.deepEqual(b.patch, {}); assert.deepEqual(b.lines, []);
});

test("overdue: sent+unpaid+past due announced once; drafts never overdue", () => {
  const l = { G1: { guid: "g", status: "Sent", due: "2026-10-20" }, G2: { guid: "h", status: "Draft", due: "2026-10-01" } };
  assert.equal(isOverdue(l.G1, "2026-10-28"), true);
  assert.equal(isOverdue(l.G2, "2026-10-28"), false);
  const inv = new Map([["g", { status: "Sent", due_date: "2026-10-20" }]]);
  const a = planSync({ ledger: l, split: "", ticks: {}, inv, today: "2026-10-28" });
  assert.equal(a.lines.length, 1); assert.equal(a.lines[0].kind, "overdue");
  assert.equal(planSync({ ledger: a.ledger, split: "", ticks: {}, inv, today: "2026-10-28" }).lines.length, 0);
});

test("kontoErrors: an error is cleared by a later successful draft of the same payment", () => {
  assert.deepEqual(kontoErrors(LOG).map((e) => e.payment), ["G2"]);
  assert.deepEqual(kontoErrors(LOG + "\n2026-10-22 · G2 · drög guid-2 · 1 kr."), []);
});

test("greidslur summarize exposes payments, overdue and kontoErrors", () => {
  const s = summarize({ fldCoyt9zJ6NSHXyU: LOG }, true, { ledgerText: JSON.stringify({ G1: { guid: "g", status: "Sent", due: "2026-10-01", amount: 5 } }), today: "2026-10-28" });
  assert.deepEqual(s.overdue, ["G1"]);
  assert.equal(s.kontoErrors.length, 1);
  assert.equal(paymentRows({}, "2026-10-28", false).length, 0);
});

function run(req, routes) {
  const real = global.fetch, calls = [];
  global.fetch = async (url, opts = {}) => {
    const u = String(url); calls.push({ u, method: opts.method || "GET", body: opts.body ? JSON.parse(opts.body) : undefined });
    const out = routes(u, opts);
    return { ok: out.status < 300, status: out.status, json: async () => out.body, text: async () => JSON.stringify(out.body) };
  };
  let status, json;
  const res = { status(s) { status = s; return this; }, json(j) { json = j; return this; } };
  return handler(req, res).finally(() => { global.fetch = real; }).then(() => ({ status, json, calls }));
}

test("handler: rejects without cron secret / key", async () => {
  process.env.CRON_SECRET = "c"; process.env.AIRTABLE_TOKEN = "t"; process.env.VERK_KEY = "k";
  const r = await run({ headers: {}, query: {} }, () => ({ status: 200, body: {} }));
  assert.equal(r.status, 401);
});

test("handler: paid invoice ticks Greiðsla 2, writes ledger, only GETs Konto, one Virkni line", async () => {
  Object.assign(process.env, { CRON_SECRET: "c", AIRTABLE_TOKEN: "t", KONTO_USERNAME: "u", KONTO_API_KEY: "a" });
  delete process.env.GOOGLE_CHAT_WEBHOOK_SKRIFSTOFA;
  const rec = { id: "recAAAAAAAAAAAAAA", fields: { "Heiti tækifæris / verkefnis": "T-1", "Skipting greiðslu": "50% - 50%", "Konto drög 🧾": "2026-10-20 · LOK · drög guid-9 · 10.000 kr. · (x)" } };
  const routes = (u, o) => {
    if (u.includes("konto.is")) return { status: 200, body: { status: true, result: [{ guid: "guid-9", status: "Paid", paid_date: "2026-10-27", due_date: "2026-10-25" }] } };
    if (u.includes("tblPPMTlFhW0snk24")) return { status: 200, body: { id: "recV" } };
    if (o.method === "PATCH") return { status: 200, body: {} };
    return { status: 200, body: { records: [rec] } };
  };
  const r = await run({ headers: { authorization: "Bearer c" }, query: {} }, routes);
  assert.equal(r.status, 200); assert.equal(r.json.paid, 1);
  const patch = r.calls.find((c) => c.method === "PATCH");
  assert.equal(patch.body.fields["Greiðsla 2 greidd"], true);
  assert.equal(JSON.parse(patch.body.fields["Konto reikningar JSON"]).LOK.paid, "2026-10-27");
  assert.ok(r.calls.filter((c) => c.u.includes("konto.is")).every((c) => c.method === "GET"));
  const virkni = r.calls.filter((c) => c.method === "POST" && c.u.includes("tblPPMTlFhW0snk24"));
  assert.equal(virkni.length, 1); assert.match(virkni[0].body.fields.Texti, /Lokagreiðsla komin/);
});
