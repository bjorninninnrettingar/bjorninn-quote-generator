/************************************************************
 * Generate "Yfirfræsaralisti 🔬" row(s) for one unit OR a whole project
 *
 * Trigger: step in the per-unit automation ("❗❗per unit | Yfirfara 3.0 🔬❗❗"),
 *          placed AFTER "CLAUDE Sögunarlistinn 🪚" — it reads that
 *          step's freshly-created Sögunarlisti rows. Also runnable
 *          standalone for a whole project.
 * Input variables: EITHER unitId (Eyðublað record id) OR recordId
 *                   (Tækifæri/project record id) — never both.
 *
 * QUERY BUDGET: Airtable automation scripts are capped at 30 table
 * queries PER INVOCATION — cross it and every later call in that same
 * run gets rejected outright. Doing one selectRecordAsync per Sögunarlisti
 * part (per unit!) blew through that on any real project almost
 * immediately. Fixed by loading each table ONCE up front (Eyðublað units,
 * all of Sögunarlisti, all of Yfirfræsaralisti), matching everything in
 * memory, and batching the final writes — createRecordsAsync /
 * updateRecordsAsync / deleteRecordsAsync each accept up to 50 records
 * per call and count as a SINGLE query. A whole-project run now costs a
 * flat ~4 queries regardless of unit/part count.
 *
 * LOGIC:
 *   - Source of truth is Sögunarlisti's own "Yfirfr." checkbox per part
 *     (set from the "Yfirfræsari" flag on ⚙️ Eyðublaðs ÚRVINNSLA ⚙️
 *     templates) — this script does NOT re-derive which parts need
 *     routing; it just mirrors whatever Sögunarlisti already decided.
 *   - One tag per distinct "Partur" name among a unit's Sögunarlisti rows
 *     where Yfirfr. = true. Part types in QUANTITY_CAPS (shelves,
 *     slár/toppslár, skúffubotn Legra, fronts, sides) get expanded into
 *     numbered instances ("Slár #1".."Slár #4") using Sögunarlisti's own
 *     "M" quantity, capped at whatever's pre-seeded on the field; every
 *     other part type stays a single bare tag regardless of quantity.
 *     Unrecognized names (not yet a choice on the field) fall back to
 *     "Annað (ótilgreint)" instead of throwing.
 *   - Two parallel fields hold this set:
 *       - "Einingar sem þarf að fræsa (bakendi)" — always the FULL set,
 *         every run. Script-owned, never touched by the operator.
 *       - "Einingar sem þarf að fræsa" — the operator-facing list. The
 *         operator works it down by REMOVING chips as they finish each
 *         piece (no giant dropdown to search — removing an existing
 *         chip is a single tap). On update, this script reconciles
 *         rather than overwrites: items newly required (vs. the last
 *         bakendi value) are added back in, items no longer required
 *         are removed, and everything else is left exactly as the
 *         operator left it — so their progress survives a re-run.
 *   - Sérsmíði tegund = "Sökull" is explicitly out of scope — never
 *     gets a row, regardless of Sögunarlisti data.
 *   - Upsert by the unit's own "Yfirfræsaralisti 🔬" link:
 *       - if every linked row is Lokið 🔒            -> touch nothing
 *       - if nothing needs milling anymore            -> delete the
 *         existing (unlocked) row, if any
 *       - otherwise                                   -> create or
 *         update the (unlocked) row
 *   - Heiti's ".N" disambiguation number is assigned once at creation,
 *     tracked in-memory across the whole batch so two new same-named
 *     units in one project run don't collide.
 *   - One unit's data being bad doesn't abort the batch — it's logged
 *     and skipped.
 ************************************************************/

const { unitId: inputUnitId, recordId } = input.config();
if (!inputUnitId && !recordId) throw new Error("Provide unitId or recordId");
if (inputUnitId && recordId) throw new Error("Provide unitId or recordId, not both");

const UNITS_TABLE = "Eyðublað ✏️";
const PARTS_TABLE = "Sögunarlisti 🪚";
const MILL_TABLE  = "Yfirfræsaralisti 🔬";

