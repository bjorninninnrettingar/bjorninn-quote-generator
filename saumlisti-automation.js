/************************************************************
 * Script 1 — Generate "Saumalisti 🧵" lines for a PROJECT
 *
 * Trigger: Automation on Tækifæri 📣 (projects)
 * Input variable REQUIRED: recordId  (project record id)
 *
 * CHANGELOG:
 *   v1.0  Initial version — veneer sewing list per Rými.
 *         Groups veneer cabinets (Fronta efni viðskiptavinar /
 *         Fronta efni 2 Viðskiptavinar → Undirflokkur = "Spónlagt")
 *         by Heiti rýmis. Calculates sheet dimensions using Dálkur grouping
 *         so upper+base cabinets in the same column are not double-counted.
 ************************************************************/

const { recordId } = input.config();
if (!recordId) throw new Error("Missing input variable: recordId");

/********************
 * CONFIG
 ********************/
const PROJECTS_TABLE   = "Tækifæri 📣 (projects)";
const UNITS_TABLE      = "Eyðublað ✏️";
const MATERIALS_TABLE  = "Efnislisti 🧱";
const SAUMALISTI_TABLE = "Saumalisti 🧵";

// Eyðublað fields
const U_PROJECT_LINK   = "Tækifæri 📣";
const U_HEITI_RYMIS    = "Heiti rýmis";
const U_FRONTAEFNI     = "Fronta efni viðskiptavinar";
const U_FRONTAEFNI_2   = "Fronta efni 2 Viðskiptavinar";
const U_BREIDD         = "Breidd";
const U_HAED           = "Hæð";
const U_FJOLDI         = "Fjöldi eininga";
const U_DALKUR         = "Dálkur";

// Efnislisti fields
const M_UNDIRFLOKKUR   = "Undirflokkur 🗂️";
const VENEER_CATEGORY  = "Spónlagt";
const SHEET_OVERSIZE_MM = 60; // Added to both width and height for trimming allowance

// Saumlisti fields
const S_PROJECT        = "Tækifæri 📣";
const S_RYMI           = "Rými";
const S_BREIDD_BLAÐS   = "Breidd blaðs (mm)";
const S_HAED_BLAÐS     = "Hæð blaðs (mm)";
const S_FLATARMAL_BLAÐS = "Flatarmál blaðs (m²)";
const S_FLATARMAL_NOTAD = "Flatarmál notað (m²)";
const S_FJOLDI_DALKA   = "Fjöldi dálka";

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

/********************
 * MAIN
 ********************/
const projectsTable  = base.getTable(PROJECTS_TABLE);
const unitsTable     = base.getTable(UNITS_TABLE);
const materialsTable = base.getTable(MATERIALS_TABLE);
const saumalistiTable = base.getTable(SAUMALISTI_TABLE);

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
  fields: [U_PROJECT_LINK, U_HEITI_RYMIS, U_FRONTAEFNI, U_FRONTAEFNI_2, U_BREIDD, U_HAED, U_FJOLDI, U_DALKUR],
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

// Delete old Saumlisti records for this project
const oldSaumQuery = await saumalistiTable.selectRecordsAsync({ fields: [S_PROJECT] });
const toDelete = [];
for (const r of oldSaumQuery.records) {
  const projLinks = getLinks(r, S_PROJECT);
  if (projLinks.some(x => x.id === recordId)) toDelete.push(r.id);
}
if (toDelete.length) await batchDelete(saumalistiTable, toDelete);
output.set("dbg_deletedOldRecords", toDelete.length);

// Build new Saumlisti records
const newRecords = [];

for (const [rymi, units] of byRymi) {
  // --- sheetHeight: max Hæð across all veneer cabinets in this Rými ---
  let sheetHeight = 0;
  for (const u of units) {
    const h = toNumber(u.getCellValue(U_HAED));
    if (h > sheetHeight) sheetHeight = h;
  }

  // --- Group by Dálkur: upper+base cabinets sharing the same Dálkur are in
  //     the same physical column. Column width = Breidd × max(Fjöldi eininga)
  //     of cabinets in that Dálkur group. ---
  const dalkulMap = new Map(); // dálkur number → { breidd, maxFjoldi }
  for (const u of units) {
    const dalkur = toNumber(u.getCellValue(U_DALKUR));
    const breidd = toNumber(u.getCellValue(U_BREIDD));
    const fjoldi = toNumber(u.getCellValue(U_FJOLDI)) || 1;

    if (!dalkulMap.has(dalkur)) {
      dalkulMap.set(dalkur, { breidd, maxFjoldi: fjoldi });
    } else {
      const existing = dalkulMap.get(dalkur);
      // All cabinets in the same Dálkur should share the same Breidd.
      // Take max Fjöldi eininga to represent how many physical columns this Dálkur spans.
      if (fjoldi > existing.maxFjoldi) existing.maxFjoldi = fjoldi;
    }
  }

  // sheetWidth = sum of (Breidd × max Fjöldi eininga) per unique Dálkur
  let sheetWidth = 0;
  let uniqueColumns = 0; // total number of physical column instances
  for (const [, col] of dalkulMap) {
    sheetWidth += col.breidd * col.maxFjoldi;
    uniqueColumns += col.maxFjoldi;
  }

  // sheetAreaM2 = sheetWidth × sheetHeight / 1,000,000
  const oversizedWidth  = sheetWidth  + SHEET_OVERSIZE_MM;
  const oversizedHeight = sheetHeight + SHEET_OVERSIZE_MM;
  const sheetAreaM2 = Math.round((oversizedWidth * oversizedHeight / 1_000_000) * 100) / 100;

  // usedAreaM2 = sum of (Breidd × Hæð × Fjöldi eininga) for all cabinets
  let usedAreaRaw = 0;
  for (const u of units) {
    const breidd = toNumber(u.getCellValue(U_BREIDD));
    const haed   = toNumber(u.getCellValue(U_HAED));
    const fjoldi = toNumber(u.getCellValue(U_FJOLDI)) || 1;
    usedAreaRaw += breidd * haed * fjoldi;
  }
  const usedAreaM2 = Math.round((usedAreaRaw / 1_000_000) * 100) / 100;

  newRecords.push({
    fields: {
      [S_PROJECT]:         [{ id: recordId }],
      [S_RYMI]:            rymi,
      [S_BREIDD_BLAÐS]:   oversizedWidth,
      [S_HAED_BLAÐS]:     oversizedHeight,
      [S_FLATARMAL_BLAÐS]: sheetAreaM2,
      [S_FLATARMAL_NOTAD]: usedAreaM2,
      [S_FJOLDI_DALKA]:   uniqueColumns,
    },
  });
}

if (!newRecords.length) {
  output.set("status", "Engar Rými-færslur búnar til (veneer-einingar án Heiti rýmis?).");
  return;
}

await batchCreate(saumalistiTable, newRecords);

output.set(
  "status",
  `Saumalisti: ${newRecords.length} færslur búnar til fyrir ${veneerUnits.length} veneer-einingu(r) í ${byRymi.size} rými.`
);
