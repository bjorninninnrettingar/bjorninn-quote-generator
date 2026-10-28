# Owner Airtable steps (2026-10-28, from scratch/scan-2026-10-28-verkstaedi.md)

Nothing here was applied. Check `list_automations` before testing any status write.
Also needed for G16: add Vercel env var `OWNER_KEY` (only then can the owner override the Tilbúið -> Má afhenda gate in api/verk-status.js; a redeploy is required).

Texti hér að neðan er sóttur beint úr Airtable (read-only MCP) 2026-10-28. Chat-slóðir/lyklar eru **ekki** prentaðir; aðeins fyrstu 12 stafir (`https://chat`) sjást.

Paste order (top to bottom): **1** G3 formula -> **2** G4 check -> **3** Chat webhook secrets (biggest job) -> **4** G11 -> **5** G13 (only after api/verk-status.js sends the chat itself) -> **6** G24.

---

## G3 - formula "Framleiðslustaða skv. gögnum 🤖" (Tækifæri 📣, field `fldOeFl3XAMhZJEkm`)
Cause (confirmed): the "Í vinnslu" test uses `Vinnutími starfsmanna (klst) 🕒` (a rollup over ALL Verktímar 🕒 rows of the project), so any old time entry makes the project "Verk í vinnslu" at once. A formula cannot filter a rollup by date, so the exact fix is to drop that term and judge "started" by sögun only.

Open the field -> Edit field -> formula.