const U_RASTEX           = "Rastex";
const U_CNC_NOTE         = "Athugasemd til fræsara 🔬";
const U_PROJECT_LINK     = "Tækifæri 📣 (projects)";
const U_PROJECT_LINK_OLD = "Tækifæri 📣"; // some units are only linked via the old field — fall back to it
const U_SERSMIDI_TEGUND  = "Sérsmíði tegund";
const U_FRONT_HLID_TEGUND = "Frontur / Hlið tegund";
const U_SOGUNARLISTI     = "Sögunarlisti 🪚";
const U_MILL_LINK        = "Yfirfræsaralisti 🔬";
const U_SKUFFUTEGUND     = "Skúffutegund";
const U_LED_MAGN         = "LED magn";
const U_DRAWER_FIELDS    = ["N", "M", "K", "C", "F", "E", "IN", "IM", "IK", "IC", "IF", "IE"];
const U_PRIMARY_NAME     = "Athugasemd"; // Eyðublað's primary field — must be loaded for unit.name to resolve

const P_PARTUR = "Partur";
const P_CNC    = "Yfirfr.";
const P_QTY    = "M";

// Part types where quantity actually matters (multiple identical pieces per
// unit) get expanded into numbered instances ("Slár #1".."Slár #4") so
// partial completion is trackable. Everything else stays a single bare tag
// regardless of Sögunarlisti's quantity — matches the pre-seeded choices on
// the two multi-select fields below; capped at whatever's pre-seeded there,
// so a unit that somehow exceeds the cap just silently maxes out instead of
// throwing.
const QUANTITY_CAPS = {
  "Föst hilla": 6, "FRE - Föst Hilla": 6, "FRE2 - Föst hilla": 6,
  "Millihilla": 6, "efsta hilla": 6, "neðri hillur": 6,
  "Loftunarhilla": 6, "Laus loftunarhilla": 6, "Föst loftunarhilla": 6,
  "Lagna  - Skúffubotn - Legra": 6,
  "Frontur": 6, "FRE2 - Frontur": 6, "Tækja frontur": 6, "Frontur vænghurð": 6,
  "FRE-Frontur (hægri)": 6, "Stakur frontur": 6,
  "Slár": 4, "FRE - Slár": 4, "FRE2 - Slár": 4,
  "Lagna - Slár (muna KL)": 4, "Lagna - Slár (muna kantlíma ↕️)": 4,
  "Lagna - Slár úr FRE (muna kantlíma ↕️)": 4, "Lagna - Slár úr FRE2 (muna kantlíma ↕️)": 4,
  "Toppslár - KL ↕️": 4, "Lagna - Toppslár (muna KL)": 4, "Lagna - Toppslár (muna kantlíma ↕️)": 4,
  "Lagna - Toppslár úr FRE (muna kantlíma ↕️)": 4, "Lagna - Toppslár úr FRE2 (muna kantlíma ↕️)": 4,
  "Grunnskápur hlið": 2, "Skápur hlið": 2, "Grunnsk. hlið": 2, "FRE - Hlið": 2, "FRE Grunnsk. hlið": 2,
  "FRE-Grunnskápur hlið": 2, "FRE2 - Hlið": 2, "FRE2 - Grunnsk. hlið": 2, "Fronta-Grunnskápur hlið": 2,
  "Lagna - Hliðar": 2, "Lagna - Hliðar úr FRE": 2, "Lagna - Hliðar úr FRE2": 2, "Tækja hlið": 2,
  "Karmur – Hliðar": 2, "FRE-Vasi innri hlið (hægri)": 2, "FRE-Vasi ytri hlið (hægri)": 2,
};

const M_NAME           = "Heiti";
const M_NEEDED         = "Einingar sem þarf að fræsa";
const M_NEEDED_BACKEND = "Einingar sem þarf að fræsa (bakendi)";
const M_RASTEX         = "Rastex";
const M_NOTE           = "Athugasemd";
const M_INNIHALD       = "Innihald";
const M_LOCKED         = "Lokið 🔒";
const M_PROJECT_LINK   = "Tækifæri 📣 (projects)";
const M_UNIT_LINK      = "Eyðublað ✏️";
const FALLBACK_TAG      = "Annað (ótilgreint)";

const unitsTable = base.getTable(UNITS_TABLE);
const partsTable = base.getTable(PARTS_TABLE);
const millTable  = base.getTable(MILL_TABLE);

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/********************
 * Load everything up front — 3 queries total, regardless of unit count.
 ********************/
const ALL_UNIT_FIELDS = [
  U_PRIMARY_NAME, U_RASTEX, U_CNC_NOTE, U_PROJECT_LINK, U_PROJECT_LINK_OLD, U_SERSMIDI_TEGUND,
  U_FRONT_HLID_TEGUND, U_SOGUNARLISTI, U_MILL_LINK, U_SKUFFUTEGUND, U_LED_MAGN,
  ...U_DRAWER_FIELDS,
];

