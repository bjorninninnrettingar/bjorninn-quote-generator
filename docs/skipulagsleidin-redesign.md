# Skipulagsleiðin — endurhönnun á /ferli verkasíðunni (tillaga 2026-10-29, ekkert smíðað)

Markmið (eigandi): þetta er mikilvægasta síðan — **verk fer út í heilu lagi, án vesens**. Flæðið er ein lína, hvert skref tekur þá hæð sem það þarf (fullscreen, skrun milli skrefa), **næsta skref er ekki aðgengilegt fyrr en það fyrra er raunverulega búið** (mælt á gögnum, ekki smelli), pöntunarlistinn sést ekki fyrr en allt er skipulagt, og öll verkfæri (hönnuður, Cutty, Æðar, Smíða) eru innbyggð svo enginn hoppar milli síðna.

## Hvað er til í dag (skoðað)
- Stig í Airtable (`Staða í skipulagi`): For-skipulag → Í skipulagningu → Yfirfara → Klárt til framleiðslu. **Aðeins „Keyra skipulag“ (→ Í skipulagningu) og „Merkja Klárt“ færa stöðuna í sjálfvirkni/forritinu; ekkert færir verk úr „Í skipulagningu“ í „Yfirfara“** — það er handvirkt. „Klárt“ ræsir raunveruleg áhrif: Konto drög að greiðslu 2, spjall til gólfsins, `Staða í framleiðslu = Tilbúið til framleiðslu` (sjálfvirkni sem ég las í Airtable).
- Verkasíðan sýnir 4 spjöld hlið við hlið í röðinni 1 Forskipulag, 2 Skipulag, 3 Loka yfirferð, 4 Pöntunarlisti. Pöntunarlistinn er þó í raun **eftir** „Klárt“ (borðið sýnir hann sem fimmta dálk fyrir verk með opna pöntun), og „Klárt“-hliðið krefst „Efni lent í húsi“ — sem getur ekki orðið satt fyrr en pantað er. Hringrás sem er leyst með „Merkja samt Klárt“.
- Hver sjálfvirkni er ræst með hak sem er sett á false og svo true (`🔄 Keyra …`) — **viðmótið veit aldrei hvort hún tókst** („Sent kl. 14:32“ og búið).

## Flæðið (5 skref, læst í röð)
Rail efst (alltaf sýnilegt): `1 Forskipulag · 2 Einingar · 3 Loka yfirferð · 4 Pöntun · 5 Klárt`. Læst skref sýnir **nákvæmlega hvað vantar** („Opnast þegar 3 einingar eru yfirfarnar: Sk4, Sk8, Sk12 →“) og hver lína er smellanleg. Skrunið snappar milli skrefa; stöðuna rekur raunveruleg gögn.

### 1 · Forskipulag
Nú: hlekkur á hönnuðinn + „Keyra skipulag“ (engin forprófun, engin niðurstaða).
Nýtt:
- **PRO innbyggt** (`/skipuleggja?pro=<id>&embedded=1`, sama og pro.html) — svar við spurningunni: **já**, PRO styður þetta nú þegar (`EMBEDDED`). Smávægilegar breytingar án þess að yfirgefa síðuna.
- „Klár til framleiðslu“ í PRO = vista + Keyra skipulag (núverandi hegðun, Yfirferð-listinn eins og hann er).
- Forprófun á síðunni: Line Items með `Skipulagsvillur`, ótengdar línur, skápar án vöru — **áður** en skipulag er keyrt.
- Eftir keyrslu: lifandi teljari „9 af 12 línur orðnar að einingum“ (les Eyðublöð). Læsingin sem PRO setur eftir keyrslu (skoðunarhamur, „Opna til breytinga“) helst — breyting eftir á þarf samstillingu (sjá Forsendur).
- **Gátt í skref 2:** allar gildar Line Items hafa Eyðublað og engin villa.