**Find:**
```
IF(AND({Framvinda sögunar} >= 0.95, IF({Fjöldi hluta til að fræsa 🔬} = 0, 1, {Fjöldi hluta fræstir 🔬} / {Fjöldi hluta til að fræsa 🔬}) >= 0.6), "Samsetning og pökkun", IF(OR({Vinnutími starfsmanna (klst) 🕒} > 0, {Framvinda sögunar} > 0), "Verk í vinnslu", ""))
```
**Replace with:**
```
IF(AND({Framvinda sögunar} >= 0.95, IF({Fjöldi hluta til að fræsa 🔬} = 0, 1, {Fjöldi hluta fræstir 🔬} / {Fjöldi hluta til að fræsa 🔬}) >= 0.6), "Samsetning og pökkun", IF({Framvinda sögunar} > 0, "Verk í vinnslu", ""))
```
(If the editor's spacing differs, replace only the inner `OR({Vinnutími starfsmanna (klst) 🕒} > 0, {Framvinda sögunar} > 0)` with `{Framvinda sögunar} > 0`.)

Automations affected (no script text changes, behaviour does):
- `Framleiðsla · Hafin → Í vinnslu` (`wflax4ohwmWYAnwoL`) - trigger is `Framleiðslustaða = "Verk í vinnslu"`; after the fix it fires only once sögun starts.
- `Framleiðsla · 95% sagað → Samsetning` (`wflAGBInuliPFcwxL`) - first branch unchanged.
- Downstream: `Póstur · F2 Byrjað í framleiðslu` (`wflQ5JIaNklKNfKAd`, currently OFF) via Staða í framleiðslu; verk.html (~line 873/884) reads the field.
Side effect: a project with only Verktímar logged (no sögun yet) stays "Tilbúið til framleiðslu" until the first part is sawn.

## G4 - Virkni-logg: ALREADY DONE in Airtable
`list_automations` shows exactly one `🔔 Virkni-logg — Stöður` (`wflWM7MBu9Jv3ccAc`, deployed) whose script is the 2026-10-27 version (values from the trigger, compared with the last `Gildi`), watching Staða í söluferli, Staða í skipulagi, Staða í framleiðslu. The three old `Virkni-logg — Söluferli / Skipulag / Framleiðsla` automations no longer exist. Nothing to paste. Only check that the step's 4 input variables `recordId`, `sala`, `skipulag`, `framleidsla` are mapped (they are, per the API). No Chat call in it, so the webhook work does not touch it.

## G11 - Skúffusamantekt: checkbox trigger
Automation: `Skipulag · Skúffusamantekt` (`wflMovNqMtRjKZBPc`), one script step "Tekur saman skúffur fyrir verkefni", input `recordId`, trigger currently the button. Recommended: first create the checkbox field `Keyra skúffusamantekt` on Tækifæri 📣, then **Duplicate** the automation (keeps the Airtable button working) and give the copy the trigger "When record matches conditions: `Keyra skúffusamantekt` is checked"; map `recordId` = Airtable record ID. Apply the three edits below **only to the copy** (they write the checkbox, which must exist) so the box is unticked after each run:

Edit 1 - **Find:**
```
const P_SUMMARY          = "Skúffusamantekt";
```
**Replace with:**
```
const P_SUMMARY          = "Skúffusamantekt";
const P_RUN              = "Keyra skúffusamantekt";
```
Edit 2 - **Find:**
```
await projectsTable.updateRecordAsync(recordId, { [P_SUMMARY]: "Engar skúffur." });
```
**Replace with:**
```
await projectsTable.updateRecordAsync(recordId, { [P_SUMMARY]: "Engar skúffur.", [P_RUN]: false });
```
Edit 3 - **Find:**
```
await projectsTable.updateRecordAsync(recordId, { [P_SUMMARY]: sections.join("\n") });
```
**Replace with:**
```
await projectsTable.updateRecordAsync(recordId, { [P_SUMMARY]: sections.join("\n"), [P_RUN]: false });
```
The /ferli hook that ticks the box is not built; until it is, tick it by hand. Automations containing this script: only `wflMovNqMtRjKZBPc` (+ its copy).

## G13 - "Chat · Má afhenda → Skrifstofa" (`wflBTkhhtbLWybOLn`): turn OFF
No script edit to turn it off. Do it only after api/verk-status.js posts the Má afhenda chat itself (not done this round), otherwise nobody is told. Until then it stays ON and needs the webhook fix below (script 6).

## G24 - dead "LOKA PRENT Skipulag 5.0" button
No automation in the base has that name (checked all 46). The live `Prent · Lokaprent skipulags` (`wflXsdxz7UiNzOmmx`, calls /api/merge-pdfs with `WEBHOOK_SECRET`) is deployed and probably what the button should call - do **not** delete it. The dead thing is a Button field / interface element labelled "LOKA PRENT Skipulag 5.0" that the API cannot see: in Tækifæri 📣 look for a Button field with that label, check its action (none / old automation), delete the field and remove it from any interface. Not scriptable from here.

---

## Chat webhook: URLs hard-coded in scripts (G18) - exact fix
Audit of every automation script: **22 script steps in 18 automations** contain a full Google Chat webhook URL with `key=` and `token=` in clear text. All use the same `key`; the `token` differs per space. Every other script already uses the convention `await input.secret('WEBHOOK_SECRET')`. The three large Skipulag scripts (`wflqQLKQBKIpNutDn`, `wflstmiM1A5xC8N66`, `wflPGRyv0VYi4AZpd`) were not opened in full and have no Chat step by their node list - Ctrl+F `chat.googleapis.com` in them to be sure.

### Step 0 - rotate (recommended)
The URLs were visible to everyone with base-editor access and appear in this audit's tool logs. In Google Chat, per space: Apps & integrations -> Webhooks -> delete the old webhook, create a new one. Use the NEW URL as the secret value below so the old tokens die.

### Step 1 - the three secrets (names used by the Replace text)
| Secret name | Space | Scripts |
|---|---|---|
| `GOOGLE_CHAT_WEBHOOK_SKRIFSTOFA` | `spaces/AAQA4w6yK6o` (Skrifstofa) | 1-14 |
| `GOOGLE_CHAT_WEBHOOK_ALMENNT` | `spaces/AAQANnY-4U0` (ALMENNT 🐻) | 15-18 |
| `GOOGLE_CHAT_WEBHOOK_VERKSTAEDI` | `spaces/AAQAmeYUzJc` (Verklok, Laun, Eldhúsvakt) | 19-22 |

Adding a secret: open the automation -> click the "Run a script" step -> left panel **Secrets** -> **+ Add secret** -> Name = as above, Value = the full webhook URL (starts `https://chat`) -> Save. In every other step needing it: Secrets -> **+ Add secret** -> pick the existing one from the list (`WEBHOOK_SECRET` is shared across steps the same way). A step that calls `input.secret('X')` without X attached throws, so attach and edit in the same sitting.

### Step 2 - Find / Replace patterns
The URL is on one line; search `chat.googleapis.com` to jump to it, select the whole line, replace. Shown masked (`…` = rest of the line):

Pattern A (scripts 1-4)
**Find:**
```
const WEBHOOK_URL = "https://chat…";
```
**Replace with:**
```
const WEBHOOK_URL = await input.secret('GOOGLE_CHAT_WEBHOOK_SKRIFSTOFA');
```
Pattern B (scripts 5-12, 14-17; first line of script)
**Find:**
```
let webhookUrl = "https://chat…";
```
**Replace with:** (SKRIFSTOFA for 5-12 and 14; ALMENNT for 15-17)
```
let webhookUrl = await input.secret('GOOGLE_CHAT_WEBHOOK_SKRIFSTOFA');
```
Pattern C (script 13)
**Find:** `const webhookUrl = "https://chat…";`
**Replace with:** `const webhookUrl = await input.secret('GOOGLE_CHAT_WEBHOOK_SKRIFSTOFA');`

Pattern D (script 18)
**Find:** `const WEBHOOK = "https://chat…";`
**Replace with:** `const WEBHOOK = await input.secret('GOOGLE_CHAT_WEBHOOK_ALMENNT');`

Pattern E (scripts 19, 20 - single quotes)
**Find:** `const WEBHOOK_URL = 'https://chat…';`
**Replace with:** `const WEBHOOK_URL = await input.secret('GOOGLE_CHAT_WEBHOOK_VERKSTAEDI');`

Pattern F (script 21)
**Find:** `const CHAT = "https://chat…";`
**Replace with:** `const CHAT = await input.secret('GOOGLE_CHAT_WEBHOOK_VERKSTAEDI');`

Pattern G (script 22, URL inline in the call)
**Find:** `await fetch("https://chat…", {`
**Replace with:** `await fetch(await input.secret('GOOGLE_CHAT_WEBHOOK_VERKSTAEDI'), {`

### Step 3 - the 22 scripts
Order: 1-4 first (Konto, money flow), then the other ON ones; the OFF ones (10-13, 16-18) are zero risk and can wait.

| # | Automation (id) | Step (node id) | Pattern | Secret | State |
|---|---|---|---|---|---|
| 1 | Fjármál · Konto drög G1 (hak) (`wfliSHzoCuapBXoGj`) | "Skilaboð í G.CHAT💬" (`waca0giiMexmdkcTR`) | A | SKRIFSTOFA | ON |
| 2 | Fjármál · Konto drög G2 (`wfl2CC8XPIZqXry2I`) | 2nd script (`wachxxNU7D3FR9jtG`) | A | SKRIFSTOFA | ON |
| 3 | Fjármál · Konto drög lokagreiðsla (`wflKmGiyqEL6tDJng`) | 2nd script (`wacqG8asYp32rl1sh`) | A | SKRIFSTOFA | ON |
| 4 | Fjármál · Konto drög uppgjör (`wflRjajCDarwbA1NV`) | 2nd script (`waca1onmHciWLkKeX`) | A | SKRIFSTOFA | ON |
| 5 | Sala · Unnið → For-skipulag + chat (`wflGbtZowOX4cdk0M`) | "Sendir tilkynningu á SKRIF-CHAT" (`wac56TuYpkieaXkyg`, 2nd condition branch) | B | SKRIFSTOFA | ON |
| 6 | Chat · Má afhenda → Skrifstofa (`wflBTkhhtbLWybOLn`) | (`waczJIkMQVGu5lymo`) | B | SKRIFSTOFA | ON (OFF after G13) |
| 7 | Sala · Eftirfylgni 3 dagar → chat (`wflBClHfYBCN47Oac`) | (`wacUmAAhBxhe0ByNf`) | B | SKRIFSTOFA | ON |
| 8 | Sala · Eftirfylgni 15 dagar → chat (`wflt0vzOzH1zDr9AO`) | (`wacgLUlFOTkBAnyxL`) | B | SKRIFSTOFA | ON |
| 9 | Skipulag · Aftur í forskipulag (`wflm9KW0P8UPL9mIS`) | (`wacUVZ2TdNl150ue3`) | B | SKRIFSTOFA | ON |
| 10 | Póstur · F2 Búið í skipulagi (`wflE3PnxCuwXmRhAI`) | (`wacZ8lBvqMQRIKxYG`) | B | SKRIFSTOFA | OFF |
| 11 | Póstur · F2 Byrjað í framleiðslu (`wflQ5JIaNklKNfKAd`) | (`wacobo8b3VXCJmel7`) | B | SKRIFSTOFA | OFF |
| 12 | Póstur · F1 Tapað (handvirkt) (`wflns7flkidBjccAy`) | (`wacN0dkAuiGCWk9c2`) | B | SKRIFSTOFA | OFF |
| 13 | Sala · Næsta söluskref → chat (`wflej8o5oBl9NWPSJ`) | (`wacmd730ZwkWXkPyu`) | C | SKRIFSTOFA | OFF |
| 14 | Chat · Lok dags þrif (`wflWVNy9m8xjs4XjM`) | "Daily með Rakel tilkynningar" (`wac8aOVvJUSKrTxJ3`) | B | SKRIFSTOFA | ON |
| 15 | Chat · Lok dags þrif (`wflWVNy9m8xjs4XjM`) | "Almenn þrif, lok dags" (`waczhGdiqAX8nTnZl`) | B | ALMENNT | ON |
| 16 | Chat · Klár til framleiðslu → Almennt (`wflEy97JrOOsJAcSR`) | (`wachU2MSvgehEpCyq`) | B | ALMENNT | OFF |
| 17 | Chat · Sein skil → Almennt (`wflIbdF8gPNDdx1i9`) | (`waclx6khkhds8mrYI`) | B | ALMENNT | OFF |
| 18 | Chat · Quick Fix → Almennt (`wflIbyokoAWnxFDEF`) | (`wacuUvm1GF2t1Pomc`) | D | ALMENNT | OFF |
| 19 | Framleiðsla · Verklok (`wflWC2TPgyvUvCdi6`) | (`wac4vNumhhBklUtPk`, in conditional group) | E | VERKSTAEDI | ON |
| 20 | Laun · Daglegt utanumhald (7:00) (`wflQ570nrwBYcdPtF`) | 1st script (`wacysJhIJUeSa6eIo`; same code as #19) | E | VERKSTAEDI | ON |
| 21 | Laun · Daglegt utanumhald (7:00) (`wflQ570nrwBYcdPtF`) | "LAUNA utanumhald" (`wacKTIyW4zMgqoe52`) | F | VERKSTAEDI | ON |
| 22 | Chat · Eldhúsvaktin (mán 8:00) (`wfl29dAfy0biLKjPe`) | (`wacg4DiJx3DCHolCq`) | G | VERKSTAEDI | ON |

Automations affected = exactly these 18 (scripts 14 and 15 share one automation; 20 and 21 share one). Others use only `WEBHOOK_SECRET`.

Notes found on the way:
- **#21 is already broken:** its `const CHAT = "…"` has a truncated key (`AIzaSyDd` then literal `•••••`, a masked copy was pasted). `chat()` swallows errors, so payroll/orlof/veikindi reminders have not been reaching Chat. Pattern F fixes it too.
- #19 and #20 are the same project-priority cascade script in two automations posting to one space.
- Scripts 1-4 are identical except the node; after fixing #1 you can copy the whole script into 2-4.
- `Sala · Ósnert 30 dagar → Tapað` (`wflGwyU2QMhHOLXqk`) has a script step with an empty script - dead, delete the step when convenient.
- The `Prent · …` steps say "Muna að uppfæra token … GITHUB" but contain no GitHub token (only `WEBHOOK_SECRET`); the description is stale.
- Test only on OFF automations or a harmless record: "Test action" on a deployed Chat step posts a real message, and the Konto ones may run earlier steps. `list_automations` first.