let units;
if (inputUnitId) {
  const unit = await unitsTable.selectRecordAsync(inputUnitId, { fields: ALL_UNIT_FIELDS });
  if (!unit) throw new Error(`Unit ${inputUnitId} not found`);
  units = [unit];
} else {
  const unitQuery = await unitsTable.selectRecordsAsync({ fields: ALL_UNIT_FIELDS });
  units = unitQuery.records.filter((u) => {
    const linksNew = u.getCellValue(U_PROJECT_LINK) || [];
    const linksOld = u.getCellValue(U_PROJECT_LINK_OLD) || [];
    return linksNew.some((l) => l.id === recordId) || linksOld.some((l) => l.id === recordId);
  });
}

const allParts = (await partsTable.selectRecordsAsync({ fields: [P_PARTUR, P_CNC, P_QTY] })).records;
const partsById = new Map(allParts.map((r) => [r.id, r]));

const allMill = (await millTable.selectRecordsAsync({
  fields: [M_NAME, M_PROJECT_LINK, M_LOCKED, M_NEEDED, M_NEEDED_BACKEND],
})).records;
const millById = new Map(allMill.map((r) => [r.id, r]));

const millNeededField = millTable.fields.find((f) => f.name === M_NEEDED_BACKEND);
const validChoiceNames = new Set((millNeededField.options.choices || []).map((c) => c.name));

// Heiti's ".N" is assigned once at creation, tracked in-memory across the
// whole batch (seeded from existing rows, then bumped per new assignment)
// so two new same-named units processed in the same run don't collide.
const heitiMaxIndex = new Map(); // key: `${projectId}::${baseName}` -> highest index used
function nextHeiti(baseName, projectLink) {
  const projectIds = projectLink.map((p) => p.id);
  if (!projectIds.length) return `${baseName}.1`;
  const key = `${projectIds[0]}::${baseName}`;
  if (!heitiMaxIndex.has(key)) {
    const pattern = new RegExp(`^${escapeRegex(baseName)}\\.(\\d+)$`);
    let maxIndex = 0;
    for (const rec of allMill) {
      const recProjectIds = (rec.getCellValue(M_PROJECT_LINK) || []).map((p) => p.id);
      if (!recProjectIds.some((id) => projectIds.includes(id))) continue;
      const match = pattern.exec(rec.getCellValue(M_NAME) || "");
      if (match) maxIndex = Math.max(maxIndex, parseInt(match[1], 10));
    }
    heitiMaxIndex.set(key, maxIndex);
  }
  const next = heitiMaxIndex.get(key) + 1;
  heitiMaxIndex.set(key, next);
  return `${baseName}.${next}`;
}

/********************
 * Pure computation per unit — no I/O in this loop, everything comes from
 * the tables already loaded above.
 ********************/
const toCreate = [];
const toUpdate = [];
const toDelete = [];
let failed = 0;

