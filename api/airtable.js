// api/airtable.js
import crypto from "node:crypto";
import { applyCors } from "./_cors.js";
// Airtable proxy — keeps the Personal Access Token server-side only, so it
// never sits in committed code or page source (GitHub's push protection
// blocks any commit containing an Airtable PAT). Used by cutlist.html,
// dashboard.html, labels.html and stimpilklukka.html.
//
// Two layers of restriction, both enforced server-side (never trust the
// client to only ask for what it needs):
//   1. Table allowlist — only these tables are reachable at all.
//   2. Field allowlist per table — the response is capped to exactly these
//      fields regardless of what fields[] requests or omits. Verified by
//      direct testing that omitting fields[] returns full records, including
//      Efnislisti's purchase-cost fields — this is what stops that.
//      Starfsmenn additionally requires a filterByFormula (REQUIRE_FILTER)
//      so a caller can't dump every employee's PIN in one request.

const AIRTABLE_BASE = "app91U15z9K704Okd";
const STIMPLANIR_TABLE = "tblnFIO8RB6HcelXF";
const VERKTIMAR_TABLE = "tblGu27c2fcwN2i2n";

const ALLOWED_FIELDS = {
  "tbl4LMXlQjp66RFKI": [ // Tækifæri 📣 (projects)
    "Heiti tækifæris / verkefnis",
    "Staða í skipulagi",
    "Staða í framleiðslu",
    "Tækifæri unnið 🏆",
    "Áætlaður afhendingardagur Björninn (internal)",
    "Framvinda framleiðslu [weighted]",
    "Forgangur framleiðslu 🥇",
    // Reference PDFs shown at the top of fraesing.html, hidden if empty.
    "Loka teikningar verkefnis 📋",
    "Sér fræsi teikningar",
    "Heimilistæki verkefnis",
    // ── Customer portal (verkefni.html, iframed into the Wix /verkefni page) ──
    // Display-only, deliberately no pricing / cost / phone / email — this is
    // the same data the old hand-built Wix page already showed publicly. The
    // link is a plain ?t=<recordId> for now; a signed token comes later.
    "Fornafn ⬅️",                                    // greeting ("Hæ, Sólveig 👋")
    "Skilaboð til viðskiptavinar 💬",                 // rich-text portal message
    "Skipting greiðslu",                             // payment split (no krónur exposed)
    "Greiðsla 1 (staðfesting)",
    "Greiðsla 2 greidd",
    "Greiðsla 3 greidd",
    "Staða í söluferli",                             // step 1 of the timeline
    "Áætlaður afhendingardagur + 7 vinnudagar (external)", // shown delivery estimate
    "Raun afhendingardagur (int/external)",          // actual delivery once handed over
    "Heiti efnis (from Skrokka efni 🔲 viðskiptavinar)",
    "Heiti efnis (from Fronta efni viðskiptavinar 🖼️)",
    "Heiti efnis (from Fronta efni 2.0 Viðskiptavinar 🖼️)",
    "Heiti vöru 📣 (from Höldur Viðskiptavinar ✊)",
    "Heiti vöru 📣 (from Höldur Viðskiptavinar ✊2.0)",
    "Heiti efnis (from Borðplata viðskiptavinar 🍽️)",
    "Heiti efnis (from Hurðaefni viðskiptavinar 🚪)",
    "Heiti efnis (from Hurðaefni viðskiptavinar 🚪 2.0)",
    // Material swatch images shown beside each name on the portal. These are
    // lookups of attachment fields — Airtable's signed URLs expire in ~2h, but
    // the portal re-fetches the record on every page load so they stay fresh.
    "Mynd af skrokka efni",
    "Mynd af fronta efni",
    "Mynd af fronta efni 2",
    "Mynd af Hurðaefni viðskiptavinar",
    "Mynd af Hurðaefni viðskiptavinar 2.0",
    "Mynd af borðplötu viðskiptavinar",
    "Mynd af Höldum Viðskiptavinar ✊",
    "Mynd Höldur Viðskiptavinar ✊2.0",
    // ── Kitchen planner self-serve submissions (kitchen-planner.html /
    // kitchen-planner-review.html) ──
    "Fullt nafn 👤",                                 // contact name, shown on Rakel's review page
    "Netfang 📧",
    "☎️ Símanúmer",
    "Sjálfsafgreiðsla — óyfirfarið ⚠️",              // true until Rakel reviews it — see api/airtable.js's FORCED_CREATE_FIELDS
    "Sjálfsafgreiðsla skipulag (JSON) 📐",           // the exact planner state, so the review page renders the same 3D/2D scene
  ],
  "tblhdgyvTcBfP8kov": [ // Sögunarlisti 🪚
    "Tækifæri 📣 (projects)",
    "Partur",
    "H",
    "B",
    "Þ",
    "M",
    "Efni: (undirstaða)",
    "Efni:", // resolved decor name incl. customer material (e.g. "...H3154 Charl eik") — grain.html needs the decor to group grain-matched fronts
    "Villa?",
    "Athugasemd",
    "B.A.S.",
    "Lokið",
    "Skurðarskrá",
    "Skurðarnúmer", // 1-based position of the piece in its CUTLST00 file = the "Code" Cutty shows; written by cutlist.html, read by labels.html
    "Skilaboð til skipulags", // grain.html: /saga flags a problematic grain front → note back to the planners (rolls up to Tækifæri)
    "Tegund einingu",
    "Yfirfr.",
    "Fræst",
    "Magn fræst",
    "V hlið magn fræst", // per-side partial done tracking for a V/H hlið pair sharing one row (M=2×unit count)
    "H hlið magn fræst",
    "Eyðublað ✏️", // used by fraesing.html to group parts by unit
  ],
  "tbl0WcyHhz63pSzZX": [ // Eyðublað ✏️ — read-only, used by fraesing.html to render one card per unit
    "Athugasemd", // primary field — the unit's own short name (e.g. "SK 20")
    "Tækifæri 📣 (projects)",
    "Tækifæri 📣", // old project-link field — some units are only linked via this one
    "Hvað viltu smíða?",
    "Athugasemd til fræsara 🔬",
    "Skápategund", // used by fraesing.html to flag Lagnaskápur units
    "Sérsmíði tegund",
    "Frontur / Hlið tegund",
    "Skúffutegund",
    "LED magn",
    "N", "M", "K", "C", "F", "E", "IN", "IM", "IK", "IC", "IF", "IE",
    // ── kitchen-planner.html write-back ──
    "Heiti rýmis", "Breidd", "Hæð", "Dýpt", "Fjöldi eininga", "Grip?",
    "Skilaboð til Skipulags 📝", // plain-language "customer wants N drawers, not shelves" note
    "Höldur 1", "Höldur 1 magn", // set instead of Grip? when a real Vörulisti handle is chosen
    "Hæð ofns", "Töfrahorn útfærsla", "Breidd á töfra front", // Ofnaskápur / Töfrahorn cabinet types
  ],
  "tblQ8zeUanriESWvL": [ // Tengiliðir 👤 — created by kitchen-planner.html's contact-capture step
    "Fornafn ⬅️", "Eftirnafn ➡️", "Netfang 📧", "Símanúmer ☎️",
    "Tegund tengiliðs 👥", "Hvaðan kom viðskiptavinurinn 📥",
  ],
  "tblzuuRSRkeXaLWxC": [ // Vörulisti 🚪 — resolves hardware-link names for /eining (name only, no cost)
    "Heiti vöru 📣",
  ],
  "tbl8CrVWKF8CuI7HD": [ // Efnislisti 🧱
    "Heiti efnis",
    "Breidd (mm)",
    "Lengd (mm)",
    "Þykkt (mm)",
    "Undirflokkur 🗂️", // grain.html: is a part's material frontaefni / spónlagt / hurð?
    "Mynd 🖼️", // eining.html: material swatch shown beside its Sögun & fræsing group header
  ],
  "tblDQWuf4OSjUv2XI": [ // QUICK FIX❗
    "Verkheiti",
    "Vandamálið",
    "Ábyrgðarmaður",
    "Staða",
    "Nafn þitt",
    "Tengt verkefni",
    "Skiladagur",
    "Kvörtunar-ID",
    "Skráð þann:",
  ],
  "tbltD1UNpqj05WtMx": [ // Vefspjall 💬 — site chatbot conversation log. Write-only in
    // practice (Rakel reviews in Airtable directly), but listed here too so a
    // successful create's own response echoes back what was written instead
    // of coming back with an empty fields object.
    "Fyrsta spurning",
    "Samtal",
    "Óleyst spurning",
    "Netfang",
    "Síða",
  ],
  "tblzkw70E2xoX9RmK": [ // Æðaplan 📐 — grain.html (/aedar office) writes; /saga floor reads
    "Nafn",
    "Tækifæri 📣",
    "Efni",
    "Skipulag",     // layout JSON
    "Staðfest ✅",  // checkbox — floor (/saga) only loads plans where this is ticked
  ],
  "tblhglpjQkczdG1AY": [ // Starfsmenn 👷🏼‍♂️ — stimpilklukka PIN lookup only.
    "Nafn starfsmanns 👷",
    "PIN 🔢",
    "Er starfandi? ✅",
    "Kyn",
    "Starfsheiti 💼", // drives which project list the clock-out allocation screen shows
  ],
  "tblnFIO8RB6HcelXF": [ // Stimplanir ⏱️ (time clock shifts — one row per Inn→Út)
    "Inn",
    "Út",
    "Starfsmaður",
    "Dagvinna (klst)",
    "Yfirvinna (klst)",
    "Samtals (klst)",
  ],
  "tbl3e5o0Klv9RcNQ4": [ // Fjarvistir 🤒 (sick day log + vacation requests —
    // a row with "Til" filled in is a vacation *request* spanning Dagsetning
    // (frá) → Til, everything else is a plain single-day absence)
    "Dagsetning",
    "Starfsmaður",
    "Tegund",
    "Til",
    "Staða",
    "Dagar (virkir)",
    "Orlofsdagar eftir (staða)",
    "Dögum dreift",
  ],
  "tblGu27c2fcwN2i2n": [ // Verktímar 🕒 (per-project time allocation on clock-out)
    "Dagsetning",
    "Starfsmaður",
    "Verkefni 📣",
    "Verkflokkur",
    "Klst",
    "Stimplun ⏱️",
  ],
  "tblPMeNUQirwdNlYf": [ // SOP's 🤓 — read-only reference library for /sop
    "Heiti SOP (standard operating procedure)",
    "Cover mynd 🖼️",
    "Eigandi SOP's",
    "Myndbands eða teiknuð útskýring 🔗",
    "Lýsing á skrefum ✍️",
    "Lesa eða ekki 🤓",
    "Flokkur 🗂️",
    "Undirflokkur 📁",
  ],
};

