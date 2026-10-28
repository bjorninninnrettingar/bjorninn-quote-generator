// api/_konto-ledger.js — shared, pure helpers for the Konto per-payment ledger (2026-10-28).
//
// Why: the Konto invoice guid used to exist only as a text line in `Konto drög 🧾`
// ("2026-10-28 · G1 · drög <guid> · 123.456 kr. · (shape)"). A later poll had nothing structured to
// pair with a project. Now each project also carries ONE long-text JSON field (`Konto reikningar JSON`)
// = { "G1": { guid, amount, due, status, paid, overdueNotified }, "G2": {...}, ... }, and the log keeps
// working untouched. Every reader falls back to parsing the log, so drafts made BEFORE the field
// existed are still polled. The only other new field is the checkbox `Greiðsla 1 greidd (Konto)`
// (G2/G3 already have `Greiðsla 2/3 greidd`). Underscore name = not a route.

export const LEDGER_FIELD = "Konto reikningar JSON";
export const G1_PAID_FIELD = "Greiðsla 1 greidd (Konto)";
export const PAYMENTS = ["G1", "G2", "LOK", "UPPGJOR"];
export const PAYMENT_LABEL = { G1: "Greiðsla 1", G2: "Greiðsla 2", LOK: "Lokagreiðsla", UPPGJOR: "Uppgjör" };

export function parseLedger(text) {
  try {
    const o = JSON.parse(String(text || ""));
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    const out = {};
    for (const p of PAYMENTS) if (o[p] && typeof o[p] === "object") out[p] = { ...o[p] };
    return out;
  } catch { return {}; }
}

// "2026-10-28 · G1 · drög <guid> · 123.456 kr. · (shape)" → entries; the last line per payment wins.
export function ledgerFromLog(log) {
  const out = {};
  for (const line of String(log || "").split("\n")) {
    const m = line.match(/^(\d{4}-\d{2}-\d{2}) · (G1|G2|LOK|UPPGJOR) · drög (\S+)(?: · ([\d.]+) kr\.)?/);
    if (!m) continue;
    out[m[2]] = { guid: m[3], created: m[1], amount: m[4] ? parseInt(m[4].replace(/\./g, ""), 10) : null };
  }
  return out;
}

// JSON wins, the log fills any payment the JSON doesn't know yet.
export function mergedLedger(ledgerText, log) {
  const l = parseLedger(ledgerText), fromLog = ledgerFromLog(log);
  for (const p of PAYMENTS) if (!l[p] && fromLog[p]) l[p] = fromLog[p];
  return l;
}

// Which "Greiðsla N greidd" tick a Konto invoice maps to (null = none, e.g. a LOK on a 100 % deal).
export function tickFor(payment, split) {
  if (payment === "G1") return "g1";
  if (payment === "G2") return "g2";
  if (payment === "LOK") return split === "40% - 30% - 30%" ? "g3" : split === "50% - 50%" ? "g2" : null;
  return null;
}

const NOT_DUE_STATUS = /^(draft|drög|cancel|void|credit|deleted)/i;
// Overdue = a sent (non-draft) invoice, unpaid, due date before today.
export function isOverdue(e, today) {
  if (!e || e.paid || !e.due || !e.guid) return false;
  if (!e.status || NOT_DUE_STATUS.test(e.status)) return false;
  return e.due < today;
}

// One poll step for one project. `inv` = Map guid → Konto invoice. Pure: returns what to write/announce.
export function planSync({ ledger, split, ticks, inv, today }) {
  const next = JSON.parse(JSON.stringify(ledger));
  const patch = {}, lines = [];
  for (const p of PAYMENTS) {
    const e = next[p];
    if (!e || !e.guid) continue;
    const k = inv.get(e.guid);
    if (!k) continue;
    e.status = String(k.status || e.status || "");
    const due = String(k.due_date || "").slice(0, 10);
    if (due) e.due = due;
    if (/^paid$/i.test(e.status) && !e.paid) {
      e.paid = String(k.paid_date || "").slice(0, 10) || today;
      lines.push({ kind: "paid", payment: p, texti: `${PAYMENT_LABEL[p]} komin` });
    }
    if (e.paid) {
      const t = tickFor(p, split);
      if (t === "g1" && !ticks.g1) patch[G1_PAID_FIELD] = true;
      if (t === "g2" && !ticks.g2) patch["Greiðsla 2 greidd"] = true;
      if (t === "g3" && !ticks.g3) patch["Greiðsla 3 greidd"] = true;
    } else if (isOverdue(e, today) && !e.overdueNotified) {
      e.overdueNotified = true;
      lines.push({ kind: "overdue", payment: p, texti: `${PAYMENT_LABEL[p]} komin fram yfir gjalddaga (${e.due})` });
    }
  }
  const changed = JSON.stringify(next) !== JSON.stringify(ledger);
  return { ledger: next, changed, patch, lines };
}

// Per-payment rows for the /crm + /skrifstofa panel.
export function paymentRows(ledger, today, g1Ticked) {
  return PAYMENTS.filter((p) => ledger[p] && ledger[p].guid).map((p) => {
    const e = ledger[p];
    const paid = e.paid || (p === "G1" && g1Ticked ? "greidd" : null);
    return { key: p, label: PAYMENT_LABEL[p], amount: e.amount ?? null, due: e.due || null, status: e.status || "", paid: paid || null, overdue: isOverdue(e, today) };
  });
}

// Failed Konto draft tries ("… · G2 · ❌ msg") not followed by a later successful draft of the same payment.
export function kontoErrors(log) {
  const lines = String(log || "").split("\n");
  const out = [];
  lines.forEach((line, i) => {
    const m = line.match(/^(\d{4}-\d{2}-\d{2}) · (G1|G2|LOK|UPPGJOR) · ❌ (.*)$/);
    if (!m) return;
    const later = lines.slice(i + 1).some((l) => l.includes(`· ${m[2]} · drög`));
    if (!later) out.push({ date: m[1], payment: m[2], message: m[3].slice(0, 300) });
  });
  return out;
}
