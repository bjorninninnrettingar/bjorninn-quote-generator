# Skrifstofa pages — Apple pass (started 2026-10-28)

Owner brief: CRM, Skipulagsferli, Framleiðsla, Starfsmenn get the same treatment as /smida — nothing superfluous, white space, day-to-day first, rare things one tap away, every failure prevented before it can happen. Airtable untouched (150 automations); viewer-side only. Rakel (role `allt`) sees Framleiðsla already.

## Done
- **Shared shell (`office-shell.js`, `virkni-bell.js`)**: line icons (`ICON_PATHS`) instead of emoji; `more: true` nav items (Bakendi, Para tæki) sit under a quiet "Meira" row and are not draggable; collapsed sidebar shows a "B" monogram.
- **/starfsmenn** (`starfsmenn.html`, replaces /laun; `/laun` redirects, nav id `starfsmenn`, eigandi only): "Bíður þín" (pending Orlof, shown only if any, two-step confirm because approval can't be undone from here), "Fólk · N inni núna" (open Stimplanir shift per person, flags a shift open > 14 h as a forgotten clock-out), one row per person → drawer (hours, absences, shifts; pay figures behind "Sýna laun"), "Fyrri orlofsbeiðnir" on demand. Names come from Launatímabil (Starfsmenn is unreadable through the proxy), so a person with no Launatímabil row yet doesn't appear.

- **/framleidsla** (rewritten; nav label now "Framleiðsla"): list sorted by urgency (Of seint / Í vinnslu / Tilbúið til að byrja / Má afhenda, no kanban — nothing was dragged), each row = due text ("3 dögum of seint"), % bar. Project page (`?recordId=`): stage + due + priority, Staða (Heild/Sögun/Fræsing), amber "Athugið" notes (Hafa í huga / Fræsari / Uppsetning / Spónlagning), Teikningar (Lokateikningar, Úr skipuleggjara, Sérfræsing, Málsettar myndir, Heimilistæki — images open in a lightbox with ←/→/Esc, PDFs in a new tab), "Saga verksins" (= `/api/virkni?t=`), Undirbúningur checklist (Efni, CNC, Teikningar prentaðar, Verkfundur, Cutty) + Pantaðir listar statuses, and links to the tools. Starfsmenn drawer widened to 760 px (4 KPI tiles in one row).

## Next (agreed order)
Skipulagsferli → CRM (largest, last). Each: what waits for me first, kanban secondary, guards against moving a project forward when Line Items / Sögunarlisti aren't ready.
