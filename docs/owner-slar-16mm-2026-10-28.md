# Slár alltaf 16 mm / afgangsefni (greining 2026-10-28, ekkert skrifað í Airtable)

Spurning eiganda: þegar eining er með eigið 19 mm skrokkaefni má Slárin ekki teljast sem 19 mm skrokkaplata; hún á að fara á afgangsefni (16 mm).

## 1. Hvað er til í dag

Afgangsefni er til sem **eining-stigs hak**, ekki sem hluta-stigs reglur:

| Hvað | Hvar | Lýsing |
|---|---|---|
| `Afgangsefni` (checkbox) `fldUWgYg4hJpsfjij` | Eyðublað ✏️ | "Má nota afgangsefni í þessa einingu — fyrir hluti sem eru ekki sýnilegir, t.d. sökkul. Stýrir Efni: í Sögunarlisti." |
| `Afgangsefni` (checkbox) `fldP2g8A1KvsTOUol` | Sögunarlisti 🪚 | Sett af Sögunarlisti-scriptinu út frá hakinu á Eyðublaði (`setIfFieldExists(partsTable, fields, P_AFGANGSEFNI, ctx.hasAfgangsefni)` — á ÖLLUM hlutum einingarinnar, líka blindlok-línunni). |
| `Efni:` formúla `fldGJlstHqJfu9QOg` | Sögunarlisti 🪚 | Fyrsta grein: `IF({Afgangsefni}, "Nota afgangsefni", ...)` — textinn "Nota afgangsefni" kemur í stað efnisins. |

Ekkert annað: engin `Tegund = Afgangur` í Pöntunarlisti, enginn view/tafla/valmöguleiki með "afgang" í Pöntunarlisti, Pantaðir listar, Efnislisti eða ÚRVINNSLA (leitað í öllum field-nöfnum, lýsingum og options). Ekkert forrit í repo (`*.html`, `*.js`) les þetta hak.

### Hvernig afgangsefni virkar niður keðjuna (úr scriptunum)

1. **Sögunarlisti-script** (`CLAUDE Sögunarlistinn 🪚`): skrifar bara hakið. `syncCutlistMaterialLinks` reynir að leysa `Efni:` í Efnislisti eftir nafni; "Nota afgangsefni" finnst ekki -> línan fær **engan** `Efnislisti 🧱` hlekk (og sleppir líka línum sem þegar hafa hlekk, þ.e. hlekkur sem þegar er til er ekki hreinsaður).
2. **Pöntunarlisti full** (Automation `wflstmiM1A5xC8N66`): hlekkur tómur -> nafnaleit "Nota afgangsefni" finnst ekki -> `matId = null` -> `unlinkedMaterialLines++` og nafnið fer í `missingCutMaterialNames`; línan **fer ekki í `boardAreaM2`** (þ.e. ekki í plötutölur / nýtingu). Kantlíming er reiknuð áfram því hún les `Kant ..._h efni` og `KL🔄` óháð efnishlekk. Úr þessu kemur viðvörunin "⚠️ unlinkedMaterialLines ... lines skipped" í output (hávaði, ekki villa).
3. **Pöntunarlisti lean** (node 2 í `wflqQLKQBKIpNutDn`): les aldrei Sögunarlisti, `MANAGED_TYPES` = Fylgihlutir, Höldur, Skúffur, Stök vara, Harðplast, Gler & speglar. Ekkert breytist þar.
4. **Pöntun per Unit** (node 3): ekkert um afgangsefni.

Niðurstaða: afgangsefni = "ekki panta plötur fyrir þessa línu", virkar í raun aðeins í full-Pöntunarlistanum og aðeins í gegnum að hlekkurinn vantar.

## 2. Hvernig Slár er skilgreind (⚙️ Eyðublaðs ÚRVINNSLA ⚙️, `tblR1TpicLRVTXHql`)

