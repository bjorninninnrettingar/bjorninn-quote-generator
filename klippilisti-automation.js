/************************************************************
 * Script 2 — Generate "Klippilisti ✂️" lines for a PROJECT
 *
 * Trigger: Automation on Tækifæri 📣 (projects)
 * Input variable REQUIRED: recordId  (project record id)
 *
 * CHANGELOG:
 *   v1.0  Initial version — veneer cutting list, one record per
 *         physical cabinet instance (expanded by Fjöldi eininga).
 *         Positions cabinets on the veneer sheet using Dálkur ordering.
 *         Upper cabinets (Efriskápur, Loftunarskápur) and tall cabinets
 *         (Hárskápur) → Y = 0 (top of sheet).
 *         Base cabinets (Grunnskápur, Lagnaskápur, Ofnaskápur) → Y = maxHeight − Hæð.
 *         Horn is always "1" (top-left corner reference).
 *   v1.1  Front material fields renamed to "Fronta efni viðskiptavinar" and
 *         "Fronta efni 2 Viðskiptavinar". Veneer category changed to "Spónlagt".
 ************************************************************/

const { recordId } = input.config();
if (!recordId) throw new Error("Missing input variable: recordId");

/********************
 * CONFIG
 ********************/
const PROJECTS_TABLE   = "Tækifæri 📣 (projects)";
const UNITS_TABLE      = "Eyðublað ✏️";
const MATERIALS_TABLE  = "Efnislisti 🧱";
const KLIPPILISTI_TABLE = "Klippilisti ✂️";

// Eyðublað fields
const U_PROJECT_LINK   = "Tækifæri 📣";
const U_HEITI_RYMIS    = "Heiti rýmis";
const U_SKAPAT_EGUND   = "Skápategund";
const U_FRONTAEFNI     = "Fronta efni viðskiptavinar";
const U_FRONTAEFNI_2   = "Fronta efni 2 Viðskiptavinar";
const U_BREIDD         = "Breidd";
const U_HAED           = "Hæð";
const U_FJOLDI         = "Fjöldi eininga";
const U_DALKUR         = "Dálkur";

// Efnislisti fields
const M_UNDIRFLOKKUR   = "Undirflokkur 🗂️";
const VENEER_CATEGORY  = "Spónlagt";

// Klippilisti fields
const K_PROJECT        = "Tækifæri 📣";
const K_RYMI           = "Rými";
const K_SKAPUR         = "Skápur";
const K_HEITI_SKAPUR   = "Heiti skáps";
const K_SKAPATEG       = "Skápategund";
const K_HORN           = "Horn";
const K_X              = "X (mm)";
const K_Y              = "Y (mm)";
const K_BREIDD         = "Breidd (mm)";
const K_HAED           = "Hæð (mm)";
const K_DALKUR         = "Dálkur";

// Cabinet type classification for Y positioning
const UPPER_TYPES = new Set(["Efriskápur", "Loftunarskápur"]);
const TALL_TYPES  = new Set(["Hárskápur"]);
const BASE_TYPES  = new Set(["Grunnskápur", "Lagnaskápur", "Ofnaskápur"]);

/********************
 * HELPERS
 ********************/
