// chat-widget.js
// Phase 2 of the site chatbot (see memory: project_chatbot). Self-contained
// widget script — meant to be injected directly into the Wix page via a
// <script src> Custom Code snippet (Phase 3), NOT iframed like faq.html /
// verkefni.html. Because it runs inside the Wix page's own document, it
// uses a Shadow DOM so the widget's CSS can never leak into the host page
// and the host page's CSS can never leak into the widget.
//
// Backend: api/chat.js (Phase 1) for answers, api/airtable.js's Vefspjall 💬
// table (Phase 0) for logging finished conversations. Both already have
// CORS wired for the real Wix domain — see api/_cors.js.
(function () {
  "use strict";
  if (window.__bjorninnChatWidgetLoaded) return;
  window.__bjorninnChatWidgetLoaded = true;

  // Relative URLs when testing locally against `vercel dev` (widget + API
  // served from the same origin there); the real Wix page needs the
  // absolute Vercel URL since the script executes in the PAGE's document,
  // so a relative fetch would resolve against bjorninninnrettingar.is, not
  // this script's own origin.
  var API_BASE = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? ""
    : "https://bjorninn-quote-generator.vercel.app";
  var VEFSPJALL_PATH = "tbltD1UNpqj05WtMx";
  var CONTACT_URL = "https://www.bjorninninnrettingar.is/hafðu-samband";
  var DISMISS_KEY = "bjorninn-chat-dismissed";
  var GREETING = "Hæ! Ég get svarað spurningum um sérsmíði, verð, ferlið og fleira hjá Birninum. Hvað viltu vita?";
  var GENERIC_ERROR = "Því miður kom upp villa. Endilega reyndu aftur, eða hafðu samband beint.";

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  if (storageGet(DISMISS_KEY) === "1") return;

  // ---- state ----
  // apiMessages mirrors exactly what api/chat.js expects/returns per turn —
  // an assistant turn's content is the literal {"answer","escalate"} JSON
  // string, matching what the model itself produced, since that's what it
  // best recognizes as its own prior turn (confirmed in Phase 1 testing).
  var apiMessages = [];
  // transcript is the human-readable version, only for the Airtable log —
  // Rakel reads Icelandic sentences there, not JSON.
  var transcript = [];
  var hasLoggedThisSession = false; // see logConversation() for the trade-off this implies
  var awaitingReply = false;

  // ---- shadow host ----
  var host = document.createElement("div");
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.zIndex = "2147483000";
  host.style.bottom = "0";
  host.style.right = "0";
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = [
    ":host{all:initial;}",
    "*{box-sizing:border-box;font-family:'Kumbh Sans',Arial,Helvetica,sans-serif;}",
    ".wrap{position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;align-items:flex-end;gap:12px;}",
    ".bubble-holder{position:relative;}",
    ".bubble{width:56px;height:56px;border-radius:50%;background:#3d61c1;border:none;cursor:pointer;",
    "display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,.18);transition:background .15s ease;}",
    ".bubble:hover{background:#2c478e;}",
    ".dismiss-badge{position:absolute;top:-4px;right:-4px;width:20px;height:20px;border-radius:50%;",
    "background:#fff;border:1px solid #e6e3da;color:#6f6d66;font-size:12px;line-height:1;cursor:pointer;",
    "display:flex;align-items:center;justify-content:center;padding:0;}",
    ".dismiss-badge:hover{color:#191919;border-color:#a29c72;}",
    ".panel{width:340px;max-width:calc(100vw - 24px);height:min(520px, calc(100vh - 100px));",
    "background:#fff;border:1px solid #e6e3da;border-radius:12px;box-shadow:0 12px 34px rgba(0,0,0,.2);",
    "display:flex;flex-direction:column;overflow:hidden;}",
    ".hdr{background:#3d61c1;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex:none;}",
    ".hdr h1{font-size:15px;font-weight:600;margin:0;}",
    ".hdr button{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;padding:2px 4px;line-height:1;opacity:.85;}",
    ".hdr button:hover{opacity:1;}",
    ".msgs{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:10px;background:#fff;}",
    ".row{display:flex;}",
    ".row.user{justify-content:flex-end;}",
    ".row.bot{justify-content:flex-start;}",
    ".bub{max-width:84%;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.5;white-space:pre-wrap;}",
    ".row.user .bub{background:#3d61c1;color:#fff;border-bottom-right-radius:3px;}",
    ".row.bot .bub{background:#f5f3ea;color:#403d35;border-bottom-left-radius:3px;}",
    ".links{display:flex;flex-wrap:wrap;gap:6px;max-width:84%;margin:2px 0 0 2px;}",
    ".links a{font-size:12.5px;font-weight:600;color:#3d61c1;background:#fff;border:1px solid #a29c72;",
    "border-radius:14px;padding:5px 11px;text-decoration:none;white-space:nowrap;}",
    ".links a:hover{background:#f5f3ea;}",
    ".typing{display:flex;gap:4px;padding:4px 2px;}",
    ".typing span{width:6px;height:6px;border-radius:50%;background:#a29c72;animation:blink 1.2s infinite ease-in-out;}",
    ".typing span:nth-child(2){animation-delay:.2s;} .typing span:nth-child(3){animation-delay:.4s;}",
    "@keyframes blink{0%,80%,100%{opacity:.25;}40%{opacity:1;}}",
    ".escalate{margin-top:6px;max-width:84%;background:#fff;border:1px solid #e6e3da;border-radius:10px;padding:10px;font-size:13px;color:#6f6d66;}",
    ".escalate p{margin:0 0 8px;}",
    ".escalate .actions{display:flex;flex-direction:column;gap:8px;}",
    ".escalate a.contact{font-weight:600;font-size:13px;color:#fff;background:#3d61c1;padding:8px 12px;",
    "border-radius:6px;text-decoration:none;text-align:center;}",
    ".escalate a.contact:hover{background:#2c478e;}",
    ".escalate .capture{display:flex;gap:6px;}",
    ".escalate input[type=email]{flex:1;min-width:0;font:inherit;font-size:13px;padding:7px 9px;",
    "border:1px solid #e6e3da;border-radius:6px;outline:none;}",
    ".escalate input[type=email]:focus{border-color:#3d61c1;}",
    ".escalate button.send{font:inherit;font-size:13px;font-weight:600;color:#191919;background:#fff;",
    "border:1px solid #a29c72;border-radius:6px;padding:7px 10px;cursor:pointer;white-space:nowrap;}",
    ".escalate button.send:hover{background:#f5f3ea;}",
    ".escalate button.send:disabled{opacity:.5;cursor:default;}",
    ".escalate .done{color:#2c478e;font-weight:500;}",
    ".inputrow{flex:none;display:flex;gap:8px;padding:10px;border-top:1px solid #e6e3da;background:#fff;}",
    ".inputrow input{flex:1;min-width:0;font:inherit;font-size:14px;padding:10px 12px;border:1px solid #e6e3da;",
    "border-radius:8px;outline:none;}",
    ".inputrow input:focus{border-color:#3d61c1;}",
    ".inputrow button{font:inherit;font-size:14px;font-weight:600;color:#fff;background:#3d61c1;border:none;",
    "border-radius:8px;padding:0 16px;cursor:pointer;}",
    ".inputrow button:disabled{opacity:.5;cursor:default;}",
    ".inputrow button:not(:disabled):hover{background:#2c478e;}",
  ].join("\n");
  root.appendChild(style);

  var wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

  var panel = null;
  var msgsEl = null;

  var bubbleHolder = document.createElement("div");
  bubbleHolder.className = "bubble-holder";
  var bubble = document.createElement("button");
  bubble.className = "bubble";
  bubble.setAttribute("aria-label", "Opna spjall");
  bubble.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-4.4 7.4L4 21l2.1-4.6A8.38 8.38 0 0 1 12 3a8.38 8.38 0 0 1 9 8.5Z"/></svg>';
  bubble.addEventListener("click", togglePanel);

  var dismissBadge = document.createElement("button");
  dismissBadge.className = "dismiss-badge";
  dismissBadge.setAttribute("aria-label", "Loka spjallglugga");
  dismissBadge.textContent = "✕";
  dismissBadge.addEventListener("click", function (e) {
    e.stopPropagation();
    storageSet(DISMISS_KEY, "1");
    logConversation(); // best-effort, in case they'd already started chatting
    host.remove();
  });

  bubbleHolder.appendChild(bubble);
  bubbleHolder.appendChild(dismissBadge);
  wrap.appendChild(bubbleHolder);

  function togglePanel() {
    if (panel) {
      closePanel();
      return;
    }
    openPanel();
  }

  function openPanel() {
    panel = document.createElement("div");
    panel.className = "panel";

    var hdr = document.createElement("div");
    hdr.className = "hdr";
    var h1 = document.createElement("h1");
    h1.textContent = "Björninn — spjall";
    var closeBtn = document.createElement("button");
    closeBtn.setAttribute("aria-label", "Loka");
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", closePanel);
    hdr.appendChild(h1);
    hdr.appendChild(closeBtn);

    msgsEl = document.createElement("div");
    msgsEl.className = "msgs";

    var inputRow = document.createElement("div");
    inputRow.className = "inputrow";
    var input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Skrifaðu spurningu...";
    input.setAttribute("aria-label", "Spurning");
    var sendBtn = document.createElement("button");
    sendBtn.textContent = "Senda";
    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);

    panel.appendChild(hdr);
    panel.appendChild(msgsEl);
    panel.appendChild(inputRow);
    wrap.insertBefore(panel, bubbleHolder);

    function send() {
      var text = input.value.trim();
      if (!text || awaitingReply) return;
      input.value = "";
      sendMessage(text);
    }
    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") send();
    });

    if (transcript.length === 0) {
      addBotBubble(GREETING);
    } else {
      renderExisting();
    }
    input.focus();
  }

  function closePanel() {
    if (!panel) return;
    panel.remove();
    panel = null;
    msgsEl = null;
    logConversation();
  }

  function renderExisting() {
    for (var i = 0; i < transcript.length; i++) {
      var t = transcript[i];
      addRow(t.role, t.text);
      if (t.links && t.links.length) addLinkChips(t.links);
      if (t.escalate) addEscalateBlock(t.question);
    }
    scrollToBottom();
  }

  function addRow(role, text) {
    var row = document.createElement("div");
    row.className = "row " + (role === "user" ? "user" : "bot");
    var bub = document.createElement("div");
    bub.className = "bub";
    bub.textContent = text;
    row.appendChild(bub);
    msgsEl.appendChild(row);
    return row;
  }

  function addBotBubble(text) {
    addRow("bot", text);
    scrollToBottom();
  }

  function addLinkChips(links) {
    if (!msgsEl || !links || !links.length) return;
    var row = document.createElement("div");
    row.className = "links";
    for (var i = 0; i < links.length; i++) {
      var a = document.createElement("a");
      a.href = links[i].url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = links[i].label;
      row.appendChild(a);
    }
    msgsEl.appendChild(row);
    scrollToBottom();
  }

  function scrollToBottom() {
    if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function addEscalateBlock(question) {
    var box = document.createElement("div");
    box.className = "escalate";

    var p = document.createElement("p");
    p.textContent = "Vilt þú fá svar frá okkur beint?";
    box.appendChild(p);

    var actions = document.createElement("div");
    actions.className = "actions";

    var contactA = document.createElement("a");
    contactA.className = "contact";
    contactA.href = CONTACT_URL;
    contactA.target = "_blank";
    contactA.rel = "noopener";
    contactA.textContent = "Hafðu samband";
    actions.appendChild(contactA);

    var captureRow = document.createElement("div");
    captureRow.className = "capture";
    var emailInput = document.createElement("input");
    emailInput.type = "email";
    emailInput.placeholder = "netfangið þitt";
    emailInput.setAttribute("aria-label", "Netfang");
    var sendBtn = document.createElement("button");
    sendBtn.className = "send";
    sendBtn.textContent = "Senda";
    captureRow.appendChild(emailInput);
    captureRow.appendChild(sendBtn);
    actions.appendChild(captureRow);

    box.appendChild(actions);
    if (msgsEl) msgsEl.appendChild(box);

    sendBtn.addEventListener("click", function () {
      var email = emailInput.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        emailInput.style.borderColor = "#c0392b";
        emailInput.focus();
        return;
      }
      sendBtn.disabled = true;
      emailInput.disabled = true;
      sendBtn.textContent = "...";
      logConversation(email, question).then(function (ok) {
        actions.innerHTML = "";
        var done = document.createElement("p");
        done.className = "done";
        done.textContent = ok
          ? "Takk! Við sendum þér svar á " + email + "."
          : "Því miður tókst þetta ekki núna — endilega hafðu samband beint.";
        box.appendChild(done);
        scrollToBottom();
      });
    });

    scrollToBottom();
  }

  function sendMessage(text) {
    addRow("user", text);
    transcript.push({ role: "user", text: text });
    apiMessages.push({ role: "user", content: text });
    scrollToBottom();

    var typingRow = document.createElement("div");
    typingRow.className = "row bot";
    var typingBub = document.createElement("div");
    typingBub.className = "bub typing";
    typingBub.innerHTML = "<span></span><span></span><span></span>";
    typingRow.appendChild(typingBub);
    if (msgsEl) msgsEl.appendChild(typingRow);
    scrollToBottom();

    awaitingReply = true;
    fetch(API_BASE + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: apiMessages }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        typingRow.remove();
        var answer = (data && data.answer) || GENERIC_ERROR;
        var escalate = !!(data && data.escalate);
        var links = (data && Array.isArray(data.links)) ? data.links : [];
        apiMessages.push({ role: "assistant", content: JSON.stringify({ answer: answer, escalate: escalate }) });
        transcript.push({ role: "bot", text: answer, escalate: escalate, question: text, links: links });
        addBotBubble(answer);
        if (links.length) addLinkChips(links);
        if (escalate) addEscalateBlock(text);
      })
      .catch(function () {
        typingRow.remove();
        transcript.push({ role: "bot", text: GENERIC_ERROR, escalate: true, question: text });
        addBotBubble(GENERIC_ERROR);
        addEscalateBlock(text);
      })
      .then(function () {
        awaitingReply = false;
      });
  }

  // Logs the conversation once per page load (see hasLoggedThisSession).
  // Trade-off, deliberate for this MVP: if a visitor keeps chatting after
  // the first log fires (e.g. submits an email, then asks more questions),
  // those later messages aren't captured in a second row — Vefspjall only
  // supports create, not update, so avoiding duplicate/fragmented rows per
  // visitor won this trade-off over capturing every last follow-up. Revisit
  // if that turns out to matter once there's real traffic.
  function logConversation(email, escalatedQuestion) {
    if (transcript.length === 0) return Promise.resolve(true);
    if (hasLoggedThisSession && !email) return Promise.resolve(true);
    hasLoggedThisSession = true;

    var lines = transcript.map(function (t) {
      return (t.role === "user" ? "Sp: " : "Sv: ") + t.text;
    });
    var lastEscalated = null;
    for (var i = transcript.length - 1; i >= 0; i--) {
      if (transcript[i].escalate) { lastEscalated = transcript[i].question; break; }
    }

    var fields = {
      "Fyrsta spurning": transcript[0].text,
      "Samtal": lines.join("\n"),
      "Síða": location.pathname || "/",
    };
    if (escalatedQuestion || lastEscalated) fields["Óleyst spurning"] = escalatedQuestion || lastEscalated;
    if (email) fields["Netfang"] = email;

    return fetch(API_BASE + "/api/airtable?path=" + VEFSPJALL_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: fields }),
      keepalive: true,
    })
      .then(function (res) { return res.ok; })
      .catch(function () { return false; });
  }

  window.addEventListener("pagehide", function () {
    if (transcript.length > 0 && !hasLoggedThisSession) logConversation();
  });
})();