// Extra Tækifæri fields the internal floor page (/verk, verk.html) needs —
// drawings, the "þarf að hafa í huga" notes, meeting notes, progress. These
// are deliberately NOT in ALLOWED_FIELDS: the customer portal and every other
// caller hits the same public endpoint, and these are internal. They're
// merged in only when the request carries ?k= matching VERK_KEY (the key the
// shop printer bakes into the QR on each Zebra label).
const VERK_ONLY_FIELDS = {
  "tbl4LMXlQjp66RFKI": [
    "Forgangur framleiðslu 🥇",
    "Upphafs framleiðsludagur verks",
    "🎯 Markmið:",
    "🚀 Pepp verksins:",
    "🧠📌Það sem þarf að hafa í huga",
    "🔬📌 Það sem Fræsari þarf að hafa í huga",
    "🪵📌 Það sem spónlagning þarf að hafa í huga",
    "🪛📌 Það sem uppsetningaraðili þarf að hafa í huga❗",
    "Ýtarleg verklýsing teiknara📝",
    "Skúffusamantekt",
    "Verkfundar glósur",
    "Loka teikningar verkefnis 📋",
    "Sér fræsi teikningar",
    "Málsettar myndir af rými 🖼️",
    "Teikningar af tækifæri ✍️",
    "Heimilistæki verkefnis",
    "Framvinda sögunar",
    "Framvinda almennar framleiðslu",
    "Fjöldi varahluta til að saga",
    "Fjöldi varahluta sagaðir",
    "Staða á efnispöntun",
  ],
  // /eining (unit page) — mirrors exactly what the "samsetningar prentunar"
  // Eyðublað automation puts on the physical assembly label, so the digital
  // and printed views of a unit always agree. Internal build detail, not for
  // the public proxy path — same VERK_KEY gate as the Tækifæri set above.
  "tbl0WcyHhz63pSzZX": [
    "Heiti rýmis",
    "Tegund einingu",
    "Hæð", "Breidd", "Dýpt",
    "Fjöldi eininga",
    "Höldur 1", "Höldur 1 magn", "Höldur 2", "Höldur 2 magn",
    "LED", "LED magn",
    "Fataslár", "Fataslár magn",
    "Straumbreytar", "Straumbreytar magn",
    "Útdrög", "Útdrög magn",
    "AMBIA", "AMBIA magn",
    "Hnífaparabakkar", "Hnífaparabakkar magn",
    "Rusl", "Rusl magn",
    "Fatalyftur", "Fatalyftur magn",
    "Loftunarrist", "Loftunarristar magn",
    "Stök vara",
    "Harðplast", "Harðplast?",
    "Spegill",
    "Töfrahorn útfærsla",
    "Skrá [Hurð]", "Felliþr. [Hurð]", "Lamir [Hurð]",
    "Fastar hillur fjöldi", "Lausar hillur fjöldi",
    "Fjöldi hillubera", "Fjöldi sláa",
    "Fjöldi Movento bakka", "Fjöldi lagnaskúffa",
    "Fjöldi díla", "Fjöldi Skrúfu / rastex", "Fjöldi euroskrúfa", "Fjöldi lama / klossa",
    "Rastex", "Undirgrip", "Tveir frontar (væng)",
    "Mottur í skúffur", "550mm skúffur?",
    "Flatpakkaður", "Kassi án fronts", "Lagnaskápur", "Ofnaskápur", "Kassi úr frontaefni",
    "Grip?", "Skúffutegund", "Skúffu dýptir fyrir prentara",
    "Skipting fronta [Lárétt]", "Skipting fronta [Lóðrétt]", "Skipting fronta [Tækja]",
    "Opnun [Hurð]", "Hurðaefni",
    "Sérhæð N fronts", "Sérhæð M fronts", "Sérhæð K fronts",
    "Sérhæð C fronts", "Sérhæð F fronts", "Sérhæð E fronts",
    "Tvípress / Eurolight", "Sérsmíði tegund", "Sérsmíði efni",
  ],
};

