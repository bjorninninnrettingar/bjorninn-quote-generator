// api/eigandi-clock.js
// Phone clock-in for owners. The shop kiosk lock (X-Kiosk-Token === KIOSK_DEVICE_SECRET,
// see api/airtable.js) ties INN/ÚT to being at the shop for regular staff — owners
// don't want that.
//
// Two entry points:
//   1. POST { pin }        — /eigandi page login. Verifies the PIN belongs to an
//                            "Eigandi 👨🏻‍💼" and returns { token, record, shortcut }.
//                            `token` is a per-day HMAC (keyed with KIOSK_DEVICE_SECRET,
//                            never exposes it, rotates daily) the page uses as
//                            X-Kiosk-Token for its own Stimplanir/Verktímar writes.
//   2. POST ?k=<t>&action=inn|ut|toggle — for an Apple Shortcut / GPS "When I Arrive"
//                            automation. `k` = "<recordId>~<hmac>", so it identifies
//                            the owner without a PIN in the Shortcut. Does the clock
//                            action server-side and returns { status, message }.
//                            POST-only so a link preview (Messages/Slack GET) can't
//                            clock anyone in.
// The Verktímar project split is NOT done here — an auto clock-out just closes the
// shift; /eigandi shows a catch-up split screen next time the owner opens it.
//
// Revoking one owner's Shortcut link isn't possible without per-owner state; rotating
// KIOSK_DEVICE_SECRET invalidates every token (kiosk + shortcuts).

import crypto from "node:crypto";

const AIRTABLE_BASE = "app91U15z9K704Okd";
const STARFSMENN_TABLE = "tblhglpjQkczdG1AY";
const STIMPLANIR_TABLE = "tblnFIO8RB6HcelXF";
const OWNER_TYPE = "Eigandi 👨🏻‍💼";
const RETURN_FIELDS = ["Nafn starfsmanns 👷", "Kyn", "Starfsheiti 💼", "Auka orlofsdagar 🌴", "PIN 🔢"];
const IS_MONTHS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];

export function ownerDayToken(secret, offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return crypto.createHmac("sha256", secret).update("eigandi-clock:" + d.toISOString().slice(0, 10)).digest("hex").slice(0, 40);
}
function shortcutToken(secret, recordId) {
  const sig = crypto.createHmac("sha256", secret).update("eigandi-shortcut:" + recordId).digest("hex").slice(0, 32);
  return `${recordId}~${sig}`;
}
function parseShortcutToken(secret, k) {
  const [recordId, sig] = String(k || "").split("~");
  if (!recordId || !sig) return null;
  const expect = crypto.createHmac("sha256", secret).update("eigandi-shortcut:" + recordId).digest("hex").slice(0, 32);
  return sig === expect ? recordId : null;
}
const hhmm = (d) => `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; // Iceland = UTC

async function atFetch(token, url) {
  const r = await fetch(url.toString().replace(/\+/g, "%20"), { headers: { Authorization: `Bearer ${token}` } });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}
async function atWrite(token, method, path, fields) {
  const r = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });
  return r.ok;
}

async function getEmployee(token, { pin, recordId }) {
  const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${STARFSMENN_TABLE}`);
  url.searchParams.set("filterByFormula", recordId ? `RECORD_ID()='${recordId}'` : `AND({PIN 🔢}=${pin},{Er starfandi? ✅}=1)`);
  url.searchParams.set("maxRecords", "1");
  [...RETURN_FIELDS, "Er starfandi? ✅", "Tegund starfsmanns 🧑‍💻"].forEach((f) => url.searchParams.append("fields[]", f));
  const { ok, data } = await atFetch(token, url);
  if (!ok) return null;
  const rec = (data.records || [])[0];
  if (!rec) return null;
  if (recordId && !rec.fields["Er starfandi? ✅"]) return null;
  if (rec.fields["Tegund starfsmanns 🧑‍💻"] !== OWNER_TYPE) return "NOT_OWNER";
  return rec;
}
async function openShiftFor(token, name) {
  const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${STIMPLANIR_TABLE}`);
  url.searchParams.set("filterByFormula", `AND({Starfsmaður}="${String(name).replace(/"/g, '\\"')}",{Út}=BLANK())`);
  url.searchParams.set("maxRecords", "1");
  url.searchParams.append("fields[]", "Inn");
  const { ok, data } = await atFetch(token, url);
  return ok ? (data.records || [])[0] || null : null;
}

