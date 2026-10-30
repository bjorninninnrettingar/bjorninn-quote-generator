# Sweep 2026-10-30: merged triage

Sources: [customer.md](customer.md) (18 findings), [verkstaedi.md](verkstaedi.md) (16), [skipulag.md](skipulag.md) (15), [studningur.md](studningur.md) (19), [airtable-dead-fields.md](airtable-dead-fields.md). 68 findings in total, none critical, none customer-blocking.

## Decisions made (2026-10-30)
1. SOP table goes behind the floor key (and the employee numbers come out of the Tímon SOP).
2. Shared brand colour: `#3d61c1` + gold `#a29c72`. Light variant for customer and office pages, dark variant of the same tokens for the floor.
3. verkefni keeps its walnut/paper accent, but gets Studio's fonts, radii and spacing.
4. `/hanna` stays an alias of `/skipuleggja`.
5. Chip rename SÖGUNARLISTI → MERKINGAR: not asked yet, left for later.

## Original decision list (answered above)
1. **SOP table is public.** `/api/airtable` returns all 19 SOPs (employee numbers, offboarding, company rules) with no key (studningur #6). Cheap fix: remove the employee numbers. Proper fix: put the SOP read behind the floor key.
2. **Which blue?** Four blues are in use: `#0f6cbd` (cutlist, aedar), `#0071e3` (smida), `#0a84ff` (floor, eining, sop), `#3d61c1` (Studio, faq, velja, chat widget). Recommendation: brand blue `#3d61c1` + gold `#a29c72` for everything, with the same tokens in a light and a dark variant (light = customer + office, dark = floor).
3. **verkefni** uses a walnut/paper palette and emoji timeline. Keep the walnut accent, or move it to Studio's tokens?
4. **`/hanna`** is only a rewrite of `/skipuleggja`; nothing in the code differs. Intended?
5. **Nav chip "SÖGUNARLISTI" → /labels** in cutlist and aedar: rename to "MERKINGAR"?

## Batch A: customer-facing, all under 10 minutes each
| What | Where |
|---|---|
| Replace `⚠️` with the `alert` line icon (and drop the duplicate button) | kitchen-planner.html:2346, 2354, 13501, plus i18n keys |
| Gate only checks width once: add a resize listener | kitchen-planner.html:21585 |
| Gate copy says "eldhúsinu" | kitchen-planner.html:2327 |
| Garðabær link 404s | kitchen-planner.html:15902, use `https://www.gardabaer.is/kortavefur` |
| Toast covers the suggestion card's button | kitchen-planner.html (toast next to the suggestion prompt) |
| Editor title clipped by the stepper at 1024px | kitchen-planner.html editor header |
| `Harðviðargrip` is not in the allowlist, so the grip line never shows | verkefni.html ~386, api/airtable.js |
| `/` returns Vercel NOT_FOUND | vercel.json, redirect to the public site |
| faq search misses „skápur“, „verd“, „eldhus“ | faq.html:584, 284 |
| faq compact mode applies to phones that visit /adstod directly | faq.html:216-268, only when framed |
| 3 FAQ answers missing from the chatbot (address, hours, walk-in) + "ýtarlegan" → "ítarlegan" | api/_chatbot-faq-prompt.js, faq.html:351 |

## Batch B: floor (phones, tablets, TV)
- **/labels is unusable on a phone** (618px wide, print button off-screen): labels.html:100-102, 27, 137. The one real bug.
- **/saga:** light theme and system font in a dark app, project name truncated, wrong `<title>`: grain.html:29-34, 138, 695.
- **/tv:** type too small for a 1080p TV: dashboard.html:67-70. `is-IS` dates fall back to English: dashboard.html:302, verk-i-gangi.html:115, verk.html.
- **/v/<id>:** bad QR gives a bare English page: api/v.js:25, 36, 41. Dead-end error states: velja.html:94, verk.html:315, eining.html:162.
- **Touch targets under 44px:** labels, fraesing, app bell, back links on verk-i-gangi and velar. fraesing sideways scroll at 375px (.partur nowrap). Inputs in Arial.
- **Larger:** `/app` service worker caches nothing, so no offline shell (sw.js:9). Maskable icon.

## Batch C: office and internal wording
- "PRO eða CNC" and "/cnc" strings still in smida.html:286, 292, 301 and bpp-viewer.html:97. "Reyna aftur" on a key error does nothing (smida.html:279). Bare `/smida` is a dead end with no project picker (bigger).
- bpp: non-`.bpp` files silently ignored, no back link.
- aedar: `fetchBoards()` is not memoised (about 5 calls per load): grain.html:965-967. Dead dark-theme CSS in cutlist. Emoji in banners.
- klukka/eigandi: textareas not selectable (`user-select:none`), no manifest or title in owner mode, error text wording, `toLocaleTimeString`.
- leidbeiningar: button name differs from the real one, covers only Cutty + Merkingar, not linked from /app or /verkstaedi.
- SOP content: Tímon text and "Airtable" mentions are stale (Airtable content edit, not code).

## Batch D: chatbot everywhere (L, about 1-2 h plus prompts)
Plan from the floor and support sweeps: `chat-widget.js` reads `data-app` / `data-context` from its script tag; `api/chat.js` picks a prompt per `app` (faq, studio, floor, klukka, sop); staff prompts sit behind the floor key; launcher hidden on /klukka and /tv; one tag per page: `<script src="/chat-widget.js" data-app="labels" defer>`. Knowledge sources per page are listed in studningur.md. The floor and staff prompts must not contain PINs or per-person data. Fix the stale SOP text first or the bot repeats it.

## Batch E: visual unification (after A-C)
1. One `bjorninn-tokens.css` (colours, 4 radii: 6/10/14/pill, 5-step type scale, 44px control height), light and dark variants.
2. Start with the pages that deviate most: /saga, /tv (Helvetica), leidbeiningar, /klukka (Helvetica, material colours), then cutlist and aedar (system font, `#0f6cbd`).
3. Replace emoji with the line-icon `icon()` set; /smida is the closest to the target look.
4. One primary button style in Studio (black pill vs blue 9px).

## Airtable
21 `🗑️ EYÐA` fields wait for bulk delete. Not tagged and waiting on you: planned-feature fields in Eyðublað (Grip, ZPL, LED, Hurðabúnaður), the IC/IE/IF/IK/IN family in Vöru línur, and the four `→ LI … V2` lookups.

## Not covered by the sweep
`/smida` main flow and `/eining` with a real unit (need a key or token), `/verk` with real data, `/saga` with a confirmed plan, real `/app` offline behaviour, Studio frame rate (needs a real window), non-kitchen Studio flows (wardrobe, bath, laundry, doors), PRO, EN mode, submit and thank-you screen.
