# Forskrift: Vasahurðir (Blum REVEGO, Hawa Concepta III) — útlit og pláss

2026-10-30. Bara forskrift, enginn kóði skrifaður. Eigandi les, leiðréttir, svo eru umferðir smíðaðar og prófaðar á T-32.
**Útlit og pláss eingöngu.** Engin borgögn, CAD eða CNC í þessari umferð.
**Bið:** ekki smíða fyrr en `build-beams` hefur pushað (sömu skrár: `kitchen-planner-3d.js`, `kitchen-planner.html`).

## 1. Hvað er til í dag

| Staður | Staðan í dag | Vantar |
|---|---|---|
| Ný eining | „Flóknari kerfi → Vasahurðir“ (fataskápur) og „Tækjaskápar → Skápur með rennihurðum“ (eldhús) búa til háan skáp með pocket-hurðum. „Fellihurðir“ = WingLine (annað kerfi). | Engin skýring á kerfi, hlið eða plássi. Revego er alltaf sjálfvalið. |
| Studio | Háir skápar með hurð: „Á lömum / Rennur inn í hlið“. | Sama: engin mynd af vasanum. |
| PRO / Smíða | Gerð hurðar: Á lömum / Lyftihurð / Rennihurð; kerfi: Blum Revego / Hawa Concepta III. Eining er „uno“ ef breidd ≤ 600, annars „duo“ (`pocketLeafOf`). | Reglan er röng gagnvart Blum: uno nær upp í 900, duo byrjar í 900. Engar villumeldingar. |
| 3D | Hurðin snýst 90° og rennur svo afturábak inn í skápinn sjálfan (`kind:"pocket"`). | Enginn vasi, engin braut, skápurinn breikkar ekki, hurðin fer í gegnum innvolsið. Hawa er teiknað eins og Revego. |
| 2D plan / Veggur | Smíða-teikning litar hurðina ljósbláa. Veggteikning flytur `hinge:"pocket"` og texta „rennihurð í hlið“. | Ekkert tákn: engin punktalína fyrir hurð í vasa, engin ör. |
| Tilboð / pöntun | V3 fær Revego UNO/DUO eða Concepta einfalt/tvöfalt (`POCKET_PRODUCTS`) + athugasemd. Yfirlit segir „Vasahurðir / rennihurð í hlið (Blum Revego)“. | Allt í lagi, breytist ekki. |

Athugasemd: í kóðanum heitir Hawa-kerfið `pocketSys:"concepta"` (ekki „hawa“). Við höldum því nafni.

## 2. ÚTLITIÐ (3D)

**Allt kerfið er eining: opið/lokað + vasi.** Hlutir sem verða teiknaðir:

1. **Vasinn** — mjór kassi (sama efni og skápurinn, innanverðu grátt) *við hliðina á opinu*, í fullri hæð og dýpt einingarinnar. Uno: einn vasi (vinstri eða hægri). Duo: einn 150 mm vasi, tvær hurðir leggjast saman inn í hann. Uno+uno: tveir vasar, einn á hvorum enda, hurðirnar mætast í miðju.
2. **Lokað:** hurðin er í fullri yfirlögn (full overlay) og nær yfir bæði opið og vasann — flöt með nágrönnum, 2–3 mm fúga, **engin handfang** (TIP-ON). Vasinn sést ekki.
3. **Opið** (smellur á hurðina eða „Opna“): mjúk renna (~0,9 s, easeInOut): hurðin snýst út ~90° (fyrstu 35 %), rennur svo til hliðar inn í vasann (síðustu 65 %), TIP-ON „púst“ í byrjun (4 mm út). Aftur: öfugt. Duo: blöðin leggjast fyrst saman, svo inn.
4. **Hurðin í vasa:** sést sem þunn rönd (18–26 mm) rétt inni í vasanum; vasaop er dökkgrátt þar sem hurðin hverfur.
5. **Braut:** þunn ál-lína (3×8 mm) efst og neðst á hurðarhliðinni í vasanum, ljósgrá málmáferð. Dugar sem vísbending, ekki nákvæm braut.
6. **Opið innvols:** hillur, stangir, skúffur sjást eins og núna (innvolsið er nú þegar teiknað). Vasinn er lokaður kassi, ekkert innvols í honum.
7. **Sökkull (toe-kick):** valkostur, sjálfgefið já á gólfi: sökkulplata sem fylgir skápnum og vasanum í sömu línu. **Borðplötu-útgáfa** (framhlið ≥ 1130 mm): gert sem hálfhár kassi ofan á borðplötu, vasinn nær upp að sömu hæð, hurðin 1130–… mm. Fyrsta umferð gerir gólfútgáfuna, borðplötuútgáfan í umferð 2 ef tími vinnst.
8. **Efni:** hurð = framefni skápsins. Vasi = sama og skápurinn. Braut/vélbúnaður = hlutlaust grátt málmefni (sama og lamir í dag).
9. **Concepta III (Hawa):** annað lag á sama kerfi. Hurðin snýst 90° á snúningslömum og rennur inn í hliðarhólf; vélbúnaðurinn inni í vasanum er 55 mm, svo vasinn er **≥ 87 mm** (55 + 1–2 hliðar). Sýnileg lóðrétt ál-súla (upright profile) á hurðarbrún þegar hún er opin. Nákvæm hegðun á tvöfalda kerfinu er óstaðfest hjá birgi, við teiknum það eins og uno+uno.

