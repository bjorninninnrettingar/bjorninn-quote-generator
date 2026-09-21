// The handle range, rebuilt one handle at a time (2026-09-21). Each handle = thumbnail + .glb + description.
//
// groups (the tabs on the handle page):
//   ofan-a  — "Ofan á höldur": mounted ON the top edge of the front (Comet…)
//   afestar — "Áfestar höldur": pulls screwed onto the face of the front
//   grip    — "Grip": grips / profiles at the edge or milled into the front
//   an      — no visible handle
//
// To add a handle: 1) put the picture in handles/ and the model in models/handles/,
// 2) add an entry below, 3) add its model settings to KPMODELS.handles in kitchen-planner-models.js.
// The earlier catalogue (Ona, Jey2, Arpa, Hexxa, the 14 site handles) stays in the code as `hidden`
// so older drafts and submissions still load and render.
window.KPHANDLES = {
  groups: [
    { key:"ofan-a",  label:"Ofan á höldur",   blurb:"Handfang sem situr ofan á framhliðinni, undir borðplötunni." },
    { key:"afestar", label:"Áfestar höldur",  blurb:"Handföng sem eru skrúfuð á framhliðina." },
    { key:"grip",    label:"Grip",            blurb:"Grip og prófílar á kantinum eða fræst inn í framhliðina." },
    { key:"an",      label:"Án handfangs",    blurb:"Ekkert sýnilegt handfang." }
  ],
  items: {
    comet:    { label:"Comet",     group:"ofan-a",  img:"handles/comet.jpg",    desc:"Ofan á fronti · 200 mm · brons", style:"tab", len:0.2, color:"#b08d57" },
    vann:     { label:"Vann",      group:"ofan-a",  img:"handles/vann.jpg",     desc:"Ofan á fronti · lítill flipi · kopar · 100 mm", style:"tab", len:0.1, color:"#b87a55" },
    angle:    { label:"Angle",     group:"afestar", img:"handles/angle.jpg",    desc:"Fest framan á · vinkilprófíll · svartur", style:"bar", len:0.4, color:"#17171a" },
    crossing: { label:"Crossing",  group:"afestar", img:"handles/crossing.jpg", desc:"Fest framan á · 320 mm · svart og eik", style:"bar", len:0.32, color:"#d4b98c" },
    graf:     { label:"Graf Big",  group:"afestar", img:"handles/graf.jpg",     desc:"Fest framan á · rifflað stangarhandfang · svart", style:"bar", len:0.32, color:"#1e1d1d" },
    sense:    { label:"Sense Big", group:"afestar", img:"handles/sense.jpg",    desc:"Fest framan á · bogadregið bandhandfang · svart", style:"bar", len:0.26, color:"#1a1a1c" },
    jey:      { label:"Jey",       group:"grip",    img:"handles/jey.jpg",      desc:"Grip · prófíll yfir alla framhliðina", style:"edge", len:0.94, color:"#b8935a" },
    hexxa:    { label:"Hexxa",     group:"grip",    img:"handles/hexxa.jpg",    desc:"Grip · fræst inn í framhliðina · jöfn fjarlægð frá báðum hliðum", style:"edge", len:0.7, color:"#2a2522" }
  },
  // every handle from the earlier catalogue is hidden (still usable by old drafts) except these two, which live in a group
  placeExisting: { fraest:"an", push:"an" }
};
