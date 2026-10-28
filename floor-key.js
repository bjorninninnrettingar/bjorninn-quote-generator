/* floor-key.js (2026-10-28) — the workshop pages' key, per device.
   FloorKey.get(fallback) returns this device's paired floor token (localStorage) when it has a valid,
   unexpired one, else `fallback` (the old shared constant) — so a device that was never paired behaves
   exactly as before. Pair a device from /skrifstofa -> "Para tæki" (see api/floor-token.js).
   A paired token is re-checked against the server at most every 6 hours; if it was revoked the stored
   token is dropped and the device falls back to the old key until the next pairing. */
(function (root) {
  var LS = "bjorninn:floorToken:v1";
  var CHK = "bjorninn:floorToken:checked";

  function lsGet(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function parse(t) {
    var p = String(t || "").split(".");
    if (p.length !== 5 || p[0] !== "fl1") return null;
    var exp = Number(p[2]);
    if (!isFinite(exp) || exp * 1000 <= Date.now()) return null;
    var name = "";
    try { name = decodeURIComponent(escape(atob(p[3].replace(/-/g, "+").replace(/_/g, "/")))); } catch (e) {}
    return { deviceId: p[1], exp: exp, name: name };
  }
  function read() {
    var t = lsGet(LS);
    if (!t) return "";
    if (!parse(t)) { lsDel(LS); return ""; }
    return t;
  }
  function get(fallback) { return read() || fallback; }
  function info() { var t = read(); return t ? parse(t) : null; }
  function store(t) { lsSet(LS, t); lsDel(CHK); }
  function clear() { lsDel(LS); lsDel(CHK); }

  function validate() {
    var t = read();
    if (!t || typeof fetch !== "function") return;
    var last = Number(lsGet(CHK)) || 0;
    if (Date.now() - last < 6 * 3600 * 1000) return;
    fetch("/api/floor-token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check", token: t }),
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) return; // network/server trouble: keep the token, try again next load
      if (d.ok) lsSet(CHK, String(Date.now()));
      else if (d.reason === "revoked" || d.reason === "bad_signature" || d.reason === "expired") lsDel(LS);
    }).catch(function () {});
  }

  root.FloorKey = { get: get, read: read, info: info, store: store, clear: clear, validate: validate };
  validate();
})(window);
