# PRO mode UX audit — Rakel's path (2026-10-28, read-only, code walk)

Method: read `kitchen-planner.html` (proBoot / proBar / proCheck* / Tilboð / Smíða strip / pro-home), docs/pro-finish.md. Served locally, but the browser pane is mobile-width (shows the "Best á tölvu" gate) and the API does not answer, so nothing past the picker was walked live. Line numbers are in `kitchen-planner.html` as of today's main.

Flow as it really is: `?pro=home` (pick/new) -> `?pro=<rec>` -> Rými (room cards) -> Rýmið (shape/size) -> Teikning (editor; Ný eining, Smíða box editor, Efni is a left accordion) -> top bar: Vista (= Yfirferð panel) -> Tilboð panel (Prenta / Senda). There is no "Efni" step, no "Yfirferð" step and no "Tilboð" step in the PRO step strip (strip = 1 Rými · 2 Rýmið · 3 Teikning, line 12675), so after Teikning nothing tells Rakel what comes next.

## Top 15, ranked by likelihood Rakel gets stuck

### 1. After the drawing there is no "next" — the flow ends in a top-bar button called "Vista" (L, but a quick win is S)
- Where: `body.pro #toContactBtn:not(.pro-next){display:none}` (L1385); editor "Áfram" only exists as "Næsta rými" with several rooms (L10874-10880, L16295). Last room: no Áfram at all. proSteps strip stops at "3. Teikning" (L12675).
- Why it hurts: breaks "Til baka / Áfram at the same spot every step" and "usable with zero learning". A one-room project has a drawing and then silence. The real finish line (Efni, Smíða per cabinet, Yfirferð, Tilboð) lives in an accordion, a strip of Sk buttons and two top-bar buttons.
- Fix: extend the strip to `1 Rými · 2 Rýmið · 3 Teikning · 4 Yfirferð · 5 Tilboð` and keep a primary button at the right of the title row on every PRO step: Rými "Áfram →", Rýmið "Áfram →", Teikning "Áfram í yfirferð →" (opens the Yfirferð panel; on a multi-room project "Næsta rými →" until the last room, then "Áfram í yfirferð →"), Yfirferð "Áfram í tilboð →". Same position as today's Til baka/Áfram pair. Size M.

### 2. "Vista" is not save, it opens a checklist; saving takes two clicks and there is no shortcut (S)
- Where: `proSave` button L18590 "Vista" + badge `2/12`; save inside panel `pc-save` L18830; panel closes after save (L18853).
- Why: Rakel presses Vista expecting a save, gets a 12-line panel. Autosave is local only ("● óvistað" in the bar) and Airtable only gets it on that second click. No Cmd/Ctrl+S, no beforeunload guard (grep finds none), so closing the tab on "● óvistað" is silent (a local copy survives but only in this browser).
- Fix: split into two buttons with fixed places: "Vista" (saves immediately, shows "✓ vistað 14:32") and "Yfirferð 2/12" (opens the panel). Add Cmd/Ctrl+S = Vista and a `beforeunload` prompt while dirty. Size S–M.

### 3. Error screens and prompts send her to Airtable, with no way to the project picker (S)
- Where: `proFail` texts L19590-19599 ("Opnaðu verkefnið aftur með hnappnum á Tækifærinu í Airtable"), `proSaveErrText` L19498+ (same sentence), proFail has only "Reyna aftur" (L19577).
- Why: the project picker (`?pro=home`) exists and reads the key from localStorage; a bad/missing `k` should lead there, not to Airtable. Retry on a 401 reloads the same bad link forever.
- Fix: proFail adds a second button "Velja verkefni" -> `/skipuleggja?pro=home` (+ `&k=` from localStorage), and for 401/403 the text becomes "Lykillinn vantar eða er útrunninn. Opnaðu verkefnið aftur af skrifstofusíðunni." Retry is hidden for 401/403/404. Size S.

