// office-money.js — "Greiðslur & tilboð" section of a project popup (2026-10-26), shared by
// /skrifstofa (Verk í vinnslu popup) and /crm (project detail) so the two can't drift apart —
// same pattern as office-shell.js. Talks only to /api/greidslur (VERK_KEY-gated), which flips the
// same checkboxes / calls the same generate-quote modes the Airtable automations already use —
// no money logic lives here.
//
//   OfficeMoney.mount(containerEl, recordId, k)   — renders + loads; call again on every open.
(function (root) {
  "use strict";

  var STYLE_ID = "office-money-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent =
      '.omGroup{margin-top:10px;}' +
      '.omGroup:first-child{margin-top:0;}' +
      '.omGroupHd{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--dim,#9aa3ad);margin:0 0 4px;}' +
      '.omRow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--line);font-size:.86rem;min-height:32px;}' +
      '.omRow:last-child{border-bottom:none;}' +
      '.omRow .k{color:var(--muted);}' +
      '.omRow .v{display:flex;align-items:center;gap:8px;text-align:right;}' +
      '.omOk{color:var(--good,#1a7d36);font-weight:600;}' +
      '.omBtn{background:none;border:1px solid var(--line);border-radius:8px;padding:5px 11px;font-size:.8rem;color:var(--text);font-family:inherit;cursor:pointer;white-space:nowrap;}' +
      '.omBtn:hover:not(:disabled){border-color:var(--accent);color:var(--accent);}' +
      '.omBtn.primary{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:700;}' +
      '.omBtn.primary:hover:not(:disabled){color:#fff;opacity:.9;}' +
      '.omBtn:disabled{opacity:.45;cursor:default;}' +
      '.omPrints{display:flex;flex-wrap:wrap;gap:6px;padding:6px 0;}' +
      '.omFiles{display:flex;flex-wrap:wrap;gap:6px;font-size:.8rem;padding:2px 0 6px;}' +
      '.omFiles a{color:var(--accent);text-decoration:none;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.omFiles a:hover{text-decoration:underline;}' +
      '.omLog{font-size:.74rem;color:var(--muted);white-space:pre-wrap;background:var(--bg);border-radius:8px;padding:6px 9px;margin:4px 0 2px;}' +
      '.omNote{font-size:.74rem;color:var(--dim,#9aa3ad);}' +
      '.omMsg{font-size:.8rem;color:var(--muted);min-height:1.1em;margin-top:6px;}' +
      '.omMsg.bad{color:var(--bad,#c4291c);}' +
      '.omEmpty{color:var(--dim,#9aa3ad);font-size:.85rem;}';
    document.head.appendChild(el);
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function kr(n) { return Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " kr."; }
  function day(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return isNaN(d) ? "" : d.getDate() + "." + (d.getMonth() + 1) + "." + d.getFullYear();
  }

  var PRINTS = [
    { mode: "cabinets", label: "🖨️ Tilboð" },
    { mode: "combined", label: "🖨️ Sameinað tilboð" },
    { mode: "estimate", label: "💡 Verðhugmynd" },
  ];

  // Each mount() bumps the token, so a slow response for a previously opened project never paints
  // over the one now on screen.
  var seq = 0;

  function mount(el, recordId, k) {
    injectStyle();
    var my = ++seq;
    var busy = false;
    el.innerHTML = '<div class="omEmpty">Sæki…</div>';
    if (!k) { el.innerHTML = '<div class="omEmpty">Vantar aðgangslykil — skráðu þig inn aftur á /skrifstofa.</div>'; return; }

    function url(extra) { return "/api/greidslur?k=" + encodeURIComponent(k) + (extra || ""); }

    function load() {
      return fetch(url("&id=" + encodeURIComponent(recordId)))
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (my !== seq) return;
          if (!res.ok) { el.innerHTML = '<div class="omEmpty">Tókst ekki að sækja (' + esc(res.d.error || "villa") + ')</div>'; return; }
          render(res.d);
        })
        .catch(function () { if (my === seq) el.innerHTML = '<div class="omEmpty">Tókst ekki að tengjast</div>'; });
    }

    function payRow(label, p, action) {
      var v = p.paid
        ? '<span class="omOk">✓ Greidd' + (p.at ? " " + esc(day(p.at)) : "") + '</span>'
        : '<button class="omBtn" type="button" data-act="' + action + '">Merkja greidda</button>';
      return '<div class="omRow"><span class="k">' + esc(label) + '</span><span class="v">' + v + '</span></div>';
    }
    function fileLinks(list) {
      return list.length ? '<div class="omFiles">' + list.map(function (f) {
        return '<a href="' + esc(f.url) + '" target="_blank" rel="noopener" title="' + esc(f.filename) + '">📄 ' + esc(f.filename) + '</a>';
      }).join("") + '</div>' : "";
    }

    function render(s) {
      var split = s.split || "";
      var three = split === "40% - 30% - 30%", none = split === "100%";
      var html = "";

      // Greiðslur
      html += '<div class="omGroup"><div class="omGroupHd">Greiðslur</div>' +
        '<div class="omRow"><span class="k">Skipting</span><span class="v">' + esc(split || "—") + '</span></div>' +
        '<div class="omRow"><span class="k">Greiðsla 1 (staðfesting)</span><span class="v">' + esc(s.g1 || "—") + '</span></div>';
      if (!none) html += payRow(three ? "Greiðsla 2 (30%)" : "Greiðsla 2", s.g2, "g2");
      if (three || !split) html += payRow("Greiðsla 3 (30%)", s.g3, "g3");
      html += '</div>';

      // Viðbætur
      var canApprove = s.confirmed != null && s.vidbaetur > 0;
      html += '<div class="omGroup"><div class="omGroupHd">Viðbætur</div>' +
        '<div class="omRow"><span class="k">Ósamþykktar viðbætur</span><span class="v"><b>' + kr(s.vidbaetur) + '</b>' +
          (canApprove ? '<button class="omBtn primary" type="button" data-act="vidbaetur">Samþykkja</button>' : "") + '</span></div>' +
        (s.vidbaeturSamthykktar ? '<div class="omRow"><span class="k">Samþykktar (innréttingar)</span><span class="v">' + kr(s.vidbaeturSamthykktar) + '</span></div>' : "") +
        '<div class="omRow"><span class="k">Viðbótartilboð</span><span class="v">' +
          '<button class="omBtn" type="button" data-print="vidbot"' + (canApprove ? "" : " disabled title=\"Engar ósamþykktar viðbætur á staðfestu verki\"") + '>📄 Prenta</button></span></div>' +
        fileLinks(s.vidbot) +
        (s.confirmed == null ? '<div class="omNote">Verkið er ekki staðfest — viðbætur reiknast eftir staðfestingu.</div>' : "") +
        '</div>';

      // Konto
      var g1 = s.g1Drafted
        ? '<span class="omOk">✓ Drög til</span>'
        : (s.g1Ready
          ? '<button class="omBtn" type="button" data-act="g1">🧾 Búa til drög</button>'
          : '<button class="omBtn" type="button" disabled title="Þarf fyrst að tengja automationið í Airtable">🧾 Búa til drög</button>');
      html += '<div class="omGroup"><div class="omGroupHd">Konto</div>' +
        '<div class="omRow"><span class="k">Drög að greiðslu 1</span><span class="v">' + g1 + '</span></div>' +
        (s.kontoLog ? '<div class="omLog">' + esc(s.kontoLog) + '</div>' : '<div class="omNote">Engin Konto drög enn. Aldrei búin til tvisvar.</div>') +
        (!s.g1Drafted && !s.g1Ready ? '<div class="omNote">G1 hnappurinn virkar þegar „🧾 Búa til G1 drög“ er komið í Airtable.</div>' : "") +
        '</div>';

      // Prenta
      html += '<div class="omGroup"><div class="omGroupHd">Prenta tilboð</div><div class="omPrints">' +
        PRINTS.map(function (p) { return '<button class="omBtn" type="button" data-print="' + p.mode + '">' + p.label + '</button>'; }).join("") +
        '</div>' + fileLinks(s.tilbod) + '</div>';

      html += '<div class="omMsg" id="omMsg"></div>';
      el.innerHTML = html;

      el.querySelectorAll("[data-act]").forEach(function (b) {
        b.addEventListener("click", function () { act(b.dataset.act, s, b); });
      });
      el.querySelectorAll("[data-print]").forEach(function (b) {
        b.addEventListener("click", function () { print(b.dataset.print, s, b); });
      });
    }

    function msg(t, bad) {
      var m = el.querySelector("#omMsg");
      if (m) { m.textContent = t; m.className = "omMsg" + (bad ? " bad" : ""); }
    }

    function send(body, btn, okText, refreshAfter) {
      if (busy) return;
      busy = true;
      el.querySelectorAll("button").forEach(function (x) { x.disabled = true; });
      msg(btn.dataset.print ? "Prenta… (getur tekið smá stund)" : "Vista…");
      return fetch(url(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ recordId: recordId }, body)) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          busy = false;
          if (my !== seq) return;
          if (!res.ok) {
            var e = res.d.error === "G1_NOT_SET_UP" ? "G1 er ekki tengt í Airtable enn." : (res.d.error || "villa");
            return load().then(function () { msg("Tókst ekki: " + e, true); });
          }
          // The Airtable automation does its part a few seconds after the write — reload twice.
          return load().then(function () {
            msg(okText);
            if (refreshAfter) setTimeout(function () { if (my === seq && !busy) load().then(function () { msg(okText); }); }, refreshAfter);
          });
        })
        .catch(function () { busy = false; if (my === seq) load().then(function () { msg("Tókst ekki að tengjast", true); }); });
    }

    function act(action, s, btn) {
      if (action === "g2" || action === "g3") {
        var n = action.slice(1);
        if (!confirm("Merkja greiðslu " + n + " greidda?\n\nDagsetningin skráist sjálfkrafa. Til að afmerkja þarf að fara í Airtable.")) return;
        return send({ action: action }, btn, "✓ Greiðsla " + n + " merkt greidd", 5000);
      }
      if (action === "vidbaetur") {
        if (!confirm("Samþykkja viðbætur upp á " + kr(s.vidbaetur) + "?\n\nÞær leggjast við samþykkta upphæð og línurnar læsast. Þetta er ekki hægt að afturkalla.")) return;
        return send({ action: action, expect: s.vidbaetur }, btn, "✓ Viðbætur samþykktar", 6000);
      }
      if (action === "g1") {
        if (!confirm("Búa til drög að greiðslu 1 í Konto?\n\nDrögin eru aldrei búin til tvisvar. Farðu yfir þau í Konto áður en reikningurinn er sendur.")) return;
        return send({ action: action }, btn, "✓ Beiðni send — drögin birtast hér eftir smá stund", 8000);
      }
    }

    function print(mode, s, btn) {
      if (mode === "vidbot") {
        if (!confirm("Prenta viðbótartilboð upp á " + kr(s.vidbaetur) + "?\n\nBætist við Viðbótartilboð 📄 — eldri haldast.")) return;
        return send({ action: "print", mode: mode }, btn, "✓ Viðbótartilboð prentað");
      }
      if (s.tilbod.length && !confirm("Prenta nýtt tilboð?\n\nÞað kemur í stað þess sem er núna í Tilboð til sendingar.")) return;
      return send({ action: "print", mode: mode }, btn, "✓ Prentað í Tilboð til sendingar");
    }

    load();
  }

  root.OfficeMoney = { mount: mount };
})(window);
