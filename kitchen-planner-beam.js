// kitchen-planner-beam.js — the maths behind dragging and turning a ceiling beam (biti í lofti), 2026-10-30.
//
// Pure: no DOM, no THREE — runs under node for tests (tests/kp-beam.test.js) and in the page as window.KPBEAM.
// Everything is in mm and in the beam's anchor wall's frame: `a` = along the wall from its left corner, `n` = out into
// the room. Angles are degrees, turned about the beam's own centre from `a` towards `n` (the same sense as
// KP3D.obstacleCorners). The saved data shape is untouched (offsetMm / outMm / widthMm / depthMm / rot / ang).
//
// Why it exists: the beam hangs under the ceiling and is dragged on a level plane there. Seen from a normal camera that
// plane is hit at a grazing angle, so one pixel of the pointer moved the beam 6 cm; the owner called it "too sensitive".
(function(root){
  "use strict";
  var MAX_STEP_MM = 60;      // furthest the beam may travel in one pointer event
  var FLAT_DEG = 20;         // a ray flatter than this (against the ceiling plane) is damped
  var SNAP_MM = 50;          // magnet range to walls / edges / other beams
  var ANG_MAGNET = 3;        // degrees: magnet to 0 / 45 / 90 ... against the wall
  var ANG_STEP = 5, ANG_FINE = 1;
  var MOVE_STEP = 10, MOVE_FINE = 1;
  var KEEP_WALL_MM = 150;    // the beam stays on its wall until its centre is this far past the wall's ends

  function rad(d){ return d * Math.PI / 180; }
  // an angle in (-180, 180]
  function normAng(a){ a = ((a % 360) + 360) % 360; return a > 180 ? a - 360 : a; }
  // the same for a line (a beam looks the same turned half a turn): (-90, 90]
  function normLine(a){ a = ((a % 180) + 180) % 180; return a > 90 ? a - 180 : a; }

  // How much of the pointer's travel towards / away from the camera counts. The ray meets the ceiling plane at `elevDeg` above
  // horizontal and one pixel is about 1 / sin²(elev) mm there; below FLAT_DEG the travel is multiplied by s²(1 + s²) / 2 with
  // s = sin(elev) / sin(FLAT_DEG): 1 at 20 degrees, then so much smaller that mm per pixel stays at about 5-10 whatever the view.
  function dampScale(elevDeg){
    var e = Math.abs(elevDeg);
    if (!(e < FLAT_DEG)) return 1;
    var s = Math.sin(rad(e)) / Math.sin(rad(FLAT_DEG)), q = s * s;
    return q * (1 + q) / 2;
  }
  // One pointer event: from where the beam is (cur) towards where the grip says it should be (target) — scaled by the ray's
  // angle and never further than MAX_STEP_MM. Grip offset is kept because both points are in the same plane.
  // `fwd` = the camera's horizontal view direction {x, z} (unit): only travel towards / away from the camera blows up at a flat
  // angle; sideways travel depends on the distance alone, so it is left as it is (the 60 mm cap still holds). No fwd = all of it
  // is scaled.
  function dampStep(cur, target, elevDeg, maxMm, fwd){
    var max = maxMm || MAX_STEP_MM, kq = dampScale(elevDeg), dx = target.x - cur.x, dz = target.z - cur.z;
    if (fwd){
      var f = dx * fwd.x + dz * fwd.z, l = -dx * fwd.z + dz * fwd.x;
      f *= kq;
      dx = f * fwd.x - l * fwd.z; dz = f * fwd.z + l * fwd.x;
    } else { dx *= kq; dz *= kq; }
    var len = Math.hypot(dx, dz);
    if (len > max){ dx *= max / len; dz *= max / len; }
    return { x:cur.x + dx, z:cur.z + dz };
  }
  function stepRound(v, step){ return Math.round(v / step) * step; }

  // The box's corners after the turn, and the extents they span (a / n ranges)
  function extents(cA, cN, w, d, ang){
    var t = rad(ang || 0), cs = Math.cos(t), sn = Math.sin(t), hw = w / 2, hd = d / 2;
    var xs = [], ns = [];
    [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].forEach(function(p){ xs.push(cA + p[0] * cs - p[1] * sn); ns.push(cN + p[0] * sn + p[1] * cs); });
    return { minA:Math.min.apply(null, xs), maxA:Math.max.apply(null, xs), minN:Math.min.apply(null, ns), maxN:Math.max.apply(null, ns) };
  }
  // the smallest shift (≤ tol) that puts the span's near or far side on one of the targets; 0 when none is close
  function snapSpan(lo, hi, targets, tol){
    var best = null;
    (targets || []).forEach(function(t){
      [t - lo, t - hi].forEach(function(s){ if (Math.abs(s) <= tol && (best === null || Math.abs(s) < Math.abs(best))) best = s; });
    });
    return best === null ? { d:0, hit:false } : { d:best, hit:true };
  }
  // Where the beam's centre ends up for a wanted centre: 10 mm grid (1 mm fine), then 50 mm magnets unless `free` (Alt).
  // `box` = {w, d} = the unturned box on the wall (rect extents), `targets` = {a:[...], n:[...]}.
  // → {cA, cN, snapA, snapN}
  function place(o){
    var step = o.fine ? MOVE_FINE : MOVE_STEP, w = o.w, d = o.d, ang = o.ang || 0;
    var offA = stepRound(o.cA - w / 2, step), offN = stepRound(o.cN - d / 2, step);
    var cA = offA + w / 2, cN = offN + d / 2, snapA = false, snapN = false;
    if (!o.free && o.targets){
      var ex = extents(cA, cN, w, d, ang), tol = o.tol || SNAP_MM;
      var sa = snapSpan(ex.minA, ex.maxA, o.targets.a, tol), sn = snapSpan(ex.minN, ex.maxN, o.targets.n, tol);
      if (sa.hit){ cA += sa.d; snapA = true; }
      if (sn.hit){ cN += sn.d; snapN = true; }
    }
    return { cA:Math.round(cA * 10) / 10, cN:Math.round(cN * 10) / 10, snapA:snapA, snapN:snapN };
  }
  // The turn from the pointer: `pointerAng` = angle of the pointer about the beam's centre (the long axis' direction,
  // in the wall's frame), `grab` = the offset kept from the press (pointer angle − beam angle then), `base` = 0 or 90, the
  // quarter turn already in the box (rot 90). Returns {total, ang, magnet}: total = the beam's long axis against the wall;
  // `ang` is what is stored (total − base), 5° steps (1° fine), a 3° magnet to 0/45/90… against the wall; free (Alt) = none.
  function turn(o){
    var raw = (o.pointerAng - (o.grab || 0)), base = o.base || 0, step = o.fine ? ANG_FINE : ANG_STEP, magnet = false, total;
    if (o.free) total = Math.round(raw * 10) / 10;
    else {
      var nearest = Math.round(raw / 45) * 45;
      if (Math.abs(raw - nearest) <= ANG_MAGNET){ total = nearest; magnet = true; }
      else total = stepRound(raw, step);
    }
    return { total:normAng(total), ang:normAng(total - base), magnet:magnet };
  }
  // the beam's angle against its wall for the dimension line: 0..90 (a beam looks the same turned half a turn)
  function againstWall(totalDeg){ var a = Math.abs(normLine(totalDeg)); return a; }
  // The wall a beam belongs to while it is dragged: its own until its centre is well past the wall's ends (so it never
  // hops to another wall at a corner), else null = look for another wall
  function keepsWall(t, lenMm){ return t >= -KEEP_WALL_MM && t <= lenMm + KEEP_WALL_MM; }
  // distances (mm) from the turned beam to the wall it hangs on: left corner, right corner, out from the wall
  function wallGaps(cA, cN, w, d, ang, lenMm){
    var e = extents(cA, cN, w, d, ang);
    return { left:e.minA, right:lenMm - e.maxA, out:e.minN };
  }

  var API = { dampScale:dampScale, dampStep:dampStep, stepRound:stepRound, extents:extents, snapSpan:snapSpan, place:place, turn:turn,
    normAng:normAng, normLine:normLine, againstWall:againstWall, keepsWall:keepsWall, wallGaps:wallGaps,
    MAX_STEP_MM:MAX_STEP_MM, FLAT_DEG:FLAT_DEG, SNAP_MM:SNAP_MM, ANG_MAGNET:ANG_MAGNET, KEEP_WALL_MM:KEEP_WALL_MM };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.KPBEAM = API;
})(typeof window !== "undefined" ? window : globalThis);
