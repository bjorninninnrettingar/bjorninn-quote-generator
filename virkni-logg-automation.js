/************************************************************
 * 🔔 Virkni-logg — Stöður  (2026-10-27)
 *
 * ONE automation instead of the three "🔔 Virkni-logg — Söluferli /
 * Skipulag / Framleiðsla" ones. Paste into the "Run a script" step.
 *
 * Trigger: When a record is updated — Tækifæri 📣 (projects),
 *          watch fields: Staða í söluferli, Staða í skipulagi,
 *          Staða í framleiðslu
 * Input variables (all from the TRIGGER record, not looked up):
 *   recordId    → Airtable record ID
 *   sala        → Staða í söluferli
 *   skipulag    → Staða í skipulagi
 *   framleidsla → Staða í framleiðslu
 *
 * Why: the old scripts re-read the record (selectRecordAsync), so when
 * T-15 hopped Tilbúið → Í vinnslu within 1 s both runs read "Í vinnslu"
 * — logged twice, "Tilbúið" never. Here the value comes from the trigger
 * and is compared with the project's last Virkni line (field Gildi), so
 * only real changes are written, once each.
 ************************************************************/
const cfg = input.config();
const recordId = cfg.recordId;
if (!recordId) throw new Error("recordId vantar");

const norm = v => {
  if (v == null) return "";
  if (Array.isArray(v)) v = v[0];
  if (v && typeof v === "object") return String(v.name || "");
  return String(v);
};
const FLOKKAR = [
  { flokkur: "Sala", value: norm(cfg.sala), text: (n, v) => `${n} fór í "${v}"` },
  { flokkur: "Skipulag", value: norm(cfg.skipulag), text: (n, v) => `${n} fór í skipulagsstöðu "${v}"` },
  { flokkur: "Framleiðsla", value: norm(cfg.framleidsla), text: (n, v) => `${n} fór í "${v}"` },
];

const PROJECTS = base.getTable("Tækifæri 📣 (projects)");
const VIRKNI = base.getTable("Virkni 🔔");
const VIRKNI_LINK = "fldmVqUXsZunT2HW2"; // Tækifæri → Virkni 🔔 (inverse link)
const project = await PROJECTS.selectRecordAsync(recordId, { fields: ["Heiti tækifæris / verkefnis", VIRKNI_LINK] });
if (!project) throw new Error("Verk fannst ekki: " + recordId);
const name = project.getCellValueAsString("Heiti tækifæris / verkefnis") || recordId;

// Last logged value per Flokkur, from this project's own Virkni lines.
const linkIds = (project.getCellValue(VIRKNI_LINK) || []).map(l => l.id);
const last = {};
if (linkIds.length) {
  const q = await VIRKNI.selectRecordsAsync({
    recordIds: linkIds,
    fields: ["Flokkur", "Gildi", "Texti", "Tími"],
    sorts: [{ field: "Tími", direction: "asc" }],
  });
  for (const r of q.records) {
    const fl = r.getCellValueAsString("Flokkur");
    if (!fl) continue;
    let g = r.getCellValueAsString("Gildi");
    if (!g) { // lines from before 2026-10-27 have no Gildi — read it back out of the text
      const m = r.getCellValueAsString("Texti").match(/"([^"]*)"\s*$/);
      g = m ? m[1] : "";
    }
    last[fl] = g;
  }
}

const val = f => f.value || "(tómt)";
// Changed = has history and differs. A Flokkur with no history (projects older than the
// log) is only written when nothing with history changed — otherwise the first edit of an
// old project would log all three statuses at once.
const changed = FLOKKAR.filter(f => f.flokkur in last && last[f.flokkur] !== val(f));
const toLog = changed.length ? changed : FLOKKAR.filter(f => !(f.flokkur in last) && f.value);

for (const f of toLog) {
  await VIRKNI.createRecordAsync({
    "Tækifæri": [{ id: recordId }],
    "Texti": f.text(name, val(f)),
    "Flokkur": { name: f.flokkur },
    "Gildi": val(f),
    "Tegund": { name: "staða" },
    "Til": { name: "Skrifstofa" },
    "Hver": "Airtable",
  });
}
output.set("logged", toLog.map(f => f.flokkur + ": " + val(f)).join(" | ") || "ekkert breyttist");
