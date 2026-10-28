// virkni-bell.js — 🔔 Tilkynningar v1 (2026-10-27)
// One bell for /skrifstofa (via office-shell.js) and /app. Reads /api/virkni filtered by
// role (Skrifstofa sees its own + Allir; Verkstæði sees its own + Allir), polls every 60 s
// and whenever the tab becomes visible. "Ólesið" = lines newer than the last one this
// browser has seen (localStorage) — enough for v1, no server-side read state.
//
//   VirkniBell.mount(hostEl, { role: "Skrifstofa" | "Verkstæði", k: "<VERK_KEY>" })
//   VirkniBell.post({ k, texti, tegund, til, t, tengill, hver, chat })  → Promise (never rejects)
(function (root) {
  "use strict";
  var POLL_MS = 60000;
  var IS_MONTHS = ["jan", "feb", "mar", "apr", "maí", "jún", "júl", "ágú", "sep", "okt", "nóv", "des"];

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ago(iso) {
    var t = Date.parse(iso); if (!t) return "";
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return "rétt í þessu";
    if (s < 3600) return Math.floor(s / 60) + " mín";
    if (s < 86400) return Math.floor(s / 3600) + " klst";
    var d = new Date(t);
    return d.getDate() + ". " + IS_MONTHS[d.getMonth()];
  }
  function seenKey(role) { return "bjorninn:virkni:seen:" + role; }
  function getSeen(role) { try { return localStorage.getItem(seenKey(role)) || ""; } catch (e) { return ""; } }
  function setSeen(role, iso) { try { localStorage.setItem(seenKey(role), iso); } catch (e) {} }
  function withKey(path, k) {
    if (!k || !path) return path;
    var hashAt = path.indexOf("#");
    var base = hashAt === -1 ? path : path.slice(0, hashAt), hash = hashAt === -1 ? "" : path.slice(hashAt);
    return base + (base.indexOf("?") === -1 ? "?" : "&") + "k=" + encodeURIComponent(k) + hash;
  }

  var CSS =
    ".vbWrap{position:relative;display:inline-flex;}" +
    ".vbBtn{all:unset;box-sizing:border-box;position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;border-radius:8px;padding:8px 10px;font:inherit;font-size:.82rem;color:inherit;}" +
    ".vbBtn:hover{background:rgba(127,127,127,.18);}" +
    ".vbIc{display:inline-flex;line-height:1;}" +
    ".vbBadge{position:absolute;top:2px;left:20px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#d93025;color:#fff;font-size:.66rem;font-weight:700;line-height:16px;text-align:center;box-sizing:border-box;}" +
    ".vbBadge[hidden]{display:none;}" +
    ".vbPanel{position:fixed;z-index:1000;width:min(380px,calc(100vw - 24px));max-height:min(70vh,560px);overflow:auto;background:#fff;color:#1c2430;border:1px solid #d9dee5;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.22);font-size:.86rem;}" +
    ".vbPanel[hidden]{display:none;}" +
    ".vbHd{display:flex;justify-content:space-between;align-items:center;padding:12px 14px 8px;font-weight:700;}" +
    ".vbHd span{font-weight:400;color:#6b7684;font-size:.76rem;}" +
    ".vbItem{display:block;padding:9px 14px;border-top:1px solid #eef1f4;color:inherit;text-decoration:none;}" +
    "a.vbItem:hover{background:#f4f7fa;}" +
    ".vbItem.new{background:#fff8e6;}" +
    ".vbMeta{color:#6b7684;font-size:.74rem;margin-top:2px;}" +
    ".vbEmpty{padding:18px 14px;color:#6b7684;text-align:center;}" +
    "@media (prefers-color-scheme: dark){html:not([data-theme=light]) .vbPanel{background:#1c2430;color:#e8edf3;border-color:#2e3a49;}html:not([data-theme=light]) .vbItem{border-color:#2a3542;}html:not([data-theme=light]) a.vbItem:hover{background:#243040;}html:not([data-theme=light]) .vbItem.new{background:#3a3220;}}" +
    ".vbPanel.vbDark{background:#1c2430;color:#e8edf3;border-color:#2e3a49;}.vbDark .vbItem{border-color:#2a3542;}.vbDark a.vbItem:hover{background:#243040;}.vbDark .vbItem.new{background:#3a3220;}" +
    "html[data-theme=dark] .vbPanel{background:#1c2430;color:#e8edf3;border-color:#2e3a49;}html[data-theme=dark] .vbItem{border-color:#2a3542;}html[data-theme=dark] a.vbItem:hover{background:#243040;}html[data-theme=dark] .vbItem.new{background:#3a3220;}";

  function injectCss() {
    if (document.getElementById("vbCss")) return;
    var st = document.createElement("style"); st.id = "vbCss"; st.textContent = CSS;
    document.head.appendChild(st);
  }

  function mount(host, opts) {
    if (!host || !opts || !opts.k) return null;
    injectCss();
    var role = opts.role === "Verkstæði" ? "Verkstæði" : "Skrifstofa";
    var wrap = document.createElement("div");
    wrap.className = "vbWrap";
    wrap.innerHTML =
      '<button type="button" class="vbBtn" title="Tilkynningar"><span class="vbIc"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15z"/><path d="M10 21h4"/></svg></span>' +
      (opts.label ? '<span class="osLabel">' + esc(opts.label) + '</span>' : "") +
      '<span class="vbBadge" hidden></span></button>';
    var panel = document.createElement("div");
    panel.className = "vbPanel" + (opts.dark && opts.dark() ? " vbDark" : ""); panel.hidden = true;
    document.body.appendChild(panel);
    host.appendChild(wrap);
    var btn = wrap.querySelector(".vbBtn"), badge = wrap.querySelector(".vbBadge");
    var items = [], loaded = false;

    function paintBadge() {
      var seen = getSeen(role);
      var n = items.filter(function (it) { return it.timi > seen; }).length;
      // First visit ever: don't greet someone with "50 ólesið" — start from now.
      if (!seen && items.length) { setSeen(role, items[0].timi); n = 0; }
      badge.hidden = !n;
      badge.textContent = n > 9 ? "9+" : String(n);
    }
    function paintPanel(seenBefore) {
      panel.innerHTML = '<div class="vbHd">Tilkynningar <span>' + esc(role === "Verkstæði" ? "Verkstæði + allir" : "Skrifstofa + allir") + '</span></div>' +
        (!loaded ? '<div class="vbEmpty">Sæki…</div>' :
          !items.length ? '<div class="vbEmpty">Ekkert nýtt</div>' :
          items.map(function (it) {
            var tag = it.tengill ? "a" : "div";
            var href = it.tengill ? ' href="' + esc(withKey(it.tengill, opts.k)) + '"' : "";
            return "<" + tag + ' class="vbItem' + (seenBefore && it.timi > seenBefore ? " new" : "") + '"' + href + ">" +
              "<div>" + esc(it.texti) + "</div>" +
              '<div class="vbMeta">' + esc(ago(it.timi)) + (it.hver ? " · " + esc(it.hver) : "") + "</div></" + tag + ">";
          }).join(""));
    }
    function place() {
      var r = btn.getBoundingClientRect();
      var w = panel.offsetWidth || 380;
      var left = Math.min(Math.max(12, r.left), window.innerWidth - w - 12);
      var below = r.bottom + 6, h = panel.offsetHeight || 300;
      panel.style.left = left + "px";
      panel.style.top = (below + h > window.innerHeight - 12 ? Math.max(12, r.top - h - 6) : below) + "px";
    }
    function load() {
      return fetch("/api/virkni?k=" + encodeURIComponent(opts.k) + "&til=" + encodeURIComponent(role), { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : { items: [] }; })
        .then(function (d) { items = d.items || []; loaded = true; paintBadge(); if (!panel.hidden) paintPanel(panel.dataset.seen); })
        .catch(function () {});
    }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (!panel.hidden) { panel.hidden = true; return; }
      if (opts.dark) panel.classList.toggle("vbDark", !!opts.dark());
      var seenBefore = getSeen(role);
      panel.dataset.seen = seenBefore;
      paintPanel(seenBefore);
      panel.hidden = false;
      place();
      if (items.length) setSeen(role, items[0].timi);
      paintBadge();
    });
    document.addEventListener("click", function (e) { if (!panel.hidden && !panel.contains(e.target)) panel.hidden = true; });
    window.addEventListener("resize", function () { if (!panel.hidden) place(); });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") load(); });
    setInterval(function () { if (document.visibilityState === "visible") load(); }, POLL_MS);
    load();
    return { reload: load };
  }

  function post(payload) {
    return fetch("/api/virkni", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    }).then(function (r) { return r.json().catch(function () { return {}; }); }).catch(function () { return {}; });
  }

  root.VirkniBell = { mount: mount, post: post };
})(window);