**2D plan (grunnmynd):** skápur teiknaður með vasanum sem aukakassi; hurðin opin = punktalína (dashed) af hurðinni lagðri í vasann, ör sem sýnir ferðina frá opi inn í vasa. **Framhlið/Veggur:** lokuð hurð eins og venjulega + lítið tákn (ör ← / →) og vasinn sem lóðrétt gráfyllt rönd við hliðina. **Smíða/vinnuteikning:** sama tákn: punktaútlína af hurðinni í vasanum, ör, texti „Vasi 100 mm · hlið: hægri“ og kerfisheiti.

## 3. PLÁSSIÐ (mm)

Blum: *uppsetningarbreidd (EB) innifelur vasann* (900 − 100 = 800 innri breidd). Þ.e. skápurinn *er* opið + vasi; framhliðin er EB − 2 mm.

| Kerfi | Vasi | Skápsbreidd (EB) | Hurð (FB) | Innri breidd |
|---|---|---|---|---|
| REVEGO uno | 100 | 450–900 | 442–898 | allt að 800 |
| REVEGO uno+uno | 2 × 100 | 900–1800 | 442–898 hvor | allt að 1600 |
| REVEGO duo | 150 | 900–1500 | 442–748 | allt að 1350 |
| Concepta III 25 / 35 | ≥ 87 | — (óstaðfest) | hæð 1200–2200 / 1900–2700 | — |

Sameiginlegt Revego: hæð skáps 1155–3012, hæð hurðar 1130–2980, þykkt hurðar 18–26 mm, **max 35 kg á hurð**, dýpt skáps frá 573, dýpt vasa frá 553.

**Reglur í skipulaginu:**
- Vasinn er *hluti* af skápsbreiddinni (breiddin sem notandinn sér breytist ekki). Innri breidd = breidd − vasi; innvolsið (hillur, stangir) fær aðeins innri breidd.
- Vasahliðin = „Hlið“ (vinstri/hægri) í Smíða. Vasinn má vera upp við vegg eða horn-vegg (Blum kallar það „niche“), en nágranni má **ekki** hafa hurð sem snýst yfir vasann (gul viðvörun).
- Nágrannar: skápur við hlið vasans þarf að vera lokaður/fastur; engin skúffa/hurð má opnast yfir vasann. Vasinn má ekki skarast við úthlið, áfellu eða horn: horn-skápur og ísskápur fá ekki vasahurð (sama og í dag).
- Draugur: þegar eining með vasahurð er valin/dregin sýnir planið vasann með dökkgráum strikaðri útlínu (ghost) svo notandinn sjái hvað pláss fer í hann.
- Uno/duo-val **eftir breidd**: ≤ 900 → uno; 900–1500 → duo; > 1500 → uno+uno (eða duo+duo þegar til). Kemur í stað `pocketLeafOf` (> 600).