for (const unit of units) {
  try {
    const sersmidiTegund = unit.getCellValue(U_SERSMIDI_TEGUND)?.name || "";
    const isSokull = sersmidiTegund === "Sökull";

    // Innihald — plain-language summary of what's in the box, for the
    // operator. Reconstructed from historical examples (the script that
    // used to generate this was deleted) — flag any mismatch.
    function buildInnihald() {
      if (sersmidiTegund === "Hurð")      return "Hurð / karmur";
      if (sersmidiTegund === "Borðplata") return "Borðplata";
      if (sersmidiTegund === "Stök vara") return "Stök vara";
      if (sersmidiTegund === "Sérsmíði")  return "Ath. teikningar";
      if (isSokull) return "";

      const frontHlidTegund = unit.getCellValue(U_FRONT_HLID_TEGUND)?.name || "";
      if (frontHlidTegund) return frontHlidTegund;

      const drawerParts = [];
      let totalDrawers = 0;
      for (const letter of U_DRAWER_FIELDS) {
        const qty = Number(unit.getCellValue(letter)) || 0;
        if (qty > 0) {
          drawerParts.push(`${qty}×${letter}`);
          totalDrawers += qty;
        }
      }
      if (!drawerParts.length) return "";

      const material = unit.getCellValue(U_SKUFFUTEGUND)?.name || "";
      const materialSuffix = material ? ` (${material})` : "";
      const ledQty = Number(unit.getCellValue(U_LED_MAGN)) || 0;
      const ledSuffix = ledQty > 0 ? ` | LED ×${ledQty}` : "";

      return `Skúffur: ${drawerParts.join(" · ")}${materialSuffix} | Skúffufrontar: ${totalDrawers}${ledSuffix}`;
    }

    const neededTags = new Set();
    const instanceCounts = new Map();
    if (!isSokull) {
      const linkedParts = unit.getCellValue(U_SOGUNARLISTI) || [];
      for (const link of linkedParts) {
        const rec = partsById.get(link.id);
        if (!rec) continue;
        if (!rec.getCellValue(P_CNC)) continue;
        const partName = String(rec.getCellValue(P_PARTUR) || "").trim();
        if (!partName) continue;

        const cap = QUANTITY_CAPS[partName];
        if (!cap) {
          neededTags.add(partName);
          continue;
        }

        const qty = Math.max(1, Math.round(Number(rec.getCellValue(P_QTY)) || 1));
        const already = instanceCounts.get(partName) || 0;
        const toAdd = Math.min(qty, cap - already);
        for (let i = 1; i <= toAdd; i++) {
          neededTags.add(`${partName} #${already + i}`);
        }
        instanceCounts.set(partName, already + toAdd);
      }
    }

    const finalTags = new Set(
      [...neededTags].map((t) => (validChoiceNames.has(t) ? t : FALLBACK_TAG))
    );

    const existingLinks = unit.getCellValue(U_MILL_LINK) || [];
    const existingRecords = existingLinks.map((l) => millById.get(l.id)).filter(Boolean);
    const existingRecord = existingRecords.find((r) => !r.getCellValue(M_LOCKED)) || null;
    const blockedByLock = existingLinks.length > 0 && !existingRecord;

    if (blockedByLock) {
      // Every linked row is locked (finished/reviewed) — never touch it.
    } else if (finalTags.size === 0) {
      if (existingRecord) toDelete.push(existingRecord.id);
    } else {
      const projectLinkNew = unit.getCellValue(U_PROJECT_LINK) || [];
      const projectLink = projectLinkNew.length ? projectLinkNew : (unit.getCellValue(U_PROJECT_LINK_OLD) || []);

      // Reconcile the operator-facing "remaining" list against the new
      // backend set instead of overwriting it: items newly required get
      // added back in, items no longer required get removed, everything
      // else is left exactly as the operator left it.
      let remainingTags;
      if (existingRecord) {
        const oldBackend = new Set((existingRecord.getCellValue(M_NEEDED_BACKEND) || []).map((v) => v.name));
        const oldRemaining = new Set((existingRecord.getCellValue(M_NEEDED) || []).map((v) => v.name));
        const addedItems = [...finalTags].filter((t) => !oldBackend.has(t));
        const removedItems = [...oldBackend].filter((t) => !finalTags.has(t));
        remainingTags = new Set(oldRemaining);
        for (const t of removedItems) remainingTags.delete(t);
        for (const t of addedItems) remainingTags.add(t);
      } else {
        remainingTags = new Set(finalTags);
      }

      const fields = {
        [M_NEEDED_BACKEND]: [...finalTags].map((name) => ({ name })),
        [M_NEEDED]: [...remainingTags].map((name) => ({ name })),
        [M_RASTEX]: Boolean(unit.getCellValue(U_RASTEX)),
        [M_NOTE]: unit.getCellValue(U_CNC_NOTE) || null,
        [M_INNIHALD]: buildInnihald() || null,
        [M_PROJECT_LINK]: projectLink.map((p) => ({ id: p.id })),
        [M_UNIT_LINK]: [{ id: unit.id }],
      };

      if (existingRecord) {
        toUpdate.push({ id: existingRecord.id, fields });
      } else {
        const baseName = unit.name || unit.id;
        fields[M_NAME] = nextHeiti(baseName, projectLink);
        toCreate.push({ fields });
      }
    }
  } catch (err) {
    failed++;
    console.error(`Unit ${unit.id} (${unit.name}) failed: ${err.message}`);
  }
}

/********************
 * Apply — batched, up to 50 records per call, each batch = 1 query.
 ********************/
for (const batch of chunk(toCreate, 50)) await millTable.createRecordsAsync(batch);
for (const batch of chunk(toUpdate, 50)) await millTable.updateRecordsAsync(batch);
for (const batch of chunk(toDelete, 50)) await millTable.deleteRecordsAsync(batch);

if (recordId) {
  output.set("units_processed", units.length);
  output.set("units_failed", failed);
  output.set("created", toCreate.length);
  output.set("updated", toUpdate.length);
  output.set("deleted", toDelete.length);
}
