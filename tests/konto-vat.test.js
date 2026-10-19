import { test } from "node:test";
import assert from "node:assert/strict";
import { periodFromDueDate } from "../api/konto-vat.js";

test("periodFromDueDate: a VAT due date covers the 2-month period ending 2 months before it", () => {
  assert.deepEqual(periodFromDueDate("2026-10-05"), { start: "2026-07-01", end: "2026-08-31" });
  assert.deepEqual(periodFromDueDate("2026-04-07"), { start: "2026-01-01", end: "2026-02-28" });
  assert.deepEqual(periodFromDueDate("2026-06-05"), { start: "2026-03-01", end: "2026-04-30" });
});

test("periodFromDueDate: December due date covers Sep-Oct, no year rollover needed", () => {
  assert.deepEqual(periodFromDueDate("2026-12-07"), { start: "2026-09-01", end: "2026-10-31" });
});

test("periodFromDueDate: February due date rolls the period back into the previous year (Nov-Dec)", () => {
  assert.deepEqual(periodFromDueDate("2027-02-05"), { start: "2026-11-01", end: "2026-12-31" });
});
