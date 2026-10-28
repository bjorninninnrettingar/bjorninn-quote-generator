# Scan 2026-10-28: vantar enn í keðjunni "unnið -> skipulag -> verkstæði -> afhending"

Aðferð: B3 í scratch/morgun-verkstaedi.md lesið á móti kóðanum (grep, ekki commit-skilaboð). Ekkert skrifað í Airtable eða kóða.

## A) Staða B3 (14 atriði)

| B3 | Staða | Sönnun |
|---|---|---|
| 1 Klárt-hlið + "4. Verkfundur" | DONE (viðvörun, ekki lás) | ferli.html:672-712 (CHECKLIST hefur 4. Verkfundur; confirmKlart listar opin atriði, rautt fyrir 5/6); notað á 2 stöðum: ferli.html:528 (drag) og :827 (hnappur) |
| 2 Kveikja á 2 chat-automations | SUPERSEDED | api/virkni.js sendir chat sjálft; ferli.html:715 notifyKlart, skrifstofa.html:1303, app.html:1761, cnc.html:739, pontun.html:290 |
| 3 Virkni-logg lagfæring | PARTIAL: skrifta skrifuð, ekki staðfest sett upp | virkni-logg-automation.js (trigger-gildi, ein automation). Eigandi þarf að líma og slökkva á gömlu 3 |
| 4 Efni samstillt | DONE að mestu | pontun.html:334-362 syncEfni (allt "Komið í hús" -> hakar 5.); "Pantað utan kerfis" pontun.html:397/445; sía lagað (onlyProject framleidsla.html:141, ferli.html:345) |
| 5 Athugasemdir gólfs | PARTIAL | verk.html:578-583 og fraesing.html:256-258 sýna; /velja og /eining sýna ekkert |
| 6 Tilkynningar v1 | DONE | api/virkni.js, virkni-bell.js, bjalla í skrifstofa + app |
| 7 Morgunyfirlit | DONE | api/morgunyfirlit.js + vercel.json:189 |
| 8 Formúla "Framleiðslustaða skv. gögnum" | MISSING (Airtable, eigandi) | engin merki um breytingu; verk.html:873 vísar enn í formúluna |
| 9 Má afhenda chattexti + bókaður tími í /verk | MISSING | verk.html hefur engan afhendingartíma/dagsetningu; verk-status.js:80 skrifar bara bjöllulínu; chat-texti er í Airtable-automation (óbreytt) |
| 10 "Senda aftur í forskipulag" + Skúffusamantekt hnappar | MISSING | grep: enginn hnappur í ferli.html; verk.html:1102 sýnir bara texta; "til_baka" tegund til í virkni.js:22 en ekkert skrifar hana |
| 11 Auka-pöntunarlisti búinn til í /pontun | MISSING | pontun.html:129-130/304 les bara, engin "ný" aðgerð |
| 12 Breyta Eyðublaði / Pöntunarlínu / Tilbúið 🔒 | PARTIAL | Tilbúið 🔒 á Sögunarlista-línum ferli.html:1069; Eyðublað- og Pöntunarlínu-breytingar vantar |
| 13 Forgangur 🥇 í /framleidsla | MISSING | framleidsla.html:165/187/233 les aðeins |
| 14 Eyða LOKA PRENT 5.0 | MISSING (Airtable, eigandi) | óstaðfest |

## B) Eftirstandandi göt (hámark 25 raðir)

Alvarleiki: P0 röng gögn/týnd vinna, P1 þvingar í Airtable, P2 snyrting. "Airtable-skrifta?" = eigandi þarf að líma Find/Replace.

