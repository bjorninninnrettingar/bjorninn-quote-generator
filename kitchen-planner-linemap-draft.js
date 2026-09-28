// DRAFT — not wired into submitPlan()/collectEyðublaðRows() yet. This is the first
// "sheet" of the Line Items mapping work (see the Claude memory file
// project_kitchen_planner.md, "2026-09-28: Line Items integration" for the full
// scoping conversation this came out of): the automated part, cabinet body (V1)
// and the default interior (V2) — matched against real Airtable Útfærslur records
// by their STRUCTURED "Skipulag" fields (Skápategund/Breidd/Hæð/Dýpt, and the
// N/M/K/E/C/F drawer-count fields), not by fuzzy-matching free-text names.
// Every entry below resolved to exactly ONE real Útfærslu record — none were
// ambiguous — pulled 2026-09-28 from base app91U15z9K704Okd, table
// "Útfærslur 🎨" (tbl8HjvBwNJ41cTV0). Re-verify before relying on this if it's
// been a while — record ids don't change but a décor/product could be retired.
//
// Widths are customer mm rounded to the nearest 10cm family (30–120cm) — the
// existing decision (2026-09-22 round) is to put the real mm in the note to
// the söluaðili, same as before.
window.KP_LINEMAP_DRAFT = {

  // ---- V1: cabinet body Útfærslu, by planner CATALOG key + width family (mm) ----
  // Only the 4 families below are unambiguous by width alone (Skápategund +
  // Skipulag-Hæð + Skipulag-Dýpt match exactly one non-"38mm" real product per
  // width). `isskapur` (built-in fridge) reuses `harskapur` — it already submits
  // as Hárskápur + a note today (CATALOG.isskapur.skapategundOverride).
  v1: {
    // grunnskapur: Skápategund=Grunnskápur, Hæð=800, Dýpt=600 ("Lokaður grunnskápur")
    // — the SAME width also matches "Lítill kassi" (H500) and "Hár veggskápur"
    // (H2000) under the same Skápategund; those are real Björninn products with
    // no home in the current planner CATALOG, harmless to ignore here.
    grunnskapur: {
      300: { id:"recavcUhCIylAX1NC", name:"Lokaður grunnskápur 30sm", sku:"LGR30" },
      400: { id:"recyqubggHAaQEl6k", name:"Lokaður grunnskápur 40sm", sku:"LGR40" },
      500: { id:"recZcXiFomYNQgT3M", name:"Lokaður grunnskápur 50sm", sku:"LGR50" },
      600: { id:"recBmLITNeGC8dqxo", name:"Lokaður grunnskápur 60sm", sku:"LGR60" },
      700: { id:"recAx92PDOGmVgRbx", name:"Lokaður grunnskápur 70sm", sku:"LGR70" },
      800: { id:"rec2AG0Nxebhda6Ji", name:"Lokaður grunnskápur 80sm", sku:"LGR80" },
      900: { id:"recgHwqa5EJftF6fV", name:"Lokaður grunnskápur 90sm", sku:"LGR90" },
      1000:{ id:"recokTf5KS2W7QvhQ", name:"Lokaður grunnskápur 100sm", sku:"LGR100" },
      1100:{ id:"recdmDyx3tOq1a14f", name:"Lokaður grunnskápur 110sm", sku:"LGR110" },
      1200:{ id:"recMDRCvd1opLovjN", name:"Lokaður grunnskápur 120sm", sku:"LGR120" }
      // grunnskapur.maxW is 1200 already — nothing wider to worry about.
    },
    // harskapur: Skápategund=Hárskápur, Hæð=2400, Dýpt=600 ("Lokaður hár skápur")
    harskapur: {
      300: { id:"recfHYiAnRJSFDY42", name:"Lokaður hár skápur 30sm", sku:"LHA30" },
      400: { id:"recHExXHBQ1bKa15M", name:"Lokaður hár skápur 40sm", sku:"LHA40" },
      500: { id:"recROVna0zIOVndog", name:"Lokaður hár skápur 50sm", sku:"LHA50" },
      600: { id:"recmSaJVgCvwnRNUe", name:"Lokaður hár skápur 60sm", sku:"LHA60" },
      700: { id:"recmu7p7PEayjWi1n", name:"Lokaður hár skápur 70sm", sku:"LHA70" },
      800: { id:"recI67pf7xA5hj4j3", name:"Lokaður hár skápur 80sm", sku:"LHA80" },
      900: { id:"recQzSO0e4NJUjIg3", name:"Lokaður hár skápur 90sm", sku:"LHA90" }
      // harskapur.maxW is 900 — 1000/1100/1200 don't apply to this type.
    },
    // efriskapur: Skápategund=Efriskápur, Hæð=1000, Dýpt=300, WITH "Lokaður" (has a front)
    efriskapur: {
      300: { id:"recFdk8bLJrphAhUo", name:"Lokaður efri skápur 30sm", sku:"LEF30" },
      400: { id:"recfLYXvmD6bQsum8", name:"Lokaður efri skápur 40sm", sku:"LEF40" },
      500: { id:"recVmsIEwMmzOJmOt", name:"Lokaður efri skápur 50sm", sku:"LEF50" },
      600: { id:"recLRou29hMgmiWTR", name:"Lokaður efri skápur 60sm", sku:"LEF60" },
      700: { id:"recd05Aw4v6DZMmZd", name:"Lokaður efri skápur 70sm", sku:"LEF70" },
      800: { id:"rec0Kvz8ZHUYGIh5N", name:"Lokaður efri skápur 80sm", sku:"LEF80" },
      900: { id:"recsgOfn2RPfsf3OE", name:"Lokaður efri skápur 90sm", sku:"LEF90" },
      1000:{ id:"recPzvDulVh1pDhTF", name:"Lokaður efri skápur 100sm", sku:"LEF100" },
      1100:{ id:"recwVmffGXQPG7tGx", name:"Lokaður efri skápur 110sm", sku:"LEF110" },
      1200:{ id:"recm1iJsiNOup6Irq", name:"Lokaður efri skápur 120sm", sku:"LEF120" }
    },
    // opnarhillur: same Skápategund/Hæð/Dýpt as efriskapur but WITHOUT "Lokaður" —
    // the plain "Efri skápur N sm" is the no-front/open variant (my best-evidence
    // read of the "Lokaður" vs plain naming pattern — check this one specifically,
    // it's the one place the distinction actually matters for what gets built).
    opnarhillur: {
      300: { id:"recTzNeyv2OJhsw0F", name:"Efri skápur 30sm", sku:"EF30" },
      400: { id:"recqnw5R4gXI1llOi", name:"Efri skápur 40sm", sku:"EF40" },
      500: { id:"recFQMIixR6WxxehF", name:"Efri skápur 50sm", sku:"EF50" },
      600: { id:"recIlVZWpc2qooD5S", name:"Efri skápur 60sm", sku:"EF60" },
      700: { id:"recR57qv3FZzApWT8", name:"Efri skápur 70sm", sku:"EF70" },
      800: { id:"recSNy3jrCPmePlE9", name:"Efri skápur 80sm", sku:"EF80" },
      900: { id:"rectBoC7jdFgLTphm", name:"Efri skápur 90sm", sku:"EF90" },
      1000:{ id:"recS3auWDfxQ1xxiQ", name:"Efri skápur 100sm", sku:"EF100" },
      1100:{ id:"recXmWvKcnFg6jFF6", name:"Efri skápur 110sm", sku:"EF110" },
      1200:{ id:"reconAiPV5oCTYkiT", name:"Efri skápur 120sm", sku:"EF120" }
    }
  },

  // ---- V2: default 3-drawer interior (the same M/K/F or M/K/E every drawer
  // cabinet uses today — see DRAWER_LAYOUT in kitchen-planner-3d.js). Matched by
  // the exact N/M/K/E/C/F count fields, not the description text. ----
  v2DrawersDefault: {
    legra:  { id:"recubTiIJ6BCFdfoO", name:"Legra - 1 F-skúffa | 1 K-skúffa | 1 M-skúffa", sku:"L-FKM" },
    merivo: { id:"reclQDfn1f6Y63LnB", name:"Merivo - 1 E-skúff | 1 K-skúff | 1 M - skúff", sku:"M-EKM" }
  },

  // ---- V2: loose shelves, 1–5, by count. TWO variants exist — "plain" for
  // shelves inside a closed cabinet (not visible) and "úr frontaefni" (finished
  // in the front material) for shelves that ARE seen, i.e. opnarhillur. Use
  // v2ShelvesFrontaefni for opnarhillur, v2ShelvesPlain for everything else with
  // a shelfRange (grunnskapur/harskapur/efriskapur's closed-door interior).
  v2ShelvesPlain: {
    1: { id:"recwGGwfPaPwgnlC3", name:"Hilla", sku:"H1" },
    2: { id:"recViuQMmaNp5teAu", name:"2 hillur", sku:"H2" },
    3: { id:"recdGmqHb3MfW7mgc", name:"3 hillur", sku:"H3" },
    4: { id:"rec3P45azIYjXEtOM", name:"4 hillur", sku:"H4" },
    5: { id:"recCPTrQkijuVhLAi", name:"5 hillur", sku:"H5" }
  },
  v2ShelvesFrontaefni: {
    1: { id:"recxwvKdx0GCahWlQ", name:"Hilla úr frontaefni", sku:"FREH1" },
    2: { id:"recS8m90SyDm0SQbt", name:"2 hillur úr frontaefni", sku:"FREH2" },
    3: { id:"reccHklnjHICTW1oP", name:"3 hillur úr frontaefni", sku:"FREH3" },
    4: { id:"rechzpKVua6jHlaft", name:"4 hillur úr frontaefni", sku:"FREH4" },
    5: { id:"recDrqfQFgZaTmrZQ", name:"5 hillur úr frontaefni", sku:"FREH5" }
  }

  // ---- NOT covered here, needs a separate pass (each is a real gap, not an
  // oversight — flagging so nobody assumes this file is the whole picture) ----
  // - ofnaskapur: Útfærslur for "Ofnaskápur" bundle the WHOLE cabinet+drawer
  //   combo into one V1 description (e.g. "Ofnaskápur - Merivo - EKM skúffu
  //   sams. | skápur f. ofan ofn | ...") with no width/H/D fields at all — needs
  //   matching by drawer combo, not width. Not attempted this round.
  // - tofrahorn: already has its own mechanism (CATALOG.tofrahorn.tofrahornId,
  //   a fixed real Töfrahorn útfærsla link) — doesn't need this table.
  // - vaskaskapur: reuses the grunnskapur table above for widths up to 120cm
  //   (its own maxW is 1500mm — 130/140/150cm have no matching real product,
  //   same "note only" situation the planner already has for anything without
  //   a real Airtable link).
  // - uthlid / uthlidhar / uthlidefri (end panels), laushilla (loose 38mm
  //   shelf boards): likely a different Vörulisti/Efnislisti product entirely,
  //   not a "Skápategund" Útfærslu — not researched yet.
  // - Custom (non-default) drawer counts/height-code splits: the planner
  //   already only sends a note for these ("viðskiptavinur óskar eftir
  //   skúffum (N stk)... staðfestu skúffuhæðir") since it was never capturing
  //   exact heights per position — that stays true under Line Items too,
  //   nothing to map here beyond the one default 3-drawer case above.
};
