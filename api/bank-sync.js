// api/bank-sync.js
// Vercel Cron: daily sync from Landsbankinn (Accounts, UnpaidBills, Claims
// APIs) into Airtable —
//   1. one daily snapshot row in "Fjárhagsstaða 📊" (cash + AR + AP), and
//   2. new bank transactions appended into "Bókhald 💰", tagged
//      "Óunnið (banki) 🏦" with Flokkur/Tegund left blank — those require
//      human judgment (Efni vs. Verkfæri, Fastur vs. Breytilegur kostnaður)
//      that raw bank data can't supply.
//
// Read-only against Landsbankinn on purpose: this only ever issues GET
// requests, even though the Kröfukerfi (Claims) system access grant is
// technically capable of POST/PUT/DELETE — see project chat history for why.
//
// Auth: OAuth2 client_credentials over mutual TLS — see
// https://developers.landsbankinn.is/authentication. Requires:
//   LB_API_KEY           — apikey / client_id from Netbanki fyrirtækja
//   LB_CERT_P12_BASE64    — base64 of the .p12 certificate file
//   LB_CERT_PASSWORD      — password for that .p12
// Protected by CRON_SECRET, same pattern as monthly-sick-rollup.js.
//
// NOT YET VERIFIED against a real Landsbankinn credential — the exact
// response envelope (paginated {data,...} vs. bare array) was confirmed from
// docs only for /Transactions; /Accounts, /UnpaidBills and /Claims are
// assumed to follow the same shape. Run once by hand (see the manual-trigger
// note below) and check the logged response shapes before trusting the cron.

import https from "node:https";

const AIRTABLE_BASE = "app91U15z9K704Okd";
const BOKHALD_TABLE = "tbl5wXBjHf437yKQx";
const FJARHAGSSTADA_TABLE = "tblhP1FMM4QJfwxat";

const LB_API_HOST = "openapi.landsbankinn.is";
const LB_TOKEN_HOST = "mtls-auth.landsbankinn.is";

function certAgent() {
  const pfxBase64 = process.env.LB_CERT_P12_BASE64;
  const passphrase = process.env.LB_CERT_PASSWORD;
  if (!pfxBase64 || !passphrase) {
    throw new Error("LB_CERT_P12_BASE64 / LB_CERT_PASSWORD not configured");
  }
  return new https.Agent({ pfx: Buffer.from(pfxBase64, "base64"), passphrase });
}

