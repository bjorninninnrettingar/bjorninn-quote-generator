/* bjorninn-icons.js — one shared line-icon set for the floor + office pages (2026-10-30).
   Same look as Studio's icon(): 24px viewBox, 1.5px stroke, round caps/joins, currentColor.
   Plain script, no dependencies.

   BJICON(name, size)        -> '<svg class="bji" …>' string (size in px, default 1em)
   BJICON.el(name, size)     -> the same as a DOM element
   BJICON.strip(text)        -> text without emoji/pictographs/variation selectors (DISPLAY ONLY — never
                                use the result as a key, filter or value sent to Airtable)
   BJICON.iconify(escaped)   -> HTML-escaped text where mapped emoji become icons and the rest are stripped
   BJICON.hydrate(root)      -> fills every <i data-ic="name"></i> under root (also runs automatically,
                                including for elements added later by innerHTML templates)
   BJICON.EMOJI              -> emoji -> icon name map (used by the one-off page conversion and by iconify)
   Markup in pages:  <i data-ic="saw"></i>   (sized 1em, so it takes the emoji's font-size) */
(function () {
  "use strict";
  var P = {
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5"/><path d="M12 17.2h.01"/>',
    ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
    saw: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4l1.6 2.6M20 12l-2.6 1.6M12 20l-1.6-2.6M4 12l2.6-1.6M17.7 6.3l-.4 3M17.7 17.7l-3-.4M6.3 17.7l.4-3M6.3 6.3l3 .4"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="1.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.6-3.7 3.4-5.8 7-5.8s6.4 2.1 7 5.8"/>',
    users: '<circle cx="9" cy="9" r="3.2"/><path d="M3 19.5c.5-3.2 2.8-5 6-5s5.5 1.8 6 5M16 6.2a3 3 0 0 1 0 5.6M18 14.8c1.7.5 2.8 2 3 4.7"/>',
    message: '<path d="M4 5.5h16V16H9.5L5.5 19.5V16H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.4M12 18.1v2.4M3.5 12h2.4M18.1 12h2.4M6 6l1.7 1.7M16.3 16.3L18 18M18 6l-1.7 1.7M7.7 16.3L6 18"/><circle cx="12" cy="12" r="6.2"/>',
    machine: '<rect x="3.5" y="9" width="17" height="9" rx="1"/><path d="M7 9V5.5h5V9M16 13.5h2.5M6.5 18v2.5M17.5 18v2.5"/>',
    book: '<path d="M5 4.5h10.5A2.5 2.5 0 0 1 18 7v13H7.5A2.5 2.5 0 0 1 5 17.5z"/><path d="M5 17.5A2.5 2.5 0 0 1 7.5 15H18M9 8.5h5"/>',
    hammer: '<path d="M13 6.5l4.5 4.5M10.5 9l5-5 5 5-3 3-2-2L9 20.5 3.5 15l8-5.5"/>',
    wrench: '<path d="M14.5 5a4.5 4.5 0 0 0-4.2 6.1L4 17.4 6.6 20l6.3-6.3A4.5 4.5 0 0 0 19 9.5l-2.7 2.7-2.5-.5-.5-2.5L16 6.5A4.5 4.5 0 0 0 14.5 5z"/>',
    screwdriver: '<path d="M4 20l5.5-5.5M8 12.5l3.5 3.5M11.5 9l4-4 3.5 3.5-4 4zM13.5 7l3.5 3.5"/>',
    router: '<path d="M9 3.5h6v5.5H9zM12 9v7M10 16h4l-2 4.5z"/>',
    tag: '<path d="M4 4.5h8l8 8-7.5 7.5-8.5-8.5z"/><circle cx="8.5" cy="9" r="1.2"/>',
    layers: '<path d="M12 3.5l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5M3 16.5l9 5 9-5"/>',
    scan: '<path d="M4 8.5V5a1 1 0 0 1 1-1h3.5M15.5 4H19a1 1 0 0 1 1 1v3.5M20 15.5V19a1 1 0 0 1-1 1h-3.5M8.5 20H5a1 1 0 0 1-1-1v-3.5M4 12h16"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.4l2.8 2.8L16.2 9.6"/>',
    tick: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.3 2"/>',
    hourglass: '<path d="M7 3.5h10M7 20.5h10M8 3.5c0 4 4 5 4 8.5s-4 4.5-4 8.5M16 3.5c0 4-4 5-4 8.5s4 4.5 4 8.5"/>',
    bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5L19 18H5z"/><path d="M10 20.5h4"/>',
    truck: '<path d="M2.5 6.5h11v10h-11zM13.5 10h4.2l3.3 3.3v3.2h-7.5"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    pencil: '<path d="M4 20l1-4.5L16.5 4a2 2 0 0 1 3 3L8 18.5z"/><path d="M14.5 6l3.5 3.5"/>',
    file: '<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5M9 12.5h7M9 16h7"/>',
    clipboard: '<rect x="5" y="4.5" width="14" height="16" rx="1.5"/><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 13.5h7M8.5 17h4"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="M4 7l8 6 8-6"/>',
    send: '<path d="M20.5 3.5L3.5 10.5l6.5 3 3 6.5z"/><path d="M10 13.5l5.5-5.5"/>',
    phone: '<path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>',
    grip: '<circle cx="9" cy="7" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="17" r="1"/><circle cx="15" cy="17" r="1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    chevL: '<path d="M14.5 6l-6 6 6 6"/>',
    chevR: '<path d="M9.5 6l6 6-6 6"/>',
    chevU: '<path d="M6 14.5l6-6 6 6"/>',
    chevD: '<path d="M6 9.5l6 6 6-6"/>',
    arrowL: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowUR: '<path d="M7 17L17 7M9 7h8v8"/>',
    arrowUD: '<path d="M8 4v16M4.5 7.5L8 4l3.5 3.5M16 20V4M12.5 16.5L16 20l3.5-3.5"/>',
    arrowLR: '<path d="M4 8h16M16.5 4.5L20 8l-3.5 3.5M20 16H4M7.5 12.5L4 16l3.5 3.5"/>',
    undo: '<path d="M9 8H15a4.5 4.5 0 0 1 0 9H8M9 4.5L5.5 8 9 11.5"/>',
    play: '<path d="M8 5.5l11 6.5-11 6.5z"/>',
    stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="1"/>',
    lock: '<rect x="6" y="11" width="12" height="9" rx="1.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
    unlock: '<rect x="6" y="11" width="12" height="9" rx="1.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 6.9-.9"/>',
    key: '<circle cx="8" cy="15.5" r="3.5"/><path d="M10.5 13l8-8M15.5 8l2.5 2.5M13.5 10l2 2"/>',
    printer: '<path d="M7 9V3.5h10V9M7 17H4.5v-8h15v8H17"/><rect x="7" y="14" width="10" height="6.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8M12 16.8h.01"/>',
    bulb: '<path d="M9 17.5h6M10 20.5h4M12 3.5a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3.5z"/>',
    trash: '<path d="M5 7h14M10 7V5h4v2M7 7l.9 12.2h8.2L17 7M10.5 10.5v6M13.5 10.5v6"/>',
    refresh: '<path d="M18.5 12a6.5 6.5 0 1 1-1.9-4.6"/><path d="M17 3.8v3.9h-3.9"/>',
    trophy: '<path d="M8 4.5h8v5a4 4 0 0 1-8 0zM8 6.5H4.5c0 3 1.5 4.5 3.7 4.8M16 6.5h3.5c0 3-1.5 4.5-3.7 4.8M12 13.5v4M8.5 20.5h7M9.5 17.5h5"/>',
    medal: '<circle cx="12" cy="14.5" r="5"/><path d="M8.5 10.5L6 3.5h4l2 4 2-4h4l-2.5 7"/>',
    pin: '<path d="M9 3.5h6l-1 5.5 3 3.5H7L10 9z"/><path d="M12 12.5v8"/>',
    image: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>',
    camera: '<path d="M4 8.5h3l1.8-2.5h6.4L17 8.5h3V19H4z"/><circle cx="12" cy="13.5" r="3.4"/>',
    door: '<path d="M6.5 20.5V3.5h11v17M4 20.5h16"/><circle cx="14.6" cy="12" r=".7"/>',
    ruler: '<path d="M4 17.5L17.5 4 20 6.5 6.5 20zM8 13l2 2M11 10l1.5 1.5M14 7l2 2"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.5-.9-1.5-1.4-2.8-1.4-1.6 0-2.7.8-2.7 2s1 1.7 2.7 2.2 2.7 1 2.7 2.2-1.2 2-2.7 2c-1.3 0-2.4-.5-2.9-1.5M12 6v1.8M12 16.2V18"/>',
    fire: '<path d="M12 3.5c.5 3.2 5.5 5.2 5.5 10.2a5.5 5.5 0 0 1-11 0c0-2.2 1-3.6 2.2-4.7.2 1.3.7 2.1 1.5 2.6C10.2 8.4 10.8 5.8 12 3.5z"/>',
    sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
    moon: '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>',
    umbrella: '<path d="M3.5 12a8.5 8.5 0 0 1 17 0zM12 12v6.5a1.8 1.8 0 0 1-3.6 0"/>',
    thermo: '<path d="M10 14.2V5.5a2 2 0 0 1 4 0v8.7a3.5 3.5 0 1 1-4 0z"/><path d="M12 9v6.5"/>',
    sparkle: '<path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8zM18.5 3.5v3M17 5h3"/>',
    flask: '<path d="M9.5 3.5h5M10.5 3.5v6L5 19a1.5 1.5 0 0 0 1.3 2.2h11.4A1.5 1.5 0 0 0 19 19l-5.5-9.5v-6M8 15h8"/>',
    cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    board: '<rect x="3.5" y="8" width="17" height="8" rx="1"/><path d="M7 11.5h4"/>',
    square: '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
    target: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
    handshake: '<path d="M3 11l4-3.5 4 1.5 3-1.5 4 2 3 1.5v3.5l-5.5 4-2-1.5-2 1.5-5-3.5z"/>',
    home: '<path d="M4 11l8-6.5 8 6.5v9.5H4z"/><path d="M10 20.5V15h4v5.5"/>',
    building: '<rect x="5" y="3.5" width="14" height="17" rx="1"/><path d="M9 7.5h2M13 7.5h2M9 11.5h2M13 11.5h2M10 20.5v-4h4v4"/>',
    factory: '<path d="M3.5 20.5v-9l5 3v-3l5 3v-3l5 3V20.5zM6 17h2M11 17h2M16 17h2M15.5 12.5V5h3v8.5"/>',
    folder: '<path d="M3.5 6.5h6l2 2.5h9v10h-17z"/>',
    chart: '<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>',
    scissors: '<circle cx="6.5" cy="7" r="2.5"/><circle cx="6.5" cy="17" r="2.5"/><path d="M8.5 8.5L20 18M8.5 15.5L20 6"/>',
    robot: '<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 8V4.5M9 13h.01M15 13h.01M9.5 16.2h5M3.5 12.5v3M20.5 12.5v3"/>',
    rocket: '<path d="M14.5 4.5c3 0 5 2 5 5-1.5 4.5-4.5 7-7.5 8l-3-3c1-3 3.5-6 5.5-10zM9 15l-4.5 4.5M6.5 12L4 12.5 6 9.5l3-.5M12 18l-.5 2.5 3-2 .5-3"/>',
    video: '<rect x="3.5" y="6.5" width="12" height="11" rx="1.5"/><path d="M15.5 10.5l5-3v9l-5-3"/>',
    brain: '<path d="M9.5 4a3 3 0 0 0-3 3 3 3 0 0 0-2 4.5A3.2 3.2 0 0 0 7 16.8a3 3 0 0 0 5 1.7V5.7A3 3 0 0 0 9.5 4zM14.5 4a3 3 0 0 1 3 3 3 3 0 0 1 2 4.5 3.2 3.2 0 0 1-2.5 5.3 3 3 0 0 1-5 1.7"/>',
    dot: '<circle cx="12" cy="12" r="6" fill="currentColor"/>',
    ring: '<circle cx="12" cy="12" r="6"/>',
    menu: '<path d="M4.5 7h15M4.5 12h15M4.5 17h15"/>',
    wifiOff: '<path d="M3.5 3.5l17 17M8.5 15.5a5 5 0 0 1 5.5-1.2M5 11.5a10 10 0 0 1 3.5-2M12 19.5h.01M12 8.5a10 10 0 0 1 7 3M16.5 12.5a5 5 0 0 1 1.6 1.2"/>',
    tv: '<rect x="3.5" y="5" width="17" height="11.5" rx="1.5"/><path d="M9 20h6M12 16.5V20"/>',
    rubble: '<path d="M4.5 19.5l4-7 3 4 3-6 5 9z"/>'
  };

  // emoji -> icon name. null means "no icon, just drop it" (decorative, animal avatars, names inside data).
  var E = {
    "⚠": "alert", "❗": "alert", "❓": "help", "❔": "help", "⛔": "ban", "🚫": "ban",
    "🪚": "saw", "🔬": "search", "🔍": "search",
    "📅": "calendar", "🗓": "calendar", "📆": "calendar",
    "👤": "user", "👷": "user", "🧑‍💼": "user", "🧑‍💻": "user",
    "👨": "user", "👴": "user", "👥": "users",
    "💬": "message", "⚙": "gear", "🏭": "factory", "📒": "book", "📖": "book",
    "🔨": "hammer", "🛠": "hammer", "🔧": "wrench", "🪛": "screwdriver",
    "🏷": "tag", "🗂": "layers", "✅": "check", "✔": "tick", "✓": "tick",
    "⏱": "clock", "⏰": "clock", "🕘": "clock", "⏳": "hourglass", "🔔": "bell",
    "🚚": "truck", "📦": "box", "✏": "pencil", "🖊": "pencil", "✍": "pencil", "📝": "pencil", "🗒": "pencil",
    "📄": "file", "🧾": "file", "📋": "clipboard", "📧": "mail", "✉": "mail", "📤": "send",
    "☎": "phone", "📞": "phone", "↕": "arrowUD", "↔": "arrowLR", "➕": "plus", "❌": "close",
    "⬅": "arrowL", "➡": "arrowR", "↗": "arrowUR", "▶": "play", "◀": "chevL", "⏹": "stop",
    "↩": "undo", "🔒": "lock", "🔓": "unlock", "🔑": "key", "🖨": "printer",
    "ℹ": "info", "💡": "bulb", "🗑": "trash", "🔄": "refresh",
    "🏆": "trophy", "🥇": "medal", "🥈": "medal", "🥉": "medal",
    "📌": "pin", "🖼": "image", "📸": "camera", "🚪": "door", "📐": "ruler",
    "💰": "coin", "💸": "coin", "💲": "coin", "🔥": "fire",
    "☀": "sun", "🌙": "moon", "🌴": "umbrella", "🤒": "thermo",
    "✨": "sparkle", "🎉": "sparkle", "🧪": "flask", "🧊": "cube", "🧩": "cube",
    "🪵": "board", "🔲": "square", "⬛": "square", "⬜": "square", "🎯": "target",
    "🤝": "handshake", "🏠": "home", "🏡": "home", "🏢": "building", "🏨": "building", "🏛": "building", "🏗": "building",
    "📁": "folder", "📊": "chart", "📈": "chart", "🔗": "link",
    "✂": "scissors", "🤖": "robot", "🚀": "rocket", "🎬": "video", "🧠": "brain",
    "🔴": "dot", "🟡": "dot", "🟢": "dot", "⚫": "dot", "⚪": "ring",
    "📣": "bell", "📲": "phone", "📺": "tv", "👨🏻": "user", "🧑🏻": "user", "🆕": "sparkle", "🔢": null, "🦓": null,
    "♾": null, "👉": "arrowR", "👈": "arrowL", "✋": null, "✊": null,
    "🧨": null, "🏃": null, "🦙": null, "🧦": null, "🛟": null, "🦾": null,
    "🍽": null, "😠": null, "🥀": null, "🤓": null, "🐻": null, "🐰": null,
    "🦆": null, "🐕": null, "🦇": null, "🦊": null, "🦁": null
  };

  // Strip regex: pictographs (incl. ZWJ sequences, skin tones), variation selectors, keycap marks. Leaves arrows
  // ← → ↑ ↓, ×, ·, –, — and ordinary punctuation alone.
  var STRIP = /(?:[↔-↙↩↪▶◀]️|[‼⁉ℹ⌚⌛⌨⏏⏩-⏳⏸-⏺Ⓜ▪▫◻-◾☀-➿⤴⤵⬅-⬇⬛⬜⭐⭕〰〽㊗㊙]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF])[︎️]?(?:‍(?:[☀-➿⬅-⬇♀♂]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF])[︎️]?)*|[︎️‍⃣]|\uD83C[\uDFFB-\uDFFF]/g;
  // ✓ (U+2713) is plain text in most fonts but we treat it as a UI icon too.

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  function BJICON(name, size) {
    var d = P[name];
    if (d === undefined) return "";
    var s = size ? ' width="' + size + '" height="' + size + '"' : "";
    return '<svg class="bji" viewBox="0 0 24 24"' + s + ' fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + d + "</svg>";
  }
  BJICON.paths = P;
  BJICON.EMOJI = E;
  BJICON.names = function () { return Object.keys(P); };
  BJICON.el = function (name, size) {
    var t = document.createElement("span");
    t.innerHTML = BJICON(name, size);
    return t.firstChild;
  };

  // Text for DISPLAY only: drops emoji and tidies the whitespace they leave behind.
  BJICON.strip = function (text) {
    if (text == null) return "";
    return String(text).replace(STRIP, "").replace(/[ \t]{2,}/g, " ").replace(/[ \t]+([)\]])/g, "$1").replace(/^[ \t]+|[ \t]+$/g, "");
  };
  BJICON.hasEmoji = function (text) { STRIP.lastIndex = 0; var r = STRIP.test(String(text == null ? "" : text)); STRIP.lastIndex = 0; return r; };

  // Already-escaped HTML text -> mapped emoji become <i data-ic>, unmapped ones vanish.
  BJICON.iconify = function (html) {
    if (html == null) return "";
    return String(html).replace(STRIP, function (m) {
      var base = m.replace(/[︎️]/g, "");
      var hit = E[base];
      if (hit === undefined) hit = E[base.split("‍")[0]];
      return hit ? '<i data-ic="' + hit + '"></i>' : "";
    });
  };

  var ST = "i[data-ic]{display:inline-block;width:1em;height:1em;vertical-align:-.14em;font-style:normal;line-height:0;flex:none}" +
    "i[data-ic] svg,svg.bji{display:block;width:1em;height:1em}i[data-ic] svg{width:100%;height:100%}" +
    "svg.bji[width]{width:auto;height:auto}";
  function css() {
    if (document.getElementById("bji-style")) return;
    var s = document.createElement("style"); s.id = "bji-style"; s.textContent = ST;
    (document.head || document.documentElement).appendChild(s);
  }

  function fill(el) {
    var n = el.getAttribute("data-ic");
    if (!n || el.firstChild) return;
    var sz = el.getAttribute("data-size");
    el.innerHTML = BJICON(n, sz || null);
    if (!el.hasAttribute("role")) el.setAttribute("aria-hidden", "true");
  }
  BJICON.hydrate = function (root) {
    root = root || document;
    if (root.nodeType === 1 && root.matches && root.matches("i[data-ic]")) fill(root);
    if (root.querySelectorAll) { var l = root.querySelectorAll("i[data-ic]:empty"); for (var i = 0; i < l.length; i++) fill(l[i]); }
  };

  function start() {
    css();
    BJICON.hydrate(document);
    if (typeof MutationObserver === "undefined") return;
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var a = muts[i].addedNodes;
        for (var j = 0; j < a.length; j++) if (a[j].nodeType === 1) BJICON.hydrate(a[j]);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  // Render-time safety net for pages that show lots of Airtable text (stage / status / owner / category names
  // with emoji in them). Strips emoji from the DISPLAYED text nodes and title/placeholder/aria-label/alt
  // attributes only — JS strings, option values, input values and data-* attributes are never touched, so
  // comparisons and writes keep the exact Airtable strings.
  var ATTRS = ["title", "placeholder", "aria-label", "alt", "label"];
  function clean(s) { return s.replace(STRIP, "").replace(/ {2,}/g, " "); }
  function autoNode(n) {
    if (n.nodeType === 3) {
      var p = n.parentNode, tg = p && p.nodeName;
      if (tg === "SCRIPT" || tg === "STYLE" || tg === "TEXTAREA") return;
      STRIP.lastIndex = 0;
      if (STRIP.test(n.nodeValue)) { STRIP.lastIndex = 0; n.nodeValue = clean(n.nodeValue); }
      STRIP.lastIndex = 0;
      return;
    }
    if (n.nodeType !== 1 || n.nodeName === "SCRIPT" || n.nodeName === "STYLE") return;
    for (var i = 0; i < ATTRS.length; i++) {
      var v = n.getAttribute(ATTRS[i]);
      if (v) { STRIP.lastIndex = 0; if (STRIP.test(v)) { STRIP.lastIndex = 0; n.setAttribute(ATTRS[i], clean(v)); } STRIP.lastIndex = 0; }
    }
    for (var c = n.firstChild; c; c = c.nextSibling) autoNode(c);
  }
  BJICON.autoStrip = function () {
    function go() {
      autoNode(document.body);
      if (document.title) document.title = clean(document.title);
      if (typeof MutationObserver === "undefined") return;
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          if (m.type === "characterData") autoNode(m.target);
          else if (m.type === "attributes") autoNode(m.target);
          else for (var j = 0; j < m.addedNodes.length; j++) autoNode(m.addedNodes[j]);
        }
      }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }
    if (document.body) go(); else document.addEventListener("DOMContentLoaded", go);
  };

  window.BJICON = BJICON;
  if (typeof document !== "undefined") {
    css();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  }
  if (typeof module !== "undefined" && module.exports) module.exports = BJICON;
})();
