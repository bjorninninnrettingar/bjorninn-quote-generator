// The handle range, rebuilt one handle at a time (2026-09-21). Each handle = thumbnail + .glb + description.
//
// groups (the tabs on the handle page):
//   ofan-a  — "Á brún": mounted ON the top edge of the front (Comet…)
//   afestar — "Áfestar": pulls screwed onto the face of the front
//   grip    — "Grip": grips / profiles at the edge or milled into the front
//   an      — no visible handle
//
// To add a handle: 1) put the picture in handles/ and the model in models/handles/,
// 2) add an entry below, 3) add its model settings to KPMODELS.handles in kitchen-planner-models.js.
// The earlier catalogue (Ona, Jey2, Arpa, Hexxa, the 14 site handles) stays in the code as `hidden`
// so older drafts and submissions still load and render.
window.KPHANDLES = {
  groups: [
    { key:"ofan-a",  label:"Á brún",          blurb:"Handfang sem situr ofan á framhliðinni, undir borðplötunni." },
    { key:"afestar", label:"Áfestar",         blurb:"Handföng sem eru skrúfuð á framhliðina." },
    { key:"grip",    label:"Grip",            blurb:"Grip og prófílar á kantinum eða fræst inn í framhliðina." },
    { key:"an",      label:"Ekkert handfang", blurb:"Ekkert sýnilegt handfang." }
  ],
  items: {
    // finishes = the colours Innval actually stocks it in (HÖLDUR.pdf, 13.3.2025 — user: "listinn er réttur"),
    // finish = the one in its photo (state.handleColor null = that one). Only these are offered (2026-10-24).
    comet:    { label:"Comet",     group:"ofan-a",  img:"handles/comet.jpg",    desc:"200 mm · brons", style:"tab", len:0.2, color:"#b08d57", finish:"brons", finishes:["brons", "messing", "svart"] },
    vann:     { label:"Vann",      group:"ofan-a",  img:"handles/vann.jpg",     desc:"Lítill flipi · 200 mm", style:"tab", len:0.2, color:"#b87a55", finish:"dokkt_latun", finishes:["dokkt_latun", "stal", "svart"] },
    angle:    { label:"Angle",     group:"afestar", img:"handles/angle.jpg",    desc:"Vinkilprófíll · svartur", style:"bar", len:0.4, color:"#17171a", finish:"svart", finishes:["svart", "brons", "dokkt_latun", "stal", "hvitt"] },
    crossing: { label:"Crossing",  group:"afestar", img:"handles/crossing.jpg", desc:"320 mm · svart og eik", style:"bar", len:0.32, color:"#d4b98c", finish:"eik_svart", finishes:["eik_svart", "svart"] },
    graf:     { label:"Graf Big",  group:"afestar", img:"handles/graf.jpg",     desc:"Rifflað stangarhandfang · svart", style:"bar", len:0.32, color:"#1e1d1d", finish:"svart", finishes:["svart", "dokkt_latun"] },
    sense:    { label:"Sense Big", group:"afestar", img:"handles/sense.jpg",    desc:"Bogadregið bandhandfang · svart", style:"bar", len:0.26, color:"#1a1a1c", finish:"svart", finishes:["svart", "stal"] },
    jey:      { label:"Jey",       group:"grip",    img:"handles/jey.jpg",      desc:"Prófíll yfir alla framhliðina", style:"edge", len:0.94, color:"#b8935a", finish:"cava", finishes:["cava", "svart", "stal", "hvitt"] },
    hexxa:    { label:"Hexxa",     group:"grip",    img:"handles/hexxa.jpg",    desc:"Fræst inn í framhliðina · jöfn fjarlægð frá báðum hliðum", style:"edge", len:0.7, color:"#2a2522", finish:"svart", finishes:["svart", "brons", "gratt", "hvitt"] },
    // 2026-09-29: same physical profile as Jey (same jey.glb, same geometry/placement — kind:"jey" in
    // KPMODELS.handles), just clad in the front's own material instead of a fixed brass/dark colour
    // (`matchFront:true`, see handleProfile() in kitchen-planner-3d.js) — "eins og Jey nema með
    // frontaefnisklæðningu", closer to the real product photo the customer sent than the earlier
    // from-scratch rounded-cove attempt. Only makes sense on a Spónlagt front (`requiresFrontCategory`
    // gates it out of the picker in handlesOf(), kitchen-planner.html). `fixedColor` is true for the
    // same reason Hexxa's is — there is no separate finish to pick, it follows the wood.
    sponagrip: { label:"Spónagrip", group:"grip", img:"handles/jey.jpg", desc:"Sami prófíll og Jey · klætt í lit spónsins · aðeins á spónlögðum frontum", style:"edge", len:0.94, color:"#8a6b48", fixedColor:true, requiresFrontCategory:"sponlagt" }
  },
  // Colours a handle can be ordered in (state.handleColor; null = the handle's own colour from the photo).
  // Handles with fixedColor:true (Crossing = black + oak, Hexxa = milled into the front) have no choice.
  finishes: { // labels as on Innval's list, so they match the order
    svart:   { label:"Svart matt",     hex:"#1c1c1e", metal:0.3,  rough:0.55 },
    stal:    { label:"Stálútlit",      hex:"#b9bcc0", metal:0.85, rough:0.32 },
    messing: { label:"Látún",          hex:"#b8935a", metal:0.8,  rough:0.34 },
    dokkt_latun: { label:"Dökkt látún", hex:"#7a5c36", metal:0.75, rough:0.38 },
    cava:    { label:"Cava (burstað)", hex:"#bfa37a", metal:0.8,  rough:0.36 },
    kopar:   { label:"Kopar",          hex:"#b87a55", metal:0.8,  rough:0.34 }, // no handle is offered in it any more — old drafts
    brons:   { label:"Brons",          hex:"#7d5f42", metal:0.7,  rough:0.4 },
    eik_svart: { label:"Eik og svart", hex:"#d4b98c", metal:0.1,  rough:0.6 }, // Crossing as photographed
    gratt:   { label:"Grátt matt",     hex:"#8e9093", metal:0.1,  rough:0.6 },
    hvitt:   { label:"Hvítt matt",     hex:"#efeeea", metal:0.05, rough:0.6 }
  },
  // every handle from the earlier catalogue is hidden (still usable by old drafts) except these two, which live in a group
  // (fraest left the picker 2026-10-24 — done properly now as Spónagrip, spónlagt fronts only; old drafts still render it)
  placeExisting: { push:"an" }
};