// Tables that hold credential-like, health-adjacent, or visitor-PII data — a
// request with no filterByFormula would otherwise dump every row's allowed
// fields, which for Starfsmenn means every employee's PIN at once, for
// Fjarvistir means every employee's sick-day history at once, and for
// Vefspjall means every site visitor's email + full conversation transcript
// at once. Require the caller to filter to a single lookup instead of
// listing the whole table.
const REQUIRE_FILTER = new Set(["tblhglpjQkczdG1AY", "tbl3e5o0Klv9RcNQ4", "tblzkw70E2xoX9RmK", "tbltD1UNpqj05WtMx"]);

// The kiosk's clock-out flow writes one Verktímar row per project the
// employee split their shift across (Dagsetning + Klst + links). Like
// Stimplanir it's kiosk-device-locked (see KIOSK_LOCKED_TABLES) — the split
// only happens right after ÚT on the paired shop tablet.

// Stimplanir is for opening a new shift (Inn). Fjarvistir is for marking a
// day sick from the kiosk, AND for submitting a vacation request (send
// "Til" too — see FORCED_CREATE_FIELDS below, which forces "Staða" to
// "Í bið" only in that case, so a client can't self-approve its own
// vacation request, while an ordinary same-day sick entry is unaffected).
// Verktímar is for the per-project split written on clock-out. No other
// table accepts creates through this proxy. Stimplanir's "Út" is
// deliberately not creatable: a shift is opened blank and only ever closed
// via the PATCH path below, never created pre-closed.
const CREATABLE_FIELDS = {
  // "Mánuður 🗓️"/"Ár 🗓️" are real single-select fields (not formulas) so
  // they work as clean pick-a-value dropdown filters in Interfaces — the
  // kiosk computes and sends them at creation time since there's no
  // Airtable Automation populating them.
  "tblnFIO8RB6HcelXF": ["Inn", "Starfsmaður", "Mánuður 🗓️", "Ár 🗓️"],
  "tbl3e5o0Klv9RcNQ4": ["Dagsetning", "Starfsmaður", "Tegund", "Til"],
  // One row per project the employee split their just-closed shift across.
  // Verkefni 📣 is empty for the "Sölur"/"Annað" buckets (Verkflokkur says
  // which). Stimplun ⏱️ links back to the shift row for traceability.
  "tblGu27c2fcwN2i2n": ["Dagsetning", "Starfsmaður", "Verkefni 📣", "Verkflokkur", "Klst", "Stimplun ⏱️"],
  // /aedar creates one grain-plan row per project+material the first time
  // it's saved; thereafter it PATCHes the same row (see WRITABLE_FIELDS).
  "tblzkw70E2xoX9RmK": ["Nafn", "Tækifæri 📣", "Efni", "Skipulag", "Staðfest ✅"],
  // Site chatbot widget (see faq.html's corpus) logs one row per conversation
  // when it ends — write-only from this proxy, Rakel/owner review happens
  // directly in Airtable, nothing in this repo reads it back.
  "tbltD1UNpqj05WtMx": ["Fyrsta spurning", "Samtal", "Óleyst spurning", "Netfang", "Síða"],
  // kitchen-planner.html's contact-capture step creates a Tengiliðir, then a
  // Tækifæri linking it, then one Eyðublað per placed cabinet — see
  // FORCED_CREATE_FIELDS below for the fields the client can't set itself.
  "tblQ8zeUanriESWvL": ["Fornafn ⬅️", "Eftirnafn ➡️", "Netfang 📧", "Símanúmer ☎️", "Tegund tengiliðs 👥", "Hvaðan kom viðskiptavinurinn 📥"],
  "tbl4LMXlQjp66RFKI": ["Tengiliður verkefnis 👤", "Skrokka efni 🔲 viðskiptavinar", "Fronta efni viðskiptavinar 🖼️", "Sjálfsafgreiðsla skipulag (JSON) 📐"],
  // "Skúffutegund" (Phase 7b) is a real 2-choice field (LEGRA/MERIVO), set
  // the same on every unit — a whole-project hardware choice, not per-cabinet.
  "tbl0WcyHhz63pSzZX": ["Tækifæri 📣", "Heiti rýmis", "Hvað viltu smíða?", "Skápategund", "Breidd", "Hæð", "Dýpt", "Fjöldi eininga", "Grip?", "Skilaboð til Skipulags 📝", "Höldur 1", "Höldur 1 magn", "Hæð ofns", "Töfrahorn útfærsla", "Breidd á töfra front", "Skúffutegund", "Lausar hillur fjöldi"],
  // /app's "❗ Nýtt QUICK FIX" quick-task form — see FORCED_CREATE_FIELDS
  // below for why "Staða" isn't in this list (anyone on the floor can report
  // a problem, but it always starts "opið", never self-set to in-progress).
  "tblDQWuf4OSjUv2XI": ["Nafn þitt", "Vandamálið", "Ábyrgðarmaður", "Tengt verkefni", "Skiladagur"],
};

