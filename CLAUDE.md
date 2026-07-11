# bjorninn-quote-generator

Static HTML tools + Vercel API functions for Björninn Innréttingar. Deployed at
https://bjorninn-quote-generator.vercel.app — all pages talk to Airtable through
`/api/airtable`, a server-side proxy that holds the PAT (kept out of the repo
since GitHub push protection blocks committing an Airtable PAT directly).

## Pages (short URL → file)

| URL | File | Purpose |
|---|---|---|
| `/tv` | [dashboard.html](dashboard.html) | Framleiðsluyfirlit — production overview / TV dashboard |
| `/cutlist` | [cutlist.html](cutlist.html) | Skurðarlisti (Cutty) — cutting list, also drives USB export to the saw |
| `/labels` | [labels.html](labels.html) | Merkingar (Sögun) — label printing for cut pieces |
| `/leidbeiningar` | [leidbeiningar.html](leidbeiningar.html) | Leiðbeiningar — instructions for the cutlist + labels workflow |
| `/klukka` | [stimpilklukka.html](stimpilklukka.html) | Stimpilklukka — PIN-pad time clock (Inn/Út) for starfsmenn, kiosk-style |

Rewrites live in [vercel.json](vercel.json). To add another short URL, add a
`rewrites` entry there (`source` = short path, `destination` = the `.html` file),
then commit + push — Vercel redeploys automatically on push to `main`.

## API

- [api/airtable.js](api/airtable.js) — proxy for Airtable requests (holds the PAT server-side)
- [api/generate-quote.js](api/generate-quote.js) — quote PDF generation (uses `pdf-lib`, `maxDuration: 30` in vercel.json)

## Workflow notes

- cutlist.html and labels.html are meant to be used together — see leidbeiningar.html for the intended order of operations.
- Local dev: `.claude/launch.json` has a `vercel-dev` config (port 4322) that sources `.env.local` before running `vercel dev`, since `vercel dev` does **not** load `.env.local` into the function process on its own here — confirmed by direct testing (a custom test var placed in `.env.local` never showed up in `process.env` until the launch command explicitly `source`d the file first). `AIRTABLE_TOKEN`/`WEBHOOK_SECRET` are marked Sensitive in Vercel, so `vercel env pull` returns them empty — get a real PAT from the user and write it into `.env.local` (gitignored via `.env*`) to test locally.
- When building a query string for `/api/airtable`, always percent-encode with `encodeURIComponent` (not `URLSearchParams`, which turns spaces into `+`). The incoming request parser here does not decode `+` back to space, so a `+` in a `filterByFormula` field reference (e.g. `{Field Name}`) survives as a literal plus and Airtable's formula parser rejects it as an unknown field. `api/airtable.js` also normalizes any stray `+` back to `%20` before forwarding to Airtable, as a second layer.
- Stimpilklukka (`/klukka`) reads/writes the `Starfsmenn` and `Stimplanir` tables in the same Airtable base. Each `Starfsmenn` record needs a `PIN 🔢` value set for that employee to be able to clock in/out — there's no UI for assigning PINs, set them directly in Airtable.
- `Stimplanir` is one row per **shift**, not per tap: `INN` creates a row with `Inn` set and `Út` blank; `ÚT` finds that employee's open row (`Út` blank) and PATCHes `Út` onto it. "Currently clocked in" = an open row exists. Matching an employee's open shift is done by exact name (`{Starfsmaður}="..."`), not record ID — referencing a linked-record field in an Airtable formula resolves to the linked row's *display name*, not its ID, so `SEARCH(recordId, ARRAYJOIN(...))` silently never matches (found this the hard way — always test formula fields against real data, not just isValid).
- Dagvinna/yfirvinna split is computed entirely in Airtable formula fields on `Stimplanir` (`Dagv. start/endir`, `Hádegi start/endir`, `Vinnugluggi (mín)`, `Háðegi skörun (mín)`, `Dagvinna (klst)`, `Yfirvinna (klst)`, `Samtals (klst)`) — the app never does this math client-side. Rule, per [Byggiðn](https://byggidn.is/vinnutimi/) ("overtime is counted from when day work ends Mon–Fri until day work begins in the morning") and the current schedule: dagvinna window is 08:00–16:30 Mon–Thu / 08:00–13:15 Fri, with an unpaid 12:00–12:45 lunch subtracted Mon–Thu; anything worked after the window, or any hours on Sat/Sun, is yfirvinna. Time worked *before* 08:00 is deliberately excluded from both (business decision, not automatically paid) — this is why Yfirvinna is computed from `MAX(Inn, Dagv. endir)` onward rather than as `Samtals − Dagvinna`, which would wrongly count that gap as overtime. This does **not** implement the union's Yfirvinna 1/Yfirvinna 2 rate-tier split (first 3.5 hrs/week vs. beyond, plus night work) — only the dagvinna/yfirvinna hour classification.
