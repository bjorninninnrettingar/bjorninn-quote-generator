# Morgunlisti — BJÖRNINN STUDIO (skönnun 2026-10-27, nótt)

Gengið í gegnum **live** https://bjorninn.vercel.app/skipuleggja á 1440×900 (+ 1280×720 skyndiskoðun) sem nýr viðskiptavinur:
öll 6 rýmin í einu verkefni (Eldhús L-laga, Fataskápur „Allt rýmið“, Baðherbergi einn veggur + „Velja ný“ efni,
Þvottahús Horn, Innihurðir, Aðeins rými/Stofa), Rýmin þín (fjarlægja/afturkalla/bæta við), Spurningar, Senda inn
(**ekki** sent), Hjálp, tungumál, endurhleðsla, til-baka. Engar JS-villur í console allan tímann.
Prufudrög hreinsuð (draft + homeThumbs + lang), `tourDone` sett aftur á "1", `:pro:` lyklar ósnertir.

> Fyrirvari: Vafrapanelið var falið alla nóttina, þá keyrir `requestAnimationFrame` ekki — veggja-fade og
> innkomuhreyfingar í 3D frjósa hálfgagnsæjar. Það sem leit út eins og „gegnsæir skápar“ í 3D er því **ekki** talið með.
> 3D-gæði (lýsing, skuggar) þarf að líta á með augunum á morgun.

Alvarleiki: **Blokkar** (viðskiptavinur festist / gögn í hættu) · **Mikilvægt** (ruglar, lítur illa út) · **Fínpússun**.
Stærð: S (< 1 klst) · M (hálfur dagur) · L (dagur+).

---

## Fyrstu 10 — gera þetta fyrst

