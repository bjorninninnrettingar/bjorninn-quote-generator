// office-shell.js — shared sidebar/auth logic for the BC-style office pages
// (/skrifstofa, /ferli, /pontun, /crm, /skipulag). Mirrors the cnc-bpp.js
// pattern: logic lives here so the pages can never drift apart. Unlike
// cnc-bpp.js, the sidebar's *chrome* (logo/company/user header, nav links,
// fold toggle, settings button, logout, and the settings modal) is now
// rendered AND styled from here, not duplicated per page — only each
// page's own `.sidebar` shell (width/background) stays page-local, and
// even that gets overridden (via !important, deliberately) when folded.
// 2026-10-17: logo/bigger-header/settings-tab redesign, then per-user nav
// drag-reorder + a fold toggle that shrinks the sidebar to icons-only —
// both persisted to localStorage, both real (not placeholders).
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
  var NAV_ORDER_KEY = "bjorninn:skrifstofa:navOrder";
  var COLLAPSED_KEY = "bjorninn:skrifstofa:collapsed";

  var NAV = [
    { id: "home",  icon: "🏠", label: "Yfirlit",         roles: ["allt"], href: "/skrifstofa" },
    { id: "ferli", icon: "📐", label: "Skipulagsferli",  roles: ["skipulag", "allt"], href: "/ferli" },
    { id: "crm",   icon: "📇", label: "CRM",             roles: ["allt"], href: "/crm" },
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

  function getCollapsed() { try { return localStorage.getItem(COLLAPSED_KEY) === "1"; } catch (e) { return false; } }
  function applyCollapsed(v) { try { document.documentElement.setAttribute("data-os-collapsed", v ? "1" : "0"); } catch (e) {} }
  function setCollapsed(v) { try { localStorage.setItem(COLLAPSED_KEY, v ? "1" : "0"); } catch (e) {} applyCollapsed(v); }

  function getNavOrder() { try { return JSON.parse(localStorage.getItem(NAV_ORDER_KEY) || "null"); } catch (e) { return null; } }
  function setNavOrder(ids) { try { localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(ids)); } catch (e) {} }
  // Applies the person's own saved drag order on top of the role-filtered NAV list; any item not
  // in a saved order (new nav entry added later, or first-ever visit) keeps its original place at
  // the end rather than disappearing.
  function orderedNav(roles) {
    var items = NAV.filter(function (a) { return a.roles.some(function (r) { return roles.indexOf(r) !== -1; }); });
    var order = getNavOrder();
    if (!order) return items;
    var byId = {};
    items.forEach(function (a) { byId[a.id] = a; });
    var out = [];
    order.forEach(function (id) { if (byId[id]) { out.push(byId[id]); delete byId[id]; } });
    items.forEach(function (a) { if (byId[a.id]) out.push(a); });
    return out;
  }

  // ---- injected chrome styling (sidebar header/footer/nav drag state + settings modal) —
  // self-contained so no consuming page needs its own copy, unlike the pre-existing page-local
  // .sidebar/.nav CSS (width/background) those still own ----
  var STYLE_ID = "office-shell-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent =
      '.osBrand{padding:16px 16px 14px;border-bottom:1px solid #2a3442;margin-bottom:8px;transition:padding .15s;}' +
      '.osLogo{display:block;width:100%;height:auto;background:#fff;border-radius:10px;padding:10px 14px;box-sizing:border-box;}' +
      '.osUser{color:#8aa4c7;font-size:.78rem;margin-top:10px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      'html[data-os-density="compact"] .sidebar nav a{padding:5px 18px !important;font-size:.82rem !important;}' +
      '.sidebar nav a{display:flex;align-items:center;gap:10px;user-select:none;}' +
      '.sidebar nav a.dragging{opacity:.35;}' +
      '.sidebar nav a .osLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.osBottom{padding:10px 10px 14px;border-top:1px solid #2a3442;margin-top:8px;display:flex;flex-direction:column;gap:2px;}' +
      '.osBottomRow{display:flex;align-items:center;gap:2px;}' +
      '.osSettingsBtn,.osLogoutBtn{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;color:#8aa4c7;font-size:.82rem;cursor:pointer;font-family:inherit;flex:1;min-width:0;}' +
      '.osSettingsBtn .osLabel,.osLogoutBtn .osLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.osSettingsBtn:hover,.osLogoutBtn:hover{background:#242e3b;color:#fff;}' +
      '.osFoldBtn{all:unset;box-sizing:border-box;flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;color:#8aa4c7;cursor:pointer;font-size:.9rem;}' +
      '.osFoldBtn:hover{background:#242e3b;color:#fff;}' +
      // Collapsed mode: override each page's own hard-coded .sidebar width (!important,
      // deliberately — this is the one case office-shell.js reaches into page-owned CSS) and hide
      // every text label, leaving icon-only nav + a fold button to expand again.
      'html[data-os-collapsed="1"] .sidebar{width:72px !important;}' +
      'html[data-os-collapsed="1"] .osLogo{display:none;}' +
      'html[data-os-collapsed="1"] .osBrand::before{content:"🐻";display:block;font-size:1.6rem;text-align:center;}' +
      'html[data-os-collapsed="1"] .osUser,html[data-os-collapsed="1"] .osLabel,html[data-os-collapsed="1"] .searchWrap,html[data-os-collapsed="1"] .searchResults{display:none !important;}' +
      'html[data-os-collapsed="1"] .sidebar nav a{justify-content:center;padding:9px 0 !important;}' +
      'html[data-os-collapsed="1"] .osBottomRow{justify-content:center;}' +
      'html[data-os-collapsed="1"] .osSettingsBtn,html[data-os-collapsed="1"] .osLogoutBtn{flex:none;justify-content:center;padding:8px;}' +
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
          '<div class="osMuted" style="margin-top:8px;">Draga má valmyndarliði til að raða þeim upp á nýtt. Fella-takkinn neðst í hliðarslánni felur hana niður í táknmyndir.</div>' +
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

  // Vanilla drag-to-reorder on the nav <a> list (event delegation on the <nav> container) — no
  // library, just the standard "find the element whose vertical midpoint the pointer has crossed"
  // approach. Persists the new order on every drop.
  function wireNavDrag(navEl) {
    if (navEl.dataset.dragWired) return;
    navEl.dataset.dragWired = "1";
    function afterElement(y) {
      var els = Array.prototype.slice.call(navEl.querySelectorAll("a:not(.dragging)"));
      return els.reduce(function (closest, child) {
        var box = child.getBoundingClientRect();
        var offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
        return closest;
      }, { offset: -Infinity, element: null }).element;
    }
    navEl.addEventListener("dragstart", function (e) {
      var a = e.target.closest("a");
      if (!a) return;
      a.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", a.dataset.navId || ""); } catch (err) {}
    });
    navEl.addEventListener("dragend", function (e) {
      var a = e.target.closest("a");
      if (a) a.classList.remove("dragging");
    });
    navEl.addEventListener("dragover", function (e) {
      e.preventDefault();
      var dragging = navEl.querySelector("a.dragging");
      if (!dragging) return;
      var after = afterElement(e.clientY);
      if (after == null) navEl.appendChild(dragging); else navEl.insertBefore(dragging, after);
    });
    navEl.addEventListener("drop", function (e) {
      e.preventDefault();
      var ids = Array.prototype.map.call(navEl.querySelectorAll("a"), function (a) { return a.dataset.navId; });
      setNavOrder(ids);
    });
  }

  // Paints the logo/company/user header, nav links, fold+settings+logout footer into a page's
  // existing #officeSidebarTop / #officeNav / #officeSidebarBottom slots. Used by boot() for
  // every normal area page, and called directly by /skrifstofa (which manages its own
  // login/record loading rather than redirecting through boot()'s auth check).
  function renderChrome(record, activeId) {
    injectStyle();
    applyDensity(getDensity());
    applyCollapsed(getCollapsed());
    var k = getK();
    var roles = record.roles || [];

    var topEl = document.getElementById("officeSidebarTop");
    if (topEl) {
      topEl.className = "osBrand";
      topEl.innerHTML =
        '<img class="osLogo" src="/logo-bjorninn.png" alt="Björninn Innréttingar" />' +
        '<div class="osUser">' + esc(record.name || "") + '</div>';
    }

    var navEl = document.getElementById("officeNav");
    if (navEl) {
      navEl.innerHTML = "";
      orderedNav(roles).forEach(function (a) {
        var el = document.createElement("a");
        el.href = a.href + (k ? "?k=" + encodeURIComponent(k) : "");
        el.draggable = true;
        el.dataset.navId = a.id;
        el.title = a.label;
        el.innerHTML = '<span class="osIcon">' + esc(a.icon) + '</span><span class="osLabel">' + esc(a.label) + '</span>';
        if (a.id === activeId) el.className = "active";
        navEl.appendChild(el);
      });
      wireNavDrag(navEl);
    }

    var bottomEl = document.getElementById("officeSidebarBottom");
    if (bottomEl) {
      bottomEl.className = "osBottom";
      bottomEl.innerHTML =
        '<div class="osBottomRow">' +
          '<button class="osSettingsBtn" id="officeSettingsBtn" type="button">⚙️ <span class="osLabel">Stillingar</span></button>' +
          '<button class="osFoldBtn" id="officeFoldBtn" type="button" title="Fela/sýna valmynd"></button>' +
        '</div>' +
        '<button class="osLogoutBtn" id="officeLogoutBtn" type="button">↩ <span class="osLabel">Útskrá</span></button>';
      document.getElementById("officeSettingsBtn").addEventListener("click", function () { openSettingsModal(record); });
      document.getElementById("officeLogoutBtn").addEventListener("click", function () { clearSession(); location.href = "/skrifstofa"; });
      var foldBtn = document.getElementById("officeFoldBtn");
      function paintFoldIcon() { foldBtn.textContent = getCollapsed() ? "⇥" : "⇤"; }
      paintFoldIcon();
      foldBtn.addEventListener("click", function () { setCollapsed(!getCollapsed()); paintFoldIcon(); });
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
