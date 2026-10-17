// office-shell.js — shared sidebar/auth logic for the BC-style office pages
// (/skrifstofa, /yfirferd, /pontun, /crm, /skipulag). Mirrors the cnc-bpp.js
// pattern: logic lives here so the pages can never drift apart, but each
// page keeps its own copy of the sidebar CSS in its own <style> block (same
// reasoning as cnc-bpp.js's comment on why — one page's unrelated existing
// classes should never collide with a shared stylesheet).
//
// A consuming page needs:
//   - a container with id="officeSidebar" where the nav list gets rendered
//   - #officeUserName, #officeLogout somewhere in its own sidebar markup
//   - to call OfficeShell.boot("<thisPageId>") on load
(function (root) {
  "use strict";

  var SESSION_KEY = "bjorninn:skrifstofa:session";
  var K_STORE = "bjorninn:skrifstofa:k";

  var NAV = [
    { id: "home",  label: "🏠 Yfirlit",         roles: ["allt"], href: "/skrifstofa" },
    { id: "ferli", label: "📐 Skipulagsferli",  roles: ["skipulag", "allt"], href: "/ferli" },
    { id: "crm",   label: "📇 CRM",             roles: ["allt"], href: "/crm" },
  ];

  function getK() {
    var fromUrl = new URLSearchParams(location.search).get("k");
    if (fromUrl) { try { localStorage.setItem(K_STORE, fromUrl); } catch (e) {} }
    try { return localStorage.getItem(K_STORE) || ""; } catch (e) { return ""; }
  }
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; }
  }
  function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }

  function boot(activeId) {
    var k = getK();
    var session = getSession();
    if (!session || !session.record) {
      var ret = encodeURIComponent(location.pathname + location.search);
      location.href = "/skrifstofa?return=" + ret + (k ? "&k=" + encodeURIComponent(k) : "");
      return null;
    }
    var record = session.record;
    var roles = record.roles || [];

    var navEl = document.getElementById("officeNav");
    if (navEl) {
      navEl.innerHTML = "";
      NAV.filter(function (a) { return a.roles.some(function (r) { return roles.indexOf(r) !== -1; }); })
        .forEach(function (a) {
          var el = document.createElement("a");
          el.href = a.href + (k ? "?k=" + encodeURIComponent(k) : "");
          el.textContent = a.label;
          if (a.id === activeId) el.className = "active";
          navEl.appendChild(el);
        });
    }
    var nameEl = document.getElementById("officeUserName");
    if (nameEl) nameEl.textContent = (record.name || "").split(" ")[0];
    var logoutBtn = document.getElementById("officeLogout");
    if (logoutBtn) logoutBtn.addEventListener("click", function () { clearSession(); location.href = "/skrifstofa"; });

    return { k: k, record: record };
  }

  root.OfficeShell = { boot: boot, getK: getK, getSession: getSession, NAV: NAV };
})(window);
