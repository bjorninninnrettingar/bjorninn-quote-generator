# Smíða og Ný eining í PRO — tillaga að nýju flæði (2026-10-30)

**Staða:** Þetta er TILLAGA, ekkert er byggt. Lestu, leiðréttu, svo byggjum við eina umferð í einu.
Kóðatilvísanir (skrá:lína) eru aftast, í viðauka.

## Hvað þú baðst um
- Smíða: aðeins **eitt atriði í einu**, eins og Hurða-flæðið. Myndin við hliðina sýnir það sem er verið að skoða.
- Lamir eiga að vera sér hluti. Myndin hoppar á milli lamanna.
- Ný eining í PRO á að hafa **alla** möguleika Studio (fataskápar vantar).
- Smíða og Ný eining eiga að vera **sama flæðið** í PRO.
- Reglur sem standa: Rakel sofnar ekki (hvert atriði fær skýra aðgerð: slá inn tölu eða ýta á „Rétt“), myndin sýnir núverandi gildi sem fölan skugga, „Áfram / Til baka“ á sama stað, engin síðuskrunun, engin emoji, stuttir textar.
- **Gögnin breytast ekki** (b.smida, b.shelfPos, b.interior.frontsMm, smidaFor, smidaHash, proReady, proIssues, b.smidaAck). /smida, Keyra skipulag, CNC og vinnuteikningar lesa þau.

## 1. Hvað er á skjánum núna
Ég mældi í vafranum (1440 × 900) með prufusenunum. Tölur eru **hnappar / reitir inni í opnum hluta**, einn hluti opinn í einu. Hlutarnir sjálfir (8–9 hausar) og yfirlitsmerkin eru alltaf að auki.

| Eining | Mál (hver) | Innvols | Staðsetning | Vélbúnaður | Fleiri stillingar | Yfirlit |
|---|---|---|---|---|---|---|
| Fataskápur 900 | 1 / 1 | 3 (+ myndaspjöld ef flipi opnaður) | **34 / 15** | 12 / 5 | 14 / 3 | 12 |
| Efri skápur með hurðum | 1 / 1 | 3 | 15 / 6 | 6 / 2 | 8 / 4 | 12 |
| Vaskaskápur | 1 / 1 | 4 | 9 / 6 | 0 (aðeins texti) | 14 / 3 | 11 |
| Skúffuskápur | 1 / 1 | um 6 | áætlað um 10 (Sérhæð á hverri samskeyti) | áætlað 5–10 (grip) | 16 / 3 | 4–12 |
| Ofnskápur | 1 / 1 | áætlað 5 | áætlað 15–25 (ofn, skúffur, ofnhillur) | áætlað 5–10 | 14 / 3 | 12 |

Skúffu- og ofnskápar voru ekki í prufusenunum, svo þær tölur eru áætlaðar úr kóða (`smItems`). PRO sjálft gat ég ekki opnað (enginn lykill), en sami kóði keyrir í senunum.

**Niðurstaða:** Staðsetning er verst — í fataskáp 49 stjórntæki í einum hluta. Hliðarspjaldið er 1175–2124 px hátt en sést bara 730 px, þ.e. **það skrunast**, sem brýtur regluna. Allir hlutar eru líka sýnilegir sem hausar allan tímann.

## 2. Hurða-flæðið: hvað gerir það skýrt
1. **Ein spurning á skjá** („Hvorum megin eru lamirnar?“), með myndaspjöldum eða einni tölu.
2. **Myndin er alltaf með** og sýnir nákvæmlega það sem spurt er um.
3. **Myndavélin færist** að því sem verið er að velja (fyrir hvern hluta fyrir sig).
4. Svarið er **ein aðgerð**; síðan opnast næsta spurning sjálf. Yfirlitið byggist upp neðst.

**Hvernig við heimfærum þetta á Smíða:** hver hlutur (ein hilla, ein löm, eitt grip) verður ein „spurning“. Núverandi „staðfestingarlisti“ (allt í einu) hverfur.

