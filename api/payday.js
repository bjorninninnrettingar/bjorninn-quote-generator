// api/payday.js
// Payday API proxy — keeps the OAuth clientId/clientSecret server-side and
// exchanges them for a short-lived (24h) bearer token, which it caches in
// module scope and reuses across warm invocations.
//
// READ-ONLY BY DESIGN. The Payday credential is a full-access company key
// (no scopes) that can create/book invoices, post journal entries, mark
// things paid, etc. This proxy exposes only an allowlist of GET endpoints
// and hard-refuses every write verb. Any write integration gets its own
// dedicated, purpose-built endpoint later — never a generic passthrough.
//
// Auth: callers must send  X-Payday-Key: <PAYDAY_PROXY_SECRET>  . If that env
// var is unset the endpoint is disabled entirely (503), so it can't sit live
// and unguarded by accident.
//
// Env:
//   PAYDAY_CLIENT_ID       OAuth clientId  (Stillingar → Fyrirtæki in Payday)
//   PAYDAY_CLIENT_SECRET   OAuth clientSecret
//   PAYDAY_PROXY_SECRET    shared secret required in the X-Payday-Key header

const PAYDAY_API = "https://api.payday.is";
const TOKEN_TTL_SAFETY_MS = 5 * 60 * 1000; // refresh 5 min before expiry

// Allowlisted GET paths (leading slash stripped). Each entry is matched
// anchored (^…$) against the request's `path`. `:seg` matches one path
// segment (no slash). Query string is passed through untouched.
const ALLOWED_GET = [
  "companies/me",
  "users/me",
  "general/currency",
  "general/vat",
  "general/cpi/:seg",

  "customers",
  "customers/:seg",
  "customers/number/:seg",
  "customers/search",
  "customers/:seg/invoice",
  "customers/:seg/accountStatement",

  "invoices",
  "invoices/:seg",
  "invoices/:seg/history",

  "recurring/invoices",
  "recurring/invoices/:seg",

  "expenses",
  "expenses/:seg",
  "expenses/paymenttypes",
  "expenses/accounts",

  "accounting/accounts",
  "accounting/creditors",
  "accounting/creditors/:seg/accountStatement",
  "accounting/accountStatement",
  "accounting/journal",

  "products",
  "products/:seg",
  "products/sku",
  "products/salesLedgerAccounts",

  "sales/paymenttypes",

  "payroll/employees",
  "payroll/employees/:seg",
  "payroll/pension/funds/:seg",
];

const ALLOWED_GET_RE = ALLOWED_GET.map(
  (p) => new RegExp("^" + p.replace(/:seg/g, "[^/]+") + "$")
);

let cachedToken = null; // { token: string, expiresAt: number(ms) }

async function getToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - TOKEN_TTL_SAFETY_MS) {
    return cachedToken.token;
  }
  const clientId = process.env.PAYDAY_CLIENT_ID;
  const clientSecret = process.env.PAYDAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw Object.assign(new Error("Payday credentials not configured"), { status: 500 });
  }
  const r = await fetch(`${PAYDAY_API}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.accessToken) {
    throw Object.assign(new Error(data.error_description || "Payday auth failed"), {
      status: r.status || 502,
    });
  }
  cachedToken = {
    token: data.accessToken,
    expiresAt: Date.now() + (data.expiresIn || 86400) * 1000,
  };
  return cachedToken.token;
}

export default async function handler(req, res) {
  const proxySecret = process.env.PAYDAY_PROXY_SECRET;
  if (!proxySecret) {
    return res.status(503).json({ error: "Payday proxy disabled (PAYDAY_PROXY_SECRET unset)" });
  }
  if (req.headers["x-payday-key"] !== proxySecret) {
    return res.status(401).json({ error: "Bad or missing X-Payday-Key" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "This proxy is read-only. Writes go through dedicated endpoints, not here.",
    });
  }

  const { path, ...params } = req.query;
  if (!path) return res.status(400).json({ error: "Missing path" });

  const cleanPath = String(path).replace(/^\/+/, "").replace(/\/+$/, "");
  if (!ALLOWED_GET_RE.some((re) => re.test(cleanPath))) {
    return res.status(403).json({ error: `Path not allowed: ${cleanPath}` });
  }

  const url = new URL(`${PAYDAY_API}/${cleanPath}`);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
    else url.searchParams.set(key, value);
  }

  let token;
  try {
    token = await getToken();
  } catch (e) {
    return res.status(e.status || 502).json({ error: e.message });
  }

  const pdRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await pdRes.text();
  res.status(pdRes.status);
  res.setHeader("Content-Type", pdRes.headers.get("content-type") || "application/json");
  return res.send(text);
}
