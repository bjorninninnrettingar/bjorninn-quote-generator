# Áfellur sem alvöru hlutar — SPEC (30.10.2026)

Staða: **aðeins spec, ekkert smíðað, ekkert skrifað í Airtable.** Eigandi les, leiðréttir, svo eru smíðaðar þrjár umferðir og prófaðar á T-32. Tilvísanir í kóða (skrá:lína) eru aftast í viðauka.

## 1. Hvernig er þetta í dag

- **Teikniforrit:** ein föst áfella, 19 mm (`AFELLA_MM`), þar sem skáparöð mætir vegg sem beygir inn á við. Hún er bara *teiknuð* í 3D (frontaefni, borðplatan yfir) og tekin frá í staðsetningu (`runStartMm`/`runEndMm`). Breiddin er aldrei vistuð og ekki hægt að breyta henni.
- **Vinnuteikningar (PRO):** áfellan er skyggð og með í málakeðju, alltaf 19 mm.
- **Viðvaranir (G6):** bil 5–299 mm við vegg eða milli skápa gefur „áfella, fyllistykki eða færa saman?“ — en ekkert í kerfinu *býr áfelluna til*.
- **Úthlið** er allt annað: raunverulegur kubbur í röðinni (`uthlid*`), með 🔑 `UH1…`, eigin Útfærslu (UHGR/UHLK/UHHA/UHVS/UHEF eftir hæð), Smíðagögn `{w:dýpt, h, d:19}` og línu í Line Items. Úthliða-catch (`missingEndPanels`) býður úthlið á hverja sýnilega hlið; hlið sem snýr að vegg-áfellu (19 mm) telst „þakin“ og fær enga.
- **Toppáfella og mini-áfella:** eru ekki til. Bil upp í loft og horn-árekstur eru bara viðvaranir (`openingIssues`).
- **Eyðublað → Sögunarlisti:** *ekkert af áfellunum nær þangað frá teikniforritinu.* Airtable þekkir hins vegar áfellu nú þegar (sjá 3).

## 2. Gagnalíkan í teikniforritinu

Áfellur verða **ekki kubbar í röðinni** (of mikil áhætta fyrir gömul drög, borðplötuhluta og staðsetningu). Þær verða *afleiddar* úr rúmfræðinni, með vistuðum yfirskrifunum:

| Tegund | Hvar er það vistað | Sjálfgefið | Yfirskrift |
|---|---|---|---|
| **Veggáfella** | `wall.afella = { start:{mm}, end:{mm} }` | engin skrá = 19 mm eins og í dag | `mm` slegið inn → röðin heldur því bili við vegg |
| **Toppáfella** | `b.topAfella` á skápnum | sjálfvirkt kveikt á háum skápum og efri skápum sem ná nálægt lofti; hæð = lofthæð − (neðri brún + skápshæð) + 20 | `{off:true}` slekkur; `{mm:n}` ræður hæðinni |
| **Mini-áfella** | `wall.mini = { start:{mm\|off} }` á veggnum sem röðin byrjar á í innra horni | 50 mm þar sem hurðir/skúffur rekast (sama rúmfræði og `openingIssues`) | `mm` breytir, `off:true` fjarlægir |

**Gömul drög** hafa enga af þessum reitum → hegða sér nákvæmlega eins og áður (19 mm vegg, engin toppáfella, engin mini). Ný sjálfvirkni (toppur/mini) kemur aðeins þegar reiknað er, aldrei með því að breyta vistuðum stærðum. Veggáfella án innsláttar breytir ekki staðsetningu skápa.

**Breidd veggáfellu** = raunverulegt bil milli skáps og veggjar (en minnst 19 mm); handsleginn `mm` gildir í staðinn. Hæð = hæð skápsins (sama regla og Smíðagögn: gólfskápar án sökkuls). Breidd toppáfellu = breidd skápsins.

**Lykill og Line Item.** Hver áfella fær 🔑 `AF1, AF2…` (eigin runa, eins og `UH`). Af því áfellur eru ekki kubbar þarf varanlegt kort `state.afKeys = {"v:<veggur>:start":"AF1", "t:<skápur>":"AF2", "m:<veggur>":"AF3"}` — úthlutað í fyrsta sinn sem áfellan sést, aldrei endurnotað í verkefninu (annars færast tölur þegar ein er fjarlægð).