function httpsJson({ host, path, method = "GET", headers = {}, body, agent }) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(body) : null;
    const req = https.request(
      {
        host,
        path,
        method,
        agent,
        headers: { ...headers, ...(payload ? { "Content-Length": payload.length } : {}) },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json;
          try {
            json = text ? JSON.parse(text) : {};
          } catch {
            return reject(new Error(`Non-JSON response from ${path} (${res.statusCode}): ${text.slice(0, 500)}`));
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`${method} ${path} -> ${res.statusCode}: ${text.slice(0, 500)}`));
          }
          resolve(json);
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getAccessToken() {
  const apiKey = process.env.LB_API_KEY;
  if (!apiKey) throw new Error("LB_API_KEY not configured");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: apiKey,
    scope: "external",
    access_token_configuration: "external_client",
  }).toString();
  const json = await httpsJson({
    host: LB_TOKEN_HOST,
    path: "/connect/token",
    method: "POST",
    agent: certAgent(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return json.access_token;
}

async function lbGet(token, path) {
  return httpsJson({
    host: LB_API_HOST,
    path,
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, apikey: process.env.LB_API_KEY },
  });
}

// Landsbankinn's documented list endpoints return either a paginated
// {data, totalPages, ...} envelope or (unconfirmed for some resources) a
// bare array — handled defensively since only /Transactions was confirmed.
async function lbGetAllPages(token, basePath, params) {
  let page = 1;
  const perPage = 500;
  const all = [];
  for (;;) {
    const sp = new URLSearchParams({ ...params, page: String(page), perPage: String(perPage) });
    const json = await lbGet(token, `${basePath}?${sp.toString()}`);
    const data = Array.isArray(json) ? json : json.data || [];
    all.push(...data);
    const totalPages = Array.isArray(json) ? 1 : json.totalPages || 1;
    if (page >= totalPages) break;
    page++;
  }
  return all;
}

async function airtableFetch(token, tableId, params) {
  const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}`);
  for (const [k, v] of Object.entries(params || {})) {
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, item));
    else url.searchParams.set(k, v);
  }
  // See api/airtable.js's airtableUrl() — URLSearchParams encodes spaces as
  // "+", which Airtable's formula parser doesn't decode back to space.
  const finalUrl = url.toString().replace(/\+/g, "%20");
  const res = await fetch(finalUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Airtable ${tableId} fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Airtable caps a single response at 100 records — anything that needs a
// true total (dedupe sets, sums) must page through with `offset`, not just
// take the first page.
async function airtableFetchAll(token, tableId, params) {
  let offset;
  const records = [];
  do {
    const json = await airtableFetch(token, tableId, offset ? { ...params, offset } : params);
    records.push(...(json.records || []));
    offset = json.offset;
  } while (offset);
  return records;
}

async function airtableCreate(token, tableId, records) {
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: batch, typecast: true }),
    });
    if (!res.ok) throw new Error(`Airtable ${tableId} create failed: ${res.status} ${await res.text()}`);
  }
}

async function airtableUpdate(token, tableId, records) {
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: batch, typecast: true }),
    });
    if (!res.ok) throw new Error(`Airtable ${tableId} update failed: ${res.status} ${await res.text()}`);
  }
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const airtableToken = process.env.AIRTABLE_TOKEN;
  if (!airtableToken) return res.status(500).json({ error: "AIRTABLE_TOKEN not configured" });

  try {
    const lbToken = await getAccessToken();

    // dueDateFrom is required by /Claims, and the API caps the search
    // window at 2 years — a claim still legitimately "unpaid" past that
    // has long since moved to secondary collection or auto-cancellation,
    // so this window isn't a real limitation for "currently outstanding".
    const claimsDueDateFrom = new Date(Date.now() - 729 * 86400000).toISOString().slice(0, 10);

    const [accounts, unpaidBills, unpaidClaims] = await Promise.all([
      lbGetAllPages(lbToken, "/api/Accounts/Accounts/v1/Accounts", {}),
      lbGetAllPages(lbToken, "/api/Claims/UnpaidBills/v1/UnpaidBills", {}),
      lbGetAllPages(lbToken, "/api/Claims/Claims/v1/Claims", { dueDateFrom: claimsDueDateFrom, status: "unpaid" }),
    ]);

    const openIskAccounts = accounts.filter((a) => a.status === "open" && a.currency === "ISK");
    const cashTotal = openIskAccounts.reduce((sum, a) => sum + a.balance, 0);
    const unpaidTotal = unpaidBills.reduce((sum, b) => sum + b.totalAmountDue, 0);
    const claimsTotal = unpaidClaims.reduce((sum, c) => sum + c.totalAmountDue, 0);

    // Overdraft headroom, for the "health bar" — only accounts with a real
    // limit set count; availableAmount is the bank's own room-remaining
    // figure (balance + unused limit, minus any hold), not recomputed here.
    const overdraftAccounts = openIskAccounts.filter((a) => a.overdraftLimit > 0);
    const overdraftLimitTotal = overdraftAccounts.reduce((sum, a) => sum + a.overdraftLimit, 0);
    const overdraftRoomTotal = overdraftAccounts.reduce((sum, a) => sum + a.availableAmount, 0);
    // True total spendable liquidity — balance for accounts without
    // overdraft, remaining credit for the one that has it. Do NOT sum this
    // with cashTotal/overdraftRoomTotal elsewhere, that double-counts.
    const availableTotal = openIskAccounts.reduce((sum, a) => sum + a.availableAmount, 0);

    const today = new Date().toISOString().slice(0, 10);

    // Trailing ~90-day average of Fastur kostnaður, for the runway figure —
    // relies on rows already categorized by hand in Bókhald (bank-synced
    // rows tagged "Óunnið (banki)" have no Tegund yet, so they're correctly
    // excluded until someone categorizes them).
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const fixedCostRows = await airtableFetchAll(airtableToken, BOKHALD_TABLE, {
      filterByFormula: `AND({Tegund}='Fastur kostnaður 🔒', IS_AFTER({Dagsetning}, '${ninetyDaysAgo}'))`,
      "fields[]": ["Upphæð"],
      pageSize: 100,
    });
    const fixedCostSum = fixedCostRows.reduce((sum, r) => sum + (r.fields["Upphæð"] || 0), 0);
    const avgMonthlyFixedCost = fixedCostSum / 3;

    // Upsert by date — this can run more than once on the same day (manual
    // re-triggers, retries), and a snapshot table with duplicate rows per
    // day would corrupt any trend chart built on it.
    const fjarhagsstadaFields = {
      Dagsetning: today,
      "Sjóðsstaða samtals": cashTotal,
      "Óinnheimtar kröfur": claimsTotal,
      "Ógreiddir reikningar": unpaidTotal,
      "Yfirdráttarheimild samtals": overdraftLimitTotal,
      "Yfirdráttarrými eftir": overdraftRoomTotal,
      "Laust fé samtals": availableTotal,
      "Meðaltal fastur kostnaður (3 mán)": avgMonthlyFixedCost,
    };
    const existingToday = await airtableFetch(airtableToken, FJARHAGSSTADA_TABLE, {
      filterByFormula: `DATETIME_FORMAT({Dagsetning}, 'YYYY-MM-DD') = '${today}'`,
      "fields[]": ["Dagsetning"],
      pageSize: 2,
    });
    if ((existingToday.records || []).length) {
      await airtableUpdate(
        airtableToken,
        FJARHAGSSTADA_TABLE,
        existingToday.records.map((r) => ({ id: r.id, fields: fjarhagsstadaFields }))
      );
    } else {
      await airtableCreate(airtableToken, FJARHAGSSTADA_TABLE, [{ fields: fjarhagsstadaFields }]);
    }

    // New transactions -> Bókhald, deduped against a 30-day window by the
    // bank's own transaction id (Banka-IÐ). Fetch window matches the dedupe
    // window with margin, so a transaction can never be missed between runs.
    const fromDate = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);

    const existing = await airtableFetchAll(airtableToken, BOKHALD_TABLE, {
      filterByFormula: `AND({Banka-IÐ}!='', IS_AFTER({Dagsetning}, DATEADD(TODAY(), -30, 'days')))`,
      "fields[]": ["Banka-IÐ"],
      pageSize: 100,
    });
    const seenIds = new Set(existing.map((r) => r.fields["Banka-IÐ"]).filter(Boolean));

    const newRows = [];
    for (const account of openIskAccounts) {
      const txs = await lbGetAllPages(lbToken, `/api/Accounts/Accounts/v1/Accounts/${account.bban}/Transactions`, {
        bookingDateFrom: fromDate,
        bookingDateTo: today,
      });
      for (const tx of txs) {
        if (seenIds.has(tx.id)) continue;
        seenIds.add(tx.id);
        newRows.push({
          fields: {
            Lýsing: tx.remittanceInformationUnstructured || tx.actionLabel || tx.reference || "Bankafærsla",
            Dagsetning: tx.bookingDate,
            Upphæð: tx.amount,
            "Óunnið (banki) 🏦": true,
            "Banka-IÐ": tx.id,
          },
        });
      }
    }

    if (newRows.length) await airtableCreate(airtableToken, BOKHALD_TABLE, newRows);

    return res.status(200).json({
      date: today,
      accounts: openIskAccounts.length,
      cashTotal,
      unpaidTotal,
      claimsTotal,
      newTransactions: newRows.length,
    });
  } catch (err) {
    console.error("bank-sync failed:", err);
    return res.status(502).json({ error: err.message });
  }
}
