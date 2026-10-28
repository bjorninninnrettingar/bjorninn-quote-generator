# PRO — hvað vantar upp á 90 % (næturskönnun 2026-10-27)

Aðferð: unnið sem sölumaður á staðbundnum les-þjóni (port 4440, allar skrif-köll lokuð nema kp-price), 1440×900.
T-199: teiknað frá grunni Eldhús (9 einingar + borðplata) + Fataskápar (Fylla vegginn, 5) + Baðherbergi (3) →
Tilboð → Yfirferð → Smíða á öllum 17 → Teikningar/Skápalisti → Vista (lokað, payload skráð). T-32: /smida + /cnc.
Airtable (app91U15z9K704Okd): allar 51 sjálfvirknir lesnar, ekkert skrifað. Nánar um sjálfvirknir:
`side-session-notes/…/airtable-automations-pro-scan.md`.

---

## 1. Ferli sölumanns í dag — skref fyrir skref

| # | Skref | Hvar | Staða |
|---|---|---|---|
| 1 | Innskrá í /skrifstofa með PIN → lykill `k` í localStorage | App | OK |
| 2 | Nýtt verkefni: /crm „+ Nýtt verkefni“ (tengiliður + Tækifæri) → „Hanna“ opnar PRO | App | OK — en CRM-síðunni er skipt út, engin leið til baka |
| 3 | Opna PRO (`/skipuleggja?pro=rec…&k=`) úr CRM-línu, skrifstofu-leit eða /pro (iframe) | App | OK — PRO les `k` *bara* úr slóðinni; bókamerki án `k` = allt bilar |
| 4 | Velja rými (Eldhús/Fataskápar/Bað/Þvottahús) | App | OK — en að **bæta við rými síðar** er falið (Til baka → Til baka) |
| 5 | Rýmið (veggir, lofthæð, gluggar, vatn) í mm | App | OK, gott |
| 6 | Teikna: Ný eining → Smíða → „+ Næsti hægra megin“ | App | OK, hratt. ⚠ vaskaskápur settur sjálfkrafa á vatnið án orða → ég fékk 2 vaska í eldhúsi og 2 á baði |
| 7 | Efni (sjálfgefin, „óákveðið“) | App | OK í eldhúsi. **Bilað fyrir fjölrými**: Tækifæri hefur eitt efnasett — bað (Halifax eik) pantast/verðleggst sem eldhúsfrontur |
| 8 | Tilboð (lifandi verð, kp-price) | App | **Bilað**: höldur = Σ allra lengda × heildarfjöldi (sjá G1) |
| 9 | „Prenta tilboð“ → PDF í Airtable-reitinn *Tilboð til sendingar* | App → Airtable | Hálft: prentar úr Airtable-línum (ekki teikningunni), varar ekki við „● óvistað“, enginn hlekkur á PDF-ið, engar teikningar í PDF |
| 10 | Senda tilboð til viðskiptavinar (tölvupóstur) | **Airtable / handvirkt** | Ekki til í appi. F0/F1/F2 póst-sjálfvirknir allar slökktar |
| 11 | Viðskiptavinur samþykkir → „🏆 Tækifæri unnið“ í /crm | App | **Bilað að hluta**: „Færir verk → tækifæri unnið“ hlustar á gamla gátreitinn, ekki stöðureitinn → *Staðfest tilboð 🔒* PDF frystist ekki, „For-skipulag“ ekki sett, enginn UNNIÐ-póstur í spjall (síðast keyrt 2026-08-25) |
| 12 | Konto G1 (innborgun) | **Airtable** (Interface-hnappur) | Kóðinn í /skrifstofa tilbúinn en gátreitur `🧾 Búa til G1 drög` + kveikja ekki enn búin til |
| 13 | Mæling á staðnum (Mæling-spjald) | App | OK |
| 14 | Smíða á hverjum skáp („Yfirfarinn →“) | App | OK, hratt (17 skápar á ~20 s). ⚠ Hægt að smella í gegn án þess að líta á |
| 15 | Yfirferð (8 línur) → „Vista í Airtable“ | App | OK (lokað hér, 503 sýnt rétt). Payload: 19 Line Items + efni + **Magn Halda 1 = 35 með 4 höldu-SKU** |
| 16 | „Klár til framleiðslu“ → Keyra skipulag (gátreitur `🔄 Keyra Skipulag`) → Eyðublöð | App → Airtable sjálfvirkni | OK (síðast keyrt 10-09). `force` inntak ekki tengt |
| 17 | Yfirfara 3.0 per einingu (Sögunarlisti) | App (/ferli) | OK, en PRO keyrir það ekki sjálft — segir bara „keyrðu Yfirfara á þeim“ |
| 18 | Yfirfara 4.0 / Pöntunarlisti / senda á birgja | App (/pontun) | OK |
| 19 | Staða í skipulagi → „Klárt til framleiðslu“ (G2 drög o.fl.) | App (/skipulag) | OK |
| 20 | /smida → „Skrifa á USB“ | App | OK á T-32 (9 skápar, allir „Teiknaður í PRO“, les-aðeins). Engin CNC-hnappur í ólæstu PRO |
| 21 | LOKA PRENT, Skúffusamantekt, pöntunar-PDF | **Airtable** (Interface-hnappar) | Airtable-eingöngu |

