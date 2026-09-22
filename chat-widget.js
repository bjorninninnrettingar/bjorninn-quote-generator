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
    : "https://bjorninn.vercel.app";
  var VEFSPJALL_PATH = "tbltD1UNpqj05WtMx";
  var CONTACT_URL = "https://www.bjorninninnrettingar.is/hafðu-samband";
  var GREETING = "Hæ! Ég get svarað spurningum um sérsmíði, verð, ferlið og fleira hjá Birninum. Hvað viltu vita?";
  var GENERIC_ERROR = "Því miður kom upp villa. Endilega reyndu aftur, eða hafðu samband beint.";

  // Homepage-only, on purpose — a visitor browsing other pages shouldn't
  // have this follow them. This is a code-level guarantee independent of
  // whatever page-scope the Wix Custom Code panel has set, since that's a
  // manually-configured admin setting and easy to get wrong or change by
  // accident later; this check can't drift from it.
  if (location.pathname !== "/") return;

  // A prior version let visitors collapse the bubble to a small
  // up-arrow handle, persisted via localStorage — dropped because that
  // handle ended up almost the same size as the bubble itself, so it
  // didn't actually declutter anything. Clean up that leftover state for
  // anyone who has it set from before.
  try {
    localStorage.removeItem("bjorninn-chat-collapsed");
    localStorage.removeItem("bjorninn-chat-dismissed");
  } catch (e) {}

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
    ".bubble{width:56px;height:56px;border-radius:50%;background:#3d61c1;border:none;cursor:pointer;",
    "display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,.18);transition:background .15s ease;}",
    ".bubble:hover{background:#2c478e;}",
    ".panel{width:340px;max-width:calc(100vw - 24px);height:min(520px, calc(100vh - 100px));",
    "height:min(520px, calc(100dvh - 100px));",
    "background:#fff;border:1px solid #e6e3da;border-radius:12px;box-shadow:0 12px 34px rgba(0,0,0,.2);",
    "display:flex;flex-direction:column;overflow:hidden;}",
    // Mobile: `vh` on a phone is the browser-chrome-hidden height, so a
    // panel sized off it visibly resizes/jumps every time the address bar
    // or the on-screen keyboard shows or hides — confirmed as the reported
    // "moving a lot" symptom. `dvh` tracks the actually-visible viewport
    // instead (falls back to the `vh` line above on older browsers, since
    // an invalid unit just drops that one declaration). Docking the panel
    // to a full-width bottom sheet also removes the side margins that made
    // any shift more noticeable, and a smaller bubble/handle leaves more
    // room so the panel doesn't compete with the keyboard for space.
    "@media (max-width:480px){",
    ".wrap{left:0;right:0;bottom:0;padding:10px;gap:8px;}",
    ".bubble{width:50px;height:50px;}",
    ".bubble svg{width:22px;height:22px;}",
    ".panel{width:100%;max-width:100%;height:60vh;height:60dvh;max-height:60dvh;",
    "border-radius:14px 14px 0 0;box-shadow:0 -8px 28px rgba(0,0,0,.22);}",
    ".hdr{border-radius:14px 14px 0 0;}",
    "}",
    // `.hdr`'s own top corners have to match `.panel`'s rounding exactly —
    // `overflow:hidden` on the panel clips it, but browsers commonly leave a
    // faint white-background seam at the curve from antialiasing when the
    // clipped child's own corners are still square. Reported as a "white
    // frame" around the header.
    ".hdr{background:#3d61c1;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex:none;",
    "border-radius:12px 12px 0 0;}",
    ".hdr h1{font-size:15px;font-weight:600;margin:0;}",
    ".hdr button{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;padding:2px 4px;line-height:1;opacity:.85;}",
    ".hdr button:hover{opacity:1;}",
    ".content{flex:1;min-height:0;overflow:hidden;}",
    ".chat-view{height:100%;min-height:0;display:flex;flex-direction:column;}",
    ".faq-view{height:100%;}",
    ".faq-view iframe{width:100%;height:100%;border:0;display:block;}",
    // Same corner-seam fix as `.hdr`, mirrored at the bottom — `.tabbar` is
    // now the panel's last child, sitting against its rounded bottom
    // corners (desktop only; the mobile bottom-sheet variant has square
    // bottom corners already, so no override needed there).
    ".tabbar{flex:none;display:flex;border-top:1px solid #e6e3da;background:#fff;border-radius:0 0 12px 12px;}",
    ".tabbar button{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;",
    "padding:8px 4px 7px;background:none;border:none;cursor:pointer;color:#9a9890;font:inherit;font-size:11px;font-weight:600;}",
    ".tabbar button.active{color:#3d61c1;}",
    ".tabbar button svg{display:block;}",
    ".msgs{flex:1;min-height:0;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:10px;background:#fff;}",
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
    // font-size must stay >=16px on every real text input in this file —
    // iOS Safari force-zooms the whole page on focus for anything smaller,
    // which is exactly the kind of jarring, jump-around behavior the mobile
    // stability fix was about. Not optional/cosmetic.
    ".escalate input[type=email]{flex:1;min-width:0;font:inherit;font-size:16px;padding:7px 9px;",
    "border:1px solid #e6e3da;border-radius:6px;outline:none;}",
    ".escalate input[type=email]:focus{border-color:#3d61c1;}",
    ".escalate .err-msg{color:#c0392b;font-size:12px;margin:0;}",
    ".escalate button.send{font:inherit;font-size:13px;font-weight:600;color:#191919;background:#fff;",
    "border:1px solid #a29c72;border-radius:6px;padding:7px 10px;cursor:pointer;white-space:nowrap;}",
    ".escalate button.send:hover{background:#f5f3ea;}",
    ".escalate button.send:disabled{opacity:.5;cursor:default;}",
    ".escalate .done{color:#2c478e;font-weight:500;}",
    ".inputrow{flex:none;display:flex;gap:8px;padding:10px;border-top:1px solid #e6e3da;background:#fff;}",
    ".inputrow input{flex:1;min-width:0;font:inherit;font-size:16px;padding:10px 12px;border:1px solid #e6e3da;",
    "border-radius:8px;outline:none;}",
    ".inputrow input:focus{border-color:#3d61c1;}",
    ".inputrow input:disabled{background:#f5f3ea;}",
    ".inputrow button{font:inherit;font-size:14px;font-weight:600;color:#fff;background:#3d61c1;border:none;",
    "border-radius:8px;padding:0 16px;cursor:pointer;}",
    ".inputrow button:disabled{opacity:.5;cursor:default;}",
    ".inputrow button:not(:disabled):hover{background:#2c478e;}",
  ].join("\n");
  root.appendChild(style);

  var wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

  // On a phone, focusing the input opens the on-screen keyboard, which
  // shrinks window.visualViewport without changing window.innerHeight — a
  // position:fixed element stays pinned to the (unchanged) layout
  // viewport, so it ends up sitting behind the keyboard or the page
  // scrolls to compensate, both of which read as the widget "jumping."
  // Track the actually-visible viewport and nudge the widget up by
  // exactly the obscured amount instead. No-op on desktop (nothing
  // shrinks the visual viewport there), and safe if visualViewport isn't
  // supported at all.
  function syncViewportOffset() {
    var vv = window.visualViewport;
    if (!vv) return;
    var obscured = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    wrap.style.bottom = obscured > 0 ? obscured + "px" : "";
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncViewportOffset);
    window.visualViewport.addEventListener("scroll", syncViewportOffset);
  }

  var panel = null;
  var msgsEl = null;

  var bubble = document.createElement("button");
  bubble.className = "bubble";
  bubble.setAttribute("aria-label", "Opna spjall");
  bubble.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-4.4 7.4L4 21l2.1-4.6A8.38 8.38 0 0 1 12 3a8.38 8.38 0 0 1 9 8.5Z"/></svg>';
  bubble.addEventListener("click", togglePanel);
  wrap.appendChild(bubble);

  function togglePanel() {
    if (panel) {
      closePanel();
      return;
    }
    openPanel();
  }

  var CHAT_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-4.4 7.4L4 21l2.1-4.6A8.38 8.38 0 0 1 12 3a8.38 8.38 0 0 1 9 8.5Z"/></svg>';
  // Same question-mark-in-circle icon faq.html itself uses for its "Af
  // hverju sérsmíði?" category — keeps the FAQ tab visually tied to the
  // page it's actually showing.
  var FAQ_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.7"/><path d="M12 17h.01"/></svg>';

  function openPanel() {
    panel = document.createElement("div");
    panel.className = "panel";

    var hdr = document.createElement("div");
    hdr.className = "hdr";
    var h1 = document.createElement("h1");
    h1.textContent = "BJÖRNINN";
    var closeBtn = document.createElement("button");
    closeBtn.setAttribute("aria-label", "Loka");
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", closePanel);
    hdr.appendChild(h1);
    hdr.appendChild(closeBtn);

    var content = document.createElement("div");
    content.className = "content";

    var chatView = document.createElement("div");
    chatView.className = "chat-view";

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
    chatView.appendChild(msgsEl);
    chatView.appendChild(inputRow);

    // The FAQ tab reuses faq.html itself (already live at /adstod, already
    // the single source of truth for this content) via iframe, rather than
    // re-implementing its search/category/accordion UI a second time here.
    // Lazy-loaded: no src until the tab is actually opened, so visitors who
    // never touch it don't cost an extra request.
    var faqView = document.createElement("div");
    faqView.className = "faq-view";
    var faqIframe = document.createElement("iframe");
    faqIframe.title = "Algengar spurningar";
    faqView.appendChild(faqIframe);
    faqView.style.display = "none";

    content.appendChild(chatView);
    content.appendChild(faqView);

    var tabbar = document.createElement("div");
    tabbar.className = "tabbar";
    var chatTabBtn = document.createElement("button");
    chatTabBtn.className = "active";
    chatTabBtn.innerHTML = CHAT_ICON + "<span>Spjall</span>";
    var faqTabBtn = document.createElement("button");
    faqTabBtn.innerHTML = FAQ_ICON + "<span>Algengar spurningar</span>";
    tabbar.appendChild(chatTabBtn);
    tabbar.appendChild(faqTabBtn);

    function switchTab(tab) {
      var isChat = tab === "chat";
      chatView.style.display = isChat ? "flex" : "none";
      faqView.style.display = isChat ? "none" : "block";
      chatTabBtn.classList.toggle("active", isChat);
      faqTabBtn.classList.toggle("active", !isChat);
      if (!isChat && !faqIframe.src) faqIframe.src = API_BASE + "/adstod";
    }
    chatTabBtn.addEventListener("click", function () { switchTab("chat"); });
    faqTabBtn.addEventListener("click", function () { switchTab("faq"); });

    panel.appendChild(hdr);
    panel.appendChild(content);
    panel.appendChild(tabbar);
    wrap.insertBefore(panel, bubble);

    function send() {
      var text = input.value.trim();
      if (!text || awaitingReply) return;
      input.value = "";
      sendMessage(text, input, sendBtn);
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
    // Skip on the same narrow-viewport breakpoint the mobile bottom sheet
    // uses — auto-focusing there pops the on-screen keyboard the instant
    // the panel opens, eating half the screen before the visitor has even
    // read the greeting. Desktop has no keyboard-popping cost, so focus
    // there as normal.
    if (!window.matchMedia("(max-width:480px)").matches) input.focus();

    document.addEventListener("keydown", onEscape);
  }

  function onEscape(e) {
    if (e.key === "Escape") closePanel();
  }

  function closePanel() {
    if (!panel) return;
    panel.remove();
    panel = null;
    msgsEl = null;
    document.removeEventListener("keydown", onEscape);
    logConversation();
  }

  function renderExisting() {
    for (var i = 0; i < transcript.length; i++) {
      var t = transcript[i];
      addRow(t.role, t.text);
      if (t.links && t.links.length) addLinkChips(t.links);
      if (t.escalate) addEscalateBlock(t);
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

  // Takes the transcript entry itself (not just its question text) so a
  // successful email submission can be recorded directly on it
  // (entry.resolvedEmail) — renderExisting() replays this same entry every
  // time the panel is reopened, and without that flag it would show a
  // blank, un-submitted form again even after the visitor already sent
  // their email, risking a confused duplicate submission.
  function addEscalateBlock(entry) {
    var box = document.createElement("div");
    box.className = "escalate";

    var p = document.createElement("p");
    p.textContent = "Vilt þú fá svar frá okkur beint?";
    box.appendChild(p);

    var actions = document.createElement("div");
    actions.className = "actions";
    box.appendChild(actions);
    if (msgsEl) msgsEl.appendChild(box);

    function renderDone(email) {
      actions.innerHTML = "";
      var done = document.createElement("p");
      done.className = "done";
      done.textContent = "Takk! Við sendum þér svar á " + email + ".";
      box.appendChild(done);
    }

    if (entry.resolvedEmail) {
      renderDone(entry.resolvedEmail);
      scrollToBottom();
      return;
    }

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

    function submit() {
      var email = emailInput.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        emailInput.style.borderColor = "#c0392b";
        emailInput.focus();
        return;
      }
      var err = box.querySelector(".err-msg");
      if (err) err.remove();
      sendBtn.disabled = true;
      emailInput.disabled = true;
      sendBtn.textContent = "...";
      logConversation(email, entry.question).then(function (ok) {
        if (ok) {
          entry.resolvedEmail = email;
          renderDone(email);
        } else {
          // Keep the form usable on failure (a network blip shouldn't be a
          // dead end) — re-enable and let them retry instead of just
          // showing an error with no way forward from inside the chat.
          sendBtn.disabled = false;
          emailInput.disabled = false;
          sendBtn.textContent = "Senda";
          var errMsg = document.createElement("p");
          errMsg.className = "err-msg";
          errMsg.textContent = "Náði ekki að senda — reyndu aftur.";
          actions.insertBefore(errMsg, captureRow);
        }
        scrollToBottom();
      });
    }
    sendBtn.addEventListener("click", submit);
    emailInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") submit();
    });

    scrollToBottom();
  }

  function sendMessage(text, input, sendBtn) {
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

    // Visible "in flight" state — without this the input/button stay fully
    // interactive while awaitingReply silently no-ops a second send, which
    // just looks broken rather than "still working on it."
    awaitingReply = true;
    input.disabled = true;
    sendBtn.disabled = true;
    fetch(API_BASE + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: apiMessages }),
    })
      // fetch() only rejects on a real network failure — a 4xx/5xx HTTP
      // response (hitting the message cap, a backend/Anthropic outage,
      // ...) still resolves here with no "answer"/"escalate" fields.
      // Left unchecked, that fell through to the generic-error text with
      // escalate defaulting to false — a dead end with no way to reach a
      // human, unlike a real network failure below. Throwing routes both
      // cases through the same .catch(), which does escalate.
      .then(function (res) {
        if (!res.ok) throw new Error("chat API error " + res.status);
        return res.json();
      })
      .then(function (data) {
        typingRow.remove();
        var answer = (data && data.answer) || GENERIC_ERROR;
        var escalate = !!(data && data.escalate);
        var links = (data && Array.isArray(data.links)) ? data.links : [];
        apiMessages.push({ role: "assistant", content: JSON.stringify({ answer: answer, escalate: escalate }) });
        var entry = { role: "bot", text: answer, escalate: escalate, question: text, links: links };
        transcript.push(entry);
        addBotBubble(answer);
        if (links.length) addLinkChips(links);
        if (escalate) addEscalateBlock(entry);
      })
      .catch(function () {
        typingRow.remove();
        var entry = { role: "bot", text: GENERIC_ERROR, escalate: true, question: text };
        transcript.push(entry);
        addBotBubble(GENERIC_ERROR);
        addEscalateBlock(entry);
      })
      .then(function () {
        awaitingReply = false;
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
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
