# BJÖRNINN STUDIO — yfirferð 2026-10-25 (unnið á meðan eigandi var í göngutúr)

Þrír hlutar: **A** tegundir sem eru eftir í „+ Ný eining“, **B** bakendinn, **C** flæði hinna rýmanna.
Hvert atriði: tillaga + (ef þarf) spurning með ráðlögðu svari svo við getum farið hratt yfir.
✅ = þegar lagað og komið á main.

---

## A. „+ Ný eining“ — tegundir sem eru eftir

Skannað í vafra (1440×900): allir 26 kostir, hver hluti opnaður, mælt hvort hliðarspjaldið flæðir.

### Lagað strax ✅
- „Hæð **upp að borðplötu** 250 cm“ á háum ofna-/ísskápum → nú bara á lágum gólfeiningum.
- „Annað mál 60–60“ þar sem málið er fast (ofnaskápar 60 cm) → falið.
- Búrskápur: „Föst framhlið“ var í boði sem **innskúffa** (bull) → tekið út. Vinsælu lausnirnar tvær í röð (stutt heiti feitletrað, smáatriði undir) → yfirflæði 145 → 45 px.

### Tillögur (förum yfir saman)
| # | Tegund | Tillaga | Spurning / ráðlagt |
|---|---|---|---|
| A1 | Grunnskápur · Lítill kassi | Sýnir „Hillur / Skúffur“ víxl — eini kosturinn í „Annað“ svo það er í lagi; en ruslafötur + innskúffa birtast á 50 cm kassa (alltaf gráar) → fela þær þegar kassinn er undir 60 cm | Fela? **Já** |
| A2 | Háir · Hurðir með hillum | 10 hæðarhnappar (180–270). Sjálfgefið 250. Fataslár 0 sjálfgefið | Færri hnappar (210/230/250/270 + Annað mál)? **Já** |
| A3 | Háir · Búrskápur | Enn 45 px yfirflæði þegar hann er tómur (athugasemdin „Tómur skápur…“) → stytta í tooltip; byrja á vinsælustu lausninni valinni í stað tóms skáps | Byrja á „4 skúffur + 2 hillur“? **Já** |
| A4 | Eldhústæki · Ofn í háum skáp | 97 px yfirflæði: 6 skúffu-útgáfur í lista + „Aðeins samsetningar sem Björninn smíðar (Legra)“ texti → sama tveggja-dálka útlit og búrskápurinn, texti í tooltip | **Já** |
| A5 | Eldhústæki · ísskápar/frystir | Innbyggður ísskápur breidd 50–100 — er það rétt eða bara 60 (og 70/90 fyrir side-by-side)? | Bara 60 / 70 / 90? |
| A6 | Efri · Lausar hillur (38 mm) | „Hæð 71.4 cm“ sjálfgefið og 20 hæðarhnappar 10–200 → þetta er í raun **hæð frá gólfi**; endurnefna „Hæð frá gólfi“, sjálfgefið 150 cm, hnappar 120/140/150/160 + Annað mál | **Já** |
| A7 | Eyja · Ein röð / Tvær raðir | 76 / 141 px yfirflæði (kassalistinn + mál hvers kassa) → kassalisti í þéttari röðum, mál í samanbrotnum hópi eins og aðrir | **Já** |
| A8 | Úthliðar · neðri/há/efri | 14 dýptarhnappar (10–75) → sjálfgefið = dýpt skápsins sem hún fer á, hnappar 30/60 + Annað mál | **Já** |
| A9 | Úthliðar · „Bak á eyju“ | Opnar tóma síðu („Veldu útfærslu“, engin mál) | Laga/fela? **Fela þar til eyja er valin** |
| A10 | Hornskápar (allir) | **Fyllistykki** þegar blindi helmingurinn < ~62 cm (opin spurning frá síðast) | (a) sjálfvirkt 5–7 cm + athugasemd — **ráðlagt** / (b) ekkert |

---

## B. Bakendinn (yfirferð á api/ + innsendingu)

`npm test`: 199/199 ✅.

