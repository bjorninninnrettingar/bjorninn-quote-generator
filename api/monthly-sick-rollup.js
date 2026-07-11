// api/monthly-sick-rollup.js
// Vercel Cron, 1st of every month: for every active employee, counts last
// month's Fjarvistir (Veikindi) rows and adds MAX(0, 2 - count) to their
// "Auka orlofsdagar" (bonus vacation days) on Starfsmenn — the "2 paid sick
// days/month, unused rolls into vacation" policy Björninn wants.
//
// Runs with full Airtable access directly (not through api/airtable.js's
// client-facing field allowlist) since this is a trusted server-only cron,
// never reachable from a browser. Protected by CRON_SECRET — Vercel sends
// that as the Authorization header when it triggers a scheduled function;
// see https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.

const AIRTABLE_BASE = "app91U15z9K704Okd";
const STARFSMENN_TABLE = "tblhglpjQkczdG1AY";
const FJARVISTIR_TABLE = "tbl3e5o0Klv9RcNQ4";
const SICK_DAYS_PER_MONTH = 2;

async function airtableFetch(token, path, params) {
  const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${path}`);
  for (const [k, v] of Object.entries(params || {})) {
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, item));
    else url.searchParams.set(k, v);
  }
  // See api/airtable.js's airtableUrl() — URLSearchParams encodes spaces as
  // "+", which Airtable's formula parser doesn't decode back to space.
  const finalUrl = url.toString().replace(/\+/g, "%20");
  const res = await fetch(finalUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Airtable ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: "AIRTABLE_TOKEN not configured" });

  // "Last month" relative to whenever this runs (scheduled for the 1st, but
  // computed this way so a manual/late run still targets the right month).
  const now = new Date();
  const firstOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const monthKey = firstOfLastMonth.toISOString().slice(0, 7); // "YYYY-MM"

  const [employeesData, sickData] = await Promise.all([
    airtableFetch(token, STARFSMENN_TABLE, {
      "fields[]": ["Nafn starfsmanns 👷", "Er starfandi? ✅", "Auka orlofsdagar 🌴"],
      pageSize: 100,
    }),
    airtableFetch(token, FJARVISTIR_TABLE, {
      "fields[]": ["Starfsmaður", "Dagsetning", "Tegund"],
      pageSize: 100,
    }),
  ]);

  const employees = (employeesData.records || []).filter((r) => r.fields["Er starfandi? ✅"]);
  const sickRows = (sickData.records || []).filter((r) => {
    if (r.fields["Tegund"] !== "Veikindi") return false;
    const d = r.fields["Dagsetning"];
    return typeof d === "string" && d.slice(0, 7) === monthKey;
  });

  const results = [];
  for (const emp of employees) {
    const empName = emp.fields["Nafn starfsmanns 👷"];
    const count = sickRows.filter((r) => (r.fields["Starfsmaður"] || []).includes(emp.id)).length;
    const unused = Math.max(0, SICK_DAYS_PER_MONTH - count);
    results.push({ employee: empName, sickDays: count, vacationDaysAdded: unused });

    if (unused > 0) {
      const current = emp.fields["Auka orlofsdagar 🌴"] || 0;
      const patchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${STARFSMENN_TABLE}/${emp.id}`;
      await fetch(patchUrl, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { "Auka orlofsdagar 🌴": current + unused } }),
      });
    }
  }

  return res.status(200).json({ month: monthKey, results });
}