// Fields forced to a fixed value on create, regardless of what (or whether)
// the client sends — applied after CREATABLE_FIELDS filtering, so these
// don't need to be creatable at all. A table's entry may be a plain object
// (always applied) or a function of the already-filtered fields (applied
// conditionally) — Fjarvistir needs the latter, since only a vacation
// *request* (a row that carries "Til") should be forced into "Í bið"; an
// ordinary same-day sick entry has no "Til" and must pass through untouched.
const FORCED_CREATE_FIELDS = {
  "tbl3e5o0Klv9RcNQ4": (fields) => (fields["Til"] ? { "Staða": "Í bið" } : {}),
  "tbltD1UNpqj05WtMx": { "Staða": "Nýtt" },
  "tblDQWuf4OSjUv2XI": { "Staða": "opið 😠" },
  // A self-serve submission must never look like reviewed designer work —
  // both the review flag and the pre-production stage are forced server-side
  // so a tampered client request can't skip Rakel's review or jump straight
  // into the real production pipeline (which only ever fires off an explicit
  // button press on the Tækifæri record, never on record creation).
  "tbl4LMXlQjp66RFKI": {
    "Staða í söluferli": "Hönnun & Ráðgjöf 🖊️✨",
    "Staða í skipulagi": "For-skipulag",
    "Sjálfsafgreiðsla — óyfirfarið ⚠️": true,
  },
};

