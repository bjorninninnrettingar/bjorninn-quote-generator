// office-shell.js — shared sidebar/auth logic for the BC-style office pages
// (/skrifstofa, /ferli, /pontun, /crm, /skipulag). Mirrors the cnc-bpp.js
// pattern: logic lives here so the pages can never drift apart. Unlike
// cnc-bpp.js, the sidebar's *chrome* (logo/company/user header, settings
// button, logout, and the settings modal) is now rendered AND styled from
// here, not duplicated per page — only each page's own `.sidebar` shell
// (width/background) and `.sidebar nav a` link styling stay page-local,
// since those predate this file and differ cosmetically page to page.
// 2026-10-17: added the logo/bigger-header/settings-tab redesign — settings
// are real, not a placeholder (Þéttleiki persists to localStorage and
// applies immediately), with room to grow ("Annað" section).
//
// A consuming page needs:
//   - #officeSidebarTop, #officeNav, #officeSidebarBottom inside its own .sidebar
//   - to call OfficeShell.boot("<thisPageId>") on load (or, for /skrifstofa
//     specifically, which handles its own login/record loading, call
//     OfficeShell.renderChrome(record, activeId) directly once logged in)
(function (root) {
  "use strict";

  var SESSION_KEY = "bjorninn:skrifstofa:session";
  var K_STORE = "bjorninn:skrifstofa:k";
  var DENSITY_KEY = "bjorninn:skrifstofa:density";

  var NAV = [
    { id: "home",  label: "🏠 Yfirlit",         roles: ["allt"], href: "/skrifstofa" },
    { id: "ferli", label: "📐 Skipulagsferli",  roles: ["skipulag", "allt"], href: "/ferli" },
    { id: "crm",   label: "📇 CRM",             roles: ["allt"], href: "/crm" },
  ];

  var ROLE_LABELS = { allt: "Allt", skipulag: "Skipulag", sala: "Sala", forskipulag: "Forskipulag" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

  function getK() {
    var fromUrl = new URLSearchParams(location.search).get("k");
    if (fromUrl) { try { localStorage.setItem(K_STORE, fromUrl); } catch (e) {} }
    try { return localStorage.getItem(K_STORE) || ""; } catch (e) { return ""; }
  }
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; }
  }
  function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }

  function getDensity() { try { return localStorage.getItem(DENSITY_KEY) || "normal"; } catch (e) { return "normal"; } }
  function applyDensity(v) { try { document.documentElement.setAttribute("data-os-density", v); } catch (e) {} }
  function setDensity(v) { try { localStorage.setItem(DENSITY_KEY, v); } catch (e) {} applyDensity(v); }

  // ---- injected chrome styling (sidebar header/footer + settings modal) — self-contained so no
  // consuming page needs its own copy, unlike the pre-existing page-local .sidebar/.nav CSS ----
  var STYLE_ID = "office-shell-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent =
      '.osBrand{display:flex;align-items:center;gap:10px;padding:16px 16px 14px;border-bottom:1px solid #2a3442;margin-bottom:8px;}' +
      '.osLogo{width:40px;height:40px;border-radius:9px;background:#fff;object-fit:contain;padding:4px;flex:none;}' +
      '.osBrandText{min-width:0;}' +
      '.osCompany{color:#fff;font-weight:700;font-size:1rem;line-height:1.15;letter-spacing:-.01em;}' +
      '.osUser{color:#8aa4c7;font-size:.78rem;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      'html[data-os-density="compact"] .sidebar nav a,html[data-os-density="compact"] .sidebar nav .navItem{padding:5px 18px !important;font-size:.82rem !important;}' +
      '.osBottom{padding:10px 10px 14px;border-top:1px solid #2a3442;margin-top:8px;display:flex;flex-direction:column;gap:2px;}' +
      '.osSettingsBtn,.osLogoutBtn{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;color:#8aa4c7;font-size:.82rem;cursor:pointer;font-family:inherit;}' +
      '.osSettingsBtn:hover,.osLogoutBtn:hover{background:#242e3b;color:#fff;}' +
      '.osModalBg{display:none;position:fixed;inset:0;background:rgba(10,14,20,.45);z-index:200;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}' +
      '.osModalBg.open{display:flex;}' +
      '.osModal{background:#fff;color:#1a1d21;border-radius:14px;max-width:380px;width:100%;max-height:85vh;overflow:auto;padding:20px;}' +
      '.osModal h2{font-size:1.1rem;font-weight:700;margin:0;}' +
      '.osModalClose{float:right;background:none;border:none;font-size:1.2rem;color:#5d6670;cursor:pointer;line-height:1;}' +
      '.osSection{margin-top:18px;}' +
      '.osSection h3{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#5d6670;margin:0 0 8px;}' +
      '.osWhoName{font-weight:700;font-size:.95rem;}' +
      '.osBadges{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;}' +
      '.osBadge{font-size:.7rem;font-weight:700;padding:3px 9px;border-radius:999px;background:#eef1f5;color:#5d6670;}' +
      '.osSeg{display:flex;border:1px solid #e1e4e8;border-radius:9px;overflow:hidden;}' +
      '.osSegBtn{all:unset;box-sizing:border-box;flex:1;text-align:center;padding:8px 10px;font-size:.82rem;cursor:pointer;color:#5d6670;}' +
      '.osSegBtn.active{background:#0f6cbd;color:#fff;font-weight:700;}' +
      '.osMuted{font-size:.82rem;color:#9aa3ad;}';
    document.head.appendChild(el);
  }

  function openSettingsModal(record) {
    injectStyle();
    var bg = document.getElementById("osSettingsModalBg");
    if (!bg) {
      bg = document.createElement("div");
      bg.id = "osSettingsModalBg";
      bg.className = "osModalBg";
      bg.addEventListener("click", function (e) { if (e.target === bg) bg.classList.remove("open"); });
      document.body.appendChild(bg);
    }
    var roles = record.roles || [];
    var badges = roles.map(function (r) { return '<span class="osBadge">' + esc(ROLE_LABELS[r] || r) + '</span>'; }).join("");
    var density = getDensity();
    bg.innerHTML =
      '<div class="osModal">' +
        '<button class="osModalClose" id="osModalClose" type="button">✕</button>' +
        '<h2>Stillingar</h2>' +
        '<div class="osSection"><h3>Þú</h3><div class="osWhoName">' + esc(record.name || "") + '</div><div class="osBadges">' + badges + '</div></div>' +
        '<div class="osSection"><h3>Útlit</h3>' +
          '<div class="osMuted" style="margin-bottom:8px;">Þéttleiki hliðarslár</div>' +
          '<div class="osSeg" id="osDensitySeg">' +
            '<button class="osSegBtn' + (density === "normal" ? " active" : "") + '" data-v="normal" type="button">Venjulegt</button>' +
            '<button class="osSegBtn' + (density === "compact" ? " active" : "") + '" data-v="compact" type="button">Þétt</button>' +
          '</div>' +
        '</div>' +
        '<div class="osSection"><h3>Annað</h3><div class="osMuted">Fleiri stillingar bætast við hér.</div></div>' +
      '</div>';
    bg.classList.add("open");
    document.getElementById("osModalClose").addEventListener("click", function () { bg.classList.remove("open"); });
    document.getElementById("osDensitySeg").addEventListener("click", function (e) {
      var btn = e.target.closest(".osSegBtn");
      if (!btn) return;
      setDensity(btn.dataset.v);
      document.querySelectorAll("#osDensitySeg .osSegBtn").forEach(function (b) { b.classList.toggle("active", b === btn); });
    });
  }

  // Paints the logo/company/user header, nav links, settings+logout footer into a page's
  // existing #officeSidebarTop / #officeNav / #officeSidebarBottom slots. Used by boot() for
  // every normal area page, and called directly by /skrifstofa (which manages its own
  // login/record loading rather than redirecting through boot()'s auth check).
  function renderChrome(record, activeId) {
    injectStyle();
    applyDensity(getDensity());
    var k = getK();
    var roles = record.roles || [];

    var topEl = document.getElementById("officeSidebarTop");
    if (topEl) {
      topEl.className = "osBrand";
      topEl.innerHTML =
        '<img class="osLogo" src="/logo-bjorninn.png" alt="Björninn Innréttingar" />' +
        '<div class="osBrandText">' +
          '<div class="osCompany">Björninn Innréttingar</div>' +
          '<div class="osUser">' + esc(record.name || "") + '</div>' +
        '</div>';
    }

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

    var bottomEl = document.getElementById("officeSidebarBottom");
    if (bottomEl) {
      bottomEl.className = "osBottom";
      bottomEl.innerHTML =
        '<button class="osSettingsBtn" id="officeSettingsBtn" type="button">⚙️ Stillingar</button>' +
        '<button class="osLogoutBtn" id="officeLogoutBtn" type="button">Útskrá</button>';
      document.getElementById("officeSettingsBtn").addEventListener("click", function () { openSettingsModal(record); });
      document.getElementById("officeLogoutBtn").addEventListener("click", function () { clearSession(); location.href = "/skrifstofa"; });
    }
  }

  function boot(activeId) {
    var k = getK();
    var session = getSession();
    if (!session || !session.record) {
      var ret = encodeURIComponent(location.pathname + location.search);
      location.href = "/skrifstofa?return=" + ret + (k ? "&k=" + encodeURIComponent(k) : "");
      return null;
    }
    renderChrome(session.record, activeId);
    return { k: k, record: session.record };
  }

  root.OfficeShell = { boot: boot, getK: getK, getSession: getSession, NAV: NAV, renderChrome: renderChrome, applyDensity: applyDensity, getDensity: getDensity };
})(window);