**Villuboð (íslenska, rauð = stoppar í Smíða, gul = viðvörun):**
- „Hurðin er of breið fyrir REVEGO uno (hámark 898 mm)“
- „Hurðin er of mjó fyrir REVEGO (lágmark 442 mm)“
- „Skápurinn er of lágur fyrir REVEGO (lágmark 1155 mm)“ / „…of hár (hámark 3012 mm)“
- „Skápurinn er of grunnur fyrir REVEGO (lágmark 573 mm)“
- „Hurðin er of þung fyrir REVEGO (hámark 35 kg)“ — aðeins ef þyngd er þekkt (áætlun úr efni × flatarmáli), annars sleppt.
- „Hurðin er of há fyrir Concepta III 25 (1200–2200 mm)“
- „Hurð nágranna opnast yfir vasann“ (gul)
- „Of breitt fyrir eina hurð: skipt í tvær (uno+uno)“ (upplýsing)

## 4. FLÆÐIÐ

- **Hvar:** Ný eining → *Flóknari kerfi → Vasahurðir* (eldhús: *Tækjaskápar*). Gerð hurðar í Smíða helst. **Mæli með:** Studio sér útlitið og plássið (sjálfsafgreiðsla, enginn verðmiði nefndur), **PRO velur kerfi og hlið** — verðið (300 þús – 1,3 m.kr.) er áfram ákvörðun Rakelar (sbr. fyrri regla).
- **Wizard, eitt í einu (eins og Hurðir-wizardinn):**
  1. *Kerfi:* Blum REVEGO / Hawa Concepta III (PRO; Studio = Revego, falið).
  2. *Ein hurð eða tvær:* sjálfvalið úr breidd, hægt að breyta (uno / duo / uno+uno).
  3. *Hvoru megin er vasinn:* tvær stórar myndir (vinstri/hægri).
  4. *Stærð ok?* græn/rauð niðurstaða úr reglunum í kafla 3, ein lína.
  5. *Búið.* Stór hnappur **Opna / Loka** sýnir rennið á skápnum sjálfum í forskoðun.
- **Samantektarflögur:** „REVEGO uno · vasi hægri · 100 mm“; **Yfirlit:** „Vasahurðir (Blum REVEGO uno, vasi hægri, 100 mm)“; tilboð/pöntun óbreytt.

## 5. Gagnamódel

Endurnýtum `b.smida.doors[i]`: `type:"pocket"`, `pocketSys:"revego"|"concepta"`. **Ný valfrjáls reitir** (aðeins í `b.smida.doors[i]`, ekkert annað breytist):
`pocketSide:"left"|"right"` (sjálfvalið = `b.swing`-andstæða, sem nú), `pocketLeaf:"uno"|"duo"|"unouno"` (sjálfvalið úr breidd), `toeKick:true|false` (sjálfvalið true), `onWorktop:true|false` (sjálfvalið false).
Gömul gögn (án nýrra reita) teiknast eins og áður með sjálfvöldum gildum. Engin Airtable-breyting, ekkert í `ALLOWED_FIELDS`. Ef `pocketLeaf` er sett flytjum við hana í `smidaFor` svo vinnuteikning sér hana.

## 6. EKKI í þessari umferð
CAD, borgögn, CNC (`cnc-sides.js` heldur áfram að sleppa lömum), nákvæm braut/tengi, vasaveggþykkt (15–17 vs 18–19 mm), verðlagning umfram núverandi V3-vörur, uno+duo/duo+duo samsetningar umfram uno/duo/uno+uno, Fellihurðir (WingLine), Topline-rennihurðir.

## 7. UMFERÐIR (hver prófuð á T-32 á 5 mín)