| Template (Partur) | Þykkt formúla | Tegund | Efnisflokkur | Athugasemd |
|---|---|---|---|---|
| **`Slár`** (rec2zQjQrGNNODn3I) | `16` | Grunnskápur, Hárskápur, Efriskápur, Ofnaskápur, Loftunarskápur | Skrokkaefni | Magn `Fjöldi sláa`, B = `Breidd-2*Þykkt skrokka f. Úrvinnslu`, H = 100 |
| `Lagna - Slár (muna KL)` | `16` | Lagnaskápur | Skrokkaefni | KL ↕️, Magn `Fjöldi eininga*2` |
| `Lagna - Toppslár (muna KL)` | `16` | Lagnaskápur | Skrokkaefni | KL ↕️ |
| **`Toppslár - KL ↕️`** | `Sérþykkt á TOPP/BOTN` | Grunnskápur | Skrokkaefni | H = 80. Þykktin er **ekki** 16 heldur sú sama og toppur/botn |
| `Lagna - (Topp)slár úr FRE / FRE2` | `Þykkt fronta` | Lagnaskápur úr FRE(#2) | Frontaefni | Úr frontaefni, ekki skrokkaefni; ekki hluti af þessu máli |
| `❌ FRE / FRE2 - Slár [SLÖKKT]` | tómt | | | Slökkt |

Hvað stýrir efninu: `Efni:` -> `Efni: (undirstaða)` (`fldshrZoGeVBBiDcR`) fellur fyrir Slár niður í default-greinina = `Skrokkaefni 🔲` (`fldYAXqrPKRZbAYqA`) = **`Skrokkaefni (eining)` ef það er til, annars `Skrokkaefni (Tækifæri)`**. Ekkert í formúlunni horfir á þykkt (nema Þ=3 -> masonít). Þykktin kemur frá template (`16`).

Í Sögunarlisti-scriptinu er eigin-skrokkaefni override sem breytir `t` í `Þykkt skrokka f. Úrvinnslu` aðeins þegar template-formúlan inniheldur `Sérþykkt á (Hliðum|TOPP/BOTN|hillum)`. `Slár` (formúla `16`) er því óbreytt 16 — en `Toppslár - KL` verður 19 í 19 mm einingu (það er hún í raun toppur).

### Hvar bugið er í dag

Slár í 19 mm einingu: `Þ = 16` en `Efni:`/`Efnislisti 🧱` = 19 mm eigin skrokkaefnið. Í Pöntunarlisti full er `boardKey = ${matId}|${round(Þ)}` -> sér liður `matId|16`, sem fær eigin `Math.ceil` af plötum (nýting 0,92) og leggst síðan **ofan á sama `PLATA | <heiti efnis>` línu** og 19 mm plöturnar (`boardLines` er keyed á `materialKey` = heiti, ekki þykkt). Afleiðing: a.m.k. 1 aukaplata af 19 mm efni vegna nokkurra sláa, og Slár er ranglega sögð úr 19 mm efni.

## 3. Tillaga (lágmarksbreyting, nýtir kerfið sem er til)

Nota **sama Afgangsefni-hakið á Sögunarlisti** en setja það á hluta-stigi: Slár-línur (16 mm skrokkaefni) í einingu með eigið skrokkaefni sem er ekki 16 mm fá hakið. Þá:
- `Efni:` sýnir "Nota afgangsefni" (á sögunarlista/labels/cutlist, saman við sökkul-afganga),
- engin plata í Pöntunarlisti fyrir línuna.

Ekkert nýtt field, engin ný tafla.

### Breyting A — Sögunarlisti-script (setja hak á Slár)

**Find:** (kemur einu sinni fyrir; blindlok-útgáfan notar `blindlokFields` og er ósnert)
```
    setIfFieldExists(partsTable, fields, P_AFGANGSEFNI, ctx.hasAfgangsefni);
```
**Replace with:**
```
    // Slár er alltaf 16 mm. Ef einingin er með eigið skrokkaefni sem er ekki 16 mm
    // fer slárin á afgangsefni (Efni: = "Nota afgangsefni") í stað þess að
    // teljast sem plata úr skrokkaefni einingarinnar.
    const slarOnLeftover =
      /slár/i.test(rawPartName) && !/FRE/i.test(rawPartName) &&
      toNumber(overridden.t) === 16 &&
      (unit.getCellValue("Skrokkaefni (eining) 🔲") || []).length > 0 &&
      toNumber(ctx.thykktSkrokka) > 0 &&
      toNumber(ctx.thykktSkrokka) !== 16;
    setIfFieldExists(partsTable, fields, P_AFGANGSEFNI, ctx.hasAfgangsefni || slarOnLeftover);
```
Skýringar: `Toppslár - KL` er áfram 19 (`overridden.t` er þá 19, skilyrðið `=== 16` sleppir henni). Ef eigandi vill líka að hún sé 16 þarf að breyta template-formúlunni (annað mál). FRE-slár sleppt (frontaefni).

**Automations sem innihalda þetta script (þarf að uppfæra):** aðeins **`Skipulag · Yfirfara einingu`** (`wflqQLKQBKIpNutDn`, node `wacv3SG8AsLxPohhl` "CLAUDE Sögunarlistinn 🪚"). Önnur automation í listanum innihalda ekki þetta script (Keyra skipulag, Pöntunarlisti verkefnis, o.s.frv. gera það ekki). Gamla `1. Keyra alla lista` (`wflR6BIZrW303Z44L`) er **ekki** í list_automations núna — ef það finnst enn í UI þarf að uppfæra líka eða slökkva.

### Breyting B — Pöntunarlisti full (virða hakið, líka fyrir línur sem þegar hafa efnishlekk, og þagga viðvörun)

B1. **Find:**
```
const F_CUT_KL_WIDTH = "KL breidd";
```
**Replace with:**
```
const F_CUT_KL_WIDTH = "KL breidd";
const F_CUT_AFGANGSEFNI = "Afgangsefni";
```

B2. **Find:**
```
    if (!matId && materialName) missingCutMaterialNames.add(materialName);
```
**Replace with:**
```
    if (!matId && materialName && materialName !== "Nota afgangsefni") missingCutMaterialNames.add(materialName);
```

B3. **Find:**
```
if (!matId) {
  unlinkedMaterialLines++;
} else {
```
**Replace with:**
```
if (Boolean(r.getCellValue(F_CUT_AFGANGSEFNI))) {
  // afgangsefni (t.d. 16 mm slá í 19 mm einingu): ekki talið með í plötum.
  // Kantlíming er áfram reiknuð hér að neðan.
} else if (!matId) {
  unlinkedMaterialLines++;
} else {
```

**Automations:** aðeins **`Skipulag · Pöntunarlisti verkefnis`** (`wflstmiM1A5xC8N66`, node `wacwQTonFS1qIPFFL`). Lean-útgáfan í `Skipulag · Yfirfara einingu` (node `wacjE53vyeGXBbZAI`) les ekki Sögunarlisti og þarf **ekki** breytingu. (Lýsing node-sins segir "ath. uppfæra öll automation á sama tíma" — ef önnur automation eru með fulla útgáfu af Pöntunarlista sem list_automations sýnir ekki, uppfæra þau líka; í þessari base er hún aðeins í þessu eina.)

Breyting A ein og sér virkar nú þegar (hlekkur vantar -> plata sleppt), en B gerir það óbrigðult (línur sem þegar eru með hlekk eða eru læstar með `Tilbúið 🔒` teljast ekki lengur) og fjarlægir "unlinkedMaterialLines" hávaðann. Mælt með A+B.

### Áhætta

- **Slár birtist í Efni: = "Nota afgangsefni"** á sögunarlista, /cutlist, merkimiðum o.fl. Ekkert í repo-inu les Afgangsefni, svo þessi flötur flokkast eins og sökkull-afgangar. Þarf að staðfesta að sögunin sé sátt við að Slár séu ekki hópuð með skrokknum (sennilega vilji eiganda).
- **Kantlíming Slár er áfram pöntuð** (hún er reiknuð óháð efnishlekk). Rétt: kantband þarf enn.
- **Engin pöntun á 16 mm efni** myndast; ef afgangar eru ekki til þarf að panta/finna 16 mm handvirkt. Kerfið teiknar ekki neina "16 mm þarf" línu (sjá valkost 2 hér að neðan ef það er óskað).
- **Gömul Sögunarlisti-rows** (og læstar `Tilbúið 🔒`) fá ekki hakið nema Sögunarlistinn sé keyrður aftur (Yfirfara einingu). Læstar línur með hlekk haldast í plötutölum nema B komi til og hakið sé handsett.
- Mörkin `Þykkt skrokka f. Úrvinnslu` > 0 og != 16 byggja á að það field sé rétt fyllt þegar eigin efni er valið; ef það er tómt sleppir skilyrðið (Slár helst eins og í dag).
- Gögn: `Eurodekor W911 SM 16 mm MDF` hefur `Þykkt (mm)` = 19 í Efnislisti (líklega villa í gögnum). Þessi tillaga reiðir sig ekki á það field.

### Afturköllun

Skipta Replace-blokkunum aftur út fyrir Find-textana (hver breyting er sjálfstæð). Hakið á þegar-sköpuðum Sögunarlisti-línum er hægt að hreinsa með því að keyra Yfirfara einingu á einingunni (óbreytt script endurskapar línurnar án hakans) — ólæstar línur eru endurskapaðar; læstar (`Tilbúið 🔒`) þarf að afhaka handvirkt.

## 4. Valkostir ef eigandi vill í raun panta 16 mm efni (ekki bara sleppa)

1. **Efnislisti "félagi" hlekkur** (nýtt self-link field á Efnislisti: 19 mm skrokkaefni -> samsvarandi 16 mm). Sögunarlisti-script setur þá `Efnislisti 🧱` á Slár = félaginn og Pöntunarlisti telur Slár sem 16 mm plötur (`matId|16` fær sinn eigin `PLATA` lið af 16 mm efninu). Kostur: rétt pöntun, ekkert handvirkt. Galli: þarf að viðhalda tengingum við hvert skrokkaefni (data-vinna), nýtt field + breyting í báðum scriptum, og `boardLines` þyrfti að keya á rétta efnið (virkar því félaginn er annað matId).
2. **Sér Sögunarlisti-hak (t.d. `Slár 16 mm afgangur`) sem Pöntunarlisti sleppir**. Sama virkni og tillagan, en án þess að blanda við sökkul-afganginn og án þess að breyta `Efni:` formúlunni. Galli: nýtt field og meiri breyting; ávinningur lítill miðað við að `Afgangsefni` er til.

**Meðmæli:** A + B (nota Afgangsefni sem er til). Fari eigandi að vilja pantaða 16 mm línu, bæta þá við valkosti 1 seinna.