function toNumber(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function getSingleSelectName(rec, field) {
  try { return rec.getCellValue(field)?.name || ""; } catch { return ""; }
}

function getLinks(rec, field) {
  const v = rec.getCellValue(field);
  return Array.isArray(v) ? v : [];
}

function normalizeText(s) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

async function batchDelete(table, ids) {
  for (let i = 0; i < ids.length; i += 50)
    await table.deleteRecordsAsync(ids.slice(i, i + 50));
}

async function batchCreate(table, records) {
  for (let i = 0; i < records.length; i += 50)
    await table.createRecordsAsync(records.slice(i, i + 50));
}

/**
 * Given a cabinet type string, return the Y position on the veneer sheet.
 * UPPER_TYPES and TALL_TYPES hang from the top → Y = 0.
 * BASE_TYPES sit on the floor → Y = maxHeight − cabinetHeight.
 * Unknown types default to Y = 0.
 */
function calcY(skapateg, cabinetHaed, maxHeight) {
  if (BASE_TYPES.has(skapateg)) return maxHeight - cabinetHaed;
  // UPPER_TYPES, TALL_TYPES, and anything unrecognised → top of sheet
  return 0;
}

/********************
 * MAIN
 ********************/
const projectsTable   = base.getTable(PROJECTS_TABLE);
const unitsTable      = base.getTable(UNITS_TABLE);
const materialsTable  = base.getTable(MATERIALS_TABLE);
const klippilistiTable = base.getTable(KLIPPILISTI_TABLE);

// Verify project exists
const project = await projectsTable.selectRecordAsync(recordId);
if (!project) throw new Error(`Verkefni ekki fundið í "${PROJECTS_TABLE}": ${recordId}`);

output.set("projectName", project.name);

// Load all materials into a lookup map: id → Undirflokkur value
const materialsQuery = await materialsTable.selectRecordsAsync({ fields: [M_UNDIRFLOKKUR] });
const materialUndirflokkur = new Map();
for (const m of materialsQuery.records) {
  const val = normalizeText(m.getCellValueAsString(M_UNDIRFLOKKUR));
  materialUndirflokkur.set(m.id, val);
}

output.set("dbg_materialsLoaded", materialsQuery.records.length);

// Load all units linked to this project
const unitsQuery = await unitsTable.selectRecordsAsync({
  fields: [
    U_PROJECT_LINK, U_HEITI_RYMIS, U_SKAPAT_EGUND,
    U_FRONTAEFNI, U_FRONTAEFNI_2,
    U_BREIDD, U_HAED, U_FJOLDI, U_DALKUR,
  ],
});

const allUnits = unitsQuery.records.filter(u => {
  const links = getLinks(u, U_PROJECT_LINK);
  return links.some(x => x.id === recordId);
});

output.set("dbg_unitsForProject", allUnits.length);

// Filter to veneer units only: either front material field → Efnislisti → Undirflokkur = "Spónlagt"
// Note: "Fronta efni" fields return string IDs ["recXXX"] rather than [{id,name}] objects,
// so we handle both formats.
const veneerUnits = allUnits.filter(u => {
  const allLinks = [
    ...getLinks(u, U_FRONTAEFNI),
    ...getLinks(u, U_FRONTAEFNI_2),
  ];
  return allLinks.some(link => {
    const id = typeof link === "string" ? link : link?.id;
    return id && materialUndirflokkur.get(id) === VENEER_CATEGORY;
  });
});

output.set("dbg_veneerUnits", veneerUnits.length);

if (!veneerUnits.length) {
  output.set("status", "Engar fronta-einingar með Frontaefni fundnar fyrir þetta verkefni.");
  return;
}

// Group by Heiti rýmis
const byRymi = new Map(); // rými name → array of unit records
for (const u of veneerUnits) {
  const rymi = normalizeText(getSingleSelectName(u, U_HEITI_RYMIS) || u.getCellValueAsString(U_HEITI_RYMIS));
  if (!rymi) continue;
  if (!byRymi.has(rymi)) byRymi.set(rymi, []);
  byRymi.get(rymi).push(u);
}

output.set("dbg_rymi", Array.from(byRymi.keys()));

// Delete old Klippilisti records for this project
const oldQuery = await klippilistiTable.selectRecordsAsync({ fields: [K_PROJECT] });
const toDelete = [];
for (const r of oldQuery.records) {
  const projLinks = getLinks(r, K_PROJECT);
  if (projLinks.some(x => x.id === recordId)) toDelete.push(r.id);
}
if (toDelete.length) await batchDelete(klippilistiTable, toDelete);
output.set("dbg_deletedOldRecords", toDelete.length);

// Build new Klippilisti records
const newRecords = [];

for (const [rymi, units] of byRymi) {
  // maxHeight = max Hæð of all veneer cabinets in this Rými
  let maxHeight = 0;
  for (const u of units) {
    const h = toNumber(u.getCellValue(U_HAED));
    if (h > maxHeight) maxHeight = h;
  }

  // Sort cabinets by Dálkur ascending, then by record name for ties
  const sorted = [...units].sort((a, b) => {
    const da = toNumber(a.getCellValue(U_DALKUR));
    const db = toNumber(b.getCellValue(U_DALKUR));
    if (da !== db) return da - db;
    return (a.name || "").localeCompare(b.name || "");
  });

  // Build Dálkur groups in sorted order, preserving first-encounter ordering.
  // Each Dálkur group gets colQty = max(Fjöldi eininga) of any cabinet in it.
  // The group occupies colQty X positions starting at the current cumulative offset.
  // xOffset tracks the running left edge.

  // Pass 1: collect all unique Dálkur values in sorted order and their colQty
  const dalkulOrder = []; // ordered list of unique Dálkur numbers
  const dalkulColQty = new Map(); // dálkur → max Fjöldi eininga
  const dalkulBreidd = new Map(); // dálkur → Breidd (assume uniform per Dálkur)

  for (const u of sorted) {
    const dalkur = toNumber(u.getCellValue(U_DALKUR));
    const fjoldi = toNumber(u.getCellValue(U_FJOLDI)) || 1;
    const breidd = toNumber(u.getCellValue(U_BREIDD));

    if (!dalkulColQty.has(dalkur)) {
      dalkulOrder.push(dalkur);
      dalkulColQty.set(dalkur, fjoldi);
      dalkulBreidd.set(dalkur, breidd);
    } else {
      if (fjoldi > dalkulColQty.get(dalkur)) dalkulColQty.set(dalkur, fjoldi);
    }
  }

  // Pass 2: for each Dálkur, compute the X positions for each of its colQty slots
  // dalkulXSlots[dalkur] = [x0, x1, ... x_(colQty-1)]
  const dalkulXSlots = new Map();
  let xOffset = 0;
  for (const dalkur of dalkulOrder) {
    const breidd  = dalkulBreidd.get(dalkur);
    const colQty  = dalkulColQty.get(dalkur);
    const slots = [];
    for (let i = 0; i < colQty; i++) {
      slots.push(xOffset + i * breidd);
    }
    dalkulXSlots.set(dalkur, slots);
    xOffset += breidd * colQty;
  }

  // Pass 3: for each cabinet, emit one Klippilisti record per Fjöldi eininga instance.
  // Cabinets sharing the same Dálkur (e.g. Efriskápur above Grunnskápur) are in the
  // same physical column and must share the same X positions — so each cabinet always
  // starts from slot 0 of its Dálkur, not after the previous cabinet consumed slots.

  for (const u of sorted) {
    const dalkur    = toNumber(u.getCellValue(U_DALKUR));
    const breidd    = toNumber(u.getCellValue(U_BREIDD));
    const haed      = toNumber(u.getCellValue(U_HAED));
    const fjoldi    = toNumber(u.getCellValue(U_FJOLDI)) || 1;
    const skapateg  = getSingleSelectName(u, U_SKAPAT_EGUND);
    const heiti     = normalizeText(u.name || "");

    const slots = dalkulXSlots.get(dalkur) || [];
    const yPos  = calcY(skapateg, haed, maxHeight);

    // Emit one record per physical instance (N = fjoldi).
    // Use slots[i]; if fjoldi somehow exceeds slots.length, clamp to last slot.
    for (let i = 0; i < fjoldi; i++) {
      const xPos = slots[i] !== undefined ? slots[i] : (slots[slots.length - 1] ?? 0);

      newRecords.push({
        fields: {
          [K_PROJECT]:      [{ id: recordId }],
          [K_RYMI]:         rymi,
          [K_SKAPUR]:       [{ id: u.id }],
          [K_HEITI_SKAPUR]: heiti,
          [K_SKAPATEG]:     skapateg,
          [K_HORN]:         "1",
          [K_X]:            xPos,
          [K_Y]:            yPos,
          [K_BREIDD]:       breidd,
          [K_HAED]:         haed,
          [K_DALKUR]:       dalkur,
        },
      });
    }
  }
}

if (!newRecords.length) {
  output.set("status", "Engar Klippilisti-færslur búnar til (veneer-einingar án Heiti rýmis?).");
  return;
}

await batchCreate(klippilistiTable, newRecords);

output.set(
  "status",
  `Klippilisti: ${newRecords.length} færslur búnar til fyrir ${veneerUnits.length} veneer-einingu(r) í ${byRymi.size} rými.`
);
