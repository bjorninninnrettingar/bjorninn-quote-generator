# Owner Airtable steps (2026-10-28, from scratch/scan-2026-10-28-verkstaedi.md)

Nothing here was applied. Check `list_automations` before testing any status write.
Also needed for G16: add Vercel env var `OWNER_KEY` (only then can the owner override the Tilbúið -> Má afhenda gate in api/verk-status.js; a redeploy is required).

## G3 - formula "Framleiðslustaða skv. gögnum" (Tækifæri 📣, formula field, no script)
The current formula text was not readable from the repo, so an exact Find cannot be written here. Open the field, copy the formula and apply:

**Find:** (the term that counts every Verktímar row as "started", i.e. the COUNT/ARRAYJOIN of the Verktímar link used for the Í vinnslu test)
```
<the Verktímar-based "byrjað" condition in the current formula>
```
**Replace with:** (count only Verktímar rows dated on/after "Upphafs framleiðsludagur verks", or only sögun/fræsing progress > 0)
```
<same condition restricted to rows with Dagsetning >= {Upphafs framleiðsludagur verks}>
```
Automations affected: every automation that triggers on this field (Tilbúið / Í vinnslu / F2 post); /verk reads it (verk.html).

## G4 - Virkni-logg (script, full replace, no Find)
Paste the whole of `virkni-logg-automation.js` into the "Run a script" step of ONE automation, trigger "When a record is updated" on Tækifæri 📣 watching Staða í söluferli, Staða í skipulagi, Staða í framleiðslu; input variables recordId, sala, skipulag, framleidsla. Turn OFF the three old "🔔 Virkni-logg - Söluferli / Skipulag / Framleiðsla" automations.

## G13 - "💬 Má afhenda" automation: turn OFF (no script)
Only after api/verk-status.js sends the chat itself (not done in this round).

## G11 - Skúffusamantekt trigger
Change the existing automation trigger from button to "When checkbox is checked" (needs a checkbox field and a /ferli hook, not built). Automation containing the script: the one that writes `Skúffusamantekt` on Tækifæri.

## G18 / G24
G18: remove the duplicated Chat webhook calls from the 6+ scripts (needs a per-script review; no safe Find/Replace without reading each). G24: delete the dead "LOKA PRENT Skipulag 5.0" button/automation in the Airtable UI.


## Konto paid-sync fields (api/konto-paid-sync.js, api/konto-invoice.js, api/greidslur.js)
Create on Tækifæri 📣 (exact names; nothing else is renamed). Until they exist everything still works: the cron ticks Greiðsla 2/3 from guids parsed out of `Konto drög 🧾` and reports `missingFields:true`; G1 paid and the "already announced" memory need the fields.
1. `Konto reikningar JSON` - Long text (plain, no rich text). Written by the app; do not edit by hand.
2. `Greiðsla 1 greidd (Konto)` - Checkbox. Ticked by the cron when the G1 invoice is Paid in Konto.
Also: Vercel env `CRON_SECRET` must be set (field-check/morgunyfirlit use it). Check list_automations before testing: ticking Greiðsla 2/3 greidd fires "Skráir tíma þegar Greiðsla 2/3 er greidd" (intended).
First run by hand: `/api/konto-paid-sync?k=<VERK_KEY>&dry=1` and confirm the counts look right.
