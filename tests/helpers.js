// Tiny req/res + fetch fakes for testing the Vercel handlers without a network.
export function mockRes() {
  const res = { statusCode: 200, body: undefined, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.send = (b) => { res.body = b; return res; };
  res.end = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}

// fake fetch: `routes` is a function (call) => {status, body} | undefined; every call is recorded.
export function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, opts = {}) => {
    const call = { url: String(url), method: opts.method || "GET", body: opts.body ? JSON.parse(opts.body) : undefined };
    calls.push(call);
    const out = routes(call) || { status: 200, body: { records: [] } };
    if (out.throw) throw new Error(out.throw);
    return { ok: out.status < 300, status: out.status, json: async () => out.body, text: async () => JSON.stringify(out.body) };
  };
  fn.calls = calls;
  return fn;
}

// Wraps fake Airtable routes so a Tækifæri GET carries its Line Items' ids in its link field (fldlcBLh5sXC6VlRn) and a
// Line Items query by RECORD_ID() returns just those — how api/kp-submit's linesOfProject() finds a project's lines.
// Lines whose "Tækifæri 📣 (projects)" names another project aren't linked to `opp`.
export function byLink(routes, { opp, projects = "tbl4LMXlQjp66RFKI", lines = "tblFcsUoGxsuUwNEH", field = "fldlcBLh5sXC6VlRn", link = "Tækifæri 📣 (projects)" } = {}) {
  return (call) => {
    const out = routes(call);
    const url = decodeURIComponent(call.url);
    if (call.method === "GET" && url.includes(`${projects}/${opp}`) && out && out.body && out.body.fields) {
      const all = routes({ method: "GET", url: `https://api.airtable.com/v0/x/${lines}?probe=1` });
      const recs = (all && all.body && all.body.records) || [];
      const ids = recs.filter((r) => !(r.fields || {})[link] || r.fields[link].includes(opp)).map((r) => r.id);
      return { ...out, body: { ...out.body, fields: { ...out.body.fields, [field]: ids } } };
    }
    if (call.method === "GET" && url.includes(lines) && /RECORD_ID/.test(url) && out && out.body && out.body.records) {
      const want = new Set((url.match(/RECORD_ID\(\)='([A-Za-z0-9]+)'/g) || []).map((m) => m.match(/'([^']+)'/)[1]));
      return { ...out, body: { ...out.body, records: out.body.records.filter((r) => want.has(r.id)) } };
    }
    return out;
  };
}