### Lagað strax ✅
- Skipt yfir í **Merivo** með miðlungs-innskúffu (IK) → verður lág (IM), því IK er ekki til í Merivo (annars 400-villa við að búa til samsetningu).
- Skápur sem finnur ekki V1 missti aukahlutina sína (ruslafötur, töfrahorn, lyftu…) **án athugasemdar** → nú kemur athugasemd.
- „eldhúsið“ texti í öðrum rýmum: lögunartitill (Þvottahús sagði „Hvernig er eldhúsið…“), stærðarhint, afhendingarspurning → hlutlaust.

### Hátt — þarf ákvörðun / meiri vinnu (ekki snert sjálfur)
| # | Hvar | Vandinn | Tillaga |
|---|---|---|---|
| B1 | kitchen-planner.html ~11555 (🔑 númer í mörgum rýmum) | Skápur bættur við rými 1 eftir á fær 🔑 sem rými 2 notar þegar → **öll innsendingin fellur** („Tvítekinn 🔑“), sérstaklega í PRO | Einn teljari yfir öll rými |
| B2 | ensureCombo (skúffusamsetningar búnar til eftir þörfum) | Ný samsetning er bara í minni: endurhlaða drögin → línan fer **án skúffu-V2 (vanverðlagt)** | Í Senda inn: búa til/fletta upp öllum samsetningum sem vantar V2 |
| B3 | kp-submit — harðkóðuð Airtable-id | Ef ein Útfærsla/Vöruliðsröð er eytt → 422 → **hver innsending með þeim skáp fellur** | Við 422: fjarlægja id í Skilaboð og senda aftur; `test:live` reglulega |
| B4 | kp-submit — endurtekur POST | Netvilla eftir að Airtable vistaði → tvöfaldur tengiliður/Tækifæri/línur | Endurtaka bara GET/429; eftir POST-villu: fletta upp áður en sent er aftur |
| B5 | kp-submit / kp-pro — „T-227 \|“ forskeyti | Ef nafnið hefur ekki forskeyti enn → endurtekin innsending býr til **allar línur aftur** | Leita eftir tengdu RECORD_ID() |
| B6 | api/drawer-combo.js | Hver sem er getur búið til Útfærslur-raðir, án „Óyfirfarið — Rakel ⚠️“ og án rate-limit | Rate-limit + flagg (en athuga fyrst hvort flaggið stoppi verð) |

### Miðlungs
- Engin stærðartakmörk á planner-JSON (100.000 stafa hámark í Airtable) → stórt fjölrýmaverkefni getur fallið.
- Innsending sendir efni **virka rýmisins**, PRO sendir **fyrsta rýmið**; höldufjöldi telur bara virka rýmið.
- Skúffustafli með „Föst framhlið“ (P) fær ekkert V2 verð fyrir hinar skúffurnar.
- kp-drawings: 4,3 MB nálægt 4,5 MB hámarki Vercel, engin endurtekning.
- drawer-combo leitar bara eftir Vörunúmeri (ekki Flokki).

---

## C. Flæði hinna rýmanna (Fataskápar, Bað, Þvottahús, Innihurðir, Allt heimilið)

### Gildir um öll
- **Bara eitt rými af hverri gerð í verkefni** (lykillinn er einstakur) → „Baðh. 2“, tveir fataskápar ganga ekki. → Lyklar eins og `fataskapar:2`.
- Ekkert rými nema eldhús hefur **Úthliðar**.
- Harðkóðað „5 efnissíður“ (eldhús) → rými með 4 síður fer ekki aftur á fyrstu síðu.
- Eldra „Byrja“-síðan sýnir enn „Hurðir — Væntanlegt“.