**Airtable-eingöngu í dag:** senda tilboð, G1-drög, LOKA PRENT/samantektir, að sækja PDF-ið sjálft.
**Bilað:** höldu-verð, efni í fjölrýmum, „unnið“-sjálfvirknin, tilboðs-PDF úr óvistuðu.

---

## 2. Forgangsraðaður gap-listi

| # | Hvað | Af hverju skiptir það máli | Tillaga | Stærð |
|---|---|---|---|---|
| **G1** | **Höldur ofverðlagðar ~4×.** `handleHardwareSummary` skilar öllum lengdum Jey (4 SKU: 24.263 + 12.879 + 12.483 + 10.474) og einum fjölda; kp-price (og Airtable-formúlan) margfaldar *summu* verðanna × fjölda. T-199: 21 höldur = 1.262.072 kr (≈60 þús/stk); eftir fataskáp 35 stk ≈ 2,1 m.kr. Vista skrifar þetta á Tækifærið. | Hvert tilboð með Jey/Hexxa er rangt um hundruð þúsunda – milljónir. Seljandi sér það ekki nema hann reikni. | Telja **per SKU** (`{id: fjöldi}`). Annaðhvort höldur sem V3 á hverri Sk-línu (verð per línu) eða Halda 1/Halda 2 reitir; kp-price notar sama. Próf í tests/kp-price.test.js. | M |
| **G2** | **Efni per rými týnist.** Tækifæri á eitt efnasett (`projectMaterialFields` = fyrsta rými). Bað FR1 = H1180 Halifax eik í vinnuteikningum, en Line Items bera ekkert frontaefni → pantað/verðlagt sem eldhúsfrontur. Frontaefni #2 ekki notað. | Rangt efni pantað og sagað — dýr villa í framleiðslu. | Skrifa efni per línu (Frontaefni #2 + Fronta efni 2.0 fyrir 2. rými sem lágmark), eða per-línu efnisreit sem Keyra skipulag les; Yfirferð ⛔ ef >2 frontaefni. | M–L |
| **G3** | **„Prenta tilboð“ prentar úr Airtable, ekki teikningunni** og varar ekki við óvistuðu; enginn hlekkur á PDF; engar teikningar/myndir í PDF. | Seljandi sendir gamalt verð; þarf að fara í Airtable að sækja skjalið. | Prenta = vista fyrst (sama dialog og Keyra skipulag) → generate-quote → opna PDF-ið í nýjum flipa. Valkostur: hengja Studio-mynd + grunnmynd/veggmyndir aftan á. | S–M |
| **G4** | **Senda tilboð + samþykki vantar.** Engin „Senda til viðskiptavinar“, engin samþykktar-/undirskriftarstaða. | Hvert tilboð fer út fyrir appið (Gmail/Airtable). | „Senda tilboð“ í Tilboð-spjaldi: Gmail-drög (api/email-draft er til) með PDF-hlekk + setur Staða í söluferli = 📤 Tilboð sent. Seinna: samþykktarhlekkur (`/verkefni`-gáttin) sem setur 🏆. | M |
| **G5** | **„Unnið“ í /crm sleppir 3 hlutum** (frysta *Staðfest tilboð 🔒*, For-skipulag, UNNIÐ-skilaboð) — sjálfvirknin hlustar á gamla `Tækifæri unnið 🏆` gátreitinn. | Ekkert fryst tilboð = deilur um verð/umfang síðar; Fjárhags-mission byggir á því. | Breyta kveikju „Færir verk → tækifæri unnið“ yfir á Staða í söluferli = 🏆 (í Airtable, notandi gerir) **eða** /crm hakar líka í gátreitinn (bæta í WRITABLE_FIELDS). | S |
| **G6** | **Engin viðvörun um göt/áfellur.** T-199 veggur 1: 1000 mm autt vinstra megin, 200 mm milli Sk6 og Sk1, 200 mm við hægri enda — „Engar ábendingar“. `fitWarnings` þekkir bara árekstra, glugga, vatn, loft. | Gat sem enginn tekur eftir = vantar áfellu/úthlið í Sögunarlista; uppgötvast á uppsetningardegi. | Ný ábending: bil < 150 mm milli skápa / að vegg → „Áfella?“ með Laga (setja áfellu / draga saman). | S–M |
| **G7** | **Sjálfvirkur vaskaskápur í PRO án orða.** `seedSink` keyrir í PRO (bara röðin sleppt). Ég bætti við vaskaskáp eins og seljandi myndi → 2 vaskar (eldhús + bað). | Tvöföld lína í tilboði og framleiðslu. | Í PRO: ekki seeda, eða toast „Vaskaskápur settur á vatnið (Sk1)“ + Ný eining varar ef vaskaskápur er þegar á vatninu. | S |
| **G8** | **Skápalisti segir ósatt um tæki.** Sk5 Uppþvottavél: „1 hurð · 3 lamir, vinstri“ (Smíðagögn `hinge:"vinstri"`); Sk7 innb. ísskápur skráður „Hárskápur · Lokaður hár skápur“, athugasemd „—“. | Verkstæðið les Skápalistann; röng lamatala/vantar „ísskápur, loftunarrist“. | Uppþvottavél: engar lamir í Skápalista/Smíðagögnum; tæki fá tegund+athugasemd (Ísskápur innb., loftun). | S |
| **G9** | **Að bæta við rými í PRO er falið** (Teikning → Til baka → Til baka → kort). „1. Rými“ í progress-röndinni er ekki smellanlegt. | Algengt: viðskiptavinur bætir við baði eftir fyrsta fund. | „+ Rými“ í herbergjaflipunum (`.ps-rooms`) → sama kortaval. | S |
| **G10** | **Engin leið til baka úr PRO** í /crm eða /skrifstofa (nema iframe-hliðarstikan í /pro); CRM nýtt-verkefni skiptir út CRM-síðunni. PRO les `k` bara úr URL. | Seljandi týnist í flipum; bókamerki án `k` brotnar. | „← Skrifstofa/CRM“ í PRO-haus; `k` fallback í localStorage (sama lykill og office-shell); CRM opnar PRO í nýjum flipa. | S |
| **G11** | **PRO-teikning ↔ Airtable rekur í sundur eftir vistun.** T-32: teikning 13 Sk, /smida & /cnc 9 Sk, „Teikningunni breytt eftir Keyra skipulag“ á Sk10/Sk11, 0/9 yfirfarnir (merkin bara í staðbundnum drögum). | CNC borar eftir gömlu. | Eftir „Klár til framleiðslu“ keyrir PRO Yfirfara 3.0 sjálft á nýjum/breyttum einingum (gátreitur fld2oZxB3MIm2kT0K, eins og /ferli) og sýnir „X af Y með Sögunarlista“. | M |
| **G12** | **CNC aðeins aðgengilegt þegar læst.** Ólæst PRO hefur engan /smida eða /cnc hnapp. | Hönnuður vill sjá CNC-hlið áður en hann læsir. | Alltaf „Smíða & CNC ↗“ í PRO-stiku (opnar /smida). | S |
| **G13** | **api/tilbod-print.js án lykils** — hver sem er getur endurprentað/yfirskrifað *Tilboð til sendingar* á hvaða Tækifæri sem er. | Öryggi + rangt skjal getur farið til viðskiptavinar. | Krefjast VERK_KEY (PRO og CRM hafa hann). | S |
| **G14** | **G1-innborgun þarf enn Airtable.** Gátreitur `🧾 Búa til G1 drög` ekki til; kveikjan enn Interface-hnappur. | Seljandi fer í Airtable við hverja sölu. | Notandi býr til reitinn + skiptir kveikju (skref í docs/api.md) — 10 mín í Airtable. | S (handvirkt) |
| **G15** | **Efriskápur 500–600: tveir frontar í Keyra skipulag (≥500) vs. ein hurð í hönnuði (>600).** | /cnc borar lamir öðrum megin fyrir tvær hurðir. | Eigandi ákveður regluna; laga þá annan staðinn. | S (ákvörðun) |
| G16 | Smærra: „● óvistað“ strax við opnun á ósnertu verkefni; forsíða vinnuteikninga „T-199 \| -“ án tengiliðar; viðskiptavina-orðalag í Skilaboð („Viðskiptavinur óskar… vinsamlegast staðfestu“) í PRO-línum; Sk-merki skarast í Ofanmynd; efri skápar ómerktir í grunnmynd; „Skrifa á USB“ til bæði í /smida og /cnc. | Fínpússun. | Laga í einni lotu. | S |