Skref fyrir skref:
1. `collectLineItems` (teikniforrit) bætir einni línu við á hverja áfellu: `Magn:1`, `🔑:"AFn"`, `Vöru reitur 1:[Útfærsla Áfella]`, `Skilaboð til skipulags:"Áfella við Vegg 1, vinstri (19 mm)"`, og **`Smíðagögn (JSON) 🔧: {"v":1,"w":<breidd mm>,"h":<hæð mm>,"d":19}`** — nákvæmlega sama form og úthlið. Breidd/hæð/þykkt bera því mm-málin; engin ný Airtable-reiti þarf.
2. `kp-submit` (viðskiptavinur) og `kp-pro` (PRO Vista): `KEY_RE` / `LINE_KEY_RE` verða `Sk|UH|AF|HU|BP|BV|BH` á **öllum þremur** stöðum (kp-submit, kp-pro, **kp-price**) — sama bilun og T-248 (úthlið fékk 400). Smíðagögn eru staðfest með `^\{"v":1`. Prófun bætt við.
3. kp-pro skrifar bara breyttar línur, ber saman við það sem Airtable hefur (handbreyting í Airtable vinnur), og áfella sem hverfur úr teikningunni birtist sem „munaðarlaus“ lína (`orphans`/`retire`) — engin ný kóðaleið.

## 3. Airtable — gátlisti (ég bý ekkert til; þetta er lesið úr lifandi grunninum)

**Það sem er þegar til (sannreynt):**
- ÚRVINNSLA sniðmát **„Áfella“** (`rec6VMJSfyn4qX7As`): Tegund `Áfella`, Efnisflokkur Frontaefni, **B = `Breidd`, H = `Hæð`, Þ = `Þykkt fronta`, Magn = `Fjöldi eininga`**, engin kantlíming. Þ.e. 19 mm × breidd × hæð úr frontaefni verkefnisins.
- Valmöguleikinn `Áfella` er til í „Frontur / Hlið tegund“ (bæði á Útfærslum og Eyðublaði) og í ÚRVINNSLA `Tegund`.
- `Tegund einingu` á Eyðublaði er formúla úr fjórum valreitum (Skápategund / FRE / **Frontur–Hlið tegund** / Sérsmíði) → Áfella kemur sjálfkrafa þegar Útfærslan setur Frontur/Hlið tegund = Áfella.
- 10 handgerð Eyðublöð eru þegar með Tegund einingu = Áfella (t.d. 70 × 2800, Fjöldi 4, Dýpt 19) — röðin Sögunarlisti virkar því fyrir þetta form.

**Vantar (hægt að búa til, ég geri það ekki):**
- [ ] **Vörulisti 🚪: ný vara „Áfella“** (SKU `AF`; Flokkur = *Úthlið* sem er til). Verð/tími: sjá spurningu 4. *Engin „Áfella“-vara er til nú.*
- [ ] **Útfærslur 🎨: ein ný lína „Áfella“** (Vörunúmer `AF`): V1 → vara hér að ofan; `Flokkur` = *Úthliðar* (til); `Hvað viltu smíða?` = *Front / Hlið* (til); `Frontur / Hlið tegund - Skipulag` = *Áfella* (til); `Búa til Eyðublað` ✔; `Skipulag - Breidd/Hæð/Dýpt` = 100 / 800 / 19 (varagildi, Smíðagögn yfirskrifa). Gefur *id* sem fer í teikniforritið (`AFELLA_UTFAERSLA_ID`; `kitchen-planner-linemap.js` er **búið til** úr Airtable — ég bæti við einni línu í skriptuna sem býr hana til, ekki handbreyting).
- [ ] **Valfrjálst, aðeins eigandi í viðmóti** (valmöguleika er ekki hægt að búa til í gegnum API): ef þið viljið aðgreina *topp* og *mini* í Sögunarlista (annað Partur-nafn) þarf að bæta `Áfella topp` og `Áfella mini` við í „Frontur / Hlið tegund“ á Útfærslum + Eyðublaði + ÚRVINNSLA `Tegund`, og afrita sniðmátið tvisvar (Partur „Áfella topp“/„Áfella mini“ — sömu formúlur). **Mín tillaga: sleppa**; tegundin fer í `Athugasemd`/Skilaboð (sjá umferð 1).
- [ ] **Kantlíming á sniðmáti** (sýnileg kantur?) — spurning 5.

