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
