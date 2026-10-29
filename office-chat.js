// office-chat.js — right-hand drawer for the read-only office helper (api/skrifstofa-chat.js, docs/skrifstofa-chat.md).
// Loaded on demand by office-shell.js when the sidebar "Spyrja" button is pressed. window.OfficeChat.open(k).
// Conversation lives in memory + sessionStorage only; nothing is stored server side. Links come from the server as
// {label,url} with same-origin paths only (re-checked here).
(function (root) {
  "use strict";
  var KEY = "bjorninn:skrifstofa:chat";
  var K_STORE = "bjorninn:skrifstofa:k";
  var msgs = [];
  var busy = false;
  var drawer, list, input, sendBtn, bg;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function getK() { try { return localStorage.getItem(K_STORE) || ""; } catch (e) { return ""; } }
  function load() { try { msgs = JSON.parse(sessionStorage.getItem(KEY) || "[]") || []; } catch (e) { msgs = []; } }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-30))); } catch (e) {} }
  function safeUrl(u) { return typeof u === "string" && /^\/[a-z0-9\-_\/]*(\?[A-Za-z0-9=&_\-]*)?$/i.test(u) && u.indexOf("//") !== 0; }

  function style() {
    if (document.getElementById("ocStyle")) return;
    var el = document.createElement("style");
    el.id = "ocStyle";
    el.textContent =
      ".ocBtn svg{flex:none}" +
      "#ocDrawer{position:fixed;top:0;right:0;bottom:0;width:min(400px,100vw);z-index:300;display:none;flex-direction:column;background:#fff;color:#1a1d21;border-left:1px solid #e1e4e8;box-shadow:-8px 0 30px rgba(10,14,20,.12);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}" +
      "#ocDrawer.open{display:flex;}" +
      "#ocDrawer header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 14px;}" +
      "#ocDrawer h2{margin:0;font-size:1rem;font-weight:700;}" +
      "#ocDrawer .ocX{all:unset;cursor:pointer;color:#5d6670;font-size:1.3rem;line-height:1;padding:2px 6px;border-radius:6px;}" +
      "#ocDrawer .ocX:hover{background:#eef1f5;}" +
      "#ocList{flex:1;overflow:auto;padding:4px 20px 12px;display:flex;flex-direction:column;gap:14px;}" +
      ".ocMsg{font-size:.9rem;line-height:1.5;white-space:pre-wrap;}" +
      ".ocMsg.u{align-self:flex-end;background:#eef1f5;padding:8px 12px;border-radius:12px;max-width:85%;}" +
      ".ocMsg.a{color:#1a1d21;}" +
      ".ocMsg.hint{color:#9aa3ad;}" +
      ".ocLinks{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}" +
      ".ocLinks a{font-size:.8rem;text-decoration:none;color:#0f6cbd;border:1px solid #d3dde9;padding:5px 11px;border-radius:999px;}" +
      ".ocLinks a:hover{background:#f2f7fc;}" +
      "#ocForm{display:flex;gap:8px;padding:12px 20px 18px;border-top:1px solid #eef1f5;}" +
      "#ocInput{flex:1;font:inherit;font-size:.9rem;padding:9px 12px;border:1px solid #e1e4e8;border-radius:10px;background:transparent;color:inherit;outline:none;}" +
      "#ocInput:focus{border-color:#0f6cbd;}" +
      "#ocSend{all:unset;cursor:pointer;background:#0f6cbd;color:#fff;font-size:.85rem;font-weight:600;padding:9px 14px;border-radius:10px;}" +
      "#ocSend[disabled]{opacity:.5;cursor:default;}" +
      "html[data-theme='dark'] #ocDrawer{background:#1b2029;color:#e7eaf0;border-color:#2a3140;}" +
      "html[data-theme='dark'] #ocDrawer .ocX:hover,html[data-theme='dark'] .ocMsg.u{background:#2a3140;}" +
      "html[data-theme='dark'] .ocMsg.a{color:#e7eaf0;}" +
      "html[data-theme='dark'] .ocLinks a{color:#3b9eff;border-color:#2f3a4d;}" +
      "html[data-theme='dark'] .ocLinks a:hover{background:#232a37;}" +
      "html[data-theme='dark'] #ocForm{border-color:#2a3140;}" +
      "html[data-theme='dark'] #ocInput{border-color:#2a3140;}" +
      "html[data-theme='dark'] #ocSend{background:#3b9eff;color:#0b1016;}";
    document.head.appendChild(el);
  }

  function build() {
    if (drawer) return;
    style();
    drawer = document.createElement("aside");
    drawer.id = "ocDrawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-label", "Spyrja");
    drawer.innerHTML =
      '<header><h2>Spyrja</h2><button class="ocX" type="button" aria-label="Loka">&times;</button></header>' +
      '<div id="ocList"></div>' +
      '<form id="ocForm"><input id="ocInput" type="text" maxlength="500" autocomplete="off" placeholder="Hvar er T-32? Hvar finn ég pöntunarlistann?" /><button id="ocSend" type="submit">Senda</button></form>';
    document.body.appendChild(drawer);
    list = drawer.querySelector("#ocList");
    input = drawer.querySelector("#ocInput");
    sendBtn = drawer.querySelector("#ocSend");
    drawer.querySelector(".ocX").addEventListener("click", close);
    drawer.querySelector("#ocForm").addEventListener("submit", function (e) { e.preventDefault(); send(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && drawer.classList.contains("open")) close(); });
  }

  function render() {
    var html = "";
    if (!msgs.length) html += '<div class="ocMsg hint">Ég get bent á síður og flett upp verkefnum. Ég breyti engu.</div>';
    msgs.forEach(function (m) {
      if (m.role === "user") { html += '<div class="ocMsg u">' + esc(m.content) + "</div>"; return; }
      html += '<div class="ocMsg a">' + esc(m.content);
      var links = (m.links || []).filter(function (l) { return l && safeUrl(l.url); });
      if (links.length) html += '<div class="ocLinks">' + links.map(function (l) { return '<a href="' + esc(l.url) + '">' + esc(l.label) + "</a>"; }).join("") + "</div>";
      html += "</div>";
    });
    if (busy) html += '<div class="ocMsg hint">Leita…</div>';
    list.innerHTML = html;
    list.scrollTop = list.scrollHeight;
    sendBtn.disabled = busy;
  }

  function send() {
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    msgs.push({ role: "user", content: text });
    busy = true; save(); render();
    var payload = msgs.slice(-12).map(function (m) { return { role: m.role, content: m.content }; });
    fetch("/api/skrifstofa-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ k: getK(), messages: payload }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        var ans = x.d && x.d.answer;
        if (!ans) ans = x.ok ? "Því miður gat ég ekki svarað þessu núna." : "Ekki tókst að ná í aðstoðarmanninn (skráðu þig inn aftur ef þetta heldur áfram).";
        msgs.push({ role: "assistant", content: ans, links: (x.d && x.d.links) || [] });
      })
      .catch(function () { msgs.push({ role: "assistant", content: "Samband tókst ekki. Reyndu aftur." }); })
      .then(function () { busy = false; save(); render(); input.focus(); });
  }

  function open() { build(); load(); render(); drawer.classList.add("open"); input.focus(); }
  function close() { if (drawer) drawer.classList.remove("open"); }
  function toggle() { build(); if (drawer.classList.contains("open")) close(); else open(); }

  root.OfficeChat = { open: open, close: close, toggle: toggle };
})(window);