| Hluti | Skjáir, einn í einu | Myndin / myndavélin | Fyrirfram útfyllt | Eina aðgerðin |
|---|---|---|---|---|
| **Mál** | Breidd → Hæð → Dýpt | Eins og í dag (vídd með fölum skugga) | Gildið sem teikningin hefur | Slá inn **eða** Rétt |
| **Innvols** | Hurðir/Skúffur → Tilbúin lausn (fataskápar) → fjöldi hverrar vöru (hilla, fataslá, skúffa) → Skúffur undir/aftan hurðar | Skápur opinn, framhlið gegnsæ, vélin beint framan á | Val viðskiptavinar / lausnin | Velja spjald **eða** Rétt |
| **Staðsetning** | Ein hilla / ein slá / ein skúffusamskeyti / ofnhæð á skjá, í röð neðan frá | Vélin lyftist upp í hæð hlutarins; lína sýnir hann | Jöfn dreifing (núverandi „Dreifa jafnt“) sem tillaga | Slá inn mm, draga, **eða** Rétt. Föst/Laus og gatafjöldi á sama skjá |
| **Frontar og hurðir** | Skipting fronta → hæð hvers fronts → gerð hverrar hurðar (lamir / lyfti / renni) → hlið lama | Framhlið, hurðir opnar | Núverandi skipting | Spjald **eða** Rétt |
| **Lamir** | Sjá kafla 3 | Hoppar á milli lama | Reglan úr /cnc (`HINGE_CLEAR`) | Rétt / mm / „Færa“ |
| **Grip** | Eitt front á skjá (aðeins ef höldin gefur ekki grip) | Vélin að frontinum | „Ekkert“ merkt | Spjald |
| **Annað** (nú „Fleiri stillingar“) | Ein spurning á skjá, aðeins þær sem eiga við: LED, FR2, innskúffufrontar, úthlið, AVENTOS … | Skápurinn í heild | Núverandi gildi | Spjald |
| **Yfirlit** | Eins og nú, en flokkað eftir hlutum | Skápurinn í heild | — | Klár |

**Enter:** í reit staðfestir Enter töluna sem er slegin inn og fer á næsta skjá. Enter í **tómum** reit gerir Rétt, en aðeins ef bendillinn er í reitnum (spurning 3 fyrir neðan).

**Verð:** skjáirnir verða fleiri (um 15–20 fyrir venjulegan skáp með 3 hillum og 4 lömum í stað ~8 hluta). Hver er samt ein snerting eða Enter. Það er verðið á því að Rakel sofi ekki.

## 3. Lamir — tilraunahlutinn (umferð 2)
**Nýr hluti „Lamir“** eftir Staðsetningu (lamir ráðast af hillugötum, svo hillur fyrst).

**Fyrir lamirnar (stuttir skjáir):** Hvorum megin lamirnar eru (ein hurð), eða staðreynd „tvær hurðir, lamir báðum megin“. Gerð hurðar. Fjöldi lama kemur úr `proHingeMin` (tillaga, hægt að bæta við / fjarlægja með ＋ / ✕).

**Einn skjár fyrir hverja löm** („Löm 2 af 4 · Hurð 1“):
1. **Myndavélin hoppar** (380 ms) að lömum: horft á hliðina þar sem lömin er, hurð gegnsæ, nokkurra sentimetra svæði kringum lömina.
2. **Svæði sýnd** (eins og í dag, ±30 mm): ljósblá bönd kringum hvert hillugat, fasta hillu og skúffubraut. **Rautt** ef lömin lendir í bandi. Textinn segir við hvað.
3. Föl lína = núverandi staða. Reitur í mm frá botni hurðar. Draga lömina á myndinni virkar áfram.
4. **Tillaga:** hnappur „Færa í 412 mm“ — næsti staður sem er laus (≥30 mm frá götum, ≥30 mm frá hurðarenda, ≥60 mm frá annarri löm). Sama regla og `proAutoHinges`, bara reiknuð fyrir eina löm.
5. **Rétt** er óvirkt meðan lömin er rauð (því Klár myndi stöðvast samt í `proIssues`).
6. Tvær hurðir: sama mm báðum megin; myndin sýnir lömina á þeirri hlið sem er verið að skoða.
7. Enter / Rétt → næsta löm, myndavélin hoppar.