### 2 · Einingar (sá hluti sem grípur mistök fyrst)
Nú: listi af einingum í tilviljanakenndri röð; smellt á einingu opnar glugga með flipum Kassi / Skúffur-hillur / Sögunarlisti / Pöntun og „Samþykkja einingu“; flögg (`Skúffur stemma ekki ⚠️`, `Vantar hluta ⚠️`) sjást aðeins inni í glugganum; samþykkt er hak sem enginn staðfestir.
Nýtt — **ein eining á skjá, allt í einu (engir flipar):**
1. **Vandamál efst** (rautt/gult): öll flögg einingarinnar í einni línu með „Laga →“ sem opnar nákvæmlega rétt stað (PRO Smíða fyrir þann Sk-númer, Eyðublaðið, efnisval).
2. Fjórir hlutar lóðrétt: **Kassi** (teikning, mál borin saman við Smíðagögn) · **Skúffur/hillur** (tafla úr Eyðublaði vs Smíðagögn, ósamræmi litað) · **Sögunarlisti** (hlutar, þykkt, efni fannst/fannst ekki, „Tilbúið 🔒“) · **Pöntun einingar** (Vörur á einingu með verði, `⛔ Villa`).
3. Biðröð til vinstri raðað eftir Sk-númeri með stöðu (óyfirfarin / vandamál / yfirfarin). „Yfirfarin → næsta“ **bíður eftir** að sjálfvirknin skili (`Yfirfarin` = satt og flögg horfin) og sýnir niðurstöðuna; ef flögg eru eftir er hnappurinn læstur (undanþága aðeins með skráðri ástæðu).
4. Lokayfirlit skrefsins: fjöldi eininga = fjöldi lína, hlutar í Sögunarlista, línur í Pöntun á einingu.
- **Gátt í skref 3:** allar einingar yfirfarnar, engin flögg. Þá (og aðeins þá) setur síðan `Staða í skipulagi = Yfirfara` (í dag handvirkt).

### 3 · Loka yfirferð (100 % fullscreen vinnusvæði)
Nú: Dagatal + þrjár raðir (Cutty / Æðar / Smíða) með litlum iframe-um sem má sleppa + gátlisti sem hægt er að haka án þess að hafa gert neitt.
Nýtt — undirskref, hvert fullscreen með mjóri stiku „3b af 5 · Cutty · ← Til baka · Næst: Æðar → (grátt)“:
- **3a Dagatal** (dagsetningar með staðfestingu, sjá núverandi villuvarnir) · **3b Cutty** (klárt = `Skurðarskrá` skráð á Sögunarlista) · **3c Æðar/F2** (klárt = áætlun staðfest, eða „ekki þörf“ ef engar æðar) · **3d Smíða & CNC** (klárt = `6. CNC yfirfarið`) · **3e .bpp skoðun** (valfrjáls) · **3f Yfirlit**: allt sem hægt er að lesa úr gögnum er grænt sjálfkrafa; aðeins „Teikningar prentaðar“ og „Verkfundur“ eru handvirk.
- Verkfærin keyra innbyggð (cutlist/grain/smida styðja `embedded=1`), engin síðuskipti.

### 4 · Pöntun (sést fyrst hér)
Nú: tenglar og stöðulína; `/pontun` sýnir pantanir en **ekkert verð**.
Nýtt:
- **4a Búa til pöntunarlista** (full útgáfa) með niðurstöðu og prófum: „Pöntunarlisti stemmir“ %, línur án birgja/verðs, einingafjöldi vs skref 2.
- **4b Yfirfara — kostnaður í fyrirrúmi:** spjald á birgja (línur, magn, einingaverð `Einingaverð 🔍`, samtals), heildarinnkaup, **innkaup vs tilboð** (hlutfall/framlegð), plötunýting/afgangur, afhendingartími birgja, línur með 0 kr rauðar, PDF-forsýn.
- **4c Senda** á birgja (hver pöntun staðfest, „Sent kl.“ staðfest með lestri) eða „Pantað utan kerfis“.
- **Gátt í skref 5:** allar pantanir sendar/skráðar og pöntunarlisti stemmir.