### Fataskápar
**Núna:** lögun (+ hvaða herbergi) → stærð → hæð → op → Litur → Dýpt (35/58) → Hæð (1800/2100/2400/Í loft) → Hurðir & höldur → Skipulag (Lokaður / Opinn / Grunnskápur / Hillur) → Spurningar → Senda.
**Vantar:** dýpt/hæð ekki valin fyrirfram; mm og cm blandað; „Hillur“ = 38 mm veggfljótandi hilla úr eldhúsinu; kortið lofar „rennihurðum“ en það er bara vasahurð.
**Tillaga:** Herbergi → lögun → stærð → hæð → op → **Dýpt (58 valið)** → **Hæð (Í loft valið)** → Litur → **Hurðir: lamir / engar** → Höldur (sleppt ef engar hurðir) → Skipulag (skápur með hurð / opinn / skúffueining / horn / úthlið) → Spurningar → Senda.
**Spurningar:** fleiri fataskápar í verkefni? **Já** · taka „rennihurðir“ af kortinu? **Já** · 58 cm/Í loft fyrirfram? **Já** · „Hillur“ = hillur inni í opnu bili? **Já**

### Baðherbergi
**Núna:** öll eldhúsflæðið (líka vatn + 5 efnissíður með **stein-borðplötum**), skápar veggfestir (200 mm frá gólfi), Skipulag: vaskaskápur / neðri / efri / opinn / lausar hillur.
**Vantar:** steinn í boði (Björninn selur ekki); bilið undir heitir „Sökkull“; enginn hár skápur/spegilskápur.
**Tillaga:** … → Vatn → Litur → Framhlið → Höldur → **Toppur: Egger eða „Engin / handlaug ofan á“** → Skipulag (vaskaskápur kominn inn, „Hæð frá gólfi“ í cm) → Spurningar → Senda.
**Spurningar:** bara Egger + Engin? **Já** · hár baðskápur? **Já, valkvætt** · spegilskápur? **Seinna, sem athugasemd** · „Sökkull“ → „Hæð frá gólfi“? **Já**

### Þvottahús
**Núna:** eldhúsflæðið allt; Skipulag sáir vask + þvottavélaturn (THVO1L/1M/2).
**Vantar:** ekkert horn/úthlið; enginn þurrkari-einn / hlið við hlið.
**Tillaga:** … → Vatn + niðurfall → **Hvar er vélin? Stæða (valið) / undir borði / engin** → Litur → Framhlið → Höldur → Borðplata (Egger) → Skipulag → Spurningar → Senda.
**Spurningar:** vélar-skref sér? **Já** · horn + úthlið úr eldhúsinu? **Já** · enginn steinn? **Já**

### Innihurðir
**Núna:** yfirlag (ekki skref): ein þétt röð á hurð með öllu í einu (mm), „Senda inn hurðirnar“ bara ef ekkert rými er teiknað.
**Tillaga:** alvöru skref: „+ hurð“ → lítill wizard á hurð: **Gerð (mynd) → Mál í cm (80×210 valið) → Opnun/lamir (mynd) → Efni** → listinn sem yfirlit → Spurningar → Senda.
**Spurningar:** alvöru skref í stað yfirlags? **Já** · cm? **Já** · herbergjalisti = rými verkefnisins + „Annað“? **Já**

### Allt heimilið
**Núna:** grunnmyndarleiðin er enn í boði („Ég á teikningu“ — sem við hættum við), herbergisgerð ræðst af **nafninu**, eitt af hverri gerð.
**Tillaga:** listasíða: **„+ Rými“ → nafn + gerð** (Eldhús / Fataskápur / Bað / Þvottahús / Innihurðir / Aðeins rými) → hver röð opnar flæði gerðarinnar og fær ✓ → ein Spurningar + Senda fyrir allt. Grunnmynd seinna sem valkostur („Teikna grunnmynd“).
**Spurningar:** taka „Ég á teikningu“ út? **Já** · gerð aðskilin frá nafni? **Já** · eitt tilboð flokkað eftir rýmum? **Já**

---

## Röð sem ég legg til
1. **A** (fljótt — flest „Já“): A1–A9 í einu lagi, svo A10 eftir svari.
2. **B1–B3** (innsendingar sem geta fallið / vanverðlagt) — áður en mikið af alvöru viðskiptavinum kemur.
3. **C**: Fataskápar fyrst (næstalgengast), svo Bað, Þvottahús, Innihurðir, síðast Allt heimilið (byggir á hinum).