**„Allar lamir rétt“ og reglan um skýra aðgerð:** hnappurinn birtist **aðeins á síðasta lamarskjá hurðarinnar** og aðeins ef engin löm er rauð og vélin hefur sýnt allar lamirnar. Hann skrifar staðfestingu á **hverja löm fyrir sig** (`smidaAck.hw["hgI_J"]`, sama snið og nú). Þetta er ein snerting á skjá þar sem allar lamirnar sjást, ekki blind yfirferð. Spurning 1.

## 4. Ný eining í PRO vantar fataskápamöguleikana — hvað og hvers vegna
Gerðaval (trén) er **ekki** vandamálið: `FATASKAPAR_TREE_PRO` er yfirsett Studio-trésins. Munurinn er í **töframanninum sjálfum**, þar sem tvær greinar eru lokaðar í PRO:

| Vantar í PRO Ný eining | Hvers vegna | Lagfæring |
|---|---|---|
| Myndaspjöld „Tilbúnar lausnir / Stakir hlutir“ (PAX-stíll), „Skúffurnar undir hurð / aftan hurðar“ og fjöldi rennihurða | Skilyrðið `(!PRO \|\| uw.smida)` — PRO fær gömlu stepparana í stað þeirra; spjöldin birtast aðeins í Smíða-hlutanum Innvols eftir „Setja inn“ | Sýna spjöldin líka í Ný eining (sami kóði, `closetBayHtml`) |
| „Rennihurðir“ og „Fellihurðir“ (`doorSys`) fá enga hurðar-/hurðafjöldaspurningu fyrr en í Smíða | Sama skilyrði; `slideDoorsHtml` er aðeins í spjaldagreininni | Sama lagfæring |
| Myndavélin svífur að því sem er valið (Breidd framan á, Hæð 45°, Dýpt frá hlið) | `uwLockView` og `uwAimCamera` fara snemma út með `PRO && !uw.smida` | Nota Smíða-myndavélina líka í Ný eining |
| Herbergið (gólf og veggur) á bað og þvottahús, og ljós bakgrunnur eins og í Studio (PRO notar dökkan fyrir Ný eining) | `previewRoom:!PRO && …`, `darkBg:!!PRO && …` | Kveikja líka í PRO ef þú vilt (spurning, sjá viðauka) |
| Skúffur dregnar til í forskoðun í öllum herbergjum | `drawerDragAll:!!uw.b && !PRO` | Fjarlægja `!PRO` |
| Bað: „Skúffur eða hurðir“ myndaskrefið | `bathFrontsWiz` er `!PRO` | Sama skref í PRO |
| Eldhús: Hæð / Dýpt / Innvols hverfa úr Ný eining | `uwShort` (viljandi: Smíða tekur við) | Hverfur af sjálfu sér þegar Ný eining og Smíða verða eitt (kafli 5) |
| Hornskápur sem „Hornskápur“ spjald | Í PRO heitir hann „Horneining“ og sést aðeins í hornskáp (`closetShape`) | Engin breyting — PRO hefur þetta þegar |

Studio-hluti sem á að vera áfram aðeins Studio: verðathugasemdir, „Algengast“-tillögur, cm-birting (PRO er mm), „Toppurinn verður í … cm hæð“, „Fylla vegginn“, eigin vél viðskiptavinar (`machineOnly`).

## 5. Eitt flæði
**Í dag:** Ný eining (gerð + breidd) → „Setja inn“ → *annar* töframaður (Smíða) opnast.
**Tillaga:** einn töframaður, sömu skjáir:

```
Hvað? (öll gerðaspjöld Studio + PRO-aukin) -> Breidd -> [skápurinn settur í herbergið]
  -> Hæð -> Dýpt -> Innvols -> Staðsetning -> Frontar -> Lamir -> Grip -> Annað -> Yfirlit
  -> Klár -> næsti skápur í röðinni
```