### 5 · Klárt til framleiðslu
Núverandi hlið (gátlisti + vélrituð staðfesting „KLÁRT“) verður **skref**, með yfirliti: einingar, afhendingardagur, pantanir og — skýrt skrifað — hvað gerist (Konto drög að greiðslu 2, spjall, `Tilbúið til framleiðslu`). Ekkert annað hlið en þetta.

## Hvað þarf að staðfesta/ákveða áður en smíðað er
1. **„Efni lent í húsi“ vs. Klárt:** ég legg til að Klárt krefjist *pantað + áætluð koma skráð*, ekki að efni sé komið (það færist í Framleiðsla-„Undirbúningur“). Annars verður hringrásin eftir.
2. **Hver færir „Í skipulagningu → Yfirfara“?** Tillaga: síðan, þegar skref 2 er grænt (þarf að staðfesta að proxy leyfi PATCH á reitinn fyrir þessi gildi — í dag er Klárt skrifað þannig).
3. **Samstilling eftir breytingu í hönnuði** þegar Eyðublöð eru til: Samstilla-sjálfvirknin / ný sameinuð skripta (óútgefin, sjá CLAUDE.md 2026-09-27). Án hennar er PRO læst eftir keyrslu.
4. **Fullscreen:** fela hliðarstikuna á meðan Skipulagsleiðin er opin (eins og `/smida`)? Mín tillaga: já, með „← Öll verk“.
5. **Verð í Pöntun:** staðfesta að `Einingaverð 🔍`, `Áætlaður kostnaður`, `Raunkostnaður` séu læsileg í gegnum proxy með lykli (þau eru á VERK_ONLY lista) og að birgjatími sé til.

## Röð smíði (hvert skref má fara í loftið eitt og sér)
A. Rammi: fullscreen snap-skrun, rail, læsing á raunverulegum merkjum, **Pöntun færð á eftir Loka yfirferð** (engin ný sjálfvirkni). B. Einingar-yfirferð. C. Loka yfirferð vinnusvæði. D. Pöntun + kostnaður. E. PRO innbyggt í Forskipulag + forprófun. F. Klárt sem skref.

## Aukaatriði
- **Hamar** í stað blýants fyrir Framleiðslu — gert (`office-shell.js`, icon `shop`).
- **Chatbot á /skrifstofa:** raunhæft og ekki galið. `api/chat.js` + `chat-widget.js` (Studio-chatinn) eru þegar til; bæta við ham `skrifstofa` sem þekkir síðukortið og hlekki (`/ferli?recordId=`, `/framleidsla?recordId=` …), og les-verkfæri: leita að verki (T-númer/nafn), „hvar er T-32?“ (staða, afhending, pantanir), „hvar finn ég X“. Aðeins lestur í fyrstu, hlekkir í stað aðgerða, lykill úr innskráningu. Vinnslutími og API-kostnaður þarf að ákveða.

## Staða (2026-10-29)
**Ákvarðanir eiganda:** 1 ok (Klárt = pantað, ekki komið í hús) · 2 ok (síðan færir Í skipulagningu → Yfirfara) · 3 **nei: hliðarstikan er alltaf sýnileg; „fullscreen“ = full breidd innan skjásins, hvert skref í sinni línu, ekki deilt með öðru** · 4 samstilling eftir breytingu í hönnuði bíður (PRO helst læst eftir „Keyra skipulag“).
**Smíðað — A (rammi), /ferli verkasíðan:** sticky raðstika 1–5, fimm skref hvert í fullri breidd, læst skref sýnir hvað vantar (`computeSteps`, merki úr gögnum: Eyðublöð `Yfirfarin` + flögg, gátlistareitir 1/2/3/4/6, Pantaðir listar `Staða` Sent/Komið í hús), „Efni lent í húsi“ farið úr hliðinu, Pöntun á eftir Loka yfirferð (með „Búa til / endurreikna pöntunarlista“ = `🔄 Keyra Pöntunarlista 4.0`), Klárt sem skref 5 (yfirlit + núverandi hlið), síðan færir Í skipulagningu → Yfirfara þegar allar einingar eru yfirfarnar, merki lesin aftur við fókus/30 s/eftir aðgerð, sjálfvirkni ræst → síðan bíður eftir niðurstöðu (`pollSignals`) í stað „Sent kl.“. Ólesanlegt merki telst aldrei sem búið.
**Eftir:** B Einingar-yfirferð (ein eining á skjá, vandamál efst), C Loka yfirferð sem fullscreen undirskref, D Pöntun með kostnaði, E PRO innbyggt í Forskipulag + forprófun.