### 4. Yfirferð has 12+ lines in a long list, three need an Airtable visit or checkbox that Rakel cannot understand (M)
- Where: `proCheckItems` L18640-18705; ack label "… — Útfærsla valin í Airtable" (L18675), "Hver eining tengd vöru" (V1 picker), "Sjálfgefnu efnin eru rétt", "Ábendingar yfirfarnar", orph/sala checks, plus pc-note "Eyðublöð → Sögunarlisti, Pöntunarlisti, CNC" (L18833).
- Why: titles are internal vocabulary (V1, Útfærsla, Eyðublöð, Sögunarlisti). "Klár til framleiðslu" is greyed until every line is green, with only a tooltip why; the one thing she is allowed to be blocked by is spread over 12 lines in a fixed-height panel.
- Fix: group into three headed blocks "Teikning", "Efni og vörur", "Smíða" with a plain one-sentence summary at the top ("3 hlutir eftir: mæling, borðplata, 4 skápar"), and move jargon to the tooltip. Rename: "Hver eining tengd vöru" -> "Allir skápar með vöru", ack "Útfærsla valin í Airtable" -> "Ég veit að þessi skápur er sérsmíði (Rakel/hönnuður velur í Airtable)" (or better: a picker like the V1 one). Disabled "Klár til framleiðslu" shows the reason under the button, not only in a title. Size M.

### 5. Locked / unlocked bar swaps its buttons, so controls move (S–M)
- Where: `proBar` L18551-18605: locked mode shows `Tilboð · Teikningar · Smíða&CNC · CNC · Opna til breytinga`; open mode shows `Vista · Tilboð · Teikningar · Hurðir · Mæling · Smíða & CNC`. Plus `Frá Studio`, `Merkja teikningu yfirfarna`, `Smíða úr Eyðublöðum` appear conditionally.
- Why: owner rule "buttons never move between states". Up to 12 controls in one row with three of them optional, so Tilboð shifts left/right depending on project.
- Fix: one fixed order always rendered: `← Skrifstofa | name | status | Vista | Yfirferð | Tilboð | Teikningar | Hurðir | Mæling | Smíða & CNC | ⋯`. Disabled (greyed, tooltip "Verkefnið er læst") instead of removed. Move conditional ones (Frá Studio, Merkja yfirfarna, Smíða úr Eyðublöðum, CNC) into a "Meira" menu or into the Yfirferð panel. Size M.

