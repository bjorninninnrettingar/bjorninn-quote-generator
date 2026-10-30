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
