# PRO -> customer draft package: audit (2026-10-28)

Read-only trace of kitchen-planner.html?pro=<recId> (+ api/*). Line refs are kitchen-planner.html unless noted.

## Per-item table

| # | Item | Status | Exact UI path | Where it lives | What the customer actually gets | Failure modes |
|---|---|---|---|---|---|---|
| 1 | Draft drawings | EXISTS, but only inside the quote PDF, and only the *customer-style* set | Header "Tilboð" -> "Prenta tilboð" or "Senda tilboð" (drawings are built automatically, no separate button). Separate "Teikningar" (header) = A3 *workshop* sheets, never go to the customer | `buildDrawingsPdf` (l.16910: cover + X-ray wall elevations + corner views + top view + 2D plan, JPG pages, A4 landscape) -> POST `/api/kp-drawings?recordId&k` (replaces "Teikningar úr skipuleggjara 📐") -> `api/generate-quote.js` `withDrawings` appends pages to the quote PDF (`appendPdf`). Work drawings: `kitchen-planner-workdraw.js`, `openWorkDrawings` (l.19931), "Vista á Tækifæri" -> `api/kp-workdraw.js` -> "Vinnuteikningar (drög) 📐" (internal draft field, NOT used by the quote). Skápalisti is a sheet of the A3 set only | Pages appended after the quote: customer-style drawings. Not the A3 sheets, no Skápalisti | `state.closed` false (room not closed) -> drawings silently skipped (try/catch sets withDrawings=false; the only sign is "✓ Prenta" with no "með teikningum"). Upload 4.3 MB cap / failure -> silent skip. Append failure in generate-quote -> console.warn only, quote goes out without drawings, UI does say "með teikningum" only if drawingsAdded |
| 2 | Materials | EXISTS (partial) | Nothing to click; it is page 1 of the quote | `materialSpec()` in `api/generate-quote.js` l.299 + "EFNISVAL" block l.389: front 1/2 with rooms, handles (planner JSON `handlesPrint`), carcass, worktop etc. from the Tækifæri link fields | Short spec block on the quote's first page. No swatches/images, no per-room material sheet | Reads Tækifæri link fields (not the unsaved drawing) -> stale if drawing unsaved (mitigated: print saves first via `proSave`). Per-unit/per-room carcass+worktop materials still not in Airtable (pro-finish "Closing pass" open item 1) |
| 3 | Short report / summary | MISSING for the customer | - | Nearest things: "Frá Studio" panel (`proStudioRender` l.18940) = the *customer's inputs* shown to Rakel; `coverLines()` on drawing cover page 1 (room/size summary, one line each); `orderBreakdownRows()` (rooms+materials list); quote's own line table. No "skýrsla/samantekt" text generated anywhere | Nothing narrative | n/a |
| 4 | E-mail | PARTIAL: a pre-filled Gmail *compose window*, not an API draft | Tilboð panel -> "Senda tilboð" (1 click; save+print+drawings run first, new tab opens Gmail compose) | `proTilbodSend` l.19403: hard-coded Icelandic template ("Hæ <fornafn>, Takk fyrir síðast. Hér er tilboðið frá okkur: <link> ... Kær kveðja,"), subject "Tilboð frá Birninum — <name>", To = contact's Netfang from `api/tilbod-print.js`. `api/email-draft.js` is NOT involved (that is the inbound-reply AI drafter for Make) | One link to the PDF, nothing attached. Link = `api/tilbod-pdf.js?r&s` (HMAC of record id with VERK_KEY, 302 to the *current* "Tilboð til sendingar" PDF; always latest). Gmail adds sender signature | No contact e-mail -> compose opens with empty To and a bold warning in the panel (not blocked). Pop-up blocker (tab opened early to mitigate). Not a real Gmail draft: if Rakel closes the tab the text is gone and a second click re-prints (and re-clears "Tilboð til sendingar"). Text not editable before it opens (edited in Gmail). Studio images/materials/summary not mentioned |
| 5 | Quote (tilboð) | EXISTS, solid | "Tilboð" header button -> panel (live total via `/api/kp-price`, line table, hidden discount/Smáverk/uppsetning fields) -> "Prenta tilboð" | `proTilbodPrint` l.19377 -> `tpPrintNow` l.19364 (unsaved drawing is saved first with `proSave`; aborts if save fails) -> `/api/tilbod-print` (key-gated relay, 403 without k) -> `generate-quote` mode "cabinets" -> "Tilboð til sendingar" (cleared + re-uploaded each print). Returns files + link + `to` | PDF opens in new tab; customer link as in #4 | Save conflict (409) opens the conflict dialog; >10 % change red box in panel; PDF attachment may lag in Airtable (6 x 1.5 s retries in tilbod-print, then files=[] but link still works only if the field fills later -> link 404 "Tilboðið fannst ekki") |
| - | Studio myndir (3D) | EXISTS, fully manual, not wired to anything | 3D view -> "Studio mynd" (st-card): pick view (Þessi sýn / Í augnhæð) + quality (Fljót ~20 s / Fín ~1 min) -> "Búa til mynd" -> wait -> "Vista á Tækifæri" (l.16993) -> `/api/kp-studio` (field "Studio myndir 📸", keeps newest 12). ~4-5 clicks + waiting per image | `KP3D.studioRender`, `api/kp-studio.js` | NOTHING: images never enter the quote, the link or the e-mail. They only sit on the Tækifæri in Airtable | Must stand in 3D view; selection tint removed automatically; each image saved separately (one image per run); the `studioShots` array is customer-only |
| - | Veggur / 3D views | EXISTS, screen-only | Header view modes (Veggur = elevation, 3D, Ofanmynd) | planner | PNG download only ("Sækja mynd"); the drawings PDF already contains the equivalent X-ray elevations/corner views | - |
| - | Mark as sent | EXISTS | After "Senda tilboð" the panel shows "Merkja tilboð sent" (click 2) | `proTilbodMarkSent` -> `/api/sala` action "sent" (needs a PDF in "Tilboð til sendingar"; sets Staða = 📤 Tilboð sent, Næsta skref in 3 days, Airtable follow-up automations) | nothing | Button lives only in the transient `#tpMsg` text -> gone if panel closed/re-rendered; no check that Rakel actually pressed Send in Gmail |

## Clicks from "drawing finished" to "customer has it" today
1. (If unsaved) Vista -> Yfirferð -> "Vista í Airtable" (print path auto-saves, so 0 extra clicks)
2. Header "Tilboð" (open panel)
3. "Senda tilboð" (waits ~10-30 s: save, drawings PDF, upload, generate-quote, attachment retry)
4. In Gmail: read, edit, press Send (outside the app)
5. Back in PRO: "Merkja tilboð sent" (if panel still showing)
= 3 clicks in PRO + the Gmail send + 1 mark. Customer receives: one e-mail, one link, one PDF = quote with EFNISVAL page + drawing pages. No separate materials page, no summary text, no Studio images, no work drawings. Studio images need ~5 extra clicks each and never reach the customer.

## Biggest gaps
1. No real Gmail draft: a compose URL only (body in a query string, lost if tab closed, no attachments, only a link).
2. No customer summary/report anywhere; no e-mail body that describes the project (rooms, materials, price, what's next).
3. Studio (3D) images are orphaned: not in PDF, not in e-mail, manual per image.
4. Drawings silently dropped when `state.closed` is false or upload fails (user only sees absence of "með teikningum").
5. No preview of what will go out; "Merkja sent" is transient and not tied to the real Send.
6. The drawings in the quote are the *customer set*; the A3 work drawings + Skápalisti go to a different field and are internal.

## Proposed: "Senda drög til viðskiptavinar" (single dialog)

Reuse everything; build one new dialog + one small endpoint. Button placement: Tilboð panel next to "Senda tilboð" (replace it, keep "Prenta tilboð").

Flow (1 click opens, 1 click sends):
1. Click opens `proDialog`-style modal (reuse `proDialog`, l.19480 area). On open it runs the existing pipeline: `proSave` if dirty -> `buildDrawingsPdf` -> `/api/kp-drawings` -> `/api/tilbod-print` (drawings appended). Shows progress; failures stop with an Icelandic message (not silent).
2. Dialog shows a checklist preview (each row with a state tick and thumbnail/link):
   - Teikningar: N síður (from `drawingsAdded`; red "Herbergi ekki lokað" if `!state.closed`, send disabled unless ticked "senda án teikninga")
   - Efnisval: the `materialSpec` rows rendered (reuse generate-quote export via tilbod-print response, or `orderBreakdownRows()` client side)
   - Samantekt: auto text (rooms, # units, main materials, handle, total m/vsk) built client side from `orderBreakdownRows` + the kp-price total, editable
   - Tilboð: total + link to the PDF (`d.link`), file names
   - Studio myndir: thumbnails of what is already in "Studio myndir 📸" (up to 3, ticked) + optional "Búa til mynd" shortcut that reuses `KP3D.studioRender` once with default Fljót/live view and saves via kp-studio
   - Viðtakandi: contact name + e-mail from `d.to`, editable; red when missing (send blocked, field to type one; optional PATCH to the contact is out of scope)
3. Editable e-mail (textarea, Icelandic): default text assembled from the samantekt + "Hér er tilboðið, teikningar og efnisval: <link>" (+ links to Studio images). Subject editable.
4. Primary button "Búa til drög í Gmail": calls new `POST /api/tilbod-draft` which creates a **real Gmail draft** (same Gmail account as bjorninn@) with HTML body, signature text, and the quote PDF attached (it is already <4.5 MB; fetch from Airtable URL server side) + Studio JPEGs inline/attached. Returns the draft id + `https://mail.google.com/mail/u/0/#drafts?compose=<id>` so one click opens it in Gmail. Fallback: the existing compose-URL path if the Gmail endpoint is not configured.
5. Same dialog then offers "Merkja sent" (same `/api/sala` "sent"), persisted as a visible button in the Tilboð panel header (not in the transient message), and writes a note on the Tækifæri ("Drög send <dags>").
6. Status update: on draft creation nothing changes; on "Merkja sent" -> `📤 Tilboð sent` as today.

### What must be NEW
- `api/tilbod-draft.js` (key-gated like tilbod-print): builds MIME (attachments: quote PDF, optional Studio images), calls Gmail API `users.drafts.create` (needs OAuth refresh token + `gmail.compose` scope in Vercel env, same Google project as api/virkni.js if it already holds one; otherwise a one-time consent). This is the one real unknown/owner step.
- Client: the dialog (~250 lines), samantekt generator (~60), default Icelandic e-mail template (~30), wiring (replaces `proTilbodSend`).
- Optional: expose `materialSpec` rows from `tilbod-print` response (`spec`) so the dialog shows exactly what is printed (small change).
- Tests: tilbod-draft MIME/validation (tests/), button + dialog in pages.test parse check.

### Re-used unchanged
`proSave`, `buildDrawingsPdf`, `/api/kp-drawings`, `/api/tilbod-print`, `/api/generate-quote` (withDrawings), `/api/tilbod-pdf` link, `/api/kp-studio`, `/api/sala` "sent", `/api/kp-price` total, `proDialog`.

### Files
- new: `api/tilbod-draft.js`, `tests/tilbod-draft.test.js`
- edit: `kitchen-planner.html` (dialog, replaces `proTilbodSend`, panel button), `api/tilbod-print.js` (return spec rows + studio image urls), docs/pro-finish.md note
- edit (maybe): `api/generate-quote.js` only if a separate materials page is wanted (not required)

### Size
- Without real Gmail draft (compose URL + dialog + samantekt + preview + persistent Merkja sent): ~1 day, ~350 lines, no env/OAuth work. Already removes the biggest friction (no preview, no editable text before opening, silent drawing drop).
- With Gmail API draft + attachments: +0.5-1 day and owner action for Google OAuth consent/env var.
- Studio auto-image inside the dialog: +0.5 day (reuse of studioRender, 20 s wait; recommend "use existing images, one optional Búa til" first).

### Decisions needed from owner
1. OK to add a Google OAuth refresh token (gmail.compose) to Vercel env for real drafts? If no, ship the compose-URL version.
2. Attach the PDF or send only the link? (Link always shows the latest; attachment is a snapshot. Recommend both: attach + link.)
3. Should the customer set stay "customer-style drawings" (current), or should the A3 vinnuteikningar be appended too? Recommend customer set only.
