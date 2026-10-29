# Skrifstofa-spjallið ("Spyrja") — 2026-10-29

Read-only helper for the office pages. Staff ask "hvar er T-32?", "hvernig keyri ég skipulag?", "hvað er í framleiðslu núna?" and get a short Icelandic answer plus real in-app link chips.

## Pieces
- [api/skrifstofa-chat.js](../api/skrifstofa-chat.js) — `POST /api/skrifstofa-chat { k, messages }` -> `{ answer, links:[{label,url}] }`. Its own endpoint (not a mode in api/chat.js) so the public chatbot can never reach it.
- [api/_skrifstofa-prompt.js](../api/_skrifstofa-prompt.js) — knowledge (workflow Tækifæri -> Framleiðsla, page map) + the `PAGES` link table. Mirror office-shell.js NAV / the CLAUDE.md pages table when pages change.
- [office-chat.js](../office-chat.js) — right-hand drawer (`window.OfficeChat`), loaded on demand by office-shell.js. Esc closes; conversation only in `sessionStorage` (`bjorninn:skrifstofa:chat`), nothing server side; dark/light via `html[data-theme]`.
- [office-shell.js](../office-shell.js) — additive: `ask` icon + "Spyrja" button above Stillingar in `renderChrome`.
- [tests/skrifstofa-chat.test.js](../tests/skrifstofa-chat.test.js).

## Safety model
- **Auth:** body `k` (or `x-verk-key`) must be the full `VERK_KEY` (`isFullKey`; floor tokens/customers get 403). The widget sends the key from localStorage `bjorninn:skrifstofa:k`.
- **Read-only:** Claude has two tools — `find_project(query)` (T-number or name) and `list_active_projects()` — both GET-only against Tækifæri with the server-side PAT, five fields only (name, söluferli, skipulag, framleiðsla, Áætlaður afhendingardagur Björninn (internal)). No write tool exists; the test asserts every Airtable call is a GET.
- **Query hygiene:** search text is reduced to letters/digits/space/`-`/`.`, max 60 chars, before it is put in `filterByFormula`.
- **Links are never model text:** the model returns `pages` (keys in `PAGES`, max 2) and `projects` (record ids, max 3, must match `/^rec[A-Za-z0-9]{14}$/` AND have been returned by a tool in the same request). Server builds `/ferli?recordId=`, `/framleidsla?recordId=` (only if the project has a production status), `/pontun?recordId=`, plus page paths. The widget re-checks that URLs are same-origin paths.
- **Limits:** 16 messages x 1000 chars, 15 requests/min and 300/day per IP (in-memory, per warm instance, like api/chat.js), max 4 tool rounds, `maxDuration` 30 s (vercel.json). Model: `SKRIFSTOFA_CHAT_MODEL` || `CHATBOT_MODEL` || Haiku 4.5.
- Needs env `ANTHROPIC_API_KEY`, `AIRTABLE_TOKEN`, `VERK_KEY` (all already set for other endpoints).

## Not verified against the real services
Tests mock Anthropic and Airtable; the UI was checked in the Browser pane against a mock `/api`. Not run live: a real Claude tool-use round trip, real Airtable formula matching (`FIND("t-32 ", LOWER(name)&" ")=1` assumes names start with "T-32 " — verify with a real project), answer quality of the prompt.

## Ideas later
Verkefni sem bíða mín / virkni feed as a third tool; deep links to a specific Eyðublað; open the drawer with a shortcut.