Hvað býr til Sögunarlista/Pöntunarlista: Keyra skipulag býr Eyðublað til úr línunni → Sögunarlisti-skriptan les ÚRVINNSLA-sniðmát með `Tegund` = `Tegund einingu` (Áfella) og býr til röð „Áfella“ úr frontaefni → Pöntunarlisti (full) telur fermetra frontaefnis með í plötunýtingu. **Athugið:** Pöntunarlisti er listi *platna*, ekki hluta — áfella birtist þar sem hluti af frontaefnis-plötunum, og sem sérstök *lína* aðeins ef vara með verð er í Vörulista (þess vegna varan hér að ofan). Staðfest verður á T-32 í umferð 1.

## 4. Hegðun í teikniforritinu

- **Veggur:** áfella er teiknuð þar sem skápur stendur við mörkin, breiddin = bilið. Slegið er inn mm á hverjum vegg-enda (lítill reitur við áfelluna í 2D/PRO og í Smíða „Staðsetning“; Enter staðfestir). Ef breytingin kemst ekki fyrir: skápar færðir eins og `addEndPanel` gerir; annars tilkynning og ekkert breytist.
- **Úthliða-catch:** við vegg býður `missingEndPanels` *áfellu* í stað úthliðar (úthlið er „þakin“ ef áfella er til; óþarfa úthlið sem eigandi nefnir sóar efni). Gömul drög með úthlið við vegg breytast ekki.
- **G6-viðvaranir:** bil við vegg ≤ hámark áfellu (spurning 3) hverfa — því þau eru *leyst* með áfellu; bil milli skápa haldast.
- **Toppur:** teiknuð fyrir ofan skáp upp í loft (lítið frávik 20 mm „skerast“ til merkis); slökkt per skáp í Smíða-spjaldi og í Yfirferð. Gildir bara ef bilið upp í loft er innan marka (spurning 1).
- **Mini:** búin til sjálfvirkt í innri hornum gólfskápa þar sem hurð/skúffa myndi rekast; röðin byrjar `mini` mm síðar; eigandi breytir/eyðir.
- **Sökkull / borðplata:** borðplatan nær áfram yfir veggáfellu (`KPWT` les nú þegar `afellaMm`, svo breytileg breidd fylgir sjálfkrafa); sökkull stoppar við skáp, ekki áfellu (óbreytt).
- **Yfirferð/Smíða:** nýr hópur „Áfellur“ með breidd/hæð sem reitir; áfellur eru **ekki** í Smíða-göngunni (engin lamir/hillur) — merktar sjálfkrafa yfirfarnar.

## 5. CNC og vinnuteikningar

- Vinnuteikningar skyggja nú þegar áfellu og leggja hana í málakeðju; breytast aðeins í að nota raunbreidd (`afs.push` notar `af.start/end`) + bæta toppáfellu við í teikningu af vegg.
- `/smida` / `cnc-sides.js` hunsar óþekkta hluti („sökklar, cover… engin hliðar-forrit“) — áfella þarf ekkert nýtt þar. `front-classify.js` telur „áfella“ sem frontahluta → hún fer í **Æðaskipulag** (/aedar) sem mjó ræma; lítið vandamál, sagað úr afgöngum.
- Merkingar (/labels) prenta merki fyrir hverja Sögunarlista-röð — áfella fær merki.

## 6. Áhætta

- **Tvöföldun í Sögunarlista/Pöntunarlista:** ef áfella er bæði úthlið *og* áfella á sama stað. Vörn: sami stað → aðeins ein (áfella ræður við vegg). Prófa á T-32.
- **Gömul verkefni:** engin AF-lína fyrr en Vista er keyrt aftur í PRO; þá bætast við línur sem þarf að keyra „Keyra skipulag“ á (býr bara til Eyðublöð fyrir ótengdar línur — endurtekur ekkert).
- **Smíða-staðfestingar (`smidaAck`/`smidaReady`):** snerta ekki mál skápanna → falla ekki úr gildi, *nema* mini/veggáfella færi skáp (staða breytist, ekki mál — hashinn notar mál). Prófað.
- **Verð:** vara án verðs = 0 kr á tilboði; með verði = tilboðið hækkar. Ákveða fyrir umferð 1 (spurning 4). `kp-price` verður að þekkja `AF` fyrst.
- **Töluúthlutun:** `afKeys` ekki vistað rétt → lyklar hlaupa til → Line Items breytast. Vörn: kortið er vistað í drögum og prófað í `kp-submit` prófunum.
- **Stærð JSON:** 5–15 línur til viðbótar á verkefni; fylgst með `PLANNER_JSON_MAX`.