**Umferð 1 — rúmfræði, útlit, pláss, villur.** Skrár: `kitchen-planner-3d.js` (vasi, hurð í yfirlögn, braut, sökkull, Hawa-útlit), `kitchen-planner.html` (`pocketLeafOf` regla, `POCKET_LIMITS`, villuboð í Smíða, Yfirlit-texti). Próf á T-32: (1) setja Vasahurðir 90 cm → sjá vasa hægra megin og hurð í yfirlögn; (2) breidd 95 cm → breytist í duo, vasi 150; (3) breidd 40 cm → rauð villa; (4) Hawa → vasi ≥ 87; (5) opna hurð = hún endar í vasa (án hreyfingar enn, bara ástand).
**Umferð 2 — hreyfing, wizard, tákn.** Skrár: `kitchen-planner-3d.js` (renna ~0,9 s, TIP-ON), `kitchen-planner.html` (wizard í 5 skrefum, Opna/Loka, ghost í plani, flögur), 2D/Veggur/Smíða-tákn (punktalína + ör). Próf á T-32: wizard frá byrjun til enda; Opna/Loka mjúkt; planið sýnir ghost; Veggur og Smíða sýna táknið.
**Umferð 3 (ef vill) — borðplötuútgáfa og uno+uno.** Skrár sömu.
Fyrir hverja umferð: `npm test` + `npm run test:live` grænt, ekkert Airtable-skrif.

## Hawa-gögn úr vörulista (síður 154–260 í CAT_EN_Hawa_On_furniture_789.0525.001, 30.10.2026)
Lesið úr vörulista eiganda (PDF í Downloads, ekki í repo). Nægir fyrir útlit og pláss; borunarmál eru í teikningum vörulistans og Hawa-stillinum og bíða.
- **Hawa Concepta III** (15/25/35 Push og Pull): hurð allt að **15, 25 eða 35 kg**, hurðarhæð **600–2700 mm**, hurðarbreidd **350–750 mm**, þykkt **18–26 mm**. Settin fyrir 1200–2200 mm hurðir eru grunnsett; 15 kg með 600–1400 mm stoð.
- **Pláss til hliðar:** tengisett (connector) **55 mm** fyrir eina hurð og **110 mm** fyrir tvær hurðir, efst og neðst. Þetta er líklega plássið sem vasinn tekur við hlið opsins (staðfesta í Hawa-stillinum). Dýptarreglur í vörulistanum: T1 ≥ 414 mm (skápdýpt) og M max ≤ TB − 320.
- **Hawa Folding Concepta III** (20/25 kg, Push og Pull): hurðarhæð **1200–2700 mm** (20 Push: 1200–2200), breidd **350–750 mm** á hurð, 2 eða 4 hurðir (2 pör) eða 3 hurðir í bland við stak Concepta III. Framhlið allt að **3000 mm breið × 2700 mm há** með tveimur pörum.
- **Útgáfur sem passa við myndina frá eiganda:** 1 hurð (Concepta III), 2 × 1 hurð, 2 hurðir felli, 2 × 2 hurðir felli, 1 × 2 hurðir felli + 1 hurð (3-hurða skápur: felli + stök Concepta III 25).
- Rekkar: gólftenging eða samsettur skápur; rennibraut með dýptarstillingu fyrir 4 hurðir með hurðarbreidd > 550 mm; styrkingarprófíll 2765 mm (4 hurðir) og 2085 mm (3 hurðir).
- Ekki enn: nákvæm borun, rennibrautarlengdir í teikningu og pláss sem fellihurðir þurfa fyrir framan opið (kemur úr Hawa-stillinum, ekki úr vörulistatextanum).

## Flæðið samkvæmt eiganda: valmöguleikar í Ný eining (mynd frá Hawa, 30.10.2026)
Leiðin er **Ný eining → Tækjaskápur → Vasahurð**. Þar kemur eitt skref „Hvaða útgáfu?“ með **spjöldum sem sýna grunnmynd ofan frá** (eins og Hawa-stillirinn gerir). Hawa Concepta III hefur fimm útgáfur:
1. **1 hurð** (Concepta III): ein hurð rennur inn í vasa.
2. **2 × 1 hurð** (Concepta III): tvær stakar hurðir, ein á hvorri hlið.
3. **2 hurðir, felli** (Folding Concepta III): tvær hurðir brotnar saman við aðra hlið.
4. **2 × 2 hurðir, felli** (Folding Concepta III): tvö pör, eitt á hvorri hlið.
5. **1 × 2 hurðir, felli + 1 hurð**: ein brotin tvöföld hlið og stök hurð á hinni.
Revego fær samsvarandi spjöld (uno, uno + uno, duo, duo + uno eftir því sem Blum-taflan leyfir).

