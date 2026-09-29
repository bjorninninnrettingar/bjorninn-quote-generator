// Real 3D models for drawers and handles (.glb). Empty = the planner draws its own
// procedural versions. To use a real model, export it from SketchUp as glTF (.glb),
// (or take Blum's .dae download) drop it under models/drawers/ or models/handles/ and add a line below — .glb and .dae both work.
//
//   drawers: key = "<system>_<height code>" with system legra|merivo and code M|K|F|E
//            (the 3-drawer base cabinet is Legra M/K/F or Merivo M/K/E)
//   handles: key = a handle key from kitchen-planner-catalog.js / HANDLES (e.g. "ona", "kantgrip_messing")
//
// Conventions (auto-corrected where possible): the front of the drawer / handle faces +Z,
// its long side runs along X, units are metres (mm is detected and converted).
// Optional per model: rot:[x,y,z] degrees (applied first), mirrorX:true.
//
//   window.KPMODELS = {
//     drawers: { legra_K: { file:"models/drawers/legra-K.glb" } },
//     handles: { ona:     { file:"models/handles/ona.glb" } }
//   };
//
// drawerSides: Blum's own drawer SIDE parts (left + right, one .dae each, per colour) — the
// planner adds a plain bottom and back between them. Key = "<system>_<height code>".
// L = the file whose x is negative in Blum's export, R = positive (they are mirror images);
// the planner puts R on the left and L on the right (the foot points inwards that way).
// boardMm = height of the drawer bottom above the lower edge of the side. Missing colour = procedural.
// Only used when the cabinet is deep enough for the real length (470/500 mm parts).
window.KPMODELS = {
  drawers: {},
  drawerSides: {
    legra_M: { boardMm:12, white:{ L:"models/drawers/legra-M-white-L.dae", R:"models/drawers/legra-M-white-R.dae" }, dark:{ L:"models/drawers/legra-M-dark-L.dae", R:"models/drawers/legra-M-dark-R.dae" } },
    legra_K: { boardMm:12, white:{ L:"models/drawers/legra-K-white-L.dae", R:"models/drawers/legra-K-white-R.dae" }, dark:{ L:"models/drawers/legra-K-dark-L.dae", R:"models/drawers/legra-K-dark-R.dae" } },
    legra_F: { boardMm:12, white:{ L:"models/drawers/legra-F-white-L.dae", R:"models/drawers/legra-F-white-R.dae" }, dark:{ L:"models/drawers/legra-F-dark-L.dae", R:"models/drawers/legra-F-dark-R.dae" } },
    legra_C: { boardMm:12, white:{ L:"models/drawers/legra-C-white-L.dae", R:"models/drawers/legra-C-white-R.dae" }, dark:{ L:"models/drawers/legra-C-dark-L.dae", R:"models/drawers/legra-C-dark-R.dae" } },
    merivo_M: { boardMm:17.6, white:{ L:"models/drawers/merivo-M-white-L.dae", R:"models/drawers/merivo-M-white-R.dae" }, dark:{ L:"models/drawers/merivo-M-dark-L.dae", R:"models/drawers/merivo-M-dark-R.dae" } },
    // Blum has no white K side for Merivo: the dark files, recoloured to the same white as the other Merivo sides
    merivo_K: { boardMm:17.6, dark:{ L:"models/drawers/merivo-K-dark-L.dae", R:"models/drawers/merivo-K-dark-R.dae" },
                white:{ L:"models/drawers/merivo-K-dark-L.dae", R:"models/drawers/merivo-K-dark-R.dae", recolor:"white" } },
    merivo_E: { boardMm:17.6, white:{ L:"models/drawers/merivo-E-white-L.dae", R:"models/drawers/merivo-E-white-R.dae" }, dark:{ L:"models/drawers/merivo-E-dark-L.dae", R:"models/drawers/merivo-E-dark-R.dae" } }
  },
  // the slide runners (one per side, same coordinate frame as the sides): they move with the drawer
  runners: {
    legra:  { L:"models/drawers/legra-runner-L.dae",  R:"models/drawers/legra-runner-R.dae" },
    merivo: { L:"models/drawers/merivo-runner-L.dae", R:"models/drawers/merivo-runner-R.dae" }
  },
  // Real handles. `map` = which model axis becomes the handle's own x (along the front), y (up) and z (out of the
  // front), with an optional minus sign; `kind`: "jey" = full-width J-profile that REPLACES `stripMm` of the front
  // (top strip on doors/drawers, side strip on tall units); "bar" = a pull, centred, turned vertical on tall units.
  // Hexxa is milled into the front (no model needed): a slot centred with equal distance to both sides.
  handles: {
    // Jey (grip): a full-width profile that takes 27 mm off the front and sits on top of it, in line with the front face (the profile is 37 mm tall: the 10 mm that overlap the panel are cut out of the panel behind a thin front lip); the finger lip is at the BOTTOM of the profile
    // (model y = length, model z = height with the lip at the low end, model x = the ~17 mm it projects)
    // `lenOptions` here (2026-09-29) are for the Line Items handle-SKU picker in kitchen-planner.html
    // ONLY — real "Jey Ál grip" Útfærslur (Flokkur=Höldur) exist in 200/300/.../1000 mm pre-cuts plus a
    // 3000 mm bar cut to size; the 3D render is untouched (still a continuous profile at the exact front
    // length — for cut-to-size stock the rendered length is always physically achievable, unlike a
    // discrete pull like Comet, so pickHandleLenM()'s "largest that fits" logic doesn't apply here; the
    // Line Items code picks a SKU with its own "smallest pre-cut that's ≥ needed, else the 3000mm bar"
    // rule instead — confirmed with the customer 2026-09-29).
    jey:                { file:"models/handles/jey.glb",   kind:"jey", map:["-y", "-z", "x"], color:"#b8935a", stripMm:27, profileMm:37,
                            lenOptions:[{ mm:200, vorulistiId:"recYkz92vylCrlCFR" }, { mm:300, vorulistiId:"rec1IwCSd1ovVxXvl" }, { mm:400, vorulistiId:"recklQjvtxw80fOEo" }, { mm:500, vorulistiId:"recMosVIFxb0wrh2S" }, { mm:600, vorulistiId:"recT3auuYgVVRiWxY" }, { mm:700, vorulistiId:"recOjFVZ95MkJ9Q4h" }, { mm:800, vorulistiId:"recvjzSW2OUhLgYEm" }, { mm:900, vorulistiId:"recVDUcGns6lYvGXN" }, { mm:1000, vorulistiId:"recN5ZXgqQWDzphMY" }, { mm:3000, vorulistiId:"recrqN50q1ITKwFYp", bulk:true }] },
    jey2:               { file:"models/handles/jey.glb",   kind:"jey", map:["-y", "-z", "x"], color:"#1b1b1d", stripMm:27, profileMm:37,
                            lenOptions:[{ mm:200, vorulistiId:"rec9KWB5VFxSWLkLh" }, { mm:300, vorulistiId:"rectdCw4psjhUVruc" }, { mm:400, vorulistiId:"rec4Yzl2Cvy57Jrex" }, { mm:500, vorulistiId:"recEcM6FJcqDVoNYT" }, { mm:600, vorulistiId:"receimV2NkpHfSgkH" }, { mm:700, vorulistiId:"recvjsjZuO5sSXFy8" }, { mm:800, vorulistiId:"recjW59nRw1dW8QqW" }, { mm:900, vorulistiId:"rechAyfUAFaAGpeDz" }, { mm:1000, vorulistiId:"recuw8dKmlx2oh40C" }, { mm:3000, vorulistiId:"rec9cXtbvxHFnyYxo", bulk:true }] },
    // Comet: 200 mm, mounted on the top edge of the front; model x = the 40 mm it projects, y = length, z = thickness (flat side up)
    // `lenOptions` = the real orderable lengths (Vörulisti record ids attached), largest that still fits the
    // front (2026-09-28: "plannerinn sýnir bara það sem er til" — every rendered size must be a real, orderable
    // product, never an invented one). `pickHandleLenM()` in kitchen-planner-3d.js does the picking.
    comet:              { file:"models/handles/comet.glb", kind:"topmount", map:["y", "z", "x"],
                            lenOptions:[{ mm:50, vorulistiId:"rec2TuLmbcn0pFOpw" }, { mm:200, vorulistiId:"recBTiHO5kO5lOWvu" }] },
    // Vann: 200 mm flip on the top edge (the file holds 100/200/350/1200 mm pieces, two meshes each: `skip`/`take` pick the 200 mm one; embedMm = the 90° corner sits inside the front, behind its face; dropMm = lowered so the flat part rests on the front)
    // NOT YET a real Vörulisti/Útfærslur product (2026-09-28) — Björninn sells it, but the record needs a real
    // purchase price + supplier before it can be created; ask before wiring it into Line Items.
    vann:               { file:"models/handles/vann.glb", kind:"topmount", map:["y", "z", "x"], skip:2, take:2, color:"#b87a55", lenMm:200, embedMm:20, dropMm:17, flip:true },
    // Fest framan á (screwed onto the face). fitMarginMm = keeps this much clear on each side of a narrow front
    angle:              { file:"models/handles/angle.glb", kind:"bar", map:["-z", "y", "x"], color:"#17171a", fitMarginMm:100,
                            lenOptions:[{ mm:100, vorulistiId:"recVR0zhe2B29nykK" }, { mm:200, vorulistiId:"recShNvBhme2tEaSV" }, { mm:300, vorulistiId:"recNvdiWxt85OT23i" }] },
    // "Crossing hnúði" (a knob, not a bar) also exists in the same product line but isn't this shape — left out.
    crossing:           { file:"models/handles/crossing.glb", kind:"bar", map:["-z", "-x", "y"], fitMarginMm:100,
                            lenOptions:[{ mm:170, vorulistiId:"rectGcCcmTA8MbckY" }, { mm:330, vorulistiId:"recuTvYTlOrGGjgjQ" }] },
    // "Graf mini" is a different, smaller product — not mapped here, only the "Graf Big" this model represents.
    graf:               { file:"models/handles/graf-big.glb", kind:"bar", map:["y", "-x", "z"], posts:true, color:"#1e1d1d", fitMarginMm:100,
                            lenOptions:[{ mm:220, vorulistiId:"recN7ZlBexPkzG1wp" }, { mm:350, vorulistiId:"recOZvCTG3z4OPuC3" }] },
    // "Sense mini" is a different, smaller product — not mapped here, only "Sense Big" this model represents.
    sense:              { file:"models/handles/sense-big.glb", kind:"bar", map:["-z", "-x", "y"], dropFlat:true, color:"#1a1a1c", fitMarginMm:100,
                            lenOptions:[{ mm:140, vorulistiId:"recdosOPHSV6HhP5X" }, { mm:200, vorulistiId:"recZ8EyutxaLegwx6" }, { mm:330, vorulistiId:"reci8JxVITzeV1Kau" }, { mm:490, vorulistiId:"rec8Ul1W9laaMsBeO" }] },
    // Real "Hexxa Ál grip" Útfærslur (Höldur): 100/200/350 mm pre-cuts + a 3000 mm bar. Same picker rule
    // as Jey above (Line Items only, not the 3D render). The 100 mm one's Vörunúmer is "HEXXA110" but its
    // own description says "100mm" — trusted the description, flagged here in case that's a typo on
    // Björninn's side and it's actually 110 mm. A "Hexxa Ál grip Brons 3000mm" colour variant also exists
    // (rec7Xs38ZCfGpcQkD) but isn't wired — Hexxa has no colour-variant concept in this planner yet.
    hexxa:              { kind:"hexxa", marginMm:50, file:null,
                            lenOptions:[{ mm:100, vorulistiId:"recw7rNNMA49tHNoz" }, { mm:200, vorulistiId:"recsRIXsElqj7nNu5" }, { mm:350, vorulistiId:"recN8LZkmG9V8Ef85" }, { mm:3000, vorulistiId:"reckwyNfBdBddqYMJ", bulk:true }] },
    // Spónagrip (2026-09-29): the customer confirmed — same physical profile as Jey (same file/map/
    // stripMm/profileMm, exact same geometry+placement), just clad in the front's own material instead
    // of a fixed colour (`matchFront:true` — handleProfile() in kitchen-planner-3d.js clones frontMat
    // onto it instead of applying `color`). Only offered on Spónlagt fronts
    // (KPHANDLES.items.sponagrip.requiresFrontCategory, enforced in kitchen-planner.html's handlesOf()).
    sponagrip:          { file:"models/handles/jey.glb", kind:"jey", map:["-y", "-z", "x"], stripMm:27, profileMm:37, matchFront:true }
  }
};