// Only the stimpilklukka kiosk's own paired device may open/close a shift —
// this is what keeps INN/ÚT tied to being physically at the shop, while
// Fjarvistir (sick marking AND vacation requests) stays reachable from any
// device. Pairing happens client-side (stimpilklukka.html stores the secret
// from a one-time ?setup= link); this just checks the header matches.
const KIOSK_LOCKED_TABLES = new Set([STIMPLANIR_TABLE, VERKTIMAR_TABLE]);

// Owners clock in from their phones via /eigandi — no device pairing. That page
// gets a per-day token from api/eigandi-clock.js (HMAC of the date keyed with
// KIOSK_DEVICE_SECRET, after verifying the PIN belongs to an Eigandi) and sends
// it as X-Kiosk-Token. Accept today's or yesterday's so a shift that straddles
// UTC midnight still submits. Never derivable without the secret.
function ownerDayToken(secret, offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + (offsetDays || 0));
  return crypto
    .createHmac("sha256", secret)
    .update("eigandi-clock:" + d.toISOString().slice(0, 10))
    .digest("hex")
    .slice(0, 40);
}

function isKioskPaired(req) {
  const secret = process.env.KIOSK_DEVICE_SECRET;
  if (!secret) return false;
  const tok = req.headers["x-kiosk-token"];
  return tok === secret || tok === ownerDayToken(secret, 0) || tok === ownerDayToken(secret, -1);
}

