// api/verk-status.js
// The workshop's two manual production steps, from /verk in the floor app:
//   - "Má Afhenda 🚚"  (everything packed) and "Afhent (LOKIÐ ✅)" (delivered)
//   - "merkja sagað" on a single Sögunarlisti piece that was cut without a label,
//     so Framvinda sögunar can reach the 95 % that moves the project on.
// Kept off the public /api/airtable proxy on purpose: setting a project to Má Afhenda
// or Afhent starts Konto invoice drafts, the VERKLOK priority cascade and customer
// emails, so it needs the VERK_KEY (the ?k= every /verk link already carries) and
// only allows the transitions below — never an arbitrary status.
//
// POST { k, t, action: "status", from, to }   → { ok, stage }
// POST { k, t, action: "sagad", pieceId, done } → { ok, done }
// `from` must equal the current status (a stale page can't overwrite a newer one).

import { addLine } from "./virkni.js";
import { checkFloorOrFullKey } from "./_auth.js";

const BASE = "https://api.airtable.com/v0/app91U15z9K704Okd";
const PROJECTS = "tbl4LMXlQjp66RFKI";
const PIECES = "tblhdgyvTcBfP8kov";
const WON = "🏆 Tækifæri unnið";

export const STAGES = {
  ready: "Tilbúið til framleiðslu 📋",
  work: "Verk í vinnslu 🔨",
  assembly: "Samsetning og pökkun 🪛📦",
  deliver: "Má Afhenda 🚚",
  done: "Afhent (LOKIÐ ✅)",
};

// [from, to] pairs the floor may make. The backward ones are the page's "Afturkalla".
export const ALLOWED = [
  [STAGES.ready, STAGES.deliver],
  [STAGES.work, STAGES.deliver],
  [STAGES.assembly, STAGES.deliver],
  [STAGES.deliver, STAGES.done],
  [STAGES.deliver, STAGES.assembly],
  [STAGES.deliver, STAGES.work],
  [STAGES.deliver, STAGES.ready],
  [STAGES.done, STAGES.deliver],
];

export function transitionAllowed(from, to) {
  return ALLOWED.some(([a, b]) => a === from && b === to);
}

// 2026-10-28 (G16): Tilbúið/Í vinnslu → Má afhenda skips Samsetning, so check that sawing and
// milling were actually recorded (same 95 % / 60 % the floor page and the Airtable automation use).
// Only the owner may override, with ownerKey (env OWNER_KEY) + a reason, which lands in Virkni.
export const SAW_TARGET = 0.95, MILL_TARGET = 0.6;
const numOr0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export function productionRecorded(f = {}) {
  const raw = f["Framvinda sögunar"];
  const sawRaw = raw == null || raw === "" ? 0 : numOr0(raw);
  const saw = sawRaw > 1 ? sawRaw / 100 : sawRaw;
  const todo = numOr0(f["Fjöldi hluta til að fræsa 🔬"]);
  const mill = todo ? Math.min(numOr0(f["Fjöldi hluta fræstir 🔬"]), todo) / todo : 1;
  const problems = [];
  if (saw < SAW_TARGET) problems.push("sögun " + Math.round(saw * 100) + "% (þarf " + SAW_TARGET * 100 + "%)");
  if (mill < MILL_TARGET) problems.push("fræsing " + Math.round(mill * 100) + "% (þarf " + MILL_TARGET * 100 + "%)");
  return { ok: !problems.length, problems };
}
export function needsProductionGate(from, to) {
  return to === STAGES.deliver && (from === STAGES.ready || from === STAGES.work);
}

async function at(path, opts = {}) {
  const r = await fetch(`${BASE}/${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(body?.error?.message || `Airtable ${r.status}`), { status: r.status });
  return body;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const b = req.body || {};
  if (!checkFloorOrFullKey(b.k)) return res.status(403).json({ error: "Ógildur lykill" });
  const t = String(b.t || "");
  if (!/^rec[A-Za-z0-9]{14}$/.test(t)) return res.status(400).json({ error: "Ógilt verk" });

  let project;
  try {
    project = (await at(`${PROJECTS}/${t}`)).fields || {};
  } catch {
    return res.status(404).json({ error: "Verkið fannst ekki" });
  }
  if (project["Staða í söluferli"] !== WON) return res.status(409).json({ error: "Verkið er ekki unnið" });

  try {
    if (b.action === "status") {
      const current = project["Staða í framleiðslu"] || "";
      if (current !== b.from) {
        return res.status(409).json({ error: "Staðan hefur breyst — endurhlaðið síðuna", stage: current });
      }
      if (!transitionAllowed(b.from, b.to)) return res.status(400).json({ error: "Þessi færsla er ekki leyfð" });
      let overrideNote = "";
      if (needsProductionGate(b.from, b.to)) {
        const chk = productionRecorded(project);
        if (!chk.ok) {
          const reason = String(b.reason || "").trim().slice(0, 150);
          const ownerOk = b.override === true && process.env.OWNER_KEY && b.ownerKey === process.env.OWNER_KEY && reason;
          if (!ownerOk) {
            return res.status(409).json({ error: "Sögun/fræsing ekki skráð: " + chk.problems.join(", ") + ". Aðeins eigandi getur farið framhjá þessu.", code: "framleidsla_vantar", stage: current });
          }
          overrideNote = " (eigandi fór framhjá: " + chk.problems.join(", ") + " — " + reason + ")";
        }
      }
      await at(`${PROJECTS}/${t}`, { method: "PATCH", body: JSON.stringify({ fields: { "Staða í framleiðslu": b.to } }) });
      // 🔔 office bell (2026-10-27). No chat: "💬 Má afhenda → Skrifstofu chat" already posts.
      const texti = b.to === STAGES.deliver ? (b.from === STAGES.done ? "Afhent afturkallað — aftur í Má afhenda" : "Allt pakkað — Má afhenda 🚚")
        : b.to === STAGES.done ? "Afhent ✅" : "Má afhenda afturkallað — aftur í " + b.to;
      await addLine({ texti: texti + overrideNote, tegund: "afhending", til: "Skrifstofa", t, tengill: "/verk?t=" + t, hver: "Verkstæði" });
      return res.status(200).json({ ok: true, stage: b.to });
    }

    if (b.action === "sagad") {
      const pieceId = String(b.pieceId || "");
      if (!/^rec[A-Za-z0-9]{14}$/.test(pieceId)) return res.status(400).json({ error: "Ógildur hluti" });
      const piece = await at(`${PIECES}/${pieceId}?returnFieldsByFieldId=false`);
      const links = piece.fields?.["Tækifæri 📣 (projects)"] || [];
      if (!links.includes(t)) return res.status(403).json({ error: "Hlutinn tilheyrir ekki þessu verki" });
      const done = b.done !== false;
      await at(`${PIECES}/${pieceId}`, { method: "PATCH", body: JSON.stringify({ fields: { "Lokið": done } }) });
      return res.status(200).json({ ok: true, done });
    }

    return res.status(400).json({ error: "Óþekkt aðgerð" });
  } catch (e) {
    console.error("verk-status:", e);
    return res.status(500).json({ error: e.message });
  }
}