## 7. Umferðir

**Umferð 1 — veggáfella með mm + allur Airtable-ferill.**
Skrár: `kitchen-planner-3d.js` (`afellaMm` les `wall.afella`, `addAfellur` notar breiddina), `kitchen-planner.html` (innsláttur, `collectLineItems`, `afKeys`, `missingEndPanels`, Yfirferð-hópur, G6), `kitchen-planner-workdraw.js`, `api/kp-submit.js`, `api/kp-pro.js`, `api/kp-price.js`, linemap-skripta, prófanir.
Þú prófar á T-32 (5 mín): (1) opnaðu PRO, vegg með skáp við horn; sláðu inn 60 mm við vegg → áfellan breikkar, skápur færist; (2) Vista → í Airtable er Line Item `AF1` með Smíðagögn `w:60`; (3) Keyra skipulag → Eyðublað „Áfella“ 60 × hæð; (4) Sögunarlisti: röð „Áfella“, frontaefni, 19 mm; (5) Pöntunarlisti: fermetrar frontaefnis með.
**Ekki með:** toppur, mini, aðgreining í Partur-nöfnum, verðútreikningur umfram það sem varan segir.

**Umferð 2 — toppáfella.** Skrár: sömu + Smíða-spjald (slökkvari), `buildScene` (teikning upp í loft). Prófun: 2500 mm hár skápur í 2600 mm lofti → `AF` 120 mm hár × skápsbreidd, slökkva á einum skáp → línan hverfur (munaðarlaus-flaggi), efri skápur í 2300 → 320 mm. **Ekki með:** sameining nágranna í eina ræmu.

**Umferð 3 — mini-áfella.** Skrár: `openingIssues` útgáfa sem skilar „hér þarf mini“, röð byrjar `mini` mm síðar, teikning. Prófun: tvö horn með hurð-árekstri → 50 mm áfellur birtast sjálfkrafa; breyta í 70; eyða öðrum. **Ekki með:** viðvaranir um annað en hurð/skúffu.

## 8. Opnar spurningar (eitt orð)

1. **Toppáfella:** hvað er mesta bil upp í loft sem fær sjálfvirka áfellu? (mm — tillaga 400)
2. **Toppáfella:** ein á hvern skáp eða ein ræma fyrir nágranna sömu hæðar? (tillaga: *hvern*)
3. **Veggáfella:** mesta breidd áður en við vörum frekar við „færa skáp / fyllistykki“? (mm — tillaga 100)
4. **Verð:** áfella verðlögð með efni (m²) eða 0 kr? (tillaga: *efni*)
5. **Kantlíming:** kanta sýnilega kantinn á áfellu? (tillaga: *nei*)

---

## Viðauki — tilvísanir í kóða og Airtable