| id | Gat | Sönnun | Alv. | Lagfæring | Stærð | Skrár | Airtable-skrifta? |
|---|---|---|---|---|---|---|---|
| G1 | "6. CNC yfirfarið" hakast um leið og ein skrá er skrifuð, líka þegar ⛔ (þarf að forrita í höndunum) eða ⚠ eru til staðar. Klárt-hliðið sér því grænt þar sem vantar | cnc.html:730-735 (`if (made.length)`) | P0 | Haka aðeins þegar missing.length == 0; annars sýna "CNC að hluta" og láta chat-línu segja það (sú er til: cnc.html:741) | S | cnc.html (þar með /smida sem notar sama writer) | Nei |
| G2 | Klárt-hlið er aðeins viðvörun og aðeins í /ferli. Ekkert annað kemur í veg fyrir/skráir bein PATCH á Staða í skipulagi; ekkert server-side hlið | ferli.html:686-712 ("Merkja samt"); api/airtable.js leyfir PATCH | P1 | Færa Klárt í api/verk-status-líka aðgerð (`action:"klart"`) sem les gátlista + skráir hvað var opið í Virkni; ferli kallar þangað | M | api/verk-status.js, ferli.html | Nei |
| G3 | "Framleiðslustaða skv. gögnum" telur gamla Verktíma sem "byrjað": verk fara beint Klárt -> Í vinnslu, "Tilbúið" dálkur tómur, F2-póstur færi út á röngum tíma | morgun B2.1; verk.html:873 treystir á hana | P0 | Formúlan telur aðeins Verktíma eftir "Upphafs framleiðsludagur" (eða bara sögun/fræsingu) | S | Airtable formúla | JÁ (formúla; eigandi) |
| G4 | Virkni-logg race lagfæring er bara til sem skrá í repo; ekki staðfest að gömlu 3 séu slökktar og ný límd | virkni-logg-automation.js | P0 (tvítekningar/týnd skref á bjöllu) | Eigandi: líma, kveikja, slökkva á 3 gömlum | S | Airtable | JÁ (líma skriftuna; Find/Replace-snið fyrir uppsetningu) |
| G5 | Staka-staða "Komið í hús" í fellilista skrifar enga Virkni-línu (aðeins "Allt komið" hnappurinn gerir það). Fólk sem breytir einni pöntun í einu lætur gólfið aldrei vita | pontun.html:438-443 vs :290 | P1 | Kalla á sama notify þegar syncEfni hakar 5. í fyrsta sinn (efniLanded false->true) | S | pontun.html | Nei |
| G6 | Sama: hak á "5. Efni lent" í /skrifstofa (842) og /ferli skrifar ekkert efni-línu / sendir ekkert; aðeins pontun gerir | skrifstofa.html:842 | P1 | Ein hjálparfall (notify efni) í office-shell.js, kallað úr öllum þremur | S | office-shell.js, skrifstofa.html, ferli.html | Nei |
| G7 | Pöntun "Sent" án tölvupósts (utan kerfis) er engin "pantað" kvittun á birgi/dagsetning: staða lýgur ekki lengur en engin áætluð komudagur, enginn "efni seint" viðvörun nema 5 daga reglan | pontun.html:445-455; morgunyfirlit.js (efni aðeins ef upphaf <=5 d) | P1 | Reitur "Væntanlegt" á Pantaðir listar (dagsetning) + morgunyfirlit flaggar Sent og komudagur liðinn | M | pontun.html, api/morgunyfirlit.js, api/airtable.js allowlist | Nei (reitur búinn til gegnum MCP/eigandi) |
| G8 | Auka-pöntunarlisti (gleymt efni) aðeins búinn til í Airtable-formi | pontun.html:129-130, 304-309 les aðeins | P1 | "+ Auka-pöntun" form (birgir, lína, magn) -> POST Auka (tblHGYgrvvDqyKOAe) + línur; þarf CREATABLE_FIELDS | M | pontun.html, api/airtable.js | Nei (prent-automation 07.08. er þegar notuð) |
| G9 | Breyta Eyðublaði (mál/frontar/magn) og Pöntunarlínu (magn/birgir) aðeins í Airtable; stærsta ástæða þess að Airtable er opið | ferli.html (engin PATCH á Eyðublað nema Yfirfara 3.0 toggle :944) | P1 | Inline edit á Eyðublaði í unit-modal + "Endurreikna" (Yfirfara 3.0 toggle er til) | L | ferli.html, api/airtable.js WRITABLE_FIELDS | Nei |
| G10 | "Senda aftur í forskipulag" (+ ástæða) aðeins Airtable-hnappur | grep: enginn hnappur; virkni.js:22 `til_baka` ónotað | P1 | Hnappur í /ferli (PATCH Staða í skipulagi=For-skipulag + ástæða í Virkni, chat til Skrifstofu) | S | ferli.html | Nei, nema núverandi hnappur hafi hliðaráhrif; athuga list_automations áður en skrifað er (minnisregla) |
| G11 | Skúffusamantekt aðeins Airtable-hnappur; tóm á T-15 | verk.html:1102 sýnir texta, enginn trigger | P1 | Checkbox-trigger úr /ferli (sama mynstur og Keyra skipulag) | S | ferli.html | Líklega JÁ: skipta um trigger á núverandi automation í checkbox (eigandi) |
| G12 | Bókaður afhendingartími/dagsetning ekki sýnd á /verk; Má afhenda hangir án kvittunar til gólfsins | verk.html (engin birting á `Viðskiptavinur sækir þann:` / afhendingardegi); morgunyfirlit flaggar "án bókaðs tíma" en gólfið sér ekkert | P1 | Sýna "Afhending: <dags>" og "Ekki bókað enn" á Má afhenda spjaldinu; Virkni til gólfs þegar tími er bókaður í /dagatal | M | verk.html, dagatal.html, api/virkni.js | Nei |
| G13 | Má afhenda chat-texti (Airtable-automation) vísar í Airtable/dagatal, ekki appið | verk-status.js:79 ("No chat: automation already posts") | P1 | Láta appið senda chat (`chat:true`, tengill /dagatal) og slökkva á Airtable-automation | S | api/verk-status.js | JÁ (slökkva á "💬 Má afhenda" automation; engin skrifta, bara OFF) |
| G14 | Forgangur framleiðslu 🥇 aðeins valinn í /dagatal-drag; tómur á T-15, þannig að röðun í /framleidsla (prioRank) er gagnslaus | framleidsla.html:165,187,233 | P2 | Select í verkspjaldi á /framleidsla (PATCH) | S | framleidsla.html, api/airtable.js WRITABLE_FIELDS | Nei |
| G15 | /velja (skanni á gólfi) og /eining sýna ekki Fræsari/Hafa í huga/Uppsetning athugasemdir; fræsari skannar hlut og sér ekkert | grep: engin 🔬📌 í velja.html/eining.html | P1 | Sýna sömu note() á "Merkja fræst" spjaldi (aðeins ef reitur ekki tómur) | S | velja.html, api/v.js (fields) | Nei |
| G16 | Hlið vantar fyrir "Má afhenda": verk-status leyfir Tilbúið -> Má afhenda beint (hoppar yfir Í vinnslu) án þess að sögun/fræsing séu skráð | api/verk-status.js:32-34 | P0 (afhending án framleiðslu skráðrar) | Krefjast Framvinda >= 95% eða skýrs `force` með ástæðu sem fer í Virkni | S | api/verk-status.js, verk.html | Nei |
| G17 | Morgunyfirlit flaggar ekki Klárt-verk með 6. CNC / 5. Efni óhakað eftir að framleiðsla hófst, né pantanir sem hanga "Í undirbúningi" > 2 daga eftir Klárt | morgunyfirlit.js:4-6 (aðeins efni <=5 d fyrir upphaf) | P1 | Tveir nýir flokkar í yfirlitinu | S | api/morgunyfirlit.js (+ test) | Nei |
| G18 | Stöðubreytingar utan appsins (Airtable beint, automations) hafa enga Virkni nema Virkni-logg skriftan (G4); engin tengsl við Chat-webhook-afrit í 6+ skriftum | morgun B2.6 | P2 | Hætta að afrita webhook; láta allt fara um /api/virkni | M | Airtable skriftur | JÁ |
| G19 | "Verk ósnert >5 dagar" sýnir 100+ daga gömul verk; "Næstu afhendingar" sýnir liðnar dagsetningar | ferli.html:248,395,411 | P2 | Hámark 60 daga / merkja "í seinkun" rautt; fela Afhent | S | ferli.html | Nei |
| G20 | "6. CNC" PATCH úr cnc.html er sendur án lykils (keyless PATCH á Tækifæri), og villa er gleypt (`.catch(function(){})`): hakið getur týnst án vitundar | cnc.html:731-735 | P1 | Senda `k`, sýna rauða línu ef PATCH mistekst | S | cnc.html | Nei |
| G21 | Pantað-staða: "Sent" án pósts og "Í undirbúningi" blandast; gólf (/verk) sýnir "Í undirbúningi x3" þótt efni sé komið ef eingöngu var hakað í Tækifæri-reit | morgun B2.3; verk.html pöntunarsvæði | P1 | Ef 5. Efni lent er hakað og pantanir ekki: sýna "Efni merkt komið (handvirkt)" frekar en hrá stöðu | S | verk.html, framleidsla.html:275 | Nei |
| G22 | Engin áminning þegar Má afhenda hefur hangið > 3 daga (T-56/T-80) | morgun B1 lína 16/17 | P2 | Bæta við morgunyfirlit: Má afhenda lengur en 3 d | S | api/morgunyfirlit.js | Nei |
| G23 | Gátlisti atriði 3 "Teikningar prentaðar 2x" og 4 "Verkfundur" eru handhök án merkis hver hakaði/hvenær | ferli.html:672-680 | P2 | Skrá Virkni-línu við hak (hver, hvenær) | S | ferli.html | Nei |
| G24 | LOKA PRENT Skipulag 5.0 og aðrir dauðir hnappar enn í Airtable | morgun B3 #14 | P2 | Eyða | S | Airtable | JÁ (UI, engin skrifta) |
| G25 | Tests vantar fyrir nýju hliðin/synk (syncEfni, confirmKlart rökin, morgunyfirlit er prófað en ekki hlið) | tests/ (virkni.test.js til) | P2 | Draga rökin í hreinar föll og prófa | M | tests/ | Nei |

## C) Skriftubreytingar sem eigandi þarf (verða að vera Find/Replace)

G3 (formúla), G4 (líma virkni-logg-automation.js), G11 (skipta um trigger), G13 (slökkva á automation), G18, G24. Ekkert af þessu skrifað hér. Samkvæmt minnisreglu: kanna list_automations áður en nokkur stöðureitur er skrifaður í prófun.
