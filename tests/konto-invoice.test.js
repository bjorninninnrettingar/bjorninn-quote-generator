import { test } from "node:test";
import assert from "node:assert/strict";
import { invoiceLines, addWorkdays, alreadyDrafted, kontoDraft } from "../api/konto-invoice.js";

const base = {
  "Heiti tækifæris / verkefnis": "T-1 | Prufa",
  "💰 Tilboðsupphæð": 1_000_000,
  "Staðfest tilboðsupphæð 🔒": 1_000_000,
  "Uppsetning Bjarnarins 🪛🐻": true,
  "Uppsetningarverð Verkefnis": 200_000,
  "heimsendingaverð": 35_000,
  "Fjöldi ferða 🚚": "2 Ferðir 🚚🚚",
};
const total = (r) => r.lines.reduce((s, l) => s + l.amountInclVat, 0);

test("40–30–30: G1 40% + half the installation, G2 30%, LOK 30% + viðbætur, UPPGJOR rest", () => {
  const p = { ...base, "Skipting greiðslu": "40% - 30% - 30%", "Samþykktar viðbætur innréttinga 🔒": 50_000, "Samþykktar viðbætur uppsetningar 🔒": 12_400 };
  assert.equal(total(invoiceLines(p, "G1")), 400_000 + 100_000);
  assert.equal(total(invoiceLines(p, "G2")), 300_000);
  assert.equal(total(invoiceLines(p, "LOK")), 300_000 + 50_000 + 12_400);
  assert.equal(total(invoiceLines(p, "UPPGJOR")), 100_000 + 35_000);
});

test("50–50: no G2; LOK is the second half", () => {
  const p = { ...base, "Skipting greiðslu": "50% - 50%" };
  assert.match(invoiceLines(p, "G2").skip, /40–30–30/);
  assert.equal(total(invoiceLines(p, "LOK")), 500_000);
});

test("100%: LOK only when there are approved viðbætur", () => {
  const p = { ...base, "Skipting greiðslu": "100%" };
  assert.ok(invoiceLines(p, "LOK").skip);
  assert.equal(total(invoiceLines({ ...p, "Samþykktar viðbætur innréttinga 🔒": 80_000 }, "LOK")), 80_000);
});

test("installation is ignored when its checkbox is off; UPPGJOR then = delivery only", () => {
  const p = { ...base, "Skipting greiðslu": "50% - 50%", "Uppsetning Bjarnarins 🪛🐻": false };
  assert.equal(total(invoiceLines(p, "G1")), 500_000);
  assert.equal(total(invoiceLines(p, "UPPGJOR")), 35_000);
  assert.ok(invoiceLines({ ...p, "heimsendingaverð": 0 }, "UPPGJOR").skip);
});

test("G1 before confirmation uses the live total", () => {
  const p = { ...base, "Skipting greiðslu": "100%", "Staðfest tilboðsupphæð 🔒": undefined, "💰 Tilboðsupphæð": 777_000, "Uppsetning Bjarnarins 🪛🐻": false };
  assert.equal(total(invoiceLines(p, "G1")), 777_000);
});

test("unknown split is skipped, not invoiced", () => {
  assert.ok(invoiceLines({ ...base }, "G1").skip);
});

test("workdays skip weekends and holidays", () => {
  const fri = new Date(Date.UTC(2026, 9, 2)); // Fri 2 Oct 2026
  assert.equal(addWorkdays(fri, 3), "2026-10-07");
  assert.equal(addWorkdays(fri, 3, new Set(["2026-10-05"])), "2026-10-08");
});

test("a logged draft blocks the same payment; an error line does not", () => {
  const log = "2026-10-05 · G1 · drög abc · 500.000 kr.\n2026-10-06 · G2 · ❌ Konto 500";
  assert.equal(alreadyDrafted(log, "G1"), true);
  assert.equal(alreadyDrafted(log, "G2"), false);
});

test("Konto draft: customer = Konto's own record, our contact only fills blanks", () => {
  const d = kontoDraft({
    customer: { guid: "g-9", name: "Í Konto", registration_no: "0101012345", output_select: "2", due_date: 14, updated_timestamp: "x" },
    contact: { name: "Úr Airtable", kennitala: "0101012345", email: "a@b.is" },
    description: "T-1", lines: [{ description: "x", amountInclVat: 1240 }], today: new Date(Date.UTC(2026, 9, 5)),
  });
  assert.equal(d.customer.name, "Í Konto");
  assert.equal(d.customer.output_select, "2");
  assert.equal(d.customer.due_date, 14);
  assert.equal(d.customer.email, "a@b.is");
  assert.equal("updated_timestamp" in d.customer, false);
});

test("Konto draft: claim, 24% VAT, amounts ex VAT on the lines", () => {
  const d = kontoDraft({ customerGuid: "g-1", contact: { name: "Prufa", kennitala: "0101012345", email: "a@b.is" }, description: "T-1", lines: [{ description: "x", amountInclVat: 124_000 }], today: new Date(Date.UTC(2026, 9, 5)), holidays: new Set() });
  assert.equal(d.customer.guid, "g-1");
  assert.equal(d.customer.name, "Prufa");
  assert.equal(d.customer.registration_no, "0101012345");
  assert.equal(d.kennitala, "0101012345");
  assert.equal(d.is_claim, true);
  assert.equal(d.items[0].tax, "S");
  assert.equal(d.items[0].unit_price, 100_000);
  assert.equal(d.amount, 124_000);
  assert.equal(d.issue_date, "2026-10-05");
  assert.equal(d.due_date, "2026-10-08");
  assert.equal(d.settlement_date, "2026-10-12");
});

test("installment lines are short — the project name lives in the invoice description", () => {
  const p = { ...base, "Skipting greiðslu": "40% - 30% - 30%", "Uppsetning Bjarnarins 🪛🐻": false };
  assert.equal(invoiceLines(p, "G1").lines[0].description, "Greiðsla 1 af 3 (40%) — innréttingar");
  assert.equal(invoiceLines(p, "LOK").lines[0].description, "Lokagreiðsla 3 af 3 (30%) — innréttingar");
});