- `kitchen-planner-3d.js:1079–1090` `AFELLA_MM`/`afellaMm`; `:1146` G6 bil; `:1319–1395` `openingIssues` (dead corner `:1378`); `:5754–5795` `addAfellur`; `:8167` útflutningur.
- `kitchen-planner.html:6419–6426` `cornerClearance`/`afella`/`runStartMm`/`runEndMm`; `:6956–7000` `missingEndPanels`; `:7004` `addEndPanel`; `:13678` `v1RecordFor` (úthlið `panelIds`); `:13912` `collectLineItems`; `:17433` `skPrefix` (UH/Sk), `skOfOtherRooms`; `:20018` `smidaFor` (`c.panel ? {w:d,h,d:19}`); `:20106` `smidaHash`; `:18499` `smidaAck`; `:21679–21683` vinnuteikning áfella.
- `kitchen-planner-worktop.js:117` borðplata les `afellaMm`.
- `api/kp-submit.js:41` `LINE_FIELDS`, `:233` Smíðagögn-staðfesting, `:313` `LINE_KEY_RE`; `api/kp-pro.js:39` `KEY_RE`, `:51` `QTY_KEY_RE`, `:275` `removed`, `:298` `retire`; `api/kp-price.js` (sama regex; T-248 í docs/pro-finish.md:728).
- `cnc-sides.js:54,196`; `front-classify.js:19`.
- `docs/kitchen-planner.md` (úthlið `:70`, `:76`, `:82`); `docs/pro-finish.md:597` (G6).
- Airtable grunnur `app91U15z9K704Okd` (lesið, ekkert skrifað): Útfærslur `tbl8HjvBwNJ41cTV0` — úthlið UHGR `recUKqD3UKKWQ8J7g`, UHLK `recEpLxCpHtbBHRkV`, UHHA `recgcU94bpLvATm0r`, UHEF `recvaMCqmYlQur8Wr` (Frontur/Hlið tegund = *Úthlið/blindlok*, `fld23mgo1syTKNUB6`; *Áfella* = `selRDuofamNzHSAIQ`); ÚRVINNSLA `tblR1TpicLRVTXHql` — *Áfella* `rec6VMJSfyn4qX7As`, *Úthlið/blindlok* `recEUl2uZVkOqA3fc` (B Breidd, H Hæð, Þ Dýpt), *Sökkul cover* `recJ5Zq06DsH8lM3X`; Eyðublað `tbl0WcyHhz63pSzZX` — `Tegund einingu` `fldYLxl8GdUg1FPEr` (formúla), `Frontur / Hlið tegund` `fldtjjheg55kiuXWw`; Vörulisti `tblzuuRSRkeXaLWxC` — UHGR `recH5yEhYQY5olsAZ`, UHLK `recNnGALFUo49ogJb`, UHHA `recQ7wp7FHiD69MIT`; engin „Áfella“-vara til.
- **Ekki lesið:** kóði Sögunarlista-/Pöntunarlista-skriptanna sjálfra (aðeins gögnin). Hegðun þeirra gagnvart Áfella byggist á 10 núverandi Eyðublöðum og lýsingu í ~/CLAUDE.md; staðfest á T-32.

---

## Airtable-færslur: tillaga (bíður samþykkis eiganda)

Staða 30.10.2026: **ekkert hefur verið búið til, breytt eða eytt í Airtable.** Allt hér að neðan er lesið úr lifandi grunninum (`app91U15z9K704Okd`) og borið saman reit fyrir reit við úthliðs-færslurnar (UHGR/UHHA/UHLK). Þegar eigandi samþykkir býr aðallotan til tvær færslur (vara, svo Útfærsla), setur id Útfærslunnar í `kitchen-planner-linemap.js` (`afellaId`) og þá er prófað á T-32.

Smíðahlutinn (umferð 1) er kominn á main og sendir **enga** AF-línu á meðan `afellaId` er `PLACEHOLDER_AFELLA_UTFAERSLA_ID`.

### 1. Ný vara í Vörulisti 🚪 (`tblzuuRSRkeXaLWxC`)

Verðið á línu kemur **ekki** beint úr vörunni heldur úr Útfærslunni sem les vöruna (`api/kp-price.js`: söluverð vöru + frontaplata × „fm fronta“ × álagning 2,05 + kantlímingarmetrar × m-verð). Þess vegna ræður varan þessu:

| Reitur (id) | Gildi | Af hverju |
|---|---|---|
| Heiti vöru 📣 (`fld2eaMu1s2beJLK4`) | Áfella (frontaefni, 19 mm) | Sama stíl og „Úthlið á grunnskáp“. Sést á tilboði. |
| SKU (`fldTUoa4wg4hftHO0`) | `AF` | Enginn annar hefur `AF` (athugað). |
| Flokkur (`fldmfha5f6EZLKrKq`) | Úthlið (til) | Formúlan `fldtfQLTIJiXzVt6q` sleppir skrokkplötu fyrir Úthlið → aðeins frontaefni er talið, eins og á úthlið. |
| Breidd mm (`fldmgFIZy3K9GMLKX`) | 100 | Viðmiðunarstærð. Verð á áfellu er **fast á stykki** (sjá fyrirvara). |
| Hæð mm (`fldBxGigJOw2FSDje`) | 800 | Dæmigerð hæð gólfskáps (sama og Útfærslan). |
| Fjöldi plötuhluta (`fldf74wqHyJCZtmTT`) | 1 | Eitt stykki á einingu. |
| Afföll % (`fldDTCv3pJ0De77aH`) | 0 % | Úthlið er með 3 %, en það er lagt við sem **heil plata** (0,03 × plata) óháð stærð — fyrir mjóa ræmu yrði það margfalt verð efnisins. 0 % = verðið fylgir bara flatarmálinu. (Eigandi má setja 3 %.) |
| Mínútur, 5 reitir (`fldg2U0QIsZkiLVM7`, `fldG5dtxsW2ljrrSH`, `fldNkxo1p7vNOlVJW`, `fldD7HFFb33ZegSsh`, `fldMUCnsxlUYZcO61`) | 0, 0, 0, 0, 0 | Ákvörðun eiganda: áfella er verðlögð með efninu eftir flatarmáli, ekki vinnu. Þá er söluverð vörunnar 0 og línan = frontaefni × flatarmál × álagning. **Kostur B (eins og úthlið):** 10, 10, 0, 5, 3 mínútur = 28 mín. ≈ 8.867 kr. án vsk. á stykki. |
| Starfsmaður fyrir útreikninga (`fldnU4cVmm6Lkdk7H`) | tengja `recUhUS8yuNyAwAfU` | Eins og úthlið: timakaupið (9.500) kemur þaðan. Skaðar ekki þótt mínútur séu 0. |
| Álagning % (`fldQxpqA2m3kwSh0S`) | 200 % (gildið `2`) | Eins og úthlið. |
| Kostnaður vélbúnaðar (`fldxQkro6tLV0hjdz`) | tómt | Úthlið hefur hann tóman. |
| Flokkun (`fldiJSFtAXYqUlYPV`), Birgir (`fldvJNNoV4ETzvugO`), Birgjatengill (`fldbY3jhgUVT6WqM6`) | tómt | Úthlið hefur þetta tómt (frontaefnið er pantað með plötunum). |

**Reitir sem eru formúlur/rollup og verða ekki skrifaðir (reiknast sjálfir):** Söluverð Bjarnarins 💰 (`fldCJjSJWoUWyT7iv`), kostnaður (`fld5rs9k7Kf7K3UxO`), vinnukostnaður (`fldepSPKStX9Up8dl`), tímar (`fldS2kCOREhzXqv4z`), m² (`fldmquNWPDjbovVOZ`, `fldvVc1YsjqRVLHSd`), hlutfall úr plötu (`fld9NJuLrLcl6ah6q`), kantlímingarmetrar (`fldv0At9QxY3tqTuQ`), auk allra tenginga til baka (`fldNZkwAvYs5wMsfK` o.fl.).

**Það sem aðeins eigandi getur gert í viðmóti:** ekkert — allir valmöguleikar sem þarf (Flokkur *Úthlið*, *Áfella* í „Frontur / Hlið tegund“, *Front / Hlið*) eru nú þegar til.

**Fyrirvarar (eigandi ákveður):**
1. **Verðið er fast á stykki, ekki eftir raunverulegum mm.** Bæði Airtable og `kp-price` margfalda tölur Útfærslunnar (fast 100 × 800 = 0,08 m²). Áfella sem er 19 mm breið er samt verðlögð eins og 100 mm. Nákvæmt flatarmál á línu þarf nýjan formúlureit á Line Items sem les `w`/`h` úr Smíðagögnum — það er sér-umferð, ekki gert hér.
2. **Kantlímingarmetrar fylgja með í verðinu** (vörureiturinn reiknar `(Dýpt+Hæð)×2/1000` = 1,6 m). Það er sama og á úthlið og aðeins nokkur hundruð krónur (m-verð 120–1.200 kr.). Ákvörðunin „engin kantlíming“ gildir um **ÚRVINNSLA-sniðmátið** (þar eru kantreitirnir tómir, staðfest) — ekki um verðið.
3. **Mínútur = 0** þýðir líka að tímaáætlun (rollup „tímar“) fyrir áfellu er 0. Ef framleiðsluyfirlit les þá tölu sést áfellan ekki þar.

### 2. Ný Útfærsla í Útfærslur 🎨 (`tbl8HjvBwNJ41cTV0`) — borin saman við UHGR (`recUKqD3UKKWQ8J7g`)