| # | Hvað er að | Lagfæring | Alv. | St. |
|---|---|---|---|---|
| 1 | **Senda inn → „← Til baka“ opnar draugaritil** („Ýttu á ＋ Ný eining…“, `activeCategory = null`) í stað Spurninga; næsta „Til baka“ fer í efnisval með „Sömu efni og í Eldhús?“ fyrir ekkert rými. Staðfest: `backToEditorBtn` → `goto("editor")` alltaf (kitchen-planner.html:15124). | Í heimilisham: `goto("intake")` (Spurningar). Bara gamalt eins-rýmis flæði fer í ritil. | Blokkar | S |
| 2 | **Leiðsögnin festist á „Skref 2 af 9“** — „Næsta →“ gerir ekkert, eina leiðin út er „Sleppa“. Orsök: skref „Sýnin“ var bætt inn, en `tourTick` heldur enn að Ný-eining-skrefin séu 3–6 (`want = !uw ? 2`) og kastar skrefi 3 aftur á 2 (kitchen-planner.html:12699). | Hliðra bilinu í 3–7 og `want` um +1 (`!uw ? 3 : uw.step===1 ? 4 : …`). Athuga líka að Grunnskápur fer nú beint í stillingar — skrefið „Veldu útfærslu“ (uw-grid) birtist kannski aldrei. | Blokkar | S |
| 3 | **Aðeins rými (Stofa): „Áfram“ óvirkt og hljótt** — engin lögun er forvalin (Eldhús/Þvottahús hafa forval), hnappurinn lítur út eins og hann virki. | Forvelja „Rétthyrnt“ eins og í Eldhúsi; almennt: óvirkur Áfram-hnappur sýnir alltaf eina línu um hvað vantar. | Blokkar | S |
| 4 | **Eldhús fékk enga mynd á Senda inn** (bara tákn) og spjaldið á „Rýmin þín“ sýndi 2D-grunnmynd (klippta) af því ég skildi ritilinn eftir í Ofanmynd. Eftir að hafa opnað Eldhús aftur í 3D kom myndin. | Myndir á spjöldum og Senda inn alltaf úr `KP3D.unitsShot()` (3D, óháð sýn) — taka hana við „Klárt“, ekki síðustu sýn. | Mikilvægt | M |
| 5 | **Myndavélarhnapparnir (Skotmark, Vista mynd, Ganga um) eru faldir undir 1500 px** (`@media (max-width:1500px){ #camToggle{ display:none } }`) — þ.e. á 1440 og 1280. Leiðsögnin skref 2 lýsir þeim samt, og kastljósið bendir á tómt svæði. | Setja þá þrjá inn í „Skoða“-valmyndina þegar þeir passa ekki í stikuna; leiðsögnin vísar á „Skoða“. | Mikilvægt | S |
| 6 | **Efni-valmyndin í ritlinum vantar Höldur og Skúffukerfi** (bara Skrokkur, Framhlið, Borðplata). Til að skipta um höldu þarf að fara „← Til baka“ í gegnum efnisskrefin. | Bæta Höldur (+ lit) og Skúffukerfi við Efni-valmyndina, sama röð og efnisskrefin. | Mikilvægt | M |
| 7 | **Forfyllta eldhúsið vantar úthliðar** → „Klárt“ spyr strax „Það vantar úthliðar á 5 stöðum“. „Já, bæta við“ hendir manni beint í næsta rými án þess að sýna úthliðarnar. | `seedKitchenRun` setji úthliðar sjálft (eins og þvottahús/bað gera); ef spurt er: vera áfram í rýminu eina sekúndu og sýna þær. | Mikilvægt | S |
| 8 | **Tungumálaskipti endurhlaða og henda á upphafssíðuna** (var á Senda inn). Á ensku eru rýmisnöfnin áfram á íslensku („Eldhús“, „Þvottahús“), „1 pcs“, og bæði „In English“ og „Á íslensku“ sjást í Hjálp. | Muna `state.step` yfir endurhleðslu (eða skipta án endurhleðslu); þýða sjálfgefin rýmisnöfn ef viðskiptavinur hefur ekki breytt þeim; fela núverandi tungumál. | Mikilvægt | S |
| 9 | **Upphafssíðan lofar „…vörulista og verð“** — verð birtist hvergi (verðáætlun er í bið, sjá minnisatriði). | Taka „og verð“ út (eða „og tilboð frá söluaðila“) þar til verðáætlunin kemur. | Mikilvægt | S |
| 10 | **Innihurðir: „Vista hurðina“ er grár án skýringar** þar til Mál er slegið inn; reitirnir sýna „50–250“ / „150–300“ / „5–40“ sem placeholder sem lítur út eins og gildi. | Lína undir hnappnum: „Sláðu inn málin í skrefi 2“ + opna skref 2 sjálfkrafa; placeholder „t.d. 82“ og bilið í hjálpartexta. | Mikilvægt | S |

---

## Upphafssíða (val á rýmum)

- **80 px tómt bil milli fyrirsagnar og „10–15 mínútur“, en inngangstextinn límist við „Hvaða rými viltu hanna?“** → jafna bilið: minna efst, 16–20 px fyrir ofan spurninguna. · Fínpússun · S
- **Tvær stórar fyrirsagnir keppa** („Hannaðu heimilið þitt“ og „Hvaða rými viltu hanna?“ nánast jafn stórar) → minnka H2 eða sameina. · Fínpússun · S
- **Spjöldin eru misjafnlega há** (efri röð 146 px, neðri 129 px) → fast `min-height` á öll sex. · Fínpússun · S
- **„Aðeins rými“ lýsingin endar á „…“** („Án innréttingar — stofa, gangur …“) → „Stofa, gangur eða annað rými án innréttingar“ eða stytta. · Fínpússun · S
- **Með vistuð drög sjást rýmin sem eru þegar í verkefninu ekki** — aðeins Innihurðir fá „Á listanum“; ef smellt er á Eldhús verður til annað eldhús („Bæta við og byrja →“). → Merkja öll rými sem eru í verkefninu („Í verkefninu · 1“) svo ekki komi óvart tvöfalt. · Mikilvægt · S
- „Byrja upp á nýtt“ (bæði hér og í Hjálp) notar innbyggðan `confirm()` vafrans → eigin staðfestingarglugga í Studio-stíl. · Fínpússun · S

