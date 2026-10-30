// Island scenes WITHOUT a tall unit, and the numbers the planner produces for them. island-baseline.json was written from the
// code as it was before the "Hár skápur í eyju" round (2026-10-30); the round must not change any of these numbers.
let n = 0;
const B = (type, w, ex) => Object.assign({ id: "s" + (n++), type, widthMm: w }, ex || {});
export function scenes(HP) {
  n = 0;
  const walls = () => [5600, 4200, 5600, 4200].map((l, i) => ({ id: "w" + i, label: "Veggur " + (i + 1), lengthMm: l, turnAfter: "left", floor: [], wall: [] }));
  const mk = (islands) => ({ top: HP, closed: true, roomHeightMm: 2600, walls: walls(), islands });
  return {
    single: mk([{ id: "I1", label: "Eyja 1", lengthMm: 1800, xMm: 2800, zMm: 2100, rot: 180, back: true, a: [B("grunnskapur", 600), B("vaskaskapur", 600), B("grunnskapur", 600)] }]),
    singleNoBack: mk([{ id: "I1", label: "Eyja 1", lengthMm: 1800, xMm: 2800, zMm: 2100, rot: 0, a: [B("grunnskapur", 600), B("uppthvottavel", 600), B("litillkassi", 600)] }]),
    two: mk([{ id: "I1", label: "Eyja 1", lengthMm: 1800, xMm: 2800, zMm: 2100, rot: 0, two: true, a: [B("grunnskapur", 600), B("grunnskapur", 600), B("grunnskapur", 600)], b: [B("grunnskapur", 900), B("grunnskapur", 900)] }]),
    withPanels: mk([{ id: "I1", label: "Eyja 1", lengthMm: 1819, xMm: 2800, zMm: 2100, rot: 90, back: true, a: [B("uthlid", 19), B("grunnskapur", 800), B("grunnskapur", 1000)] }]),
  };
}
export function measure(K, W, HP) {
  const out = {};
  const sc = scenes(HP);
  for (const k of Object.keys(sc)) {
    const s = sc[k];
    const wt = W.compute(JSON.parse(JSON.stringify(s)), K);
    const isl = s.islands[0];
    const fits = [];
    for (const [x, z] of [[2800, 2100], [2800, 300], [300, 300], [5000, 3800], [2800, 4100]]) fits.push(K.islandFits(s, isl, x, z));
    out[k] = {
      pieces: wt.pieces.map((p) => [p.label, p.surfId, p.left, p.len, p.depth, p.ends.L.type, p.ends.R.type, p.edges.front, p.edges.L, p.edges.R, p.edges.back]),
      issues: wt.issues, notes: wt.notes,
      warnings: K.fitWarnings(s, { pro: true }).map((w) => [w.msg, w.ids]),
      fits,
      fitsNearest: K.nearestIslandFit(s, isl, 2800, 300),
    };
  }
  return out;
}
