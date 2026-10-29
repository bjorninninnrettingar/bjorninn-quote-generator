// office-grid.js — modular, per-person layout for the office pages (2026-10-29).
// Every block on a page is a "widget" on a 12-column grid: drag it by its grip to reorder, drag the
// corner to set width (columns) and height (rows), hide it, bring it back from "Bæta við". The layout is
// saved in localStorage per person + page (nothing server-side), "Endurstilla" goes back to the page's
// defaults. Normal mode has no handles at all — editing only happens after "Breyta útliti", so nothing can
// be dragged by accident. Below 900 px wide the grid collapses to one column and editing is off.
//
//   var grid = OfficeGrid.mount({
//     container: el,                 // gets class og-grid; widgets must be its children (or are moved in)
//     key: "crm",                    // per page
//     user: "Rakel",                 // per person
//     widgets: [{ id, el, title, w, h, hidden?, force? }]   // w = columns (2–12), h = rows (2–40)
//   });
//   grid.edit(true|false), grid.toggleEdit(), grid.reset(), grid.show(id), grid.hide(id), grid.toggle(id)
//
// `force: true` = the widget hides itself when empty (style.display = none); in edit mode it is shown
// anyway so it can still be placed.
(function (root) {
  "use strict";
  var ROW = 64, GAP = 14, COLS = 12, MIN_W = 2, MIN_H = 2, MAX_H = 40;

  var CSS =
    ".og-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:" + ROW + "px;grid-auto-flow:row dense;gap:" + GAP + "px;align-items:stretch;}" +
    ".og-w{position:relative;min-width:0;min-height:0;overflow:auto;margin:0 !important;}" +
    ".og-w.og-off{display:none !important;}" +
    ".og-editing .og-w{overflow:hidden !important;outline:2px dashed rgba(127,127,127,.45);outline-offset:-2px;border-radius:14px;}" +
    ".og-editing .og-w[data-og-force]:not(.og-off){display:block !important;}" +
    ".og-editing .og-w>*:not(.og-chrome):not(.og-rz){pointer-events:none;opacity:.55;}" +
    ".og-w.og-dragging{opacity:.5;outline-color:var(--accent,#0f6cbd);}" +
    ".og-chrome{display:none;position:absolute;left:8px;right:8px;top:8px;z-index:30;align-items:center;gap:6px;background:var(--surface,#fff);border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.18);padding:5px 6px;font:600 .78rem var(--font,system-ui);color:var(--text,#111);}" +
    ".og-editing .og-chrome{display:flex;}" +
    ".og-grip{cursor:grab;touch-action:none;display:flex;align-items:center;gap:6px;flex:1;min-width:0;padding:3px 4px;border-radius:6px;user-select:none;}" +
    ".og-grip:active{cursor:grabbing;}" +
    ".og-grip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}" +
    ".og-grip svg{flex:none;opacity:.55;}" +
    ".og-chrome button{all:unset;box-sizing:border-box;cursor:pointer;min-width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font:600 .72rem var(--font,system-ui);color:var(--muted,#666);padding:0 5px;}" +
    ".og-chrome button:hover{background:var(--bg,#f3f3f3);color:var(--text,#111);}" +
    ".og-chrome button.on{background:var(--accent,#0f6cbd);color:#fff;}" +
    ".og-rz{display:none;position:absolute;right:2px;bottom:2px;width:22px;height:22px;cursor:nwse-resize;touch-action:none;z-index:31;color:var(--muted,#888);}" +
    ".og-editing .og-rz{display:block;}" +
    ".og-rz svg{display:block;}" +
    ".og-bar{display:none;align-items:center;gap:10px;flex-wrap:wrap;background:var(--surface,#fff);border-radius:14px;padding:10px 16px;margin-bottom:14px;font:.86rem var(--font,system-ui);color:var(--muted,#666);}" +
    ".og-bar.open{display:flex;}" +
    ".og-bar .og-hint{flex:1;min-width:200px;}" +
    ".og-bar button,.og-bar select{all:unset;box-sizing:border-box;cursor:pointer;font:600 .84rem var(--font,system-ui);padding:7px 14px;border-radius:999px;background:var(--bg,#f3f3f3);color:var(--text,#111);}" +
    ".og-bar button:hover,.og-bar select:hover{filter:brightness(.96);}" +
    ".og-bar button.og-done{background:var(--accent,#0f6cbd);color:#fff;}" +
    ".og-bar select{padding-right:14px;}" +
    "@media (max-width:900px){.og-grid{display:block;}.og-w{overflow:visible;margin-bottom:16px !important;}.og-chrome,.og-rz,.og-bar{display:none !important;}}";

  function injectCss() {
    if (document.getElementById("og-style")) return;
    var s = document.createElement("style"); s.id = "og-style"; s.textContent = CSS; document.head.appendChild(s);
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var GRIP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>';
  var RZ = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M20 10l-10 10M20 16l-4 4"/></svg>';
  var PRESETS = [["¼", 3], ["⅓", 4], ["½", 6], ["⅔", 8], ["Allt", 12]];

  function mount(opts) {
    injectCss();
    var box = opts.container, defs = {}, order = [];
    var storeKey = "bjorninn:grid:" + opts.key + ":" + String(opts.user || "").replace(/\s+/g, "_");
    opts.widgets.forEach(function (w) { defs[w.id] = w; order.push(w.id); });

    function defaults() {
      var st = { order: order.slice(), size: {}, hidden: [] };
      order.forEach(function (id) { st.size[id] = { w: defs[id].w || 6, h: defs[id].h || 4 }; if (defs[id].hidden) st.hidden.push(id); });
      return st;
    }
    function load() {
      var st = defaults(), saved = null;
      try { saved = JSON.parse(localStorage.getItem(storeKey) || "null"); } catch (e) {}
      if (saved && typeof saved === "object") {
        if (Array.isArray(saved.order)) {
          var seen = {}, o = [];
          saved.order.forEach(function (id) { if (defs[id] && !seen[id]) { seen[id] = 1; o.push(id); } });
          st.order.forEach(function (id) { if (!seen[id]) o.push(id); }); // widgets added to the page later
          st.order = o;
        }
        if (saved.size) Object.keys(saved.size).forEach(function (id) {
          var z = saved.size[id]; if (defs[id] && z) st.size[id] = { w: clamp(+z.w || st.size[id].w, MIN_W, COLS), h: clamp(+z.h || st.size[id].h, MIN_H, MAX_H) };
        });
        if (Array.isArray(saved.hidden)) st.hidden = saved.hidden.filter(function (id) { return defs[id]; });
      }
      return st;
    }
    var state = load();
    function save() { try { localStorage.setItem(storeKey, JSON.stringify(state)); } catch (e) {} }

    box.classList.add("og-grid");
    var bar = document.createElement("div"); bar.className = "og-bar";
    box.parentNode.insertBefore(bar, box);

    var els = {};
    order.forEach(function (id) {
      var d = defs[id], el = d.el; els[id] = el;
      el.classList.add("og-w"); el.dataset.ogId = id; if (d.force) el.dataset.ogForce = "1";
      var ch = document.createElement("div"); ch.className = "og-chrome";
      ch.innerHTML = '<div class="og-grip" title="Draga til að færa">' + GRIP + "<span>" + (d.title || id) + "</span></div>" +
        PRESETS.map(function (p) { return '<button type="button" data-w="' + p[1] + '" title="Breidd: ' + p[0] + '">' + p[0] + "</button>"; }).join("") +
        '<button type="button" data-hide="1" title="Fela">&times;</button>';
      el.appendChild(ch);
      var rz = document.createElement("div"); rz.className = "og-rz"; rz.title = "Draga til að stækka"; rz.innerHTML = RZ; el.appendChild(rz);
      wireWidget(id, el, ch, rz);
    });

    function apply() {
      state.order.forEach(function (id) { box.appendChild(els[id]); });
      state.order.forEach(function (id) {
        var z = state.size[id], el = els[id];
        el.style.gridColumn = "span " + z.w; el.style.gridRow = "span " + z.h;
        el.classList.toggle("og-off", state.hidden.indexOf(id) !== -1);
        el.querySelectorAll(".og-chrome [data-w]").forEach(function (b) { b.classList.toggle("on", +b.dataset.w === z.w); });
      });
      renderBar();
    }

    function metrics() {
      var r = box.getBoundingClientRect(), colW = (r.width - GAP * (COLS - 1)) / COLS;
      return { colW: colW, left: r.left };
    }

    function wireWidget(id, el, ch, rz) {
      ch.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        if (b.dataset.w) { state.size[id].w = +b.dataset.w; save(); apply(); }
        else if (b.dataset.hide) { hide(id); }
      });
      // reorder: the dragged widget hops over whichever widget the pointer is over (before/after by position)
      var grip = ch.querySelector(".og-grip");
      grip.addEventListener("pointerdown", function (e) {
        if (e.button) return; e.preventDefault();
        grip.setPointerCapture(e.pointerId); el.classList.add("og-dragging");
        function move(ev) {
          var under = document.elementsFromPoint(ev.clientX, ev.clientY).filter(function (n) { return n.classList && n.classList.contains("og-w") && n !== el && !n.classList.contains("og-off"); })[0];
          if (!under) return;
          var r = under.getBoundingClientRect();
          var after = ev.clientY > r.top + r.height / 2 && ev.clientX > r.left + r.width * 0.25 ? true : ev.clientX > r.left + r.width / 2;
          if (after) box.insertBefore(el, under.nextSibling); else box.insertBefore(el, under);
        }
        function up() {
          grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); grip.removeEventListener("pointercancel", up);
          el.classList.remove("og-dragging");
          state.order = Array.prototype.map.call(box.querySelectorAll(":scope > .og-w"), function (n) { return n.dataset.ogId; });
          save();
        }
        grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up); grip.addEventListener("pointercancel", up);
      });
      // resize: corner drag snaps to columns/rows
      rz.addEventListener("pointerdown", function (e) {
        if (e.button) return; e.preventDefault(); e.stopPropagation();
        rz.setPointerCapture(e.pointerId);
        var m = metrics(), r0 = el.getBoundingClientRect();
        function move(ev) {
          var w = clamp(Math.round((ev.clientX - r0.left + GAP) / (m.colW + GAP)), MIN_W, COLS);
          var h = clamp(Math.round((ev.clientY - r0.top + GAP) / (ROW + GAP)), MIN_H, MAX_H);
          state.size[id] = { w: w, h: h }; el.style.gridColumn = "span " + w; el.style.gridRow = "span " + h;
        }
        function up() {
          rz.removeEventListener("pointermove", move); rz.removeEventListener("pointerup", up); rz.removeEventListener("pointercancel", up);
          save(); apply();
        }
        rz.addEventListener("pointermove", move); rz.addEventListener("pointerup", up); rz.addEventListener("pointercancel", up);
      });
    }

    function hide(id) { if (state.hidden.indexOf(id) === -1) state.hidden.push(id); save(); apply(); }
    function show(id) {
      state.hidden = state.hidden.filter(function (x) { return x !== id; });
      // a widget brought back goes to the end of the page, where it can be seen and dragged
      state.order = state.order.filter(function (x) { return x !== id; }).concat(id);
      save(); apply();
      try { els[id].scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) {}
    }
    function toggle(id) { if (state.hidden.indexOf(id) === -1) hide(id); else show(id); }
    function reset() { state = defaults(); save(); apply(); }

    var editing = false;
    function renderBar() {
      var hidden = state.hidden;
      bar.innerHTML = '<div class="og-hint">Dragðu kubb á gripið til að færa hann, dragðu hornið til að stækka, eða veldu breidd. Þetta er bara þín uppsetning.</div>' +
        (hidden.length ? '<select class="og-add"><option value="">Bæta við…</option>' + hidden.map(function (id) { return '<option value="' + id + '">' + (defs[id].title || id) + "</option>"; }).join("") + "</select>" : "") +
        '<button type="button" class="og-reset">Endurstilla</button><button type="button" class="og-done">Klára</button>';
      bar.classList.toggle("open", editing);
      var add = bar.querySelector(".og-add"); if (add) add.addEventListener("change", function () { if (add.value) show(add.value); });
      bar.querySelector(".og-reset").addEventListener("click", function () { if (confirm("Endurstilla útlit þessarar síðu?")) reset(); });
      bar.querySelector(".og-done").addEventListener("click", function () { edit(false); });
    }
    function edit(on) {
      if (on && window.innerWidth <= 900) return;
      editing = !!on;
      box.classList.toggle("og-editing", editing);
      renderBar();
    }
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && editing) edit(false); });

    apply();
    return { edit: edit, toggleEdit: function () { edit(!editing); }, isEditing: function () { return editing; }, reset: reset, show: show, hide: hide, toggle: toggle, isHidden: function (id) { return state.hidden.indexOf(id) !== -1; } };
  }

  root.OfficeGrid = { mount: mount };
})(window);