## Rýmin þín (yfirlit verkefnisins)

- **„← Til baka“ á Rýmin þín fer á upphafssíðuna** — líka ef maður kom þangað úr miðju Eldhúsi með „Rýmin þín“-hnappnum. → Til baka = þaðan sem maður kom (eða fela Til baka hér; Rýmin er „heimastöðin“). · Mikilvægt · S
- **„Áfram“ með ókláruð rými: viðvörunarboxið endurtekur Hanna/Fjarlægja fyrir hvert einasta rými og minnkar spjöldin** (myndirnar styttast — stýringar hreyfast). → Ein lína („3 rými eru tóm — kláraðu þau eða fjarlægðu“) og merkja tómu spjöldin sjálf; ekki breyta stærð spjaldanna. · Mikilvægt · S
- **„Aðeins rými“ telst „Ekkert komið í Stofa“** í þeirri viðvörun, þó það eigi aldrei að fá innréttingu. → Telja Aðeins rými sem tilbúið þegar lögunin er komin. · Mikilvægt · S
- **Gönguröðin passar ekki við spjaldaröðina**: spjöldin sýna Stofu á undan Innihurðum, en gangan fór Hurðir → Stofa. → Sama röð á báðum stöðum. · Fínpússun · S
- **Fjöldi talinn á tvo vegu**: spjald „Eldhús · 15 einingar“ (10 skápar + 5 úthliðar), Senda inn „19 skápar“ og „10 skápar, 5 úthliðar“. → Alls staðar „10 skápar“ (úthliðar ekki taldar sem einingar). · Fínpússun · S
- **Ekki augljóst að hægt sé að endurnefna** (nafnið er `<input>` en lítur út eins og texti) og **engin leið til að endurraða** rýmum. → Lítill blýantur við nafn; endurröðun má bíða. · Fínpússun · S
- Þvottahúss-myndin á spjaldinu er pínulítil inni í rammanum; Fataskápsmyndin klippt til vinstri → ramma `unitsShot` þétt utan um einingarnar. · Fínpússun · S
- „Fjarlægt: Stofa · Afturkalla“ hverfur eftir 6 s → 10 s fyrir hæga notendur. · Fínpússun · S

## Eldhús

- **Mál-síðan (L-laga / Með innskoti): teikniflöturinn er 37 px of hár** (`shape-canvas` endar á 937 í 900 glugga) — neðri rammi klipptur; sama á Gluggar-og-hurðir síðunni. → `max-height: 100%` / flex-min-height á `.shape-canvas-wrap`. · Fínpússun · S
- **Plan-teikningin merkir rýmið „Rými“**, ekki „Eldhús“ (sama í Fataskáp: „Rými“ þó „Fataherbergi“ sé valið) → nota nafn rýmisins. · Fínpússun · S
- **Sjálfgefið L-eldhús er 5,6 × 5,3 m (26,5 m²)** — stærra en flest íslensk eldhús. → Byrja nær 4 × 3,5 m. · Fínpússun · S
- **Gluggar og hurðir: þrjár „áfram“-leiðir** (Áfram →, Næsti veggur →, „Veggur 2 →“ í teikningunni). Amma ýtir á Áfram og sleppir veggjum 2–6. → Áfram fer á næsta vegg þar til síðasti veggur er búinn (eða fela Næsti veggur og láta Áfram sjá um það). · Mikilvægt · S
- **Gluggareitir án eininga** („Frá vinstra horni / Breidd / Hæð / Frá gólfi“ — ekkert „cm“) → bæta „cm“ við hvern reit. · Fínpússun · S
- **Efni → Borðplata: „Valið: Premium White“ en valda flísin sést ekki** (fyrstu flísarnar eru Black Ambiance o.s.frv.; þarf að skrolla). → Valin flís fremst eða skrolla henni sjálfkrafa í sýn. · Mikilvægt · S
- **„Veldu skrokkalit“ / „1. Skrokkur“** er fagmál → „Litur innan í skápum“ sem titill, „Skrokkur“ í smáu. · Fínpússun · S
- **Ný eining: stillingin segir „Hæð upp að borðplötu 90 cm“ en merkið eftir innsetningu segir „60 × 80 × 60 cm“** → sýna sömu tölu (90) eða „B × H × D“ með skýringu. · Fínpússun · S
- **Ofanmynd: merkimiðar „Sk5 · 60“ / „Sk9 · 60“ skarast** (neðri og efri skápar ofan á hvor öðrum), stærri en kassarnir, og „Sk10“ er fagmál; „Veggur 2“ skarast við „168 cm“ og „Veggur 3“. → Bara breidd („60“) í kassanum, efri skápar í öðrum lit/línu, veggjaheiti utan á málalínu. · Mikilvægt · M
- **2D: Alpine White framhliðar á vegg 5 sýnast gráar** (á vegg 1 eru þær hvítar) → jafna lýsingu í 2D-sýn svo litur = valinn litur. · Fínpússun · M
- **Efni-valmynd í ritli: borðplötur bera kóða** („Black Ambiance Granite · F128“) → fela F-kóðann fyrir viðskiptavin. · Fínpússun · S

