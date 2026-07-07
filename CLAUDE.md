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

Rewrites live in [vercel.json](vercel.json). To add another short URL, add a
`rewrites` entry there (`source` = short path, `destination` = the `.html` file),
then commit + push — Vercel redeploys automatically on push to `main`.

## API

- [api/airtable.js](api/airtable.js) — proxy for Airtable requests (holds the PAT server-side)
- [api/generate-quote.js](api/generate-quote.js) — quote PDF generation (uses `pdf-lib`, `maxDuration: 30` in vercel.json)

## Workflow notes

- cutlist.html and labels.html are meant to be used together — see leidbeiningar.html for the intended order of operations.
- No local dev server config yet — changes are verified by pushing and checking the live Vercel URL, or by opening the HTML files directly in a browser.