// Only Sögunarlisti rows may be patched, and only these fields — used for the
// "mark as manual cut" / "fix oversized piece" actions in cutlist.html, the
// Skurðarskrá file-assignment write, and labels.html's print trigger. Never
// exposes create/delete, and never touches Tækifæri or Efnislisti.
// Note: "Lokið" is intentionally NOT writable here — the shop's
// print-server.js is the sole owner of setting that field; this proxy only
// ever sets B.A.S. to request a print, then reads Lokið to see it complete.
const WRITABLE_FIELDS = {
  // "Fræst"/"Magn fræst" (milling done / partial quantity done) and the
  // per-side "V hlið magn fræst"/"H hlið magn fræst" pair are written by
  // fraesing.html's toggle buttons.
  "tblhdgyvTcBfP8kov": ["H", "B", "Þ", "Villa?", "Athugasemd", "B.A.S.", "Skurðarskrá", "Skurðarnúmer", "Fræst", "Magn fræst", "V hlið magn fræst", "H hlið magn fræst", "Skilaboð til skipulags"],
  // Closes an open shift (stimpilklukka's ÚT button). "Inn" is intentionally
  // not writable here — a shift's start time is only ever set at creation.
  "tblnFIO8RB6HcelXF": ["Út"],
  // /aedar re-saves the working layout and flips the confirm checkbox on the
  // existing plan row. Tækifæri/Efni are set once at create, never patched.
  "tblzkw70E2xoX9RmK": ["Nafn", "Skipulag", "Staðfest ✅"],
  // kitchen-planner-review.html: Rakel's "✅ Yfirfarið" button unchecks the
  // review flag (that's the approval action — no separate status field).
  "tbl4LMXlQjp66RFKI": ["Sjálfsafgreiðsla — óyfirfarið ⚠️"],
  // /app's recent-QUICK-FIX list lets anyone tap a card to advance
  // opið → Í vinnslu → Lokið — unlike Fjarvistir's vacation-request "Staða"
  // this isn't an approval gate, so any floor device may set it.
  "tblDQWuf4OSjUv2XI": ["Staða"],
};

// URLSearchParams serializes spaces as "+" (application/x-www-form-urlencoded).
// Airtable's query-string field matching tolerates that, but its formula
// parser doesn't decode "+" back to space, so a filterByFormula referencing
// a field name with a space (e.g. {PIN 🔢}) fails with "Unknown field
// names". %20 works in both contexts, so normalize before every request.
function airtableUrl(url) {
  return url.toString().replace(/\+/g, "%20");
}