## Fataskápur

- **„Í hvaða herbergi?“ hér en „Hvaða rými er þetta?“ í Baði/Aðeins rými** → sama orðalag alls staðar. · Fínpússun · S
- **„Allt rýmið“ + „Fylla vegginn með skápum?“ segir ekki hvaða vegg** (4 veggir; fyllti vegg 1) → „Fylla vegg 1 (360 cm)?“ + veggurinn lýstur upp. · Mikilvægt · S
- **„Sömu efni og í Eldhús?“** — rangt fall → „…og í eldhúsinu?“ (eða „Sömu efni og í Eldhúsi?“). Sama setning í Baði og Þvottahúsi. · Fínpússun · S
- „Já, sömu“ sleppir öllu efnisskrefinu (líka stærð/dýpt sem titillinn „Stærð og litur“ lofar) → athuga hvort dýpt/hæð þurfi samt að koma, annars breyta titlinum. · Mikilvægt · S
- Hexxa-haldan teiknast sem ein gyllt lóðrétt rönd í fullri hæð á hverjum tvöföldum skáp (bara á annarri hurðinni) → athuga hvort það sé rétt líkan fyrir háa skápa. · Fínpússun · S

## Baðherbergi

- **Flipanöfn ólík Eldhúsi**: „1. Litur … 4. Toppur og vaskur“ en á Senda inn heitir það „Borðplata“ → nota „Toppur“ líka í samantekt baðsins. · Fínpússun · S
- „Hvaða rými er þetta?“ listinn byrjar á Fataherbergi/Hjónaherbergi fyrir baðherbergi (sjálfgefið rétt, „Baðherbergi“) → baðtengd rými efst. · Fínpússun · S
- Gott: vaskaskápur forfylltur á réttum stað, spegilskápur sem skýr valkostur.

## Þvottahús

- **Horn: myndavélin klippir vélaturninn** (hægri hlið og málmerki veggs 2 utan myndar) → ramma 3D-sýn utan um allar einingar við fyrstu opnun. · Mikilvægt · S
- **Óvarin hlið vélaturnsins sýnir dökka skrokklitinn** (framhliðar hvítar) → úthlið á enda turnsins þegar hann stendur frjáls, eða ganga úr skugga um að `syncBathPanels` nái honum. · Mikilvægt · S
- „Sömu efni og í Eldhús?“ býður bara Eldhús, ekki síðasta rýmið (ég var nýbúinn að velja ný efni í Baði) → bjóða síðast notaða eða velja á milli. · Fínpússun · S
- „Er gluggi eða hurð á veggnum?“ í eintölu þó Horn hafi 2 veggi → „…á veggjunum?“. · Fínpússun · S

## Innihurðir

