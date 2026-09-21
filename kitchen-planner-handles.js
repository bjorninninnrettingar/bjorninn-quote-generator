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
    comet: { label:"Comet", group:"ofan-a", img:"handles/comet.jpg", desc:"Ofan á fronti · 200 mm · brons", style:"tab", len:0.2, color:"#b08d57", vorulistiId:null }
  },
  // every handle from the earlier catalogue is hidden (still usable by old drafts) except these two, which live in a group
  placeExisting: { fraest:"an", push:"an" }
};