- **Skápurinn er settur í herbergið strax eftir gerð og breidd.** Smíða vinnur á raunverulegum skáp (`findBlock`); drög sem ekki eru í herberginu geta hún ekki breytt. „Til baka“ fyrir fyrsta Smíða-skjáinn tekur nýja skápinn út aftur ef engu hefur verið staðfest. Spurning 2.
- **Inngangar:** (a) hnappur á spjaldi og (b) „Laga í PRO“ úr /smida → sami töframaður, opnast á **fyrsta óstaðfesta skjá** (eins og `smFirstSec` í dag, nú á hlutarstigi). (c) Ný eining → byrjar á „Hvað?“ og fer áfram án þess að loka.
- „Klár“ → næsti óklári skápur (`smNext`/`smGo`), óbreytt, líka milli herbergja.
- Röðin er áfram: einn gangur um allt herbergið.

## 6. Áhætta og samhæfni
- **Gögn óbreytt.** Skjáirnir fylla sömu reiti og áður. Staðfesting er áfram `smidaAck.mal/inn/pos/hw` með sömu lyklum, svo skápar sem eru þegar klárir haldast klárir.
- **`smInnSig`** þarf að ná yfir nýju sjálfvöldu gildin (t.d. tilbúna lausn) svo staðfesting detti ekki út óvart og detti út þegar hún á.
- **Myndavélin:** `uwAimCamera` velur stefnu eftir hluta (`w/d/inn/pos/hw/yfir`). Hún þarf að læra „fókus á hlut“ (hæð hillu, löm). Teikningin má ekki endurbyggjast við hvert skref (`uwPrevKey`).
- **`refreshAfterEdit()`** er ekkert-aðgerð meðan `uw.smida` er virkt — nýir hjálparar mega ekki treysta á hana (herbergið er endurbyggt þegar töframanni er lokað).
- **Prófið um tvöföld föll** (`tests/kp-smida-wizard.test.js:41`): ný föll þurfa einstök nöfn (forskeyti `sm` / `uwp`).
- **Afturkalla** og vistunarkapphlaup lagaðist í dag (á main) — nýtt flæði vistar áfram með `save()` á hverja breytingu.
- **Hætta við hálfklárað nýtt skáp:** hann situr þá sem „óklár“ í Yfirferð, sem er rétt hegðun.

## 7. Umferðir
**Umferð 1 — Ný eining jafnast á við Studio + eitt flæði.** Skrár: `kitchen-planner.html`, prófið, þetta skjal. *5 mín. próf á T-32:* PRO → Ný eining → Fataskápur: lausnaspjöld og stakir hlutir sjást strax, Rennihurðir spyrja um fjölda, myndavélin svífur, skápurinn birtist í herberginu eftir breidd, Smíða heldur áfram í sama glugga, Klár fer á næsta. *Ekki með:* einn hlutur í einu, lamir.

**Umferð 2 — Lamir (tilraun).** Skrár: `kitchen-planner.html`, `cnc-sides.js` aðeins lesið. *5 mín.:* opna skáp með 2 hurðum og hillum, löm á hillugati verður rauð, „Færa“ lagar, myndavélin hoppar milli lama, Klár virkar, /smida sýnir sömu lamarstaði og áður (smidaHash óbreytt fyrir óbreytta skápa). *Ekki með:* aðrir hlutar.

**Umferð 3 — Allt hitt, einn í einu.** Mál, Innvols, Staðsetning, Frontar, Grip, Annað. *5 mín.:* einn skápur frá upphafi til Klár — teldu Enter-ýtur; ekkert skrunast. *Ekki með:* verðáætlun, nýjar vörur.

## 8. Spurningar til þín (svar í einu orði)
1. „Allar lamir rétt“ á síðasta lamarskjá hurðar — **Já** eða **Nei**?
2. Skápurinn settur í herbergið strax eftir breidd (Til baka tekur hann út) — **Já** eða **Nei**?
3. Enter í tómum reit = Rétt (aðeins þegar bendill er í reitnum) — **Já** eða **Nei**?
4. Hillur: ein hilla á skjá, eða allar hillur saman en ein tala í einu — **Ein** eða **Saman**?
5. Herbergismynd (gólf og veggur) og ljós bakgrunnur í PRO eins og Studio — **Já** eða **Nei**?