- **Engin skilaboð sjást þegar Áfram er ýtt án rýmis** (í kóðanum er toast „Veldu rými fyrir Hurð 1“, en hann birtist neðst og hverfur á 2,4 s; reiturinn fær bara bláa umgjörð). → Rauður texti við reitinn sjálfan. · Mikilvægt · S
- **Rýmisvalið sýnir sömu nöfnin tvisvar** (Eldhús, Baðherbergi, Þvottahús, Stofa bæði undir „Rýmin þín“ og „Önnur rými“) og „Fataskápur“ sem herbergi → taka verkefnisrýmin úr „Önnur rými“; nota herbergi fataskápsins („Fataherbergi“) í stað „Fataskápur“. · Mikilvægt · S
- Hægt er að hanna hurð áður en rými er valið, þrátt fyrir textann „Veldu rými … og smelltu á Hanna“ → annaðhvort leyfa (og breyta textanum) eða spyrja um rými í glugganum. · Fínpússun · S
- Hurðasíðan hefur engan stepper (Rými/Efni/Skipulag) og mjög mikið tómt pláss → lítill haus „Innihurðir · 1 hurð“ og hurðin stærri. · Fínpússun · S
- Innihurðir vantar í myndaröðina á Senda inn (bara Eldhús, Fataskápur, Bað, Þvottahús) → bæta hurðarmyndinni við. · Fínpússun · S

## Aðeins rými (Stofa)

- (sjá #3 — ekkert forval, Áfram hljótt)
- Titillinn verður „Hannaðu heimilið þitt“ inni í Stofu → „Hannaðu stofuna“ (eða nafn rýmisins). · Fínpússun · S
- Stepperinn sýnir „Efni“ og „Skipulag“ fyrir rými sem fær enga innréttingu → fela þau skref fyrir Aðeins rými. · Fínpússun · S

## Ritill (sameiginlegt)

- (sjá #2, #5, #6)
- Afturkalla/Endurgera virkar rétt (10 → 9 → 10 einingar). Undo í stikunni er á sínum stað.
- Valmyndirnar (Efni 648 px, Gluggar 596 px) skrolla rétt inni í sér á 1280×720.
- „Hjálp“ hefur „Sýna leiðsögnina“ aðeins í ritlinum; annars bara Tilkynna vandamál / Byrja upp á nýtt / In English. **Ekkert símanúmer eða „Hafa samband“** fyrir þann sem festist. → Bæta „Hringdu í okkur · 5xx xxxx“ efst í Hjálp. · Mikilvægt · S

## Spurningar

- Virkar, allt valfrjálst, passar á skjá. „Hjálpar söluaðila…“ — „söluaðili“ hljómar eins og milliliður → „Hjálpar okkur að…“. · Fínpússun · S
- „Hvenær væri best að fá innréttinguna afhenta?“ — verkefnið er líka hurðir/rými → „…fá verkið afhent?“. · Fínpússun · S

## Senda inn

- (sjá #1, #4)
- Passar á 1440×900 og 1280×720 (samantekt skrollar inni í dálknum). Ekki ýtt á Senda.
- Samantektin „Það sem þú pantar“ er löng og þétt; „Skipulagið þitt · 19 skápar“ → gott væri að hvert rými væri samanbrjótanlegt með mynd. · Fínpússun · M

## Endurhleðsla / drög

- Endurhleðsla í miðju Eldhúsi → upphafssíða → „Halda áfram →“ fer beint aftur í Eldhús-ritilinn. Virkar.
- **Eftir að Stofa var fjarlægð og tungumáli skipt stóð `activeCategory = null` eftir** — það er það sem #1 lendir í. Gott að laga #1 og bæta við vörn: ef ritill opnast án virks rýmis í heimilisham → opna Rýmin þín.

## 1280×720

- Allar síður passa nema: **Mál-síðan með „Með innskoti“ (8 veggir)** — listinn skrollar inni í hliðarspjaldinu en það sést ekki að hann haldi áfram (veggir 6–8 neðan við) → skuggi/„fleiri veggir ↓“ neðst. · Fínpússun · S
- Lofthæð og útlit: gólfefnaröðin endar 23 px neðan við skjáinn (inni í skrollandi spjaldi) → þjappa bilum á `max-height:760px`. · Fínpússun · S