| Reitur (id) | UHGR hefur | Áfella fær | Athugasemd |
|---|---|---|---|
| Lýsing á útfærslu (`fldbG3jw1tEPEchGr`) | Úthlið á grunnskáp | Áfella | |
| Vörunúmer (`fldpHihoAgFxkjTVy`) | UHGR | `AF` | |
| Flokkur (`fldrFCpVB3Wrzm4BA`) | Úthliðar | Úthliðar | |
| Hvað viltu smíða? (`fldceWYVphsBK6JZW`) | Front / Hlið | Front / Hlið | Það gerir línuna „gilda“: formúlan `fldjx6q3oWtJ451ej` (Keyra skipulag) krefst þess. |
| Frontur / Hlið tegund - Skipulag (`fld23mgo1syTKNUB6`) | Úthlið/blindlok | **Áfella** (`selRDuofamNzHSAIQ`) | Verður að vera *Áfella* — það ræður `Tegund einingu` á Eyðublaði og þar með sniðmátinu. |
| Búa til Eyðublað (`fldMZXkLkXLBMiH7d`) | ✔ | ✔ | |
| V1 vara (`fldbnVgbWTgSXLjMm`) | Úthlið á grunnskáp | nýja varan AF | Ein vara, V1 (⛔ viðvörun ef fleiri). |
| Skipulag - Breidd (`fldQPlO9WAYtixvw0`) | 600 | 100 | Varagildi; Smíðagögn yfirskrifa alltaf. |
| Skipulag - Hæð (`fldzGkX4wBDFxOlUB`) | 800 | 800 | Sama. |
| Skipulag - Dýpt (`fldRRCx4JqLtQZau9`) | tómt | tómt (eða 19) | Úthlið hefur það tómt; Smíðagögn gefa `d:19`. |
| Reitur `fld7EqNCvAy0JDWhp` (13.000 kr.) og `fldoCiqz9NnyA5abU` (35 %) | 13.000 / 35 % | sömu gildi | Viðmiðunargildi á öllum úthliðs-Útfærslum; verðútreikningur les þau ekki (staðfest í `api/kp-price.js`). Nafn reitanna sést ekki í lestrartólinu — eigandi má staðfesta í viðmóti. |
| Reitir sem eru ekki fylltir á úthlið: skúffukerfi (`fld08OQYCqF3HPciG`), ofn/vifta (`fldKTi6JX39Q3S8Rb`, `fldHPlgFNZoXiACOX`), höldur (`fldAA63gsi3Gsy87g`), Frontstaða (`fld65nMEGI1UcmIrP`), Aukahlutaflokkur (`fldtt1D4OJtNwuneU`), Skápategund (`fldMyM7diYcMAMbN4`) | tómt | tómt | Þá kemur enginn fronti/hólf/aukahlutur á Eyðublaðið. |

Formúlur/rollup á Útfærslunni (skrifast ekki): `Samtals Söluverð útfærslu` (`fld36kgODkNOZNOeU`), „fm fronta“ (`fldVq3i01NtRfM5sz`), kantlímingarmetrar (`fldnSzFZvb5QHv4dr`), allir rollup/lookup reitir (V1…V7 summur).

### 3. Þurrkeyrsla: hvað Keyra skipulag gerir við línuna `AF1`

Lesið úr scriptinu sjálfu (`wflPGRyv0VYi4AZpd`, aðeins lestur):

1. **Gild lína?** Formúlan krefst: engin Eyðublað enn, „Hvað viltu smíða?“ af V1 ≠ tómt (✔ *Front / Hlið*), Rými sett, 🔑 sett, Magn ≥ 1 og engin ⛔ villa. Áfellan uppfyllir þetta ef Útfærslan er eins og lýst er. (Dæmi úr lifandi grunni: T-32 línan `UH1` fer sömu leið.)
2. **Eyðublað er búið til** með: Athugasemd = línunafn (`AF1 | AF`), Fjöldi eininga = Magn (1), **Breidd = `w`, Hæð = `h`, Dýpt = `d`** úr Smíðagögnum (annars Skipulag-Breidd/Hæð/Dýpt Útfærslunnar: 100/800), Hvað viltu smíða? = *Front / Hlið*, Frontur / Hlið tegund = *Áfella* (af Útfærslunni; valkosturinn er til á Eyðublaði), Rými, Frontaefni #2 og eigið skrokkefni/borðplata af línunni. Skúffur, hillur, höldur, ofn, aukahlutir: tómt.
3. **`Tegund einingu`** (formúla) verður *Áfella* → Sögunarlisti-scriptan les ÚRVINNSLA-sniðmátið `rec6VMJSfyn4qX7As` og býr til röðina „Áfella“: frontaefni, B = Breidd, H = Hæð, Þykkt = „Þykkt fronta“ (19), Magn = Fjöldi eininga, **engin kantlíming** (kantreitirnir eru tómir á sniðmátinu — staðfest, ólíkt úthlið sem hefur kant á öllum fjórum brúnum).
4. **Pöntunarlisti (full)** telur flatarmálið með í plötunýtingu frontaefnis; sérlína birtist aðeins ef varan hefur verð (við kost A er verð vörunnar 0 → engin sérlína, efnið er í plötunum).
5. **Staðfest á T-32** eftir að færslurnar eru búnar til: lína `AF1` → Eyðublað „Áfella“ 60 × hæð → röð í Sögunarlista → plötufjöldi. **Ekki lesið:** kóði Sögunarlista-/Pöntunarlistaskriptanna sjálfra (aðeins Keyra skipulag og sniðmátið).

