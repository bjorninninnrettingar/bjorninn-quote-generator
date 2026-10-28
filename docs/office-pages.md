# Skrifstofa pages — Apple pass (started 2026-10-28)

Owner brief: CRM, Skipulagsferli, Framleiðsla, Starfsmenn get the same treatment as /smida — nothing superfluous, white space, day-to-day first, rare things one tap away, every failure prevented before it can happen. Airtable untouched (150 automations); viewer-side only. Rakel (role `allt`) sees Framleiðsla already.

## Done
- **Shared shell (`office-shell.js`, `virkni-bell.js`)**: line icons (`ICON_PATHS`) instead of emoji; `more: true` nav items (Bakendi, Para tæki) sit under a quiet "Meira" row and are not draggable; collapsed sidebar shows a "B" monogram.
- **/starfsmenn** (`starfsmenn.html`, replaces /laun; `/laun` redirects, nav id `starfsmenn`, eigandi only): "Bíður þín" (pending Orlof, shown only if any, two-step confirm because approval can't be undone from here), "Fólk · N inni núna" (open Stimplanir shift per person, flags a shift open > 14 h as a forgotten clock-out), one row per person → drawer (hours, absences, shifts; pay figures behind "Sýna laun"), "Fyrri orlofsbeiðnir" on demand. Names come from Launatímabil (Starfsmenn is unreadable through the proxy), so a person with no Launatímabil row yet doesn't appear.

## Next (agreed order)
Framleiðsla → Skipulagsferli → CRM (largest, last). Each: what waits for me first, kanban secondary, guards against moving a project forward when Line Items / Sögunarlisti aren't ready.