Það sem virkaði vel og þarf ekki að snerta: Rýmið-síðan, Ný eining + „+ Næsti hægra megin“, Fylla vegginn, Smíða-lykkjan,
Yfirferð, borðplata (BP/BV), vinnuteikningar 10 blöð + Skápalisti, vistunarvillur (503 sýnd skýrt), /smida + /cnc á T-32,
Keyra skipulag / Yfirfara 3.0 / 4.0 öll með gátreit sem appið getur sett (ekkert af þeim krefst Airtable lengur).

---

## 3. Átta smíðar á morgun, í þessari röð

1. **G1 — höldur per SKU** (kp-price + materialFieldsNow + próf). Stærsta peningavillan; hvert tilboð í dag er rangt.
2. **G2 — efni per rými** (lágmark: 2. rými → Fronta efni 2.0 + Frontaefni #2 á línunum; ⛔ í Yfirferð ef rými ber þriðja frontaefnið).
3. **G3 — „Prenta tilboð“ vistar fyrst og opnar PDF-ið** (+ tilbod-print krefst lykils, G13, sama snerting).
4. **G5 — „Unnið“ frystir tilboðið** (/crm hakar líka í `Tækifæri unnið 🏆`, eða leiðbeiningar til notanda um að skipta kveikjunni). Undirstaða fyrir fjárhags-missionið.
5. **G6 + G7 — göt/áfellu-ábending og enginn þögull vaskur í PRO.** Tvær litlar breytingar sem stoppa raunverulegar framleiðsluvillur.
6. **G8 — Skápalisti/Smíðagögn fyrir tæki** (uppþvottavél án lamir, ísskápur/ofn merkt sem slík með loftun).
7. **G4 — „Senda tilboð“** úr Tilboð-spjaldinu (Gmail-drög með PDF + Staða = 📤 Tilboð sent).
8. **G9 + G10 + G12 — leiðsögn:** „+ Rými“ flipi, „← Skrifstofa“ + `k` úr localStorage, „Smíða & CNC ↗“ alltaf í PRO-stiku.

(G11 sjálfvirkt Yfirfara 3.0 eftir Keyra skipulag er næst á eftir; G14 + G15 eru á borði notanda: 10 mín í Airtable + ein ákvörðun.)

---

## Samantekt (5 línur)

1. Teiknunin sjálf er ~90 % tilbúin: eldhús + fataskápur + bað frá grunni, Smíða á 17 skápum og 10 blaða vinnuteikningar tóku mínútur, án villna.
2. Tilboðið er ekki tilbúið: höldur reiknast sem summa allra lengda × fjöldi (T-199: 1,26 → 2,1 m.kr. of mikið), og efni 2./3. rýmis týnist á leiðinni í Airtable.
3. Söluhringurinn lokast utan appsins: prentað PDF lendir í Airtable-reit, engin sending, ekkert samþykki, og „Unnið“ í /crm frystir ekki tilboðið lengur.
4. Framleiðslukeðjan (Keyra skipulag → Yfirfara 3.0/4.0 → /smida USB) keyrir öll á gátreitum sem appið setur — eftir standa G1-drög og LOKA PRENT í Airtable.
5. Byrja á morgun á höldum per SKU, efni per rými og „vista-áður-en-prentað“; þá getur seljandi gefið rétt tilboð úr PRO.
