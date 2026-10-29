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
  var THEME_KEY = "bjorninn:skrifstofa:theme";

  // Yfirlit is owner-only (2026-10-18) — everything else is the shared "allt" operational
  // toolset every office title gets (see api/skrifstofa-login.js for why title no longer
  // splits people into narrower buckets). Bakendi (2026-10-19) is narrower still — "admin"
  // only, which only the Rekstrarstjóri title holds, not every "eigandi"-typed employee
  // (Jóel is Eigandi-typed too but shouldn't see this). Laun (2026-10-19) is "eigandi" —
  // broader than Bakendi on purpose, Jóel/Anton should both see payroll review too.
  var NAV = [
    { id: "home",    icon: "home", label: "Yfirlit",         roles: ["eigandi"], href: "/skrifstofa" },
    { id: "ferli",   icon: "plan", label: "Skipulagsferli",  roles: ["allt"], href: "/ferli" },
    { id: "verkst",  icon: "shop", label: "Framleiðsla",     roles: ["allt"], href: "/framleidsla" },
    { id: "crm",     icon: "people", label: "CRM",             roles: ["allt"], href: "/crm" },
    // PRO home (2026-10-23) — a landing screen in kitchen-planner.html (?pro=home) so staff can start or
    // find a project without first going through CRM/Ferli's own per-project "Opna í hönnuðinum" link.
    // Routed through pro.html (not straight to /skipuleggja), which iframes that same screen inside
    // the office shell — asked for explicitly: PRO hönnuður shouldn't navigate away from skrifstofa,
    // the sidebar should stay up the whole time.
    { id: "pro",     icon: "pencil", label: "PRO hönnuður",    roles: ["allt"], href: "/pro" },
    { id: "starfsmenn", icon: "team", label: "Starfsmenn",   roles: ["eigandi"], href: "/starfsmenn" },
    { id: "bakendi", icon: "wrench", label: "Bakendi",     roles: ["admin"], href: "/bakendi", more: true },
    // Para tæki (2026-10-28) — per-device floor keys; owner-only (api/floor-token.js re-checks Eigandi server-side).
    { id: "para",    icon: "phone", label: "Para tæki",   roles: ["eigandi"], href: "/para-taeki", more: true },
  ];

  var ROLE_LABELS = { allt: "Allt", eigandi: "Eigandi", admin: "Admin" };

  // Line icons (2026-10-28) — one stroke style (currentColor, 1.6 wide) instead of emoji, so the
  // sidebar reads as one quiet system and follows the link colour in light/dark/active states.
  var ICON_PATHS = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    plan: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    shop: '<path d="M14.5 3.5l6 6-3 3-6-6z"/><path d="M11.5 9.5L4.2 16.8a2 2 0 0 0 2.9 2.9l7.3-7.3"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3.2 3.2 0 010 5.6M18 14.4c1.8.8 3 2.6 3 5.6"/>',
    pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
    team: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 00-5 5L4 17l3 3 5.5-5.5a4 4 0 005-5l-2.5 2.5-2-2z"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
    more: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
    out: '<path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4M18 12H9"/>',
    fold: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    chev: '<path d="M9 6l6 6-6 6"/>'
  };
  function svgIcon(name, size) {
    var sz = size || 18;
    return '<svg class="osSvg" width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON_PATHS[name] || "") + '</svg>';
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  // Collapsed-sidebar initials (2026-10-18) — shown under the 🐻 instead of the full name once
  // the sidebar is folded to icons-only. First + last word's first letter (e.g. "Rakel Hulda
  // Bjarkadóttir" → "RB"); a one-word name just uses its own first letter.
  function initialsOf(name) {
    var words = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "";
    var first = words[0].charAt(0);
    var last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
    return (first + last).toUpperCase();
  }

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

  // Dark/light theme (2026-10-18) — same `data-theme` attribute + localStorage pattern app.html/
  // verk.html already use for the floor PWA (those are dark-by-default with a `:root[data-theme=
  // "light"]` override; office pages are the other way round — light-by-default with a
  // `:root[data-theme="dark"]` override — but it's the same mechanism, just each page's own
  // `:root{}` decides what "no attribute" means). office-shell.js only owns the toggle +
  // persistence here, not the palette — each consuming page carries its own dark values.
  // Each page must ALSO set this before first paint via its own inline <head> script (same as
  // app.html/verk.html) — by the time office-shell.js runs (loaded in <body>), the page has
  // already painted once; this function alone would flash light-then-dark on every load.
  function getTheme() { try { return localStorage.getItem(THEME_KEY) || "light"; } catch (e) { return "light"; } }
  function applyTheme(v) { try { document.documentElement.setAttribute("data-theme", v); } catch (e) {} }
  function setTheme(v) { try { localStorage.setItem(THEME_KEY, v); } catch (e) {} applyTheme(v); }
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

  // Items marked `more` (rarely used: Bakendi, Para tæki) live under a quiet "Meira" row instead of
  // crowding the day-to-day list; they are never part of the drag order.
  function splitNav(roles) {
    var all = orderedNav(roles);
    return { main: all.filter(function (a) { return !a.more; }), more: all.filter(function (a) { return a.more; }) };
  }

  // ---- injected chrome styling (sidebar header/footer/nav drag state + settings modal) —
  // self-contained so no consuming page needs its own copy, unlike the pre-existing page-local
  // .sidebar/.nav CSS (width/background) those still own ----
  // Kumbh Sans (2026-10-23) — not loaded by any of the office pages themselves (they use the system
  // font stack throughout), only needed here for the sidebar wordmark, so it's injected alongside
  // the chrome rather than hand-added to every consuming page's own <head>.
  var FONT_LINK_ID = "office-shell-font";
  function injectFont() {
    if (document.getElementById(FONT_LINK_ID)) return;
    var link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Kumbh+Sans:wght@400;600;700&display=swap";
    document.head.appendChild(link);
  }

  var STYLE_ID = "office-shell-style";
  function injectStyle() {
    injectFont();
    if (document.getElementById(STYLE_ID)) return;
    var el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent =
      '.osBrand{padding:16px 16px 14px;border-bottom:1px solid #2a3442;margin-bottom:8px;transition:padding .15s;}' +
      // Text wordmark (2026-10-23, replaces the /logo-bjorninn.png image) — no box behind it now
      // (2026-10-23, was a white rounded box like the old image sat in; asked for plain white text
      // straight on the sidebar instead), Kumbh Sans to match the rest of the site's own font
      // instead of a one-off serif, BJÖRNINN bold / STUDIO regular weight.
      '.osLogo{display:block;width:100%;height:auto;padding:10px 14px 4px;box-sizing:border-box;text-align:center;}' +
      '.osLogoL1{display:block;font-family:"Kumbh Sans",sans-serif;font-weight:600;font-size:1.85rem;line-height:1.1;letter-spacing:.005em;color:#fff;}' +
      '.osLogoL2{display:block;font-family:"Kumbh Sans",sans-serif;font-weight:400;font-size:1.6rem;line-height:1.1;letter-spacing:.06em;color:#fff;margin-top:2px;}' +
      '.osUser{color:#8aa4c7;font-size:.78rem;margin-top:10px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      'html[data-os-density="compact"] .sidebar nav a{padding:5px 18px !important;font-size:.82rem !important;}' +
      '.sidebar nav a{display:flex;align-items:center;gap:10px;user-select:none;}' +
      '.sidebar nav a.dragging{opacity:.35;}' +
      '.sidebar nav a .osLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.osBottom{padding:10px 10px 14px;border-top:1px solid #2a3442;margin-top:8px;display:flex;flex-direction:column;gap:2px;}' +
      '.osBottomRow{display:flex;align-items:center;gap:2px;}' +
      '.osBellRow{display:flex;color:#8aa4c7;}.osBellRow .vbWrap{flex:1;}.osBellRow .vbBtn{flex:1;justify-content:flex-start;}.osBellRow .vbBtn:hover{background:#242e3b;color:#fff;}' +
      'html[data-os-collapsed="1"] .osBellRow .osLabel{display:none;}html[data-os-collapsed="1"] .osBellRow .vbBtn{justify-content:center;}' +
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
      'html[data-os-collapsed="1"] .osBrand::before{content:"B";display:block;font-family:"Kumbh Sans",sans-serif;font-weight:700;font-size:1.5rem;text-align:center;color:#fff;}' +
      '.osSvg{flex:none;opacity:.9;}' +
      '.osIcon{display:inline-flex;align-items:center;}' +
      '.osMoreBtn{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:10px;width:100%;padding:9px 18px;color:#8aa4c7;font-size:.82rem;cursor:pointer;font-family:inherit;}' +
      '.osMoreBtn:hover{background:#242e3b;color:#fff;}' +
      '.osMoreBtn .osChev{margin-left:auto;transition:transform .15s;}' +
      '.osMore.open .osMoreBtn .osChev{transform:rotate(90deg);}' +
      '.osMoreList{display:none;}.osMore.open .osMoreList{display:block;}' +
      'html[data-os-collapsed="1"] .osMoreBtn{justify-content:center;padding:9px 0;}' +
      'html[data-os-collapsed="1"] .osChev{display:none;}' +
      '.osInitials{display:none;}' +
      // Collapsed-only: the signed-in person's initials, right under the 🐻 — see initialsOf().
      'html[data-os-collapsed="1"] .osInitials{display:block;margin-top:4px;font-size:.62rem;font-weight:700;letter-spacing:.04em;text-align:center;color:#8aa4c7;}' +
      'html[data-os-collapsed="1"] .osUser,html[data-os-collapsed="1"] .osLabel,html[data-os-collapsed="1"] .searchWrap,html[data-os-collapsed="1"] .searchResults{display:none !important;}' +
      'html[data-os-collapsed="1"] .sidebar nav a{justify-content:center;padding:9px 0 !important;}' +
      'html[data-os-collapsed="1"] .osBottomRow{justify-content:center;flex-direction:column;}' +
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
      '.osMuted{font-size:.82rem;color:#9aa3ad;}' +
      // Dark theme (2026-10-18) — this shared chrome CSS doesn't go through a page's own `:root`
      // variables, so it gets its own override block here instead.
      'html[data-theme="dark"] .osModal{background:#1b2029;color:#e7eaf0;}' +
      'html[data-theme="dark"] .osModalClose{color:#9aa3ad;}' +
      'html[data-theme="dark"] .osSection h3{color:#9aa3ad;}' +
      'html[data-theme="dark"] .osBadge{background:#2a3140;color:#c7cdd6;}' +
      'html[data-theme="dark"] .osSeg{border-color:#2a3140;}' +
      'html[data-theme="dark"] .osSegBtn{color:#9aa3ad;}' +
      'html[data-theme="dark"] .osSegBtn.active{background:#3b9eff;color:#0b1016;}';
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
    var theme = getTheme();
    bg.innerHTML =
      '<div class="osModal">' +
        '<button class="osModalClose" id="osModalClose" type="button" aria-label="Loka">&times;</button>' +
        '<h2>Stillingar</h2>' +
        '<div class="osSection"><h3>Þú</h3><div class="osWhoName">' + esc(record.name || "") + '</div><div class="osBadges">' + badges + '</div></div>' +
        '<div class="osSection"><h3>Útlit</h3>' +
          '<div class="osMuted" style="margin-bottom:8px;">Þema</div>' +
          '<div class="osSeg" id="osThemeSeg">' +
            '<button class="osSegBtn' + (theme === "light" ? " active" : "") + '" data-v="light" type="button">Ljóst</button>' +
            '<button class="osSegBtn' + (theme === "dark" ? " active" : "") + '" data-v="dark" type="button">Dökkt</button>' +
          '</div>' +
          '<div class="osMuted" style="margin:14px 0 8px;">Þéttleiki hliðarslár</div>' +
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
    document.getElementById("osThemeSeg").addEventListener("click", function (e) {
      var btn = e.target.closest(".osSegBtn");
      if (!btn) return;
      setTheme(btn.dataset.v);
      document.querySelectorAll("#osThemeSeg .osSegBtn").forEach(function (b) { b.classList.toggle("active", b === btn); });
    });
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
    applyTheme(getTheme());
    var k = getK();
    var roles = record.roles || [];

    var topEl = document.getElementById("officeSidebarTop");
    if (topEl) {
      topEl.className = "osBrand";
      topEl.title = record.name || "";
      topEl.innerHTML =
        '<div class="osLogo"><span class="osLogoL1">BJÖRNINN</span><span class="osLogoL2">STUDIO</span></div>' +
        '<div class="osUser">' + esc(record.name || "") + '</div>' +
        '<div class="osInitials">' + esc(initialsOf(record.name)) + '</div>';
    }

    var navEl = document.getElementById("officeNav");
    if (navEl) {
      navEl.innerHTML = "";
      var parts = splitNav(roles);
      function linkFor(a, draggable) {
        var el = document.createElement("a");
        // a.href is normally a bare path ("/crm"), but PRO's href already carries its own "?pro=home" —
        // join with "&" when a query string is already present instead of a second, malformed "?".
        el.href = a.href + (k ? (a.href.indexOf("?") === -1 ? "?" : "&") + "k=" + encodeURIComponent(k) : "");
        el.draggable = !!draggable;
        el.dataset.navId = a.id;
        el.title = a.label;
        el.innerHTML = '<span class="osIcon">' + svgIcon(a.icon) + '</span><span class="osLabel">' + esc(a.label) + '</span>';
        if (a.id === activeId) el.className = "active";
        return el;
      }
      var mainEl = document.createElement("div");
      mainEl.id = "osNavMain";
      parts.main.forEach(function (a) { mainEl.appendChild(linkFor(a, true)); });
      navEl.appendChild(mainEl);
      if (parts.more.length) {
        var moreEl = document.createElement("div");
        moreEl.className = "osMore" + (parts.more.some(function (a) { return a.id === activeId; }) ? " open" : "");
        moreEl.innerHTML = '<button class="osMoreBtn" type="button" title="Meira"><span class="osIcon">' + svgIcon("more") + '</span><span class="osLabel">Meira</span><span class="osChev">' + svgIcon("chev", 14) + '</span></button><div class="osMoreList"></div>';
        var listEl = moreEl.querySelector(".osMoreList");
        parts.more.forEach(function (a) { listEl.appendChild(linkFor(a, false)); });
        moreEl.querySelector(".osMoreBtn").addEventListener("click", function () { moreEl.classList.toggle("open"); });
        navEl.appendChild(moreEl);
      }
      wireNavDrag(mainEl);
    }

    var bottomEl = document.getElementById("officeSidebarBottom");
    if (bottomEl) {
      bottomEl.className = "osBottom";
      bottomEl.innerHTML =
        '<div class="osBellRow" id="officeBellHost"></div>' +
        '<div class="osBottomRow">' +
          '<button class="osSettingsBtn" id="officeSettingsBtn" type="button">' + svgIcon("gear", 17) + '<span class="osLabel">Stillingar</span></button>' +
          '<button class="osFoldBtn" id="officeFoldBtn" type="button" title="Fela/sýna valmynd"></button>' +
        '</div>' +
        '<button class="osLogoutBtn" id="officeLogoutBtn" type="button">' + svgIcon("out", 17) + '<span class="osLabel">Útskrá</span></button>';
      document.getElementById("officeSettingsBtn").addEventListener("click", function () { openSettingsModal(record); });
      document.getElementById("officeLogoutBtn").addEventListener("click", function () { clearSession(); location.href = "/skrifstofa"; });
      var foldBtn = document.getElementById("officeFoldBtn");
      function paintFoldIcon() { foldBtn.innerHTML = svgIcon("fold", 17); }
      paintFoldIcon();
      foldBtn.addEventListener("click", function () { setCollapsed(!getCollapsed()); paintFoldIcon(); });
      mountBell(document.getElementById("officeBellHost"), k);
    }
  }

  // 🔔 Tilkynningar (2026-10-27) — virkni-bell.js is loaded on demand so no page has to
  // add its own <script> tag; the bell lives above Stillingar in the sidebar.
  function mountBell(host, k) {
    if (!host || !k) return;
    function go() { window.VirkniBell.mount(host, { role: "Skrifstofa", k: k, label: "Tilkynningar" }); }
    if (window.VirkniBell) return go();
    var sc = document.createElement("script");
    sc.src = "/virkni-bell.js";
    sc.onload = go;
    document.head.appendChild(sc);
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

  // 2026-10-28 (G5/G6): one place that tells the floor + planner "efni komið" (bell, optional chat)
  // through /api/virkni, used wherever "5. Efni lent í húsi" gets ticked (/skrifstofa, /ferli, /pontun).
  function notifyEfni(k, t, texti, opts) {
    opts = opts || {};
    if (!k || !t) return Promise.resolve(false);
    return fetch("/api/virkni", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ k: k, tegund: "efni", til: "Allir", chat: opts.chat !== false, t: t, tengill: "/verk?t=" + t, hver: opts.name || "", texti: texti }),
    }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  root.OfficeShell = { notifyEfni: notifyEfni, boot: boot, getK: getK, getSession: getSession, NAV: NAV, renderChrome: renderChrome, applyDensity: applyDensity, getDensity: getDensity, applyTheme: applyTheme, getTheme: getTheme };
})(window);
