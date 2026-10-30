# Airtable dead-field scan, 2026-10-30 (read-only, nothing tagged or deleted)

Method: every record of Tækifæri (199), Eyðublað (707) and Vöru línur (2902) pulled, fill rate per field. A field is a candidate when it is filled in <=0.5% of rows (min 2), is not in any other field's `referencedFieldIds`, and its id/name does not appear in this repo.

**Blind spots:** the check does not see Airtable scripts, automation inputs, interface elements or views. Check those before tagging. Past rule: the V1/V2/… and IN/IE/IK slot fields are a deliberate design, so similar names prove nothing.

## Tækifæri (13 of 284)
Empty: `{F} + {IF} Rollup`, `{C} + {IC} Rollup`, `Skilaboð til teiknara (from Eyðublað)`, `Læsa afhendingardag 🔒`, `Fjöldi halda 2`, `Kantlíming upbbót 💰`, `Kantlíming metrar 📏`, `Lokareikningur viðbóta greiddur`.
1-2 filled: `Viðskiptavinur sækir:`, `Teikningar og lýsing klár ✅`, `Búa til samsetningarlista`, `Villur í sögunarlista`, `Aftur klárt til skipulags 2.0`.

## Eyðublað (22 of 206, 41 fully empty)
Likely dead: `LI Aukahlutategund V2` + `texti`, `LI Magn per aukahlutavöru V2`, `LI Aukahlutavörur V2` (V2 accessory lookups, never filled), `{C} + {IC}`, `{F} + {IF}`, `Breidd vængfronts 1-4`.
Leave alone, probably planned: `Grip tegund/brún/átt ⚙️` (Fræst grip system scoped 2026-10-14), `Merki ZPL` (labels), `LED aukahlutir (+magn)`, `Hurðabúnaður (+magn)`, `Flókin kerfi magn`, `Sýna bakenda` (maybe an interface toggle).

## Vöru línur (19 of 208, 16 fully empty)
Empty `LI IC / IE / IF / IK / IN` lookups and their `samtals` formulas: a slot family that is not used. Check it against the slot design before touching.
`🔄 Samstilla Eyðublað` checkbox: the Samstilla automation is gone from the base, so the checkbox is orphaned (CLAUDE.md already says to drop SYNC_CHECK from the interface).
Nearly empty: `LI N`, `LI N samtals`, `LI F samtals`, `Grip síðast breytt 🕒`.
