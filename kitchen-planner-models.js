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
    // Jey (grip): a full-width profile that takes its own height (37 mm) off the front and sits on top of it; the finger lip is at the BOTTOM of the profile
    // (model y = length, model z = height with the lip at the low end, model x = the ~17 mm it projects)
    jey:                { file:"models/handles/jey.glb",   kind:"jey", map:["-y", "-z", "x"], color:"#b8935a", stripMm:37 },
    jey2:               { file:"models/handles/jey.glb",   kind:"jey", map:["-y", "-z", "x"], color:"#1b1b1d", stripMm:37 },
    // Comet: 200 mm, mounted on the top edge of the front; model x = the 40 mm it projects, y = length, z = thickness (flat side up)
    comet:              { file:"models/handles/comet.glb", kind:"topmount", map:["y", "z", "x"], lenMm:200 },
    // Vann: 200 mm flip on the top edge (the file holds 100/200/350/1200 mm pieces, two meshes each: `skip`/`take` pick the 200 mm one; embedMm = the 90° corner sits inside the front, behind its face)
    vann:               { file:"models/handles/vann.glb", kind:"topmount", map:["y", "z", "x"], skip:2, take:2, color:"#b87a55", lenMm:200, embedMm:20 },
    // Fest framan á (screwed onto the face). lenMm = the size of the real product; fitMarginMm = keeps this much clear on each side of a narrow front
    angle:              { file:"models/handles/angle.glb", kind:"bar", map:["-z", "y", "x"], color:"#17171a", lenMm:600, fitMarginMm:100 },
    crossing:           { file:"models/handles/crossing.glb", kind:"bar", map:["-z", "-x", "y"], lenMm:328, fitMarginMm:100 },
    graf:               { file:"models/handles/graf-big.glb", kind:"bar", map:["y", "-x", "z"], posts:true, color:"#1e1d1d", lenMm:320, fitMarginMm:100 },
    sense:              { file:"models/handles/sense-big.glb", kind:"bar", map:["-z", "-x", "y"], dropFlat:true, color:"#1a1a1c", lenMm:263, fitMarginMm:100 },
    hexxa:              { kind:"hexxa", marginMm:50, file:null }
  }
};
