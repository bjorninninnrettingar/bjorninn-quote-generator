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
    "Upphafs framleiðsludagur verks",
    "Viðskiptavinur sækir þann:",
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
    // (contact name / email / phone moved to VERK_ONLY_FIELDS on 2026-10-01 — they were readable by
    // anyone; the review page now passes ?k= to see them)
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
    "Tilbúið 🔒", // ferli.html's Yfirfara einingu popup (2026-10-18) — per-row ready checkbox

    "Skurðarskrá",
    "Skurðarnúmer", // 1-based position of the piece in its CUTLST00 file = the "Code" Cutty shows; written by cutlist.html, read by labels.html
    "Skilaboð til skipulags", // grain.html: /saga flags a problematic grain front → note back to the planners (rolls up to Tækifæri)
    "Þarf æðasamfellu", // grain.html writes this per front row — audit/visibility only, see WRITABLE_FIELDS comment below
    "Tegund einingu",
    "Yfirfr.",
    "Fræst",
    "Magn fræst",
    "V hlið magn fræst", // per-side partial done tracking for a V/H hlið pair sharing one row (M=2×unit count)
    "H hlið magn fræst",
    "Eyðublað ✏️", // used by fraesing.html to group parts by unit
    // Edge banding per edge (type + material) and the arrow summary — shown in
    // /verk's Sögunarlisti section.
    "KL🔄", "Kant F_h", "Kant B_h", "Kant V_h", "Kant H_h",
    "Kant F_h efni", "Kant B_h efni", "Kant V_h efni", "Kant H_h efni",
  ],
  "tbl0WcyHhz63pSzZX": [ // Eyðublað ✏️ — read-only, used by fraesing.html to render one card per unit
    "Athugasemd", // primary field — the unit's own short name (e.g. "SK 20")
    "Yfirfarin", // ferli.html (2026-10-18): visual cue in the unit list once Yfirfara 3.0 has run
    "Tækifæri 📣 (projects)",
    "Tækifæri 📣", // old project-link field — some units are only linked via this one
    "Hvað viltu smíða?",
    "Athugasemd til fræsara 🔬",
    "Skápategund", // used by fraesing.html to flag Lagnaskápur units
    "Sérsmíði tegund",
    "Frontur / Hlið tegund",
    "Skúffutegund",
    "LED magn",
    "Opnun [Hurð]", // fraesing.html: door swing direction, shown next to Karmur - lamir/slúttjárn
    "N", "M", "K", "C", "F", "E", "IN", "IM", "IK", "IC", "IF", "IE",
    // ── kitchen-planner.html write-back ──
    "Heiti rýmis", "Breidd", "Hæð", "Dýpt", "Fjöldi eininga", "Grip?",
    "Skilaboð til Skipulags 📝", // plain-language "customer wants N drawers, not shelves" note
    "Höldur 1", "Höldur 1 magn", // set instead of Grip? when a real Vörulisti handle is chosen
    "Grip mm (Höldur 1)", // /cnc (2026-10-13): lookup through Höldur 1 → Vörulisti's own "Grip mm"
    "Hæð ofns", "Töfrahorn útfærsla", "Breidd á töfra front", // Ofnaskápur / Töfrahorn cabinet types
  ],
  // Tengiliðir 👤 was deliberately NOT readable at all here (2026-10-01): listed with names, emails and
  // phone numbers, anyone could GET the whole customer contact list through this open proxy. Reopened
  // 2026-10-18, narrowly, for /crm's staff "+ Nýtt verkefni" contact search — base set stays empty (public
  // reads see nothing), real fields live behind VERK_KEY in VERK_ONLY_FIELDS below, and the table is in
  // REQUIRE_FILTER so a caller can search for a name/e-mail/phone but can never dump the whole table (same
  // shape as the Starfsmenn PIN lookup). kp-submit.js's own contact CREATE still bypasses this proxy
  // entirely (direct Airtable call, its own token) — unaffected by this.
  "tblQ8zeUanriESWvL": [], // Tengiliðir 👤
  // Fyrirtæki 🏢 (companies — also the Birgjar/supplier table Vörulisti and Efnislisti link through,
  // and the source of "Netfang birgis 🔍" on Pantaðir listar's supplier-email automation). Same reasoning
  // as Tengiliðir: base set empty, real fields behind VERK_KEY in VERK_ONLY_FIELDS, REQUIRE_FILTER'd so
  // the whole company/supplier list can never be dumped in one request.
  "tbl2akoCETBx9S1SK": [], // Fyrirtæki 🏢
  "tblzuuRSRkeXaLWxC": [ // Vörulisti 🚪 — resolves hardware-link names for /eining (name only, no cost)
    "Heiti vöru 📣",
    // /cnc (cnc-doors.js, 2026-10-13): macro names for hinge/lock/threshold products not already hardcoded
    // in HINGES/LOCKS/THRESHOLDS — filled in by hand only after reading the real master off the stick.
    "CNC macró — blað", "CNC macró — karmur",
  ],
  "tbl8HjvBwNJ41cTV0": [ // Útfærslur 🎨 — search source for /crm's Vörulínur V1/V2/V3 picker (name/category only)
    "Lýsing á útfærslu",
    "Vörunúmer",
    "Flokkur",
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
  "tbl7K8v94Pf6Ausk3": [ // Skipulag villur 🐞 — kitchen-planner.html's error reporter (both
    // window.onerror auto-catches and the manual "Tilkynna vandamál" button).
    // Write-only, same reasoning as Vefspjall above — someone reviews in Airtable.
    "Titill",
    "Tími",
    "Tegund",
    "Skref",
    "Villuboð",
    "Ástand (JSON)",
    "Vafri",
    "Slóð",
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
    // "PIN 🔢" deliberately NOT returned (2026-10-01): with a match-all filter anyone could list every
    // employee's PIN. Clients only filter BY it (STRICT_FILTERS below), they never read it back.
    "Er starfandi? ✅",
    "Kyn",
    "Starfsheiti 💼", // drives which project list the clock-out allocation screen shows
    "Tegund starfsmanns 🧑‍💻",
    "Auka orlofsdagar 🌴", // shown on /app's Mín síða → Mínar stundir, same as stimpilklukka.html's hours screen
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
  // Vörur per eining 📦 — purely internal per-unit product review data, no public
  // use case, so the base set is empty and every field lives behind VERK_KEY
  // (see VERK_ONLY_FIELDS below) rather than the usual "baseline + more" split.
  "tblszHaBrwhYNV68z": [],
  // tblDwYfZWPmgGpjio (Vélar 🏭) folded into Vélaleiðbeiningar below
  // (2026-10-20) — "Vél" there is now a singleSelect instead of a link to a
  // separate one-row-per-machine table, so /velar reads one table, not two.
  // The old table itself is unreferenced but still exists — pending user
  // deletion in the Airtable UI (table deletion needs their approval).
  "tblGkKOmIIlBgOhh3": [ // Vélaleiðbeiningar 📋 — read-only how-to items for /velar
    "Titill (spurning)",
    "Vél",
    "Flokkur",
    "Svar",
    "Myndband",
    "Myndir 🖼️",
    "Röð",
    "Falið",
  ],
  // /pontun (Pöntunarlisti area, 2026-10-17) — order lines, grouped per-supplier
  // orders, and the supplementary "forgotten items" list. All three were
  // completely unreachable through this proxy before; internal-only (cost data),
  // so the base set is empty and every field lives behind VERK_KEY instead
  // (see VERK_ONLY_FIELDS below), same pattern as Vörur per eining.
  "tbloXR7f9Q943O9el": [], // Pöntunarlisti 📋 (order lines)
  "tblSccfV2lBp4FiFU": [], // Pantaðir listar (per-supplier orders)
  "tblHGYgrvvDqyKOAe": [], // Auka-Pöntunarlisti 💻
  "tblPPMTlFhW0snk24": [], // Virkni 🔔 (activity feed, /skrifstofa dashboard)
  "tblhP1FMM4QJfwxat": [], // Fjárhagsstaða 📊 (cash position — internal, VERK_ONLY_FIELDS below)
  "tblFcsUoGxsuUwNEH": [], // Vöru línur ➖📦 (Line item's) — pricing-sensitive, VERK_ONLY_FIELDS below
  "tblR1TpicLRVTXHql": [], // ⚙️ Eyðublaðs ÚRVINNSLA ⚙️ — part templates, /bakendi (admin-only), VERK_ONLY_FIELDS below
  // /laun (2026-10-19, eigandi-only) — payroll review: Stimplanir detail (base set already
  // public for the kiosk; widened below), plus two tables never exposed before. Both entirely
  // internal (pay figures, vacation balances), so empty base set, VERK_ONLY_FIELDS below.
  "tblSQ0FfGQeBttaH2": [], // Launatímabil 🧾 (pay period summary, per employee)
  "tbljdg6uxEfHE7uCU": [], // Orlofsbeiðnir (vacation requests)
};

// Extra Tækifæri fields the internal floor page (/verk, verk.html) needs —
// drawings, the "þarf að hafa í huga" notes, meeting notes, progress. These
// are deliberately NOT in ALLOWED_FIELDS: the customer portal and every other
// caller hits the same public endpoint, and these are internal. They're
// merged in only when the request carries ?k= matching VERK_KEY (the key the
// shop printer bakes into the QR on each Zebra label).
const VERK_ONLY_FIELDS = {
  "tblPPMTlFhW0snk24": [ // Virkni 🔔 — activity feed, /skrifstofa dashboard. Same internal/VERK_KEY
    // pattern as Pöntunarlisti/ÚRVINNSLA (ALLOWED_FIELDS stays [] above) — this entry was simply
    // missing, so automations had been writing real records since 2026-10-19 but every GET came back
    // with `fields: {}`. Matches CREATABLE_FIELDS below exactly so writes and reads agree.
    "Texti", "Tækifæri", "Flokkur", "Tími",
  ],
  "tbl4LMXlQjp66RFKI": [
    // customer contact details for Rakel's kitchen-planner review page (kitchen-planner-review.html)
    "Fullt nafn 👤",
    "Netfang 📧",
    "☎️ Símanúmer",
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
    // /skipulag (Loka yfirferð gátlista, 2026-10-17) — the 5 existing checklist
    // checkboxes plus the new "6. CNC yfirfarið" (created for this), and the
    // "stemmir" % so the page can show it instead of re-deriving it.
    "1. Dagssetningar ákveðnar",
    "2. Cutty keyrður fyrir þetta verkefni og kominn á USB?",
    "3. Teikningar prentaðar 2x",
    "4. Verkfundur tekinn",
    "5. Efni lent í húsi",
    "6. CNC yfirfarið",
    "Framvinda Pöntunarlista stemmir🔒 skipulag 2.0📝",
    "🔄 Keyra Skipulag", // PRO mode's "Keyra skipulag" button
    // PRO mode's "Tilboð" panel — read-only computed total + the 4 editable
    // pricing fields (also listed in WRITABLE_FIELDS above).
    "💰 Tilboðsupphæð", "Ósýnilegur afsláttur %", "Afsláttur í uppsetningu",
    "Smáverka álagning", "Smáverka álagning [uppsetning]",
    // /crm (2026-10-17) — pipeline/follow-up fields, all pre-existing.
    "Næsta skref", "Næsta skref dags.", "Verk ósnert dagar 📅",
    "Eftirfylgnisstaða❓", "Svar við eftirfylgni", "Tilboð sent þann",
    // /crm deal ownership (2026-10-18).
    "Sölumaður 🧑‍💼",
    // /crm KPI row (2026-10-17) — monthly sales + transfers tiles.
    "Verk staðfest þann", "Ár staðfestingar", "Mánuður staðfestingar",
    "Staðfestingargjald", "Eftirstöðvar (kr) 💰", "Staðfest tilboðsupphæð 🔒",
    "Greiðsla 2 greidd þann", "Greiðsla 3 greidd þann",
    // /crm Vörulínur editor (2026-10-17) — "Efni verkefnis"/"Aukahlutir" project-
    // level material/handle pickers, same fields "Nýtt verkefni" shows in Airtable.
    // The lookup-derived *names* of these were already public (customer portal);
    // the actual link fields themselves are internal, hence VERK_ONLY here.
    "Skrokka efni 🔲 viðskiptavinar", "Fronta efni viðskiptavinar 🖼️",
    "Fronta efni 2.0 Viðskiptavinar 🖼️", "Borðplata viðskiptavinar 🍽️",
    "Hurðaefni viðskiptavinar 🚪", "Hurðaefni viðskiptavinar 🚪 2.0",
    "Höldur Viðskiptavinar ✊", "Höldur Viðskiptavinar ✊2.0",
    "Litur á höldum 🎨", "Litur á höldum 2.0 🎨", "Innskúffufrontar [Handvalið]",
    "Loka teikningar verkefnis 📋",
    "Sér fræsi teikningar",
    "Málsettar myndir af rými 🖼️",
    "Teikningar af tækifæri ✍️",
    // skrifstofa.html's job popup (2026-10-18) — contact info + the self-serve planner's
    // own generated drawings PDF, neither previously readable through this proxy.
    "Tengiliður verkefnis 👤",
    "Teikningar úr skipuleggjara 📐",
    // ferli.html's "Loka skipulag" Dagatal section (2026-10-18) — the date fields the user's own
    // screenshot showed were missing: start date, planned delivery, and the two workday counts
    // (one typed, one the real tilboðsblað formula) side by side so a mismatch is obvious.
    "Áætlaðir dagar í vinnudögum Björninn (internal)",
    "Áætlaðir Dagar í vinnu (samkvæmt tilboðsblaði)",
    "Heimilistæki verkefnis",
    "Framvinda sögunar",
    "Fjöldi hluta til að fræsa 🔬", // /verk Framvinda: Fræsing row (rows marked Yfirfr.)
    "Fjöldi hluta fræstir 🔬",      // …and of those, ticked Fræst
    "Fjöldi varahluta til að saga",
    "Fjöldi varahluta sagaðir",
    "Staða á efnispöntun",
    // /verk "Smíðaupplýsingar" (replaces Airtable's Verkstæði 2.0 page)
    "Kantlíming skrokka",
    "Tegund fronta 1",
    "Tegund fronta 2",
    "Litur á skúffum [Handvalið]",
    "Samsetningarlisti [flatp. eða rastex]",
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
    // /hurdir (hurdir.html) — door programs for the CNC: jamb + leaf numbers and which project a door belongs to
    "Þykkt karms [Hurð]", "Karmabil frá vegg [Hurð]", "Toppstykki hurðakarms", "Athugasemd + Tækifæri (fyrir yfirfara)",
    "Smíðagögn (JSON) 🔧", // /cnc: positions from the designer's pro mode (hinges, door type …)
    "Sérhæð N fronts", "Sérhæð M fronts", "Sérhæð K fronts",
    "Sérhæð C fronts", "Sérhæð F fronts", "Sérhæð E fronts",
    "Tvípress / Eurolight", "Sérsmíði tegund", "Sérsmíði efni",
    // /yfirferd (Skipulag review wizard, 2026-10-17) — mismatch pre-checks shown
    // at the top of the wizard, computed by Airtable so the review tool never
    // has to re-derive this logic itself.
    "Skúffur stemma ekki ⚠️", "Vantar hluta ⚠️",
  ],
  // QUICK FIX❗ — the planner's own drawings + work description, shown in /app's
  // Quick Fix detail. Internal, so behind the same VERK_KEY gate.
  "tblDQWuf4OSjUv2XI": ["Loka teikningar f. QUICK FIX❗", "Verklýsing skipuleggjara", "Mynd eða skjal"],
  // /yfirferd (Skipulag review wizard) — this unit's own product/quantity rows
  // (drawers' depth overrides, handles, glass/mirror lines), one per product,
  // never aggregated across units (see CLAUDE.md: "Vörur á einingu replaced
  // Pöntunarlisti's abandoned per-unit review attempt").
  "tblszHaBrwhYNV68z": [
    "Tegund", "Vörulisti 🚪", "Eyðublað ✏️", "Magn", "Mynd 🖼️", "Rétt",
    "Skúffu dýpt",
    "Hvað viltu panta?", "Hvert fer það?", "Þykkt", "Breidd (mm)", "Hæð (mm)",
    "Kantvinnsla", "Hert gler", "Göt / úrtök / athugasemd", "⛔ Villa",
  ],
  // /pontun (Pöntunarlisti area, 2026-10-17)
  "tbloXR7f9Q943O9el": [ // Pöntunarlisti 📋 — order lines
    "Pönt.NR", "Tækifæri 📣", "Verkheiti", "Vörulisti 🚪", "Efnislisti 🧱",
    "Vörulisti txt", "Gerð", "Athugasemd", "Magn", "Mynd af vöru", "Mynd af efni",
    "Litur", "Birgir 👴", "Stemmir 🔒 Skipulag 2.0📝", "Pantaðir listar",
    "Einingaverð 🔍", "Áætlaður kostnaður", "Breidd (mm)", "Hæð (mm)",
  ],
  "tblSccfV2lBp4FiFU": [ // Pantaðir listar — one record per (project, supplier)
    "Stöðu kenni", "Staða", "Afhending óskuð", "Sent dags.", "Raunkostnaður",
    "Tækifæri 📣", "Birgir", "Pöntunarlistar PDF", "Netfang birgis 🔍",
    "Pöntunarlisti 📋", "Áætlaður kostnaður", "Gler & speglar 🪟",
    "📧 Senda á birgja",
  ],
  "tblHGYgrvvDqyKOAe": [ // Auka-Pöntunarlisti 💻 — forgotten-item supplementary orders
    "Name", "Tækifæri 📣 (projects)", "Pöntunarlisti 📋",
    "Áætlaður kostnaður Rollup (from Pöntunarlisti 📋)", "Auka pöntunarlisti PDF",
  ],
  // /bakendi (2026-10-19) — admin-only page, read-only for now. Part-template
  // formula table: every "Partur" (saw part) row's own H/B/Þ/qty formulas,
  // which Tegund einingu it applies to, grain/edgeband settings.
  "tblR1TpicLRVTXHql": [
    "Partur", "Tegund", "Efnisflokkur", "Magn formúla", "Hæð formúla",
    "Breidd formúla", "Þykkt formúla", "Kantlíming", "Skúffukerfi",
    "Yfirfræsari", "Athugasemd", "Glósur", "Glósur 📝",
  ],
  // /laun (2026-10-19) — Stimplanir's display-formula fields (Dagur/Inn kl./Út kl./Vikudagur
  // are just formatted views of the already-public Inn/Út, no new data) plus the period filter.
  "tblnFIO8RB6HcelXF": ["Dagur", "Inn kl.", "Út kl.", "Vikudagur", "Tímabil 🗓️"],
  "tblSQ0FfGQeBttaH2": [ // Launatímabil 🧾
    "Nafn", "Starfsmaður", "Tímabil 🗓️", "Tímabil frá", "Tímabil til", "Læst",
    "Dagvinna alls (klst)", "Greiddar klst", "Heildarlaun f. skatt", "Orlofsinneign (kr)",
    "Veikindadagar", "Veikindadagar greitt", "Orlofsdagar teknir", "Aðrar fjarvistir (dagar)",
    "Greiddir frídagar", "Athugasemd",
  ],
  "tbljdg6uxEfHE7uCU": [ // Orlofsbeiðnir
    "Frá", "Til", "Starfsmaður", "Staða", "Dagar (virkir)",
    "Orlofsdagar eftir (staða)", "Athugasemd", "Skráð",
  ],
  // /crm KPI row (2026-10-17) — "Sölumarkmið mánaðarins" tile. One row per
  // financial snapshot date; only the computed target + its own date are
  // needed (cash position / overdraft fields stay unexposed — not this
  // page's business, and genuinely sensitive).
  "tblhP1FMM4QJfwxat": [ // Fjárhagsstaða 📊
    "Dagsetning", "Sölumarkmið (Fastur kostnaður x2)",
  ],
  // /crm contacts (2026-10-18) — widened from the original "+ Nýtt verkefni" name/e-mail/phone-only set
  // to the full contact record for the new Tengiliðir+Fyrirtæki page: person detail, company link,
  // category/source selects, free-text notes, and the self-serve pending flag. REQUIRE_FILTER + the
  // STRICT_FILTERS entry below mean this can only ever be searched (or opened by a known record id),
  // never listed wholesale.
  "tblQ8zeUanriESWvL": [
    "Fornafn ⬅️", "Milli nafn ↔️", "Eftirnafn ➡️", "Fullt nafn 👤",
    "Kennitala 👤#️⃣", "Heimilisfang 🏡", "Netfang 📧", "Símanúmer ☎️",
    "Fyrirtæki🏢", "Tegund tengiliðs 👥", "Staða innan fyrirtækis",
    "Hvaðan kom viðskiptavinurinn 📥", "Glósur um viðskiptavin",
    "Tengiliðs-ID 🔢", "Óyfirfarið — Rakel ⚠️",
  ],
  // /crm contacts (2026-10-18) — Fyrirtæki (companies, also the Birgjar/supplier table). Same shape as
  // Tengiliðir above: full record behind VERK_KEY, REQUIRE_FILTER'd search only.
  "tbl2akoCETBx9S1SK": [
    "Nafn fyrirtækis", "Heimasíða", "Kennitala #️⃣", "Netfang 📧", "Símanr. ☎️",
    "Heimilisfang 🏡", "Tegund fyrirtækis", "Stærð fyrirtækis", "Áætluð árs-velta",
    "Greiðsluskilmálar", "áreiðanleiki", "Aðal tengiliður", "Aðrir tengiliðir innan fyrirtækis",
    "Tengiliðir 👤", "Fyrirtækja - ID", "Óyfirfarið — Rakel ⚠️",
  ],
  // /crm — assembling a new Útfærsla from existing Vörulisti parts (2026-10-18). The V1–V7 link
  // fields themselves are internal (production/pricing structure); "Lýsing á útfærslu"/"Vörunúmer"/
  // "Flokkur" stay public (ALLOWED_FIELDS above, already used by the Vörulínur picker).
  "tbl8HjvBwNJ41cTV0": [
    "Tengdar vörur 🚪V1 (alltaf setja Skrokka hér)",
    "Tengdar vörur 🚪V2 (alltaf setja Fronta eða gler HÉR)",
    "Tengdar vörur 🚪V3", "Tengdar vörur 🚪V4", "Tengdar vörur 🚪V5",
    "Tengdar vörur 🚪V6", "Tengdar vörur 🚪V7",
    "Óyfirfarið — Rakel ⚠️",
  ],
  // /crm — new material line (2026-10-18), descriptive fields only (no cost/time — those stay an
  // owner-only Airtable edit). "Heiti efnis"/dimensions/"Undirflokkur 🗂️"/"Mynd 🖼️" stay public
  // (ALLOWED_FIELDS above).
  "tbl8CrVWKF8CuI7HD": [
    "Efnisnúmer / kóði #️⃣", "Efnisflokkar 🗄️", "Spón/melamín", "Birgjar 👴🏼",
    "Pöntunareining", "Óyfirfarið — Rakel ⚠️",
  ],
  // /crm Vörulínur editor (2026-10-17) — "patch and review" only, never a
  // replacement for drawing in the designer (user, 2026-10-17): Rými and the
  // V1/V2/V3 product links plus Magn/Afsl. % are the only genuinely hand-
  // edited fields on this ~200-field pricing-engine table (confirmed against
  // the live "Nýtt verkefni" Airtable interface, not guessed) — everything
  // else here is read-only context (resolved product/útfærsla/aukahlutir
  // names, computed prices, the Skipulagsvilla warning, and the lock/viðbót
  // state so the editor can block edits to confirmed lines and let a new
  // post-staðfest row flow into the existing "🆕 Viðbót" machinery untouched).
  "tblFcsUoGxsuUwNEH": [
    "Tækifæri 📣 (projects)", "Rými 🏡", "Vöru reitur 1", "Vöru reitur 2", "Vöru reitur 3",
    "Vara 🚪", "útfærsla 🎨", "Aukahlutir 🧩", "Magn", "Afsl. %",
    "Einingarverð", "Endanlegt söluverð 💲", "⚠️ Skipulagsvilla",
    "Læstur verðlykill 🔒", "Breyting eftir staðfestingu", "Viðbót (kr)",
    // PRO Yfirferð (2026-10-26): did Keyra skipulag finish? It stamps "Síðast samstillt timestamp" (unix s) on every
    // line it created/synced an Eyðublað for, last of all — read-only here, polled by kitchen-planner.html.
    "🔑", "Eyðublað búið til ✏️", "⚠️ Breytt eftir stofnun", "Síðast samstillt timestamp",
  ],
};

// Tables that hold credential-like, health-adjacent, or visitor-PII data — a
// request with no filterByFormula would otherwise dump every row's allowed
// fields, which for Starfsmenn means every employee's PIN at once, for
// Fjarvistir means every employee's sick-day history at once, and for
// Vefspjall means every site visitor's email + full conversation transcript
// at once. Require the caller to filter to a single lookup instead of
// listing the whole table.
const REQUIRE_FILTER = new Set(["tblhglpjQkczdG1AY", "tbl3e5o0Klv9RcNQ4", "tblzkw70E2xoX9RmK", "tbltD1UNpqj05WtMx", "tblQ8zeUanriESWvL", "tbl2akoCETBx9S1SK"]);
// "A filter is required" alone was not a guard: filterByFormula=TRUE() matched every row (2026-10-01 —
// employee PINs and customer contacts were listable). These tables only accept the exact query shape
// their own pages send.
const STRICT_FILTERS = {
  // stimpilklukka.html + app.html: one active employee by PIN
  // (a PIN of all zeros is refused: a blank PIN field equals 0 in an Airtable formula, so "0000" used to log in
  // as any active employee who had no PIN set)
  "tblhglpjQkczdG1AY": /^AND\(\{PIN 🔢\}=0*[1-9]\d{0,9},\{Er starfandi\? ✅\}=1\)$/,
  // stimpilklukka.html + app.html: always one employee by name first
  "tbl3e5o0Klv9RcNQ4": /^AND\(\{Starfsmaður\}="[^"]+",/,
  // /crm contacts search by name/e-mail/phone (2026-10-18, same shape "+ Nýtt verkefni" already sent —
  // REQUIRE_FILTER had been listing this table since 2026-10-18 with no matching STRICT_FILTERS entry,
  // so filterByFormula=TRUE() would have dumped every contact; closing that gap here, not just for the
  // new code path).
  "tblQ8zeUanriESWvL": /^OR\(SEARCH\(LOWER\("(?:[^"\\]|\\.)+"\),LOWER\(\{Fornafn ⬅️\}&" "&\{Eftirnafn ➡️\}\)\),SEARCH\(LOWER\("(?:[^"\\]|\\.)+"\),LOWER\(\{Netfang 📧\}\)\),SEARCH\("(?:[^"\\]|\\.)+",\{Símanúmer ☎️\}\)\)$/,
  // /crm contacts — Fyrirtæki search by name only (same generic shape openPicker already sends
  // everywhere else, parameterized to this one field).
  "tbl2akoCETBx9S1SK": /^SEARCH\(LOWER\("(?:[^"\\]|\\.)+"\),LOWER\(\{Nafn fyrirtækis\}\)\)$/,
  // Æðaplan has been in REQUIRE_FILTER since the table was introduced but never got a matching
  // STRICT_FILTERS entry — the same filterByFormula=TRUE() gap closed elsewhere on 2026-10-01/2026-10-18,
  // just not here (2026-10-23). grain.html/cutlist.html/ferli.html all query by project name via
  // FIND(...,ARRAYJOIN({Tækifæri 📣}))>0, and grain.html's picker annotation batches several of those
  // in one OR(...) — allow both shapes, nothing else.
  "tblzkw70E2xoX9RmK": /^(?:FIND\("(?:[^"\\]|\\.)+", ARRAYJOIN\(\{Tækifæri 📣\}\)\) > 0|OR\(FIND\("(?:[^"\\]|\\.)+", ARRAYJOIN\(\{Tækifæri 📣\}\)\) > 0(?:,FIND\("(?:[^"\\]|\\.)+", ARRAYJOIN\(\{Tækifæri 📣\}\)\) > 0)*\))$/,
};
// Tables where fetching a specific record by id is refused outright, even with a real,
// unguessable record id — PIN-filter / Fjarvistir's "Starfsmaður=X" shape is the only intended
// way to read either of these (2026-10-01 hardening), not merely "has a STRICT_FILTERS entry"
// (Tengiliðir/Fyrirtæki below need by-id reads for real — see the GET handler's comment).
const BLOCK_RECORD_ID = new Set(["tblhglpjQkczdG1AY", "tbl3e5o0Klv9RcNQ4"]);
// Logged by the site (chatbot, planner error reports) and reviewed in Airtable only — never read back.
const WRITE_ONLY = new Set(["tbltD1UNpqj05WtMx", "tbl7K8v94Pf6Ausk3"]);

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
  // Tengiliðir / Tækifæri / Line Items are NOT creatable here (2026-10-01): the kitchen planner submits
  // through api/kp-submit.js (one idempotent request, forced review fields, batched Line Items), and no
  // other page creates them — an open create path for them was only a spam vector.
  // /app's "❗ Nýtt QUICK FIX" quick-task form — see FORCED_CREATE_FIELDS
  // below for why "Staða" isn't in this list (anyone on the floor can report
  // a problem, but it always starts "opið", never self-set to in-progress).
  "tblDQWuf4OSjUv2XI": ["Nafn þitt", "Vandamálið", "Ábyrgðarmaður", "Tengt verkefni", "Skiladagur"],
  // kitchen-planner.html's error reporter — see FORCED_CREATE_FIELDS below for
  // why "Staða" isn't here (every report starts "Ný", reviewed in Airtable).
  "tbl7K8v94Pf6Ausk3": ["Titill", "Tími", "Tegund", "Skref", "Villuboð", "Ástand (JSON)", "Vafri", "Slóð"],
  // /crm Vörulínur editor's "+ Ný lína" — unlike the 2026-10-01 decision to
  // keep Line Items uncreatable (an open create path was "only a spam
  // vector" for a table with no caller back then), this one IS needed now —
  // gated behind VERK_KEY via CREATE_REQUIRES_KEY below instead of left
  // open, so the spam-vector concern doesn't apply here the way it did then.
  "tblFcsUoGxsuUwNEH": ["Tækifæri 📣 (projects)", "Rými 🏡", "Vöru reitur 1", "Vöru reitur 2", "Vöru reitur 3", "Magn", "Afsl. %"],
  // /crm contacts (2026-10-18) — new Tengiliðir/Fyrirtæki, VERK_KEY-gated the same way Line Items is
  // (CREATE_REQUIRES_KEY below). The pending flag ("Óyfirfarið — Rakel ⚠️") is never in this list — it's
  // always forced true server-side (FORCED_CREATE_FIELDS), same self-approval-proofing pattern as every
  // other "Staða"/review flag in this file.
  "tblQ8zeUanriESWvL": [
    "Fornafn ⬅️", "Milli nafn ↔️", "Eftirnafn ➡️", "Kennitala 👤#️⃣", "Heimilisfang 🏡",
    "Netfang 📧", "Símanúmer ☎️", "Fyrirtæki🏢", "Tegund tengiliðs 👥",
    "Staða innan fyrirtækis", "Hvaðan kom viðskiptavinurinn 📥", "Glósur um viðskiptavin",
  ],
  "tbl2akoCETBx9S1SK": [
    "Nafn fyrirtækis", "Heimasíða", "Kennitala #️⃣", "Netfang 📧", "Símanr. ☎️",
    "Heimilisfang 🏡", "Tegund fyrirtækis", "Stærð fyrirtækis", "Áætluð árs-velta",
    "Greiðsluskilmálar",
  ],
  // /crm — assemble a new Útfærsla from existing Vörulisti parts only (2026-10-18, scoped: no brand-new
  // Vörulisti rows from this flow, and never the "Skipulag →" planner-integration fields — this stays
  // CRM/quoting-only and never surfaces in the self-serve kitchen planner).
  "tbl8HjvBwNJ41cTV0": [
    "Lýsing á útfærslu", "Vörunúmer", "Flokkur",
    "Tengdar vörur 🚪V1 (alltaf setja Skrokka hér)",
    "Tengdar vörur 🚪V2 (alltaf setja Fronta eða gler HÉR)",
    "Tengdar vörur 🚪V3", "Tengdar vörur 🚪V4", "Tengdar vörur 🚪V5",
    "Tengdar vörur 🚪V6", "Tengdar vörur 🚪V7",
  ],
  // /crm — new material line (2026-10-18), descriptive fields only. "🚨INNKAUPAVERÐ🚨" and the six
  // production-time-minutes fields are deliberately never in this list — those feed every downstream
  // sale price and stay an owner-only edit directly in Airtable until the line is reviewed.
  "tbl8CrVWKF8CuI7HD": [
    "Heiti efnis", "Efnisnúmer / kóði #️⃣", "Efnisflokkar 🗄️", "Undirflokkur 🗂️",
    "Spón/melamín", "Breidd (mm)", "Lengd (mm)", "Þykkt (mm)", "Birgjar 👴🏼", "Pöntunareining",
  ],
};

// Tables where POST (create) additionally requires ?k=VERK_KEY, the same
// gate GET's VERK_ONLY_FIELDS uses — unlike every other writable table here,
// CREATE is a flooding/spam vector (anyone who finds the table id could
// otherwise mint unlimited rows), not just a scoped edit to a record whose
// id you'd already need to know, so it gets the stricter gate.
const CREATE_REQUIRES_KEY = new Set(["tblFcsUoGxsuUwNEH", "tblQ8zeUanriESWvL", "tbl2akoCETBx9S1SK", "tbl8HjvBwNJ41cTV0", "tbl8CrVWKF8CuI7HD"]);
// Tables where PATCH (edit an existing record) additionally requires ?k=VERK_KEY. Every pre-existing
// WRITABLE_FIELDS table relies on the field allowlist alone as its boundary (the record id itself is
// the secret), but these four now carry PII (Tengiliðir/Fyrirtæki: kennitala, address, phone) or
// pricing-adjacent structure (Útfærslur/Efnislisti) that didn't exist behind this proxy before — new
// write surface gets the stricter gate from the start rather than relying on record-id obscurity.
// tbl4LMXlQjp66RFKI (Tækifæri — projects) deliberately NOT added here yet, 2026-10-23 — see
// project_security_audit_findings.md finding #2 and the same day's follow-up note: a table-wide gate
// would also 403 dagatal.html's legitimate, currently-keyless PATCH of 3 date fields (floor calendar
// drag-to-reschedule, linked from app.html with no VERK_KEY anywhere in that page). The real exploit is
// 3 specific fields (discount/review-flag/pipeline-stage), not the whole table — needs either field-
// level PATCH gating (new mechanism) or giving the floor app a key (worsens finding #1's key-sprawl
// problem). Flagged back to the user rather than shipped either way unilaterally.
const PATCH_REQUIRES_KEY = new Set(["tblQ8zeUanriESWvL", "tbl2akoCETBx9S1SK", "tbl8HjvBwNJ41cTV0", "tbl8CrVWKF8CuI7HD", "tbljdg6uxEfHE7uCU"]);

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
  "tbl7K8v94Pf6Ausk3": { "Staða": "Ný" },
  // /crm contacts + Útfærsla/material-line self-serve creates (2026-10-18) — every row Rakel creates
  // through these four starts flagged for an owner to check in Airtable, same pattern as everywhere
  // else in this file; cleared by hand there, no in-app review screen.
  "tblQ8zeUanriESWvL": { "Óyfirfarið — Rakel ⚠️": true },
  "tbl2akoCETBx9S1SK": { "Óyfirfarið — Rakel ⚠️": true },
  "tbl8HjvBwNJ41cTV0": { "Óyfirfarið — Rakel ⚠️": true },
  "tbl8CrVWKF8CuI7HD": { "Óyfirfarið — Rakel ⚠️": true },
  // (Tækifæri's forced self-serve fields live in api/kp-submit.js now.)
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
  // "Þarf æðasamfellu" (grain.html writes this per front row so the office
  // can see in Airtable which pieces need /aedar's manual sequencing vs are
  // solo — see front-classify.js's needsAedar()). Purely an audit/visibility
  // field: neither grain.html nor cutlist.html reads it back to decide
  // anything, both recompute the classification fresh every time, so a
  // stale value here can never cause a wrong cut.
  "tblhdgyvTcBfP8kov": ["H", "B", "Þ", "Villa?", "Athugasemd", "B.A.S.", "Skurðarskrá", "Skurðarnúmer", "Fræst", "Magn fræst", "V hlið magn fræst", "H hlið magn fræst", "Skilaboð til skipulags", "Þarf æðasamfellu", "Tilbúið 🔒"],
  // ferli.html's Yfirfara einingu popup (2026-10-18) — Vörur á einingu has no "Tilbúið 🔒" field
  // of its own; "Rétt" (already public via VERK_ONLY_FIELDS above) is the existing checkbox that
  // plays the same "this row is confirmed ready" role here, so that's what the per-row checkbox
  // on this table's tab is bound to.
  "tblszHaBrwhYNV68z": ["Rétt"],
  // /yfirferd's "samþykkja" action — the ONLY writable field on Eyðublað, on
  // purpose: flips a dedicated checkbox false→true to retrigger "Yfirfara 3.0"
  // (the Interface button it used to require has no API equivalent — see
  // memory: project_vercel_migration). Never touches any other Eyðublað field.
  "tbl0WcyHhz63pSzZX": ["🔄 Keyra Yfirferð 3.0"],
  // /pontun — the ONLY writable fields on Pantaðir listar: the action
  // checkbox (retriggers BIRGJA) and Staða, for a manual status correction
  // (e.g. marking "Komið í hús" once material physically arrives — nothing
  // automates that step).
  "tblSccfV2lBp4FiFU": ["📧 Senda á birgja", "Staða"],
  // /laun (2026-10-19) — approve/reject a vacation request. The ONLY writable field:
  // "Fjarvistir búnar til" is an automation-owned flag (creates the real Fjarvistir
  // row once approved), never set by this proxy.
  "tbljdg6uxEfHE7uCU": ["Staða"],
  // Closes an open shift (stimpilklukka's ÚT button). "Inn" is intentionally
  // not writable here — a shift's start time is only ever set at creation.
  "tblnFIO8RB6HcelXF": ["Út"],
  // /aedar re-saves the working layout and flips the confirm checkbox on the
  // existing plan row. Tækifæri/Efni are set once at create, never patched.
  "tblzkw70E2xoX9RmK": ["Nafn", "Skipulag", "Staðfest ✅"],
  // kitchen-planner-review.html: Rakel's "✅ Yfirfarið" button unchecks the
  // review flag (that's the approval action — no separate status field).
  "tbl4LMXlQjp66RFKI": ["Sjálfsafgreiðsla — óyfirfarið ⚠️", "Upphafs framleiðsludagur verks", "Áætlaður afhendingardagur Björninn (internal)", "Áætlaðir dagar í vinnudögum Björninn (internal)", "Viðskiptavinur sækir þann:", "🔄 Keyra Pöntunarlista 4.0",
    // /skipulag's Loka yfirferð checklist + final "Klárt til framleiðslu" gate.
    "1. Dagssetningar ákveðnar", "2. Cutty keyrður fyrir þetta verkefni og kominn á USB?",
    "3. Teikningar prentaðar 2x", "4. Verkfundur tekinn", "5. Efni lent í húsi", "6. CNC yfirfarið",
    "Staða í skipulagi",
    // PRO mode's "Keyra skipulag" button (Forskipulag area).
    "🔄 Keyra Skipulag",
    // PRO mode's "Tilboð" panel (Tilboðsblað area, 2026-10-17) — the pricing
    // fields Rakel/the owner edit by hand in Airtable today; surfacing them
    // here is the actual scope (per the user: "þetta eru allt bara fields í
    // line item eða tækifæri sem þú getur séð og sett á tilboðsblað
    // interfacið"), not new pricing logic — Airtable's own formulas (💰
    // Tilboðsupphæð) do the math exactly as they do today.
    "Ósýnilegur afsláttur %", "Afsláttur í uppsetningu",
    "Smáverka álagning", "Smáverka álagning [uppsetning]",
    // /crm — moving a card between pipeline stages, and editing the
    // follow-up next-step. Same fields Rakel already edits in Airtable;
    // existing automations (F1 emails, Konto drafts, price locks) react to
    // "Staða í söluferli" exactly as they do today, nothing new triggered.
    "Staða í söluferli", "Næsta skref", "Næsta skref dags.",
    // /crm deal ownership + pipeline reporting (2026-10-18) — new field,
    // created for this, distinct from the pre-existing "Ábyrgðaraðili
    // yfirferðar" (review-specific).
    "Sölumaður 🧑‍💼",
    // /crm Vörulínur editor (2026-10-17) — "Efni verkefnis"/"Aukahlutir" pickers.
    "Skrokka efni 🔲 viðskiptavinar", "Fronta efni viðskiptavinar 🖼️",
    "Fronta efni 2.0 Viðskiptavinar 🖼️", "Borðplata viðskiptavinar 🍽️",
    "Hurðaefni viðskiptavinar 🚪", "Hurðaefni viðskiptavinar 🚪 2.0",
    "Höldur Viðskiptavinar ✊", "Höldur Viðskiptavinar ✊2.0",
    "Litur á höldum 🎨", "Litur á höldum 2.0 🎨", "Innskúffufrontar [Handvalið]",
    "Kantlíming skrokka", "Litur á skúffum [Handvalið]",
  ],
  // /skrifstofa's activity feed — read-only, nothing writes here except the
  // 3 new Virkni automations.
  "tblPPMTlFhW0snk24": ["Texti", "Tækifæri", "Flokkur", "Tími"],
  // /app's recent-QUICK-FIX list lets anyone tap a card to advance
  // opið → Í vinnslu → Lokið — unlike Fjarvistir's vacation-request "Staða"
  // this isn't an approval gate, so any floor device may set it.
  "tblDQWuf4OSjUv2XI": ["Staða", "Skiladagur"],
  // /crm Vörulínur editor — only the same fields a person actually edits
  // (see VERK_ONLY_FIELDS comment above). The editor itself refuses to send
  // a PATCH for a line whose "Læstur verðlykill 🔒" is already set (confirmed
  // project), but that's a client-side courtesy, not the security boundary —
  // same as every other write in this proxy, the boundary is the field
  // allowlist, not who's asking.
  "tblFcsUoGxsuUwNEH": ["Rými 🏡", "Vöru reitur 1", "Vöru reitur 2", "Vöru reitur 3", "Magn", "Afsl. %"],
  // /crm contacts + Útfærsla/material-line edits (2026-10-18) — editing an EXISTING record takes effect
  // immediately (unlike create, there's no pending flag here to re-set): fixing a supplier's e-mail on
  // an already-linked Fyrirtæki row, for example, shouldn't need an owner's sign-off before it's live.
  // Same field sets as CREATABLE_FIELDS above, minus nothing — PATCH_REQUIRES_KEY is the gate.
  "tblQ8zeUanriESWvL": [
    "Fornafn ⬅️", "Milli nafn ↔️", "Eftirnafn ➡️", "Kennitala 👤#️⃣", "Heimilisfang 🏡",
    "Netfang 📧", "Símanúmer ☎️", "Fyrirtæki🏢", "Tegund tengiliðs 👥",
    "Staða innan fyrirtækis", "Hvaðan kom viðskiptavinurinn 📥", "Glósur um viðskiptavin",
  ],
  "tbl2akoCETBx9S1SK": [
    "Nafn fyrirtækis", "Heimasíða", "Kennitala #️⃣", "Netfang 📧", "Símanr. ☎️",
    "Heimilisfang 🏡", "Tegund fyrirtækis", "Stærð fyrirtækis", "Áætluð árs-velta",
    "Greiðsluskilmálar",
  ],
  "tbl8HjvBwNJ41cTV0": [
    "Lýsing á útfærslu", "Vörunúmer", "Flokkur",
    "Tengdar vörur 🚪V1 (alltaf setja Skrokka hér)",
    "Tengdar vörur 🚪V2 (alltaf setja Fronta eða gler HÉR)",
    "Tengdar vörur 🚪V3", "Tengdar vörur 🚪V4", "Tengdar vörur 🚪V5",
    "Tengdar vörur 🚪V6", "Tengdar vörur 🚪V7",
  ],
  "tbl8CrVWKF8CuI7HD": [
    "Heiti efnis", "Efnisnúmer / kóði #️⃣", "Efnisflokkar 🗄️", "Undirflokkur 🗂️",
    "Spón/melamín", "Breidd (mm)", "Lengd (mm)", "Þykkt (mm)", "Birgjar 👴🏼", "Pöntunareining",
  ],
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

// A field deleted in Airtable but left behind in ALLOWED_FIELDS used to 422
// EVERY read of that table (not just the caller that wanted the dead field),
// since the list endpoint's fields[] param validates field names and the
// record-GET path above is routed through it. Self-heal instead: on
// UNKNOWN_FIELD_NAME, drop just that field and retry, so a stale allowlist
// entry degrades (silently missing one field, logged) rather than bricking
// the whole table. Bounded by fields.length so it can't loop forever, and
// never retries down to zero fields[] — that would ask Airtable for an
// unfiltered record, which is exactly what the allowlist exists to prevent.
async function fetchAirtableFiltered(url, allowedFields, token) {
  let fields = allowedFields;
  for (let attempt = 0; attempt <= allowedFields.length; attempt++) {
    const u = new URL(url.toString());
    u.searchParams.delete("fields[]");
    fields.forEach((f) => u.searchParams.append("fields[]", f));
    const airtableRes = await fetch(airtableUrl(u), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await airtableRes.json();
    if (airtableRes.ok) return { airtableRes, data, fields };

    const badField = data?.error?.type === "UNKNOWN_FIELD_NAME"
      ? (data.error.message.match(/Unknown field name: "(.+)"/) || [])[1]
      : null;
    if (!badField || !fields.includes(badField) || fields.length <= 1) {
      return { airtableRes, data, fields };
    }
    console.warn(`[api/airtable] dropping unknown field "${badField}" from ${u.pathname} — remove it from ALLOWED_FIELDS in api/airtable.js`);
    fields = fields.filter((f) => f !== badField);
  }
}

// Every field name this proxy reads or writes, per table — api/field-check.js verifies them against the live
// base each morning (a field renamed in Airtable otherwise just goes missing: reads drop it silently, writes 422).
export function fieldDeps() {
  const out = {};
  const add = (t, names) => { out[t] = out[t] || new Set(); names.forEach((n) => out[t].add(n)); };
  for (const m of [ALLOWED_FIELDS, VERK_ONLY_FIELDS, CREATABLE_FIELDS, WRITABLE_FIELDS]) for (const [t, f] of Object.entries(m)) add(t, f);
  for (const [t, f] of Object.entries(FORCED_CREATE_FIELDS)) add(t, Object.keys(typeof f === "function" ? f({ Til: 1 }) : f));
  add("tblhglpjQkczdG1AY", ["PIN 🔢", "Er starfandi? ✅"]);       // STRICT_FILTERS formula, never returned
  add("tbl3e5o0Klv9RcNQ4", ["Starfsmaður"]);
  return out;
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
    if (WRITE_ONLY.has(tableId)) return res.status(403).json({ error: "Table not readable" });
    if (!recordId && REQUIRE_FILTER.has(tableId) && !params.filterByFormula) {
      return res.status(403).json({ error: "filterByFormula required for this table" });
    }
    // A recordId bypasses STRICT_FILTERS' shape check entirely — fetching a specific record by
    // its own (unguessable, 17-char random) id was never the thing TRUE()-style bypasses were
    // about, and crm.html / skrifstofa.html's job popup both legitimately resolve a linked
    // Tengiliðir/Fyrirtæki record this way. BLOCK_RECORD_ID is the separate, explicit opt-in for
    // the two tables (Starfsmenn, Fjarvistir) where by-id lookup genuinely should stay closed —
    // their own PIN-filter / "Starfsmaður=X" shape is the only intended way in, by design (2026-
    // 10-01 hardening), not a side effect of merely having a STRICT_FILTERS entry.
    if (recordId && BLOCK_RECORD_ID.has(tableId)) {
      return res.status(403).json({ error: "Query not allowed for this table" });
    }
    if (!recordId && STRICT_FILTERS[tableId] && !STRICT_FILTERS[tableId].test(String(params.filterByFormula || ""))) {
      return res.status(403).json({ error: "Query not allowed for this table" });
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

    if (recordId) {
      // Airtable's single-record endpoint (GET /v0/{base}/{table}/{id}) started
      // rejecting every request with a generic 422 "parameter validation
      // failed" — verified via direct testing that even one allowed field, and
      // even the previously rock-solid Tækifæri table, fail identically.
      // Routing through the list endpoint's RECORD_ID() filter instead gets
      // the same data and sidesteps whatever broke there.
      url.searchParams.set("filterByFormula", `RECORD_ID()='${recordId}'`);
      const { airtableRes, data, fields } = await fetchAirtableFiltered(url, allowedFields, token);
      if (!airtableRes.ok) return res.status(airtableRes.status).json(data);
      const record = (data.records || [])[0];
      if (!record) return res.status(404).json({ error: "Record not found" });
      return res.status(200).json(filterFields(record, fields));
    }

    const { airtableRes, data, fields } = await fetchAirtableFiltered(url, allowedFields, token);
    if (Array.isArray(data.records)) {
      data.records = data.records.map((r) => filterFields(r, fields));
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
    if (CREATE_REQUIRES_KEY.has(tableId)) {
      const verkKey = process.env.VERK_KEY;
      if (!verkKey || req.query.k !== verkKey) return res.status(403).json({ error: "Invalid key" });
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
    if (PATCH_REQUIRES_KEY.has(tableId)) {
      const verkKey = process.env.VERK_KEY;
      if (!verkKey || req.query.k !== verkKey) return res.status(403).json({ error: "Invalid key" });
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