function filterFields(record, allowedFields) {
  const allowedSet = new Set(allowedFields);
  const fields = {};
  for (const [k, v] of Object.entries(record.fields || {})) {
    if (allowedSet.has(k)) fields[k] = v;
  }
  return { ...record, fields };
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return res.status(500).json({ error: "AIRTABLE_TOKEN not configured" });

  if (req.method === "GET") {
    const { path, ...params } = req.query;
    if (!path) return res.status(400).json({ error: "Missing path" });

    const [tableId, recordId] = String(path).split("/");
    const baseFields = ALLOWED_FIELDS[tableId];
    if (!baseFields) return res.status(403).json({ error: "Table not allowed" });
    if (!recordId && REQUIRE_FILTER.has(tableId) && !params.filterByFormula) {
      return res.status(403).json({ error: "filterByFormula required for this table" });
    }

    // ?k= widens the field set for the internal /verk floor page. A present
    // but wrong key is rejected outright (so the page can show a clear "bad
    // link" rather than a confusing half-populated view); an absent key just
    // gets the normal public field set. Never forwarded to Airtable.
    let allowedFields = baseFields;
    if (params.k != null) {
      const verkKey = process.env.VERK_KEY;
      if (!verkKey || params.k !== verkKey) {
        return res.status(403).json({ error: "Invalid key" });
      }
      if (VERK_ONLY_FIELDS[tableId]) {
        allowedFields = baseFields.concat(VERK_ONLY_FIELDS[tableId]);
      }
      delete params.k;
    }

    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}`);
    for (const [key, value] of Object.entries(params)) {
      if (key === "fields[]") continue; // rebuilt below — client's request is ignored, not trusted
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
      else url.searchParams.set(key, value);
    }
    allowedFields.forEach((f) => url.searchParams.append("fields[]", f));

    if (recordId) {
      // Airtable's single-record endpoint (GET /v0/{base}/{table}/{id}) started
      // rejecting every request with a generic 422 "parameter validation
      // failed" — verified via direct testing that even one allowed field, and
      // even the previously rock-solid Tækifæri table, fail identically.
      // Routing through the list endpoint's RECORD_ID() filter instead gets
      // the same data and sidesteps whatever broke there.
      url.searchParams.set("filterByFormula", `RECORD_ID()='${recordId}'`);
      const airtableRes = await fetch(airtableUrl(url), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await airtableRes.json();
      if (!airtableRes.ok) return res.status(airtableRes.status).json(data);
      const record = (data.records || [])[0];
      if (!record) return res.status(404).json({ error: "Record not found" });
      return res.status(200).json(filterFields(record, allowedFields));
    }

    const airtableRes = await fetch(airtableUrl(url), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await airtableRes.json();
    if (Array.isArray(data.records)) {
      data.records = data.records.map((r) => filterFields(r, allowedFields));
    }
    return res.status(airtableRes.status).json(data);
  }

  if (req.method === "POST") {
    const { path } = req.query;
    if (!path) return res.status(400).json({ error: "Missing path" });

    const tableId = String(path);
    const creatable = CREATABLE_FIELDS[tableId];
    if (!creatable) return res.status(403).json({ error: "Create not allowed for this table" });
    if (KIOSK_LOCKED_TABLES.has(tableId) && !isKioskPaired(req)) {
      return res.status(403).json({ error: "DEVICE_NOT_PAIRED" });
    }

    const requestedFields = req.body?.fields || {};
    const fields = {};
    for (const [k, v] of Object.entries(requestedFields)) {
      if (creatable.includes(k)) fields[k] = v;
    }
    const forced = FORCED_CREATE_FIELDS[tableId];
    Object.assign(fields, typeof forced === "function" ? forced(fields) : forced || {});
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "No writable fields in request" });
    }

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}`;
    const airtableRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      // typecast: true so a singleSelect value with no exact-matching choice
      // (e.g. a stale/renamed option) creates the choice instead of hard-
      // failing the write — a create should never brick over a label typo.
      body: JSON.stringify({ fields, typecast: true }),
    });
    const data = await airtableRes.json();
    const filtered = data.fields ? filterFields(data, ALLOWED_FIELDS[tableId] || []) : data;
    return res.status(airtableRes.status).json(filtered);
  }

  if (req.method === "PATCH") {
    const { path } = req.query;
    if (!path) return res.status(400).json({ error: "Missing path" });

    const [tableId, recordId] = String(path).split("/");
    const writable = WRITABLE_FIELDS[tableId];
    if (!writable || !recordId) {
      return res.status(403).json({ error: "Write not allowed for this path" });
    }
    if (KIOSK_LOCKED_TABLES.has(tableId) && !isKioskPaired(req)) {
      return res.status(403).json({ error: "DEVICE_NOT_PAIRED" });
    }

    const requestedFields = req.body?.fields || {};
    const fields = {};
    for (const [k, v] of Object.entries(requestedFields)) {
      if (writable.includes(k)) fields[k] = v;
    }
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "No writable fields in request" });
    }

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}/${recordId}`;
    const airtableRes = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });
    const data = await airtableRes.json();
    // Airtable's PATCH response echoes the full updated record regardless of
    // what was sent — same leak as the GET path if left unfiltered (caught
    // via direct testing: a PATCH response included every field on the
    // record, not just the ones written).
    const filtered = data.fields ? filterFields(data, ALLOWED_FIELDS[tableId] || []) : data;
    return res.status(airtableRes.status).json(filtered);
  }

  return res.status(405).json({ error: "GET, POST or PATCH only" });
}