### Tvær spurningar til eiganda

1. **Vinnan í verðinu:** kostur A (aðeins efni eftir flatarmáli, mínútur 0 — **mín tillaga, það sem þú sagðir**) eða kostur B (eins og úthlið, 28 mín. ≈ 8.867 kr. á stykki)?
2. **Afföll 0 % eða 3 %** á áfellu (tillaga: 0 %)?

### Viðauki — nákvæm JSON-gildi (kostur A)

Vörulisti 🚪, ný færsla (reitir eftir id; prósentur eru brot: `2` = 200 %, `0.03` = 3 %):

```json
{
  "fld2eaMu1s2beJLK4": "Áfella (frontaefni, 19 mm)",
  "fldTUoa4wg4hftHO0": "AF",
  "fldmfha5f6EZLKrKq": "Úthlið",
  "fldmgFIZy3K9GMLKX": 100,
  "fldBxGigJOw2FSDje": 800,
  "fldf74wqHyJCZtmTT": 1,
  "fldDTCv3pJ0De77aH": 0,
  "fldg2U0QIsZkiLVM7": 0,
  "fldG5dtxsW2ljrrSH": 0,
  "fldNkxo1p7vNOlVJW": 0,
  "fldD7HFFb33ZegSsh": 0,
  "fldMUCnsxlUYZcO61": 0,
  "fldnU4cVmm6Lkdk7H": ["recUhUS8yuNyAwAfU"],
  "fldQxpqA2m3kwSh0S": 2
}
```

Kostur B: breyta mínútureitunum í `10, 10, 0, 5, 3` (í sömu röð og að ofan) og `fldDTCv3pJ0De77aH` í `0.03` ef Afföll eiga að vera eins og úthlið.

Útfærslur 🎨, ný færsla (`<ID-VÖRU>` = id nýju vörunnar úr skrefinu á undan):

```json
{
  "fldbG3jw1tEPEchGr": "Áfella",
  "fldpHihoAgFxkjTVy": "AF",
  "fldrFCpVB3Wrzm4BA": "Úthliðar",
  "fldceWYVphsBK6JZW": "Front / Hlið",
  "fld23mgo1syTKNUB6": "Áfella",
  "fldMZXkLkXLBMiH7d": true,
  "fldbnVgbWTgSXLjMm": ["<ID-VÖRU>"],
  "fldQPlO9WAYtixvw0": 100,
  "fldzGkX4wBDFxOlUB": 800,
  "fld7EqNCvAy0JDWhp": 13000,
  "fldoCiqz9NnyA5abU": 0.35
}
```

Eftir að Útfærslan er til: id hennar (`rec…`) fer í `kitchen-planner-linemap.js` (`window.KP_LINEMAP.afellaId`), `npm run test:live` athugar að hún sé í Útfærslum, og áfellur byrja að fara með Line Items.


**Skapað 30.10.2026:** vara `recLmy7flOx6p061Z`, Útfærsla `recKiurbbZTkXpzmp` (`afellaId`). **Öryggi:** AF-línur fara aðeins úr PRO Vista þar til T-32 er staðfest; til að opna fyrir Studio-innsendingu breyttu `AFELLA_LINES_IN_STUDIO_SUBMIT` í `true` í `kitchen-planner.html` (við `afellaLive`).