export default async function handler(req, res) {
  const airtableToken = process.env.AIRTABLE_TOKEN;
  const secret = process.env.KIOSK_DEVICE_SECRET;
  if (!airtableToken || !secret) return res.status(500).json({ error: "Server not configured" });

  const q = { ...(req.query || {}), ...(req.body || {}) };
  const k = q.k;

  // ---- Shortcut path: POST ?k=<token>&action=inn|ut|toggle ----
  if (k) {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    const recordId = parseShortcutToken(secret, k);
    if (!recordId) return res.status(401).json({ error: "BAD_TOKEN" });
    const emp = await getEmployee(airtableToken, { recordId });
    if (emp === "NOT_OWNER") return res.status(403).json({ error: "NOT_OWNER" });
    if (!emp) return res.status(401).json({ error: "BAD_TOKEN" });

    const name = emp.fields["Nafn starfsmanns 👷"] || "";
    const open = await openShiftFor(airtableToken, name);
    const now = new Date();
    const action = String(q.action || "").toLowerCase();
    let doInn = action === "inn", doUt = action === "ut";
    if (action === "toggle") { doInn = !open; doUt = !!open; }
    if (!doInn && !doUt) return res.status(400).json({ error: "BAD_ACTION" });

    if (doInn) {
      if (open) return res.status(200).json({ status: "already-in", message: `Þegar stimplaður inn (${hhmm(new Date(open.fields["Inn"]))})` });
      const ok = await atWrite(airtableToken, "POST", STIMPLANIR_TABLE, {
        "Inn": now.toISOString(),
        "Starfsmaður": [recordId],
        "Mánuður 🗓️": IS_MONTHS[now.getUTCMonth()],
        "Ár 🗓️": String(now.getUTCFullYear()),
      });
      if (!ok) return res.status(502).json({ error: "WRITE_FAILED" });
      return res.status(200).json({ status: "in", message: `Stimplaður inn kl. ${hhmm(now)}` });
    }
    if (!open) return res.status(200).json({ status: "already-out", message: "Ekki stimplaður inn" });
    const ok = await atWrite(airtableToken, "PATCH", `${STIMPLANIR_TABLE}/${open.id}`, { "Út": now.toISOString() });
    if (!ok) return res.status(502).json({ error: "WRITE_FAILED" });
    return res.status(200).json({ status: "out", message: `Stimplaður út kl. ${hhmm(now)} — skiptu tímum í /eigandi` });
  }

  // ---- Page login: POST { pin } ----
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const pin = String(q.pin || "").replace(/\D/g, "");
  if (pin.length < 3) return res.status(400).json({ error: "BAD_PIN" });
  const emp = await getEmployee(airtableToken, { pin });
  if (emp === "NOT_OWNER") return res.status(403).json({ error: "NOT_OWNER" });
  if (!emp) return res.status(401).json({ error: "BAD_PIN" });

  const fields = {};
  for (const f of RETURN_FIELDS) if (f in emp.fields) fields[f] = emp.fields[f];
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const t = shortcutToken(secret, emp.id);
  return res.status(200).json({
    token: ownerDayToken(secret, 0),
    record: { id: emp.id, fields },
    shortcut: {
      toggle: `https://${host}/api/eigandi-clock?action=toggle&k=${t}`,
      inn: `https://${host}/api/eigandi-clock?action=inn&k=${t}`,
      ut: `https://${host}/api/eigandi-clock?action=ut&k=${t}`,
    },
  });
}