---

# Viðauki — kóðatilvísanir (kitchen-planner.html nema annað sé tekið fram)

**Smíða-kjarni (sm*)**
- `smCtx` :18414 · `smMm/smAckOk` :18423–18425 · `smInnSig` :18426 · `smOrder` :18429 · `smSecDone` :18430 · `smFirstSec` :18431
- `smQueue/smHead` :18439–18440 · `smDimSecs` :18450 · `smMissing` :18461 · `smYfirSec` :18472 · `smChips/smTray` :18484–18497 · `smActions` :18498
- `smAdvanceFrom` :18505 · `smCommit` :18506 · `smAckInn` :18521 · `smSetShelves/Rails/Inner` :18530–18544
- `smItems` :18552 — `pos` :18557–18646 (Sérhæð :18559, ofn :18567, hillur :18574–18586, Dreifa :18589, Raðborun :18599, slár :18609, búr/innskúffur :18617–18636, bað :18637); `hw` :18647–18694 (Skipting :18651, hlið :18660, Gerð :18664, **lamir :18667–18677**, grip :18679–18693)
- `smItemAckOk/smGrpDone` :18698–18700 · `smItemSecs` :18701 · `smBindDrag/smAbsAt` :18771–18778 · `smWire` :18789 · `smNext` :18859 · `smGo` :18864 (annað herbergi :18867) · `openSmidaWizard` :18875 · `window.__sm` :18887
- Inngangar: spjaldshnappur :18144 · „Laga í PRO“ :21255–21261 · ný eining í PRO :9096

**Ný eining (uw*)**
- `openUnitWizard` :8399 · `drawUwDims` :8421–8461 (föl lína: :8433, :8454–8459) · `uwLockView` :8470 · `uwAimCamera` :8474 (PRO-útgangur :8477, stefna eftir hluta :8506–8508) · `uwAdvance` :8667
- Tré: `KITCHEN_TREE` :8226 · `FATASKAPAR_TREE` :8262 · `_PRO` :8278 · `BAD_TREE` :8287 · `THVOTT_TREE` :8304 · `_PRO` :8324 · `CL_HORN` ~:8349 · `activeUnitTree` :8351–8357 · `frontsWiz` :8360 · `uwShort` :8362 · `bathFrontsWiz` :8635
- `renderUnitWizard` þrep 3: :8702–8803 (Smíða-greinar :8704, :8709, :8728, :8801–8803) · `machineOnly` :8724 · fataskápaspjöld `(!PRO || uw.smida)` :8794 · PRO-hurðir :8792
- Forskoðun: :9158 (`darkBg`, `previewRoom`) · `drawerDragAll` :9161 · `uw.smida` frjáls snúningur :9197 · `closeUnitWizard` / `smClose` :18884

**Fataskápsviðmót:** `closetDoorsHtml` :12084 (síun á pocket :12086) · `closetBayHtml` :12103 · `closetDrawerModeHtml` :12100 · `slideDoorsHtml` :13700 · `renderEditPanelInto` :12133 · PRO-flipar :12286

**Lamir og reglur:** `proHingeMin` :17951 · `proShelfRows` :17953 · `proIssues` :17964 · `proSpec` :18039 · `proDefaultHinges` :18045 · `proAutoHinges` :18057 · `proSkList` :18338 · `proNextUnready` :18352 · `proReady` :19763 · `cnc-sides.js:70–81` (`HINGE_CLEAR = 30`), `cnc-sides.js:537` (viðvörun)

**Hurða-töframaðurinn (fyrirmynd):** `openDoors` :15111 · `DW_SEC_LABEL` :15024 · `dwSecs` :15067 · Opnun :15363 · Lamir :15374

**Próf:** `tests/kp-smida-wizard.test.js:41` (engin tvöföld föll)

**Mælingar (kafli 1):** `?scene=fataskapur|bad` (`scenes/*.json`), `window.__sm.open(id)`, fjöldi `.uw-sec-body button/input` á hvern hluta. Skúffu- og ofnskápar ekki í senunum — áætlað úr `smItems`.