**Reglur fyrir wizardinn (frá eiganda):**
- **Teiknað í réttum hlutföllum** í wizardinum: spjaldið og forskoðunin sýna vasann, hurðina og opið í réttum mm, ekki tákn.
- **Gera grein fyrir plássinu:** skýr texti við valið, t.d. „Vasinn tekur 100 mm af 600 mm. Innanmál: 500 mm“, og fyrir felli: hve mikið pláss fellihurðirnar þurfa þegar þær eru opnaðar. Plássið sést líka sem draugur á teikningunni (sjá kafla 3).
- Útgáfa og hlið (vinstri/hægri) eru valin í sama skrefi; stærðartakmörk (kafli 3) birtast sem villa strax á spjaldinu ef útgáfan passar ekki við breiddina.
- Þetta svarar spurningu 4 (Concepta „tvöfalt kerfi“): engin ágiskun lengur, fimm útgáfur að ofan.

## Ákvarðanir eiganda (30.10.2026)
1. **Studio og PRO velja bæði** vasahurð (ekki bara PRO). Spurning 1 er því svarað: viðskiptavinur getur líka valið hana í Studio.
2. **Vasinn innan breiddar** (100 mm uno, 150 mm duo í uppsetningarbreiddinni, eins og hjá Blum): já.
3. **Borðplötuútgáfa** (vasahurð á borðplötu, framhlið frá 1130 mm) er **með í umferð 1**.
4. **Concepta „tvöfalt kerfi“**: eigandi sendir mynd af því sem hann vill; engin ágiskun fyrr en hún er komin.
5. Sökkull sjálfgefinn: **já** (spurningu 5 ekki svarað sérstaklega; tillagan stendur nema eigandi segi annað).

## 8. Opnar spurningar (eitt orð nægir)
1. Studio sér vasahurð líka, eða bara PRO? (mæli: **Studio-útlit, PRO-val**)
2. Á vasinn að vera *innan* skápsbreiddar (eins og Blum) — já/nei? (mæli: **já**)
3. Borðplötuútgáfa strax í umferð 1? (mæli: **seinna**)
4. Concepta „tvöfalt kerfi“ = tvær stakar hurðir (uno+uno)? (mæli: **já** þar til Rakel staðfestir)
5. Sökkull sjálfgefinn **já**?

---
### Viðauki: tilvísanir í kóða (fyrir mig, ekki eiganda)
- `kitchen-planner.html`: `POCKET_PRODUCTS` ~13788, `pocketLeafOf` ~13816, V3 ~13827, pöntunarathugasemd ~13992, Ný eining tré ~8251–8286, `applyClosetDoorKind` ~12093, panel „Rennur inn í hlið“ ~12262–12284 / ~12429, Smíða-gerð + kerfi ~18818–18820, box editor ~19535–19545, Smíða-SVG litur ~19408, vinnuteikning `hinge:"pocket"` ~21714, texti ~21839, `smidaFor` doors ~20135–20138, Yfirlit ~20592, villur lamir ~18128 (sleppir pocket), viðvörun úrelts specs ~18162.
- `kitchen-planner-3d.js`: `doorMove` ~3019–3023, `makeLeaf` ~3030, part `kind:"pocket"` ~3157 (`pocketIn = CD−0.06`), hreyfing `applyPart` ~2889, smellur í göngu-ham ~6516.
- `docs/research-taekjaskapar.md` §1–2 (mál), §6 (staða); `docs/cnc.md` ~191; `docs/pro-smida-wizard.md` ~35.
- Blum heimild: REVEGO overview (síður 4–16), uno/duo uppsetningarleiðbeiningar (Downloads).
- Ath.: `research-taekjaskapar.md` §6 segir 3D hafi enga pocket-hreyfingu — úrelt, hún er til (`kind:"pocket"`) en án vasa. „Vasa-/Fellihurðir soon:true“ fannst ekki í dag: Vasahurðir og Fellihurðir eru bæði virk í „Flóknari kerfi“ (~8283–8286).