**Smíðað — B–E (2026-10-29, lásar SLÖKKTIR meðan við skoðum: `LOCKS_ON=false` í ferli.html; kveikt þegar við klárum):**
- **B Einingar:** yfirferðin er inline og í fullri breidd (gamli glugginn fluttur inn í skrefið): biðröð af Sk-flísum (✓ / vandamál / valin), ein eining í einu með 4 hlutum undir hvor öðrum (Kassi · Skúffur-hillur · Sögunarlisti · Pöntun einingar), aukaflögg (engir hlutar, engar vörur, ⛔ vara), „Yfirfarin — næsta →“ er læst þar til allir hlutar/vörur eru hakaðir, bíður eftir niðurstöðu og fer á næstu óyfirfarna.
- **C Loka yfirferð:** undirskref 3a–3f (Dagatal · Cutty · Æðar · Smíða & CNC · .bpp · Yfirlit) hvert í fullri breidd með útskýringu og stöðumerki; verkfærin eru innbyggð og hlaðast þegar skrunað er að þeim; sjálfvirku gátlistaliðirnir eru skrifvarðir (aðeins „Teikningar prentaðar“ og „Verkfundur“ hakar þú í).
- **D Pöntun:** kostnaðaryfirlit (innkaup samtals, tilboð án vsk, innkaup af tilboði %, pantanir sendar, línur án verðs) + spjald á birgja (staða, afhending óskuð, PDF, línutafla með „vantar“ í rauðu). *Óstaðfest:* að `Áætlaður kostnaður` sé m/o vsk og `💰 Tilboðsupphæð` m/vsk (útreikningurinn gerir ráð fyrir því).
- **E Forskipulag:** hönnuðurinn (PRO) innbyggður (`?pro=<id>&embedded=1`, hlaðinn við skrun) + forprófun úr Line Items (`⚠️ Skipulagsvilla`, `Eyðublað búið til ✏️`, `⚠️ Breytt eftir stofnun`).
- **Eftir:** kveikja lásana og prófa á lifandi verki (T-32); samstilling Eyðublaða eftir breytingu í hönnuði (bíður); senda pöntun á birgja héðan (nú í gegnum /pontun).

## 2026-10-29 — review round 1 (owner notes)
- No auto-scroll on load (rail click still scrolls).
- Einingar: Kassi + Sögunarlisti side by side, Pöntun einingar below; "Skúffur og hillur" removed. Sögunarlisti = Airtable-style groups by Efni with Partur/H/B/Þ/M/Tilbúið columns and the Allt/þykkt/Óklárt filters (Óklárt drops a row as soon as it is ticked). Pöntun einingar = table like the Airtable view (Tegund, Vara, Skúffu dýpt, Magn, Mynd, Rétt …; Vörulisti names resolved via RECORD_ID() OR query). "Yfirfarin — næsta →" no longer waits: the unit is marked "…" (inReview) and the poll finishes in the background with a toast.
- Loka yfirferð: tabs removed, every part (3a–3f) folds; finished parts fold by themselves unless opened by hand; lazy iframes load on expand.
- Pöntun: PDF viewed inline (iframe) + "Endurprenta PDF" (/api/pontun-print) per order; all lines grouped by Gerð with Magn editable and "Skipta um vöru" (Vörulisti link search). API: tbloXR7f9Q943O9el writable `Magn` + `Vörulisti 🚪` (key-gated), `Dýpt (mm)` readable. A full recompute rebuilds the lines and overwrites hand edits (warning shown). NOT done: adding a brand-new line, email send (later automation).