### 5b. Wrong tour in PRO (S)
- Where: `tourBtn` shown on every editor step (L12761), `startTour` (L13682) is the customer tour; auto-start is blocked for PRO (`maybeStartTour` L13633) and hints are off (`hintOnce` L13620), but Hjálp -> "Sýna leiðsögnina" still runs the customer script ("Klárt — og senda inn… söluaðili fer yfir", pointing at the hidden `toContactBtn`; spotlight with nothing to highlight).
- Why: only "onboarding" PRO has, and it is wrong.
- Fix: hide `tourBtn` in PRO today (S) and write a real PRO tour (see #8).

### 6. No first-run guidance at all in PRO (M)
- Where: `hintOnce` and `maybeStartTour` return on PRO (L13620, L13633); the pro-home page has one sentence. Hjálp -> "Hvernig…?" is the customer help (`kitchen-planner-help.js` has no PRO / Smíða / Yfirferð entries — grep finds none).
- Why: zero learning is the goal; nothing says "Sk = skápanúmer", what Smíða is, what the badge `2/12` is, what "Klár til framleiðslu" locks.
- Fix: a 5-step PRO tour (first PRO open per browser, remember in localStorage `…:proTourDone`; also in Hjálp): 1 Rými (add room) 2 Teikna og Ný eining 3 Efni (left menu) 4 Smíða (yfirfara hvern skáp) 5 Yfirferð -> Tilboð. Plus add 6 PRO entries to the help list: "Hvað er Sk?", "Hvað er Smíða?", "Hvað gerist þegar ég ýti á Klár til framleiðslu?", "Hvernig sendi ég tilboð?", "Hvernig opna ég læst verkefni?", "Hvar vistast teikningin?". Size M.

### 7. Smíða strip: 8 controls in one row, primary button changes label and width (M)
- Where: `pe-nav` L18018-18026: `‹ [Sk1..Sk24 strip] › 3/12 [Yfirfarinn → Sk8 | Næsti → Sk8 | Allir yfirfarnir — loka | Skápur yfirfarinn ✓] + Næsti hægra megin  Loka ✕`.
- Why: the green button has 4 labels with different lengths (stable-controls rule), the strip of Sk buttons grows with project size (24+ buttons push everything), "Loka ✕" and "+ Næsti hægra megin" compete with the primary one. Words "Yfirfarinn", "⛔ villa í Smíða", "Smíða" never explained on first use. ⛔ is emoji.
- Fix: fixed layout `‹ Sk7 af 24 › [primary: Yfirfarinn ✓ — næsti]   ⋯`. The Sk strip becomes a dropdown/jump list ("Sk7 ▾"). Primary label always "Yfirfarinn — næsti →" (last cabinet: "Yfirfarinn — klára"). Move "Næsti hægra megin" into the ⋯ menu. Replace ⛔ with a red line icon via `icon()` and the word "Villa". Size M.

### 8. Efni is a collapsed accordion in the sidebar, not a step (M)
- Where: `sec("efni", …)` L9035; PRO skips the Efni pages (L16136, L18648). Missing materials only show in Yfirferð after the fact.
- Why: materials are the second thing a salesperson sets after drawing, and nothing points at them. "Óákveðið (sjálfgefið sett inn)" means a default was silently used — she must "Staðfesta hér".
- Fix: open the Efni section automatically the first time Teikning opens on a new project and mark undecided selects with a visible amber "veldu" tag (exists as `undTag` — make it visible), and add the step "Efni" to the strip (links to the accordion). Size S–M.

### 9. Ný eining: "Setja inn" flow is fine, but the right-hand "＋ Næsti hægra megin" and a full wall interrupt (S)
- Where: `edNewUnit` L2475, `openUnitWizard` L10829 (customer wizard reused), Smíða `addright`.
- Why: the toolbar has Undo/Redo, Ný eining and Til baka/Áfram in one row at 1280 px; the wizard drops the editor's 3D scene (`teardown3D`), so cancelling shows a re-init flicker. Hidden features: right-click to peek inside, drag to snap (only in the customer tour, which PRO never sees).
- Fix: tooltip + 1-line hint under the toolbar in PRO the first time ("Dragðu skáp til að færa · hægrismelltu til að kíkja inn · Delete eyðir"), dismissable, remembered. Size S.

### 10. Project picker: promise vs behaviour, and "new project" hides the search (S)
- Where: `screen-pro-home` L2183-2205, `phLoadRecords` fields list L20019, `renderPhResults` L20046-20075.
- Why: placeholder says "nafn eða heimilisfang" and the hint says "nafn, heimilisfang eða T-númer" but only the name field is fetched and matched (no address), so an address search finds nothing. Clicking "＋ Nýtt verkefni" hides the search (`phCloseNewForm` / L20011), so she can create a duplicate of a customer she just failed to find; only Fornafn is required, no duplicate check. The title "PRO — Velja verkefni" uses "PRO" as a word.
- Fix: fetch "Heimilisfang" (name-checked field) or drop the word; keep the search visible above the new form and show "Til er verkefni með þessu nafni: T-123" while typing; title "Veldu verkefni". Rows should show customer + stage chip + last saved date. Size S.

### 11. Tilboð: hidden discount/markup that change what the customer sees, only in tooltips (M)
- Where: `tilbodPanel` L2144-2166: "Ósýnilegur afsláttur %", "Smáverka álagning", "Uppsetning" `<details>`; tooltips only on ⓘ (needs hover or focus).
- Why: percentage inputs saved on blur (writes the Tækifæri) with no confirmation; a typo "20" instead of "2" silently reprices the quote; "Smáverka" unexplained; the two terms read as accounting jargon. The price shown is "m/vsk" with no mention in the panel whether it includes the discount.
- Fix: show "Verð fyrir viðskiptavin: X kr (eftir 5 % afslátt)" next to the total; put the three factors in a collapsed "Afsláttur og álag (aðeins skrifstofan sér)" block with the short inline sentence visible, not only a tooltip; clamp afsláttur to 0–30 with a "ertu viss?" above 15. Size M.

### 12. "Senda tilboð" does not send (S)
- Where: `tpSend` button L2166, `proTilbodSend` L19400-19420: prints a PDF, opens a Gmail draft in a new tab (popup), then shows "Merkja tilboð sent" in `tpMsg`.
- Why: the label promises a send; the draft needs a manual Send in Gmail, the popup can be blocked (then only a toast), and the status change is a second button that is easy to miss (it renders inside the message text, so it moves). No netfang -> "settu það inn sjálf".
- Fix: rename "Útbúa tölvupóst" (tooltip "Opnar drög í Gmail — þú ýtir sjálf á Senda"). Put "Merkja tilboð sent" as a permanent third button in the fixed `tp-btns` area, disabled until the draft opened. Popup blocked: show a visible link "Opna drög". Size S.

### 13. Smíða / Yfirferð ⛔ error text does not say what to do (S–M)
- Where: `proIssues` L17194+ (texts like "Skúffuhæðir eru samtals … þurfa að fylla …", "færðu lömina eða hilluna"), Yfirferð line "Engar ⛔ villur í Smíða" L18678.
- Why: some include the fix, many only state the violation. A salesperson sees a red ⛔ and the green button disabled.
- Fix: every issue string has the format "Hvað er rangt — Hvað á að gera" and a click on it scrolls to / flashes the offending control in the box editor; auto-fix button where it is mechanical (stack fills the carcass -> "Jafna skúffur"). Size M.

### 14. Jargon list that appears unexplained: Sk, HU, V1/V2/V3, Útfærsla, Eyðublað, Keyra skipulag, Frá Studio, Í skipulagi (S)
- Where: bar titles L18560-18605 ("Hurðir … (HU-línur)"), "Smíða úr Eyðublöðum", "Í skipulagi (…) — skoðunarhamur", `proUnlock` dialog (L19445) listing three production steps to run elsewhere ("Yfirfara … Keyra pöntunarlista"), proLegacyOffer dialog.
- Why: these are production words; the salesperson only needs "verkefnið er læst af því það er komið í framleiðslu".
- Fix: replace by short plain copy and one tooltip: "Læst — komið í framleiðslu. Opna til breytinga" and a one-line warning "Þá þarf að keyra pöntunarlistann aftur (láttu Ísak vita)". The three-step dialog moves to an info icon. Size S.

### 15. Emoji and symbol use in PRO (S)
- Where: header `⚠️ Villa / hugmynd` (L2128, L2141 — shown in PRO too), ⛔ in 18 UI strings (Yfirferð, Smíða, tooltips), `＋`, `↗`, `●`, `✓`, `ⓘ` as text glyphs.
- Why: owner rule: no emoji in Studio (customer side done); PRO keeps ⚠️ and ⛔ (and the ⚠️ also sits in the Hjálp menu).
- Fix: swap ⚠️ for `icon("info")` and ⛔ for a red `icon("alert")`-style line icon + text "Villa"; keep ✓/● (typographic). Size S (find/replace plus 2 icon paths).

## Also noticed (below the top 15)
- Empty states: Yfirferð lines say "Engar einingar enn." (OK); room with no walls has the 10-second fading `stageEmpty` nudge, then nothing (L10893) — keep a permanent "＋ Ný eining" hint on an empty room.
- Keyboard flow: Enter moves down the Rýmið wall table (L14022) — good; Smíða has ←/→ between cabinets and Esc to close — good; the Yfirferð panel closes on Esc but has no focus trap; Tab order in the bar is DOM order, so Vista is the 5th stop. Cmd+S missing (see #2).
- `proFail` has no `tech` hint for 401 shown to the user except tiny `<small>` text; fine for you, noise for Rakel.
- Multi-room: room tabs + "+ Rými" sit in the strip at L12684 — good; the `(2 af 3)` counter is redundant with the tabs.
- Mæling is mandatory for "Klár til framleiðslu" (Yfirferð line 2) but a new project can be quoted without it; fine, but the bar button named "Mæling" does not say it is the on-site measuring sheet (tooltip only).
- Sk numbers are explained only on the "Sk-númer" view toggle (L2465); the Yfirferð/Smíða texts assume she knows Sk = skápur.

## Suggested order (smallest effort per step first)
1. S batch (half a day): #3 proFail buttons, #5b hide tour button, #10 picker, #12 rename Senda, #14 copy, #15 icons, Cmd+S + beforeunload (#2 part).
2. M batch: #1 strip + fixed primary button, #2 Vista/Yfirferð split, #5 fixed bar, #7 Smíða strip, #4 Yfirferð groups.
3. M content: #6 PRO tour + help entries, #11 Tilboð clarity, #13 actionable issue texts, #8 Efni step.
