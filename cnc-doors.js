// cnc-doors.js — door (karmur + hurðablað) programs for the Rover-B, built from one door Eyðublað.
//
// Why: the shop's door masters on the USB stick ([05] - Hurdir) are already parametric (HURD_H, LOM1,
// HANDFANG …), but those numbers were typed into BiesseWorks "Piece Data" on the machine every time and
// never saved — so when the leaf was made weeks after the jamb, nobody knew what the jamb got. Here both
// come from the same numbers, written straight into every file (no Piece Data), and the numbers are
// logged next to the programs (Hurðaskrá).
//
// Pure functions only (no DOM, no Airtable): hurdir.html feeds in Eyðublað fields + master text from the
// USB, tests/cnc-doors.test.js feeds in fixtures. Works as a browser global (window.CNCDOORS) and as an
// ES-module-free CommonJS-ish export for node tests (module.exports).
(function (root) {
  "use strict";

  // ── Shop rules (from the user, 2026-10-08) ──────────────────────────────────────────────────────────
  var RULES = {
    HG_BIL: 10,     // gap leaf → floor   (ÚRVINNSLA: leaf H = Hæð − 13 − karmabil − karmur, 13 = 10 + 3)
    HK_BIL: 3,      // gap leaf → jamb, top and sides (leaf B = Breidd − 6 − 2·karmur − 2·karmabil)
    HURD_Z: 38,     // leaf core thickness (HU-Efni is the cladding, not the thickness)
    LOM1: 237,      // top hinge: 237 mm from the TOP of the leaf
    LOM2: 607,      // middle hinge: 607 mm from the TOP of the leaf
    LOM3: 237,      // bottom hinge: 237 mm from the BOTTOM of the leaf
    HANDFANG: 1050, // handle / lock centre: 1050 mm from the bottom of the leaf (= 1060 from the floor)
  };

  // ── Hardware → which macros to switch on (keyed by Vörulisti record id, as linked on the Eyðublað) ──
  // A lock or hinge not listed here gets NO macro switched on and is reported, never guessed.
  var HINGES = {
    recoQeJKpvKLowWK3: { name: "JNF Coplan (innfelld)", leaf: "COPLAN", jamb: "COPLAN_KARM" },
  };
  var LOCKS = {
    // Used with this lock on T-49 and T-54 leaves. The strike-plate macro is the one named after it in the
    // master but has not been confirmed on a real door yet → "check" until it has.
    recgXxgK8jwfkFyhp: { name: "JNF lykill m. segli 60", leaf: "IN_20_835_60_BA", jamb: "IN_20_835_60_BA_SLUTJARN", confirm: "Slúttjárn-makró IN_20_835_60_BA_SLUTJARN ekki staðfest á hurð" },
    // Likely pair (2026-10-08): EN12209's tooltip is "JNF Lashus" and JNF_SLUTTJARN's parameter is labelled "EN12209";
    // both sit (switched off) in the shop's own leaf/jamb masters. Not used on a door yet → "check".
    recp1YcZFduuzhpkb: { name: "JNF euro WC 20mm", leaf: "EN12209", jamb: "JNF_SLUTTJARN", confirm: "WC-skrá: EN12209 + JNF_SLUTTJARN ekki staðfest á hurð (JNF_SLUTTJARN miðar við 36 mm karm)" },
  };
  var THRESHOLDS = {
    recRJ3d2MCFv4DDJi: { name: "Felliþröskuldur", leaf: "FELLI_THROSKULDUR" },
  };
  // Every macro this generator is allowed to switch on/off. Anything else in a master is left exactly as is.
  var MANAGED = {
    leaf: ["COPLAN", "LAMIR_89_HURD", "IN05020_LAMIR_JNF", "HYDRAULIC_PIVOT_W_SYSTEM",
           "IN_20_835_60_BA", "EN12209", "IN_20_937", "HAWAJ_80B", "FELLI_THROSKULDUR"],
    jambHinge: ["COPLAN_KARM", "LAMIR_89", "IN05020_KARMLOM_JNF"],
    jambStrike: ["IN_20_835_60_BA_SLUTJARN", "IN_20_937_SLUTTJARN", "KFV_SLUTTJARN", "SEGUL_SLUTTJARN", "JNF_SLUTTJARN"],
    jambTop: ["HYDRAULIC_PIVOT_W_SYSTEM_FRAME_INSERT"],
  };
  // Variables the masters expect from Piece Data. All of them must be replaced by numbers.
  var VARS = ["HURD_H", "HURD_B", "HURD_Z", "KARMAR_B", "KARMAR_Z", "HG_BIL", "HK_BIL", "LOM1", "LOM2", "LOM3", "HANDFANG"];

  // Masters, relative to the "[01] - AÐALMÖPPUR …" folder on the USB. Toppstykki "Ofan á hliðum" / "Á milli hliða".
  var MASTER_DIR = ["[05] - Hurdir", "01 - Karmur"];
  var MASTERS = {
    leaf: { path: ["[05] - Hurdir", "[01] - Hurd.bpp"] },
    "Ofan á hliðum": {
      dir: "[01] - Karmur Toppstykki ofan 'a (default)",
      lamir: "karmur_lamir.bpp", slut: "karmur_sluttjarn.bpp", topp: "karmur_toppstykki.bpp",
    },
    "Á milli hliða": {
      dir: "[02] - karmur Topp_stikki_A_milli",
      lamir: "karmur_lamir_M.bpp", slut: "karmur_sluttjarn_M.bpp", topp: "karmur_toppstykki_M.bpp",
    },
  };

  function num(v) { var n = typeof v === "number" ? v : parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : null; }
  function firstId(v) { return Array.isArray(v) && v.length ? (typeof v[0] === "string" ? v[0] : v[0].id) : null; }
  function sel(v) { return v == null ? "" : String(typeof v === "object" ? v.name : v).trim(); }
  function r1(x) { return Math.round(x * 10) / 10; }

  // "HU 1.1" / "Hu 5" / "Hurð 7" / "HURÐ 3  BAÐHERBERGI" → "HU1.1" / "HU5" / "HU7" / "HU3"; anything else as typed.
  function doorId(athugasemd) {
    var s = String(athugasemd || "").trim();
    var m = s.match(/^(?:hu|hurð|hurd)\s*([0-9][0-9.\-]*)/i);
    return m ? "HU" + m[1].replace(/[.\-]$/, "") : s.replace(/[\\/:*?"<>|]+/g, "-") || "Hurð";
  }

  // One door Eyðublað (fields by name) → every number the programs need + what could not be filled.
  // status: "ok" | "check" (files made, something to confirm) | "stop" (no files — data missing).
  function doorPlan(f) {
    f = f || {};
    var stop = [], check = [];
    var H = num(f["Hæð"]), B = num(f["Breidd"]), D = num(f["Dýpt"]);
    var KZ = num(f["Þykkt karms [Hurð]"]), KB = num(f["Karmabil frá vegg [Hurð]"]);
    var topp = sel(f["Toppstykki hurðakarms"]);
    if (H == null) stop.push("Hæð vantar");
    if (B == null) stop.push("Breidd vantar");
    if (D == null) stop.push("Dýpt (breidd karms) vantar");
    if (KZ == null) stop.push("Þykkt karms vantar");
    if (KB == null) stop.push("Karmabil frá vegg vantar");
    if (!MASTERS[topp]) stop.push("Toppstykki hurðakarms vantar (Ofan á / Á milli)");

    var hingeId = firstId(f["Lamir [Hurð]"]), lockId = firstId(f["Skrá [Hurð]"]), thrId = firstId(f["Felliþr. [Hurð]"]);
    var hinge = hingeId ? HINGES[hingeId] : null;
    var lock = lockId ? LOCKS[lockId] : null;
    var thr = thrId ? THRESHOLDS[thrId] : null;
    if (!hingeId) stop.push("Lamir vantar");
    else if (!hinge) stop.push("Lamir: þekki ekki makró fyrir þessa löm (" + hingeId + ")");
    if (!lockId) check.push("Engin skrá valin — engin skrá fræst");
    else if (!lock) check.push("Skrá: makró fyrir þessa skrá ekki skráð — fræsa skrá og slúttjárn handvirkt");
    else if (lock.confirm) check.push(lock.confirm);
    if (thrId && !thr) check.push("Felliþröskuldur: óþekkt vara (" + thrId + ") — ekki fræstur");
    var opnun = sel(f["Opnun [Hurð]"]).replace(/[^A-Za-zÁ-ÿ ]/g, "").trim();
    if (!opnun) check.push("Opnun (vinstri/hægri) vantar");
    var qty = num(f["Fjöldi eininga"]) || 1;
    if (qty > 1) check.push("Fjöldi eininga = " + qty + " — keyra hvert forrit " + qty + " sinnum");

    var v = null;
    if (!stop.length) {
      v = {
        HURD_H: r1(H - RULES.HG_BIL - RULES.HK_BIL - KB - KZ),
        HURD_B: r1(B - 2 * RULES.HK_BIL - 2 * KZ - 2 * KB),
        HURD_Z: RULES.HURD_Z,
        KARMAR_B: D, KARMAR_Z: KZ,
        HG_BIL: RULES.HG_BIL, HK_BIL: RULES.HK_BIL,
        LOM1: RULES.LOM1, LOM2: RULES.LOM2, LOM3: RULES.LOM3, HANDFANG: RULES.HANDFANG,
      };
      if (v.HURD_H < 1500 || v.HURD_H > 3000 || v.HURD_B < 300 || v.HURD_B > 1300) check.push("Óvenjuleg stærð á blaði: " + v.HURD_H + " × " + v.HURD_B);
    }
    var on = { leaf: [], jambHinge: [], jambStrike: [], jambTop: [] };
    if (hinge) { on.leaf.push(hinge.leaf); on.jambHinge.push(hinge.jamb); }
    if (lock) { on.leaf.push(lock.leaf); on.jambStrike.push(lock.jamb); }
    if (thr) on.leaf.push(thr.leaf);
    return {
      id: doorId(f["Athugasemd"]), topp: topp, opnun: opnun, qty: qty,
      hinge: hinge ? hinge.name : null, lock: lock ? lock.name : null, threshold: thr ? thr.name : null,
      values: v, on: on, stop: stop, check: check,
      status: stop.length ? "stop" : check.length ? "check" : "ok",
    };
  }

  // Which master each output file comes from, and which managed macros it may switch.
  // short = inside the door's own folder (Hurðir/HU01/), where the project and door are already in the path
  // (user, 2026-10-10); the long names are the old flat layout, still looked up for jambs made there.
  function filesFor(plan, prefix, short) {
    var m = MASTERS[plan.topp]; if (!m) return [];
    var base = short ? "" : (prefix ? prefix + " " : "") + plan.id;
    return [
      { kind: "leaf", name: (base ? base + " " : "") + "Hurðablað.bpp", master: MASTERS.leaf.path, managed: MANAGED.leaf, on: plan.on.leaf },
      { kind: "lamir", name: (base ? base + " " : "") + "Karmur lamir.bpp", master: MASTER_DIR.concat([m.dir, m.lamir]), managed: MANAGED.jambHinge, on: plan.on.jambHinge, need: plan.on.jambHinge },
      { kind: "slut", name: (base ? base + " " : "") + "Karmur slúttjárn.bpp", master: MASTER_DIR.concat([m.dir, m.slut]), managed: MANAGED.jambStrike, on: plan.on.jambStrike },
      { kind: "topp", name: (base ? base + " " : "") + "Karmur toppstykki.bpp", master: MASTER_DIR.concat([m.dir, m.topp]), managed: MANAGED.jambTop, on: [] },
    ];
  }

  // Safe arithmetic for PAN values once every variable is a number ("2350+10+3+37" → 2400).
  function evalArith(expr) {
    var s = String(expr).trim();
    if (!/^[0-9.+\-*/() ]+$/.test(s)) return null;
    try { var x = Function('"use strict";return (' + s + ")")(); return isFinite(x) ? r1(x) : null; } catch (e) { return null; }
  }

  // Master text (CRLF, already decoded from Windows-1252) → finished program.
  //  - every Piece-Data variable is replaced by its number in [VARIABLES] and [PROGRAM] (other sections untouched);
  //  - PAN=LPX/LPY/LPZ are computed to plain numbers (as the shop's own finished files have them);
  //  - managed macros: switched on (@) if in `on`, off (') otherwise; "Rem" lines are never touched;
  //  - errors: a macro to switch on that the master doesn't contain, or a variable left unresolved.
  function renderBpp(text, values, managed, on) {
    var nl = text.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
    var lines = text.split(/\r?\n/);
    var errors = [], found = {}, section = "";
    var varRe = new RegExp("\\b(" + VARS.join("|") + ")\\b", "gi");
    var out = lines.map(function (line) {
      var sec = line.match(/^\[([A-Z]+)\]\s*$/);
      if (sec) { section = sec[1]; return line; }
      if (section !== "VARIABLES" && section !== "PROGRAM") return line;
      var l = line.replace(varRe, function (m) { return String(values[m.toUpperCase()]); });
      var pan = l.match(/^PAN=(LPX|LPY|LPZ)\|([^|]*)\|(.*)$/);
      if (pan) {
        var val = evalArith(pan[2]);
        if (val == null) errors.push("Gat ekki reiknað " + pan[1] + " = " + pan[2]);
        else l = "PAN=" + pan[1] + "|" + val + "|" + pan[3];
      }
      if (section === "PROGRAM") {
        var mm = l.match(/^([@'])( +)([A-Z0-9_]+),(.*)$/);
        if (mm && managed.indexOf(mm[3]) >= 0) {
          var want = on.indexOf(mm[3]) >= 0;
          if (want) found[mm[3]] = true;
          l = (want ? "@" : "'") + mm[2] + mm[3] + "," + mm[4];
        }
      }
      return l;
    });
    on.forEach(function (name) { if (!found[name]) errors.push("Makró " + name + " fannst ekki í master — ekki hægt að kveikja á því"); });
    // Anything still named like a Piece-Data variable in an active line means the file would ask the machine for it.
    var sec2 = "";
    out.forEach(function (l) {
      var s = l.match(/^\[([A-Z]+)\]\s*$/); if (s) { sec2 = s[1]; return; }
      if ((sec2 !== "VARIABLES" && sec2 !== "PROGRAM") || /^\s*(Rem|')/.test(l)) return;
      var left = l.match(new RegExp("\\b(" + VARS.join("|") + ")\\b", "i"));
      if (left) errors.push("Breyta " + left[1] + " óleyst: " + l.slice(0, 80));
    });
    // The numbers are also saved in the file as globals so a finished file is its own record — under an
    // "HS_" prefix: the machine already defines HURD_B etc. itself (Piece Data), and a GLB with the same
    // name stops the program with "Variable HURD_B cannot be evaluated … Name redefined" (shop test,
    // 2026-10-08). The macros that read HURD_Z inside themselves get the machine's own value (38).
    var at = -1, inVars = false;
    out.forEach(function (l, i) {
      if (/^\[VARIABLES\]/.test(l)) inVars = true; else if (/^\[/.test(l)) inVars = false;
      if (inVars && /^PAN=/.test(l)) at = i;
    });
    if (at < 0) errors.push("Fann engar PAN-línur í [VARIABLES]");
    else out.splice.apply(out, [at + 1, 0].concat(VARS.map(function (k) { return "GLB=HS_" + k + "|" + values[k] + "|Hurdaskra|0|"; })));
    return { text: out.join(nl), errors: errors };
  }

  // Windows-1252 bytes ⇄ string (BiesseWorks on XP reads/writes ANSI). TextDecoder("windows-1252") decodes;
  // this encodes back, mapping the 0x80–0x9F punctuation (–, ’, € …) and "?" for anything not representable.
  var CP1252_HIGH = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
  function toCp1252(str) {
    var b = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      b[i] = c < 0x80 || (c >= 0xA0 && c <= 0xFF) ? c : (CP1252_HIGH[c] || 0x3F);
    }
    return b;
  }

  // The "Hurðaskrá" — every number each program was made with, human-readable, saved next to the files.
  function logText(plan, project, when) {
    var v = plan.values || {};
    var L = [
      "HURÐASKRÁ — " + project + " — " + plan.id,
      "Búið til: " + when,
      "",
      "Toppstykki: " + plan.topp + "   Opnun: " + (plan.opnun || "?") + "   Fjöldi: " + plan.qty,
      "Lamir: " + (plan.hinge || "-") + "   Skrá: " + (plan.lock || "-") + "   Þröskuldur: " + (plan.threshold || "-"),
      "",
      "Hurðablað  HURD_H " + v.HURD_H + "  HURD_B " + v.HURD_B + "  HURD_Z " + v.HURD_Z,
      "Karmur     KARMAR_B " + v.KARMAR_B + "  KARMAR_Z " + v.KARMAR_Z,
      "Bil        HG_BIL " + v.HG_BIL + " (gólf)  HK_BIL " + v.HK_BIL + " (toppur/hliðar)",
      "Lamir      LOM1 " + v.LOM1 + " frá toppi  LOM2 " + v.LOM2 + " frá toppi  LOM3 " + v.LOM3 + " frá botni (blaðs)",
      "Handfang   HANDFANG " + v.HANDFANG + " frá botni blaðs (" + (v.HANDFANG + v.HG_BIL) + " frá gólfi)",
    ];
    if (plan.check.length) L.push("", "ATH:", plan.check.map(function (s) { return "  - " + s; }).join("\r\n"));
    return L.join("\r\n") + "\r\n";
  }

  // Numbers a finished program was made with (the GLB=…|…|Hurdaskra lines this generator writes).
  // Returns null for a file that wasn't made here (hand-made / older), so callers can tell the difference.
  function readValues(text) {
    var v = {}, n = 0;
    String(text).split(/\r?\n/).forEach(function (l) {
      // "HS_HURD_H" (current) or "HURD_H" (the first files, 2026-10-08 morning, which the machine rejected).
      var m = l.match(/^GLB=(?:HS_)?([A-Z_0-9]+)\|([^|]*)\|Hurdaskra\|/);
      if (m && VARS.indexOf(m[1]) >= 0 && !(m[1] in v)) { v[m[1]] = num(m[2]); n++; }
    });
    return n === VARS.length ? v : null;
  }
  // Which numbers differ between two value sets (for "Airtable changed after the jamb was made").
  function diffValues(a, b) {
    return VARS.filter(function (k) { return a && b && a[k] !== b[k]; }).map(function (k) { return k + " " + a[k] + " → " + b[k]; });
  }

  var api = { VARS: VARS, readValues: readValues, diffValues: diffValues, RULES: RULES, HINGES: HINGES, LOCKS: LOCKS, THRESHOLDS: THRESHOLDS, MANAGED: MANAGED, MASTERS: MASTERS,
    doorId: doorId, doorPlan: doorPlan, filesFor: filesFor, renderBpp: renderBpp, evalArith: evalArith, toCp1252: toCp1252, logText: logText };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CNCDOORS = api;
})(typeof window !== "undefined" ? window : globalThis);
