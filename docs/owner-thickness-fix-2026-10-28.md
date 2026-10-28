# Carcass thickness `Þ` ignores the unit's own material - 2026-10-28

Nothing was applied. Read-only: `get_automation` (wflqQLKQBKIpNutDn, wflPGRyv0VYi4AZpd), ÚRVINNSLA records, Eyðublað field values.

## 1. Current behaviour (root cause)

`Þ` on Sögunarlisti is a plain number written by the Sögunarlisti script, from the ÚRVINNSLA template's `Þykkt formúla`. It is never a formula or lookup on Sögunarlisti.

The carcass part templates do **not** use `Þykkt skrokka f. Úrvinnslu`. Their `Þykkt formúla` is the name of a plain **number field on Eyðublað**, which the script substitutes with the unit's value:

| Part (Tegund) | `Þykkt formúla` |
|---|---|
| Skápur hlið, Tækja hlið | `Sérþykkt á Hliðum` |
| Toppur, Botn, Toppslár - KL, Loftunarbotn, Loftunartoppur, Tækja toppur | `Sérþykkt á TOPP/BOTN` |
| Laus hilla, Föst hilla, loftunarhillur, Tækjaskápur hilla | `Sérþykkt á hillum` |
| Skápa-bak, Tækjaskápur bak | `Sérþykkt á Bak` (3 = masonit) |
| Slár, Sökkull, drawer parts | literal `16` |
| Frontur etc. | `Þykkt fronta` |

On Eyðublað those four numbers are constants, **16 / 16 / 16 / 3**, on every unit I sampled, including SK2 | EF50 (recaqp2tasj7HWIUd):

- `Sérþykkt á Hliðum` = `fld5XwahccheiTiOg` = 16
- `Sérþykkt á TOPP/BOTN` = `fld883cOQamVYJu9W` = 16
- `Sérþykkt á hillum` = `fldJ6SwkKF86idb02` = 16
- `Sérþykkt á Bak` = `fldz2B6QH4Hs4IzRc` = 3
- `Þykkt skrokka f. Úrvinnslu` = `fldDuehb65mZyVfB0` = 19 (formula, already follows the unit's own carcass)

Nothing writes the Sérþykkt fields (not Keyra skipulag, not the repo). The script already reads `Þykkt skrokka f. Úrvinnslu` into the context but uses it only for `Innskúffufrontur` when set to Skrokkaefni.

Exact current script lines (Sögunarlisti script, node `wacv3SG8AsLxPohhl`):

```
const U_THYKKT_SKROKKA      = "Þykkt skrokka f. Úrvinnslu";
...
thykktSkrokka:  toNumber(unit.getCellValue(U_THYKKT_SKROKKA)),
...
    const tExpr = normalizeExpr(getText(tmpl, T_T_EXPR), unit, unitFieldNames, ctx.hasKassiAnFronts, partName);
...
    let t = safeEvalMath(tExpr);
```

So `t` = 16 for sides/top/bottom/shelves regardless of the unit's own material or of the project's carcass thickness. Because `Þykkt skrokka f. Úrvinnslu` is the right source (own carcass when linked, else the Tækifæri's), SK2 gives 19.

## 2. Automations containing the affected script

- **Skipulag · Yfirfara einingu** (`wflqQLKQBKIpNutDn`), first script node, description "CLAUDE Sögunarlistinn 🪚". This is the only Sögunarlisti-writing script in the live automation list.
- The obsolete "1. Keyra alla lista" (`wflR6BIZrW303Z44L`) is no longer returned by `list_automations`. If it still exists elsewhere, paste the same edit there.
- Keyra skipulag (`wflPGRyv0VYi4AZpd`), both Pöntunarlisti scripts and Vörur per eining do NOT contain it and need no change.

## 3. The fix (one script, one automation)

Rule: only when the unit has its own carcass linked (`Skrokkaefni (eining) 🔲`, written by Keyra skipulag) and a thickness is known, take `Þykkt skrokka f. Úrvinnslu` for the parts whose template uses Sérþykkt á Hliðum / TOPP/BOTN / hillum. Back panel (`Sérþykkt á Bak`), fronts, Slár, drawer parts and every unit without an own material stay byte-identical.

**Find:**
```
    let t = safeEvalMath(tExpr);
```

**Replace with:**
```
    let t = safeEvalMath(tExpr);

    // Eigið skrokkaefni einingar: hliðar / toppur / botn / hillur taka þykkt þess (ekki fasta 16).
    // Bak (3 mm masonit), frontar, slár og skúffuhlutar eru óbreytt.
    if (
      (unit.getCellValue("Skrokkaefni (eining) 🔲") || []).length > 0 &&
      toNumber(ctx.thykktSkrokka) > 0 &&
      /Sérþykkt á (Hliðum|TOPP\/BOTN|hillum)/u.test(getText(tmpl, T_T_EXPR))
    ) {
      t = toNumber(ctx.thykktSkrokka);
    }
```

The Find text occurs exactly once in the script. Update the script in Yfirfara einingu only (`wflqQLKQBKIpNutDn`). Save, then press the Eyðublað button on SK2 | EF50: carcass rows should show `Þ` = 19.

## 4. Risks

- **Slár (literal 16)** is cut from the same board but is hardcoded in ÚRVINNSLA, so SK2's Slár stays 16 while its sides are 19. Decide separately; fix by changing that template to `Þykkt skrokka f. Úrvinnslu` (a field name token works in `Þykkt formúla`) or extend the regex.
- Depth/width formulas that subtract thickness are not touched: if a template deducts `Sérþykkt á Hliðum` from a dimension, that term still uses 16. Not seen in the templates I read (only `Þykkt formúla` was checked, not Hæð/Breidd formúla).
- Already-generated rows keep `Þ` = 16 until Yfirfara einingu runs again on that unit. Locked rows (Tilbúið 🔒) are never rewritten.
- Edge-banding width (`klBreidd`, `>= 23` -> 43 else 23) is the same for 16 and 19, so no change there.
- Projects with a 19 mm project carcass but no own material still get 16 (current behaviour, deliberately not changed here).
- If `Skrokkaefni (eining) 🔲` is missing on a copy of the table, `getCellValue` throws. It exists (Keyra skipulag writes it by name).

## 5. Rollback

Delete the inserted `if (...) { t = toNumber(ctx.thykktSkrokka); }` block and its two comment lines so only `let t = safeEvalMath(tExpr);` remains, save the script, and re-press Yfirfara einingu on any unit to restore `Þ` = 16.
