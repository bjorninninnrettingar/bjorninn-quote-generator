// Real 3D models for drawers and handles (.glb). Empty = the planner draws its own
// procedural versions. To use a real model, export it from SketchUp as glTF (.glb),
// drop it under models/drawers/ or models/handles/ and add a line below.
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
window.KPMODELS = { drawers:{}, handles:{} };
