// front-classify.js — shared between grain.html (/aedar, /saga) and
// cutlist.html (Cutty). The single source of truth for two questions every
// Sögunarlisti row needs answered the same way in both places:
//   1. Is this row a front at all, and is its material grain/melamine décor?
//   2. Does it need to stay physically adjacent to a sibling piece for the
//      grain to flow continuously (drawer stacks, wing pairs, split-tall
//      fronts) — i.e. does it have to go through /aedar's manual planner —
//      or is it a solo piece Cutty can cut on its own?
// Extracted out of grain.html rather than duplicated so a future fix to one
// of these rules (e.g. a new drawer-front naming pattern) can't silently
// drift between the two pages — see api/airtable.js's ALLOWED_FIELDS 422
// history and this file's own commit message for why that class of bug is
// worth actively designing against here.
(function (global) {
  "use strict";

  // Visible fronts whose grain the customer sees. Inner drawer fronts
  // (Innskúffufrontur) sit inside the cabinet and are excluded.
  const FRONT_RE = /(frontur|blindlok|áfella|afella|vænghurð|vaenghurd|sökkul cover|sokkul cover)/i;
  // "FRE" / "FRE2" in the Partur text = the part is cut from frontaefni.
  const FRE_RE = /\bfre\d?\b/i;
  // A part whose material lands in one of these Undirflokkar is front material.
  const FRONT_SUBS = new Set(["Frontaefni", "Spónlagt", "Hurð"]);
  const HIDDEN_RE = /(innskúffufrontur|innskuffufrontur)/i;
  // Wing doors: a horizontal pair over one opening — cut side by side,
  // upright, so the grain figure runs continuously across the seam.
  const SIDEBYSIDE_RE = /(væng|vaeng)/i;
  // Wing doors + split fronts (vertical split, "skiptur frontur") — one
  // door's worth of grain, so the run must stay together.
  const KEEPTOGETHER_RE = /(væng|vaeng|skipt)/i;
  // A drawer bank: several fronts of one cabinet's drawer stack, sharing a
  // width — same "must not be scattered" logic as wing/split fronts.
  const DRAWER_RE = /skúffufrontur/i;
  // Wood-look / veneer decors where sequential grain matters.
  const GRAIN_RE = /(eik|hnot|valhnot|ash|askur|beyk|beech|fura|pine|wenge|teak|oak|walnut|spónlag|spónlög|sponlag|spónn|spon |rift|masterlin|linoak|hickory|acacia|akasía|kirsu|cherry|birki|birch|reykt)/i;

  function norm(s) {
    return String(s || "").toLowerCase().trim().replace(/\s+/g, " ");
  }

  // Look up a material's Undirflokkur by its resolved Efni: name, against a
  // caller-supplied boards list (each {name, sub}) — e.g. grain.html's own
  // `boards` or cutlist.html's Efnislisti fetch mapped to the same shape.
  // Cached per (boardsList identity is NOT tracked — callers clear the cache
  // themselves via clearCache() whenever they load a new project's boards,
  // same as grain.html already does for its own _subCache).
  const _subCache = new Map();
  function materialSub(efni, boards) {
    if (_subCache.has(efni)) return _subCache.get(efni);
    const v = _materialSub(efni, boards || []);
    _subCache.set(efni, v);
    return v;
  }
  function _materialSub(efni, boards) {
    const k = norm(efni);
    if (!k) return "";
    for (const b of boards) if (b.sub && norm(b.name) === k) return b.sub;
    for (const b of boards) if (b.sub && (norm(b.name).startsWith(k) || k.startsWith(norm(b.name)))) return b.sub;
    const toks = new Set(k.split(" ").filter(t => t.length > 2));
    let best = "", bestScore = 1;
    for (const b of boards) {
      if (!b.sub) continue;
      const s = norm(b.name).split(" ").filter(t => toks.has(t)).length;
      if (s > bestScore) { bestScore = s; best = b.sub; }
    }
    return best;
  }
  function clearCache() { _subCache.clear(); }

  // Is this Sögunarlisti row front material at all (FRE prefix, or its
  // resolved material's Undirflokkur is Frontaefni/Spónlagt/Hurð)?
  function isFrontMaterial(partur, efni, boards) {
    return FRE_RE.test(partur || "") || FRONT_SUBS.has(materialSub(efni, boards));
  }

  // Is this row a front at all (material-aware detection OR a recognised
  // front word in the Partur text), excluding hidden inner drawer fronts?
  function isFront(partur, frontMat) {
    return (FRONT_RE.test(partur || "") || !!frontMat) && !HIDDEN_RE.test(partur || "");
  }

  // This tool/rule is for melamine décor-print grain matching only. Real
  // veneer (Spónlagt) needs book-matching a machine can't do, and flat/solid
  // colours have no grain to match at all. Décor codes: "U####" = Uni (solid
  // colour), "H####" = Holz (woodgrain). The species keyword list is a
  // backup for names without a code.
  function isMelamineGrain(name, boards) {
    if (materialSub(name, boards) === "Spónlagt") return false; // real veneer, out of scope
    if (/\bH\s?\d{3,4}\b/i.test(name)) return true;
    if (/\bU\s?\d{3,4}\b/i.test(name)) return false;
    return GRAIN_RE.test(name);
  }

  // grain.html's buildGroups() keys a row into its group by unit + rounded
  // width (+material) — EXCEPT a drawer row (DRAWER_RE), which gets its own
  // per-copy-index key instead (`baseKey|i`) and so never actually lands in
  // the same group as a sibling plain front, even one sharing its exact
  // width. Only a wing/split row (KEEPTOGETHER_RE — "væng"/"skipt") uses the
  // plain baseKey, so ONLY that can pull an unrelated plain front along with
  // it into needing /aedar. A drawer row still always needs /aedar itself —
  // it just doesn't spread that requirement to its width-siblings. Mirrors
  // buildGroups()'s gk/keepTogether logic exactly; this is the one place
  // that rule lives, so grain.html and cutlist.html can't disagree on it.
  function aedarBucketKey(unitId, width, efni, th) {
    return `${unitId}|${Math.round(width)}|${efni}|${th}`;
  }
  // fronts: [{unitId, width, efni, th, partur}] — every grain-material front
  // row for a project (any material, any unit). Returns a Set of bucket
  // keys that need /aedar via the wing/split-sharing-a-width rule; look a
  // row up with aedarBucketKey(...). Combine with a direct DRAWER_RE test
  // on the row's own Partur for the full per-row answer (see needsAedarRow
  // in cutlist.html / syncGrainContinuityFlags in grain.html).
  function computeAedarBuckets(fronts) {
    const needs = new Set();
    for (const f of fronts) {
      if (KEEPTOGETHER_RE.test(f.partur || "")) {
        needs.add(aedarBucketKey(f.unitId, f.width, f.efni, f.th));
      }
    }
    return needs;
  }
  // The full per-row answer: this row's own Partur is a drawer front (always
  // needs /aedar, never spreads to siblings), OR it falls in a bucket a
  // wing/split sibling pulled in (see computeAedarBuckets).
  function needsAedarRow(f, buckets) {
    return DRAWER_RE.test(f.partur || "") || buckets.has(aedarBucketKey(f.unitId, f.width, f.efni, f.th));
  }

  global.FrontClassify = {
    FRONT_RE, FRE_RE, FRONT_SUBS, HIDDEN_RE, SIDEBYSIDE_RE, KEEPTOGETHER_RE, DRAWER_RE, GRAIN_RE,
    materialSub, clearCache, isFrontMaterial, isFront, isMelamineGrain,
    aedarBucketKey, computeAedarBuckets, needsAedarRow,
  };
})(window);
