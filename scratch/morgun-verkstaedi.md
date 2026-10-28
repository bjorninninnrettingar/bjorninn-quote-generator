# Morgunskýrsla: samskipti innanhúss + Skipulag → verkstæði

Næturskönnun 2026-10-27. Ekkert var skrifað. Ég las Airtable (automations, keyrslusögu og færslur), kóðann á `main` (59c44cf) og lifandi appið í Browser pane, innskráð sem skrifstofa, án þess að ýta á neitt sem skrifar.

Dæmiverkefni: **T-15 Sólveig Arna (recq9EXEXfHiEETxp)**.

---

## A) Samskipti innanhúss

### A1. Leiðirnar sem fólk notar í dag

Grunnurinn er með **53 automations: 41 kveikt og 12 slökkt**. Þakið er 150.

Google Chat er notað í tveimur rýmum:
- **SKRIFSTOFA**
- **ALMENNT 🐻**

Allir póstarnir eru Airtable-skriftur með webhook-slóð harðkóðaða í skriftunni. Vercel-kóðinn sendir **ekkert** í Chat.

| Leið | Hvað kveikir | Til hvers | Staða |
|---|---|---|---|
| 💬 Má afhenda → Skrifstofu chat | Staða í framleiðslu = Má Afhenda (oft úr `/verk`) | SKRIFSTOFA | ✅ Kveikt. Keyrði 3× á 1 mínútu 23.10. Textinn segir „setjið tímann í **Airtable**“, en það á að vera `/dagatal`. |
| Færir verk → unnið 🏆 | Staða í söluferli | SKRIFSTOFA | ✅ Kveikt |
| Senda verk aftur í forskipulag | Hnappur í Airtable-interface | SKRIFSTOFA (með skilaboðum) | ✅ Kveikt, en **aðeins sem hnappur í Airtable** |
| Konto G1 / G2 / lokagreiðsla / uppgjör | Hnappur, Klárt til framl., Má afhenda, Afhent | Chat (seinni skrifta) | ✅ Kveikt |
| Eftirfylgni 1.0 / 2.0 | 3 / 15 dagar eftir að tilboð var sent | Chat | ✅ Kveikt |
| Lok dags þrif + „Daily með Rakel“ | Cron mán–fim 16:15 | ALMENNT | ✅ Kveikt |
| Eldhúsvaktin | Cron mánudaga 08:00 | Chat | ✅ Kveikt |
| MD DAGLEGT + LAUN | Cron 07:00 | Chat-áminningar (HR) | ✅ Kveikt |
| 💬 **Verk eru klár til framleiðslu** | Klárt + Tilbúið til framleiðslu | ALMENNT | ❌ **Slökkt.** Gólfið fær ekki að vita að verk sé tilbúið. |
| 💬 **Nýtt Quick Fix → G.CHAT** | QUICK FIX fær Ábyrgðarmann | ALMENNT | ❌ **Slökkt**, þótt skriftan sé tilbúin og bendi á `/app`. |
| 💬 **Sein skil á verkum** | 7 dögum fyrir afhendingu, ekki Má afhenda/Afhent | ALMENNT | ❌ **Slökkt** |
| Næsta söluskref – G.CHAT | Dagsetning á Næsta skrefi = í dag | Chat | ❌ Slökkt |
| Seinkunarpóstur (til kúnna) | Hnappur | Tölvupóstur | ❌ Slökkt |

Aðrar leiðir:
- **Virkni 🔔:** 3 automations (Söluferli, Skipulag og Framleiðsla) skrifa línu þegar stöðusvið breytist.
  - Línurnar birtast á `/skrifstofa` Yfirliti, aðeins fyrir eiganda.
  - Aðeins **18 línur hafa verið skrifaðar** síðan 17.10. Engin lína segir *hver* gerði hvað eða *hverjum* það kemur við.
- **Quick Fix:** skráð í `/app` eða `/skrifstofa` með Ábyrgðarmanni og Skiladegi. Ábyrgðarmaðurinn sér þetta aðeins á þrjá vegu:
  - Quick Fix-flísin í `/app` verður rauð, en bara ef hann er innskráður. Hún uppfærist við opnun, ekki með tímanum.
  - Rauð lína á `/tv`, en bara fyrir verk í stöðunni „Í vinnslu“.
  - `/dagatal`.
- **Stöðubreytingar:** `/framleidsla` og `/tv` merkja verk ⚠️ þegar afhending er komin fram yfir. Það er bara sjónrænt, enginn fær tilkynningu.
- **Gólfappið:** `/aedar` (FLOOR_MODE) athugar á 90 s fresti og sýnir „Skrifstofa uppfærði skipulagið“. Það er **eina „lifandi“ tilkynningin** í appinu. Ekkert push, engin bjalla og ekkert „ólesið“ neins staðar.
- **Athugasemdir í Airtable:** eru ekki notaðar sem samskiptaleið (engin automation á `rowCommentCreated`).
- **Sími og munnlega:** það sem eftir stendur. Til dæmis „efnið er komið“, „byrjið á T-15“, „afhendingin er bókuð“ og hver lagar hvaða Quick Fix.

### A2. Göt: hvað ætti að láta hvern vita, en gerir það ekki

| # | Atburður | Hver ætti að fá að vita | Í dag | Sönnun |
|---|---|---|---|---|
| 1 | **Klárt til framleiðslu** | Verkstjóri (Jóel) + gólf | Ekkert (chat slökkt) | T-15 fór í Klárt 26.10. kl. 12:01. Engin chat-keyrsla. |
| 2 | **Quick Fix úthlutað** | Ábyrgðarmaður | Rauð flís, bara ef hann opnar appið | #25 (Jóel) var með skiladag 23.10. og er enn „Í vinnslu“. #27 (18.10.) hefur engan Ábyrgðarmann. #7 hefur verið opið síðan í júlí. |
| 3 | **Sein skil** | Skrifstofa + verkstjóri | ⚠️-merki á skjá | T-56 hefur verið í „Má afhenda“ síðan 24.08. og T-80 síðan 16.10. `/ferli` „Næstu afhendingar“ sýnir dagsetningar sem eru liðnar (14.08., 24.08., 25.08.) án nokkurs merkis. |
| 4 | **Pöntun komin** | Gólf + skipuleggjandi | Ekkert | „5. Efni lent í húsi“ er hakað með höndunum. Staða Pantaðra lista er aldrei uppfærð (sjá B). |
| 5 | **Afhending bókuð** (svar við Má afhenda) | Gólf („hvenær fer þetta út?“) | Ekkert. Chat-textinn biður um að setja tímann í Airtable. | — |
| 6 | **Verk sent aftur í forskipulag** | Skipuleggjandi | Chat, en bara úr Airtable-hnappi | — |
| 7 | **CNC-skrár komnar á USB** | Fræsari | Ekkert („Útflutt á USB: ekki enn“ sést bara í `/framleidsla`) | — |
| 8 | **Breyting eftir Klárt** (Eyðublað, Sögunarlisti) | Gólf | Ekkert (nema `/aedar` 90 s) | — |
| 9 | **Fræsara-athugasemd / „Það sem þarf að hafa í huga“** | Fræsari / samsetning | Sviðin eru sótt í `/verk` en **aldrei birt** (verk.html:421-424) | T-15 hefur „Vera vakandi skoða teikningar vel…“ sem enginn á gólfinu sér. |
| 10 | **Virkni-loggið sjálft er rangt** | — | Skriftan les *núverandi* gildi, ekki gildið sem kveikti hana | T-15 hoppaði Tilbúið → Í vinnslu á 1 s. Loggið skráði „Verk í vinnslu“ **tvisvar** og „Tilbúið“ aldrei. T-90 skráði „Afhent“ tvisvar. |

### A3. Tillaga: einn tilkynningastraumur (Virkni 2.0) + einn Chat-útgangur

Hugmyndin er að Virkni 🔔 verði eina „pósthólfið“. Appið skrifar línurnar sjálft þegar eitthvað gerist í appinu. Airtable skrifar línur fyrir það sem gerist í Airtable. **Ein** Airtable-automation sendir í Google Chat. Þetta virðir regluna „automations stay in Airtable; the app triggers them“ og **fækkar** automations.

**1. Ný svið á Virkni 🔔** (notandinn býr þau til í Airtable):
- `Til`: single select **Skrifstofa / Verkstæði / Allir**, eða multi-select með nöfnum.
- `Tegund`: single select, t.d. klart, quickfix, seint, efni, afhending, cnc, til_baka.
- `Senda í chat`: checkbox.
- `Tengill`: url, t.d. `/verk?t=…` eða `/app#qf`.
- `Hver`: text, sá sem gerði þetta.

**2. Hver skrifar línurnar:**
- **Vercel** skrifar beint, svo það kostar 0 automations:
  - `api/verk-status.js` (Má afhenda / Afhent)
  - Quick Fix-skráning (app + skrifstofa)
  - `/pontun` (Komið í hús)
  - `/cnc` og `/smida` eftir USB-skrif
  - `/ferli` (Klárt / til baka)
  - Þetta fer í gegnum lítinn sameiginlegan hjálpara, t.d. `api/virkni.js` (VERK_KEY) eða `/api/airtable` CREATABLE_FIELDS.
- **Airtable** skrifar áfram stöðulínurnar sem það á.
  - Sameina má 3 Virkni-logg automations í **eina** sem horfir á öll 3 stöðusviðin og les gildið úr trigger-inntakinu. Það lagar líka tvítekninguna.
- **Ein ný automation „🔔 Virkni → G.Chat“:** keyrir þegar færsla er búin til og `Senda í chat` er hakað. Hún velur rými eftir `Til` (Skrifstofa → SKRIFSTOFA, Verkstæði/Allir → ALMENNT) og setur `Tengill` í skilaboðin.
  - Þá má slökkva á eða eyða: Má afhenda-chat, Klár til framleiðslu-chat, Nýtt Quick Fix-chat og Sein skil-chat (4 stykki).
  - Nettó: **um −5 automations**.
- **Morgunyfirlit kl. 07:30**, annaðhvort ný Vercel cron (0 automations) eða bætt í MD DAGLEGT-skriftuna. Það skrifar eina Virkni-línu og chat-póst með þessu:
  - verk sem á að afhenda innan 7 daga en eru ekki í Má afhenda
  - verk í Má afhenda án bókaðs tíma
  - Quick Fix sem eru komin fram yfir skiladag eða hafa engan eiganda
  - verk sem eiga að byrja í framleiðslu innan 5 daga en efnið er ekki komið
  - Þetta kemur í stað „Sein skil“ og gerir „Ósnert >5 daga“-listann óþarfan.

**3. Í appinu:**
- 🔔-bjalla í `office-shell.js` og í `/app` haus.
  - Hún sýnir Virkni-línur síaðar eftir `Til` (hlutverkið kemur úr innskráningu).
  - Ólesið er geymt í localStorage út frá síðasta `Tíma` sem var séður. Það er nóg í v1, enginn gagnagrunnur fyrir „lesið“.
  - Uppfærist á 60 s fresti og þegar flipinn verður sýnilegur.
- Virkni-spjaldið á `/skrifstofa` fær sía (Allt / Mitt / Verkstæði) og hver lína verður smellanleg (`Tengill`).
- `/verk` fær lítinn „Nýlegt í þessu verki“-lista (Virkni síað á Tækifæri).

---

## B) Skipulag → verkstæði (rakið á T-15)

Staða T-15 í nótt:
- Klárt til framleiðslu (26.10. kl. 12:01), Verk í vinnslu, afhending 13.11.
- Sagað **38/321**, fræst **0/185**, weighted framvinda 7,5%.
- Gátlisti: 1 ✓ · 2 ✓ · 3 ✓ · 4 ✓ · 5 ✓ · **6. CNC yfirfarið ✗**.
- 3 Pantaðir listar (INNVAL, HEGAS, ...), **allir „Í undirbúningi“**. Auk þess AP1 Auka-pöntunarlisti.
- Æðaplan til. Skúffusamantekt tóm. Forgangur tómur.

### B1. Skrefin

| # | Skref | Hver | Hvar í dag | Markmið | Brotið? |
|---|---|---|---|---|---|
| 1 | Loka yfirferð (gátlisti 1–6) | Rakel / Jóel | `/ferli` stig 3 (5 atriði) + **Airtable fyrir „4. Verkfundur“** | Allt í `/ferli` | 🟠 „4. Verkfundur“ vantar í gátlista appsins (T-15 var hakað í Airtable) |
| 2 | **Merkja Klárt til framleiðslu** | Rakel / Jóel | `/ferli` hnappur eða draga spjald. Aðeins `confirm()` | Gátlisti sýndur í staðfestingu, varað við opnum atriðum | 🔴 **Ekkert hlið.** T-15 fór í Klárt með 6. CNC óhakað |
| 3 | Sjálfvirkt: Tilbúið → Í vinnslu, Konto G2-drög, Virkni | Airtable | 3 automations | Óbreytt | 🔴 T-15 hoppaði beint í Í vinnslu (Verktímar skráðir síðan 27.08. teljast „byrjað“). Dálkurinn **TILBÚIÐ er alltaf tómur** á `/framleidsla`. Gólfið fær enga tilkynningu (chat slökkt). F2-póstur slökktur. |
| 4 | Pöntunarlisti reiknaður (full) | Rakel | `/pontun` „Endurreikna“ (síðasta keyrsla 19.10.) | Óbreytt | 🟢 |
| 5 | Pantað hjá birgjum | Rakel / Ísak | **Utan kerfisins.** Email-automation síðast notuð 16.07. Aðeins 11 Pantaðir listar alls, 1 „Sent“, 1 „Komið í hús“. | Annaðhvort nota „Senda á birgja“ eða einn smell „Pantað utan kerfis“ + „Komið í hús“ | 🔴 Staðan lýgur. `/verk` sýnir „Í undirbúningi ×3“ þótt efnið sé komið. |
| 6 | Auka-pöntunarlisti (gleymt efni) | Rakel | Búið til **í Airtable-formi**. Appið les og prentar aftur. Prent-automation síðast notuð 07.08. | Búa til + bæta við línum í `/pontun` | 🟠 Aðeins í Airtable |
| 7 | Efni komið í hús | Rakel / gólf | Hakað með höndunum (`/ferli` / `/skrifstofa`) | „Komið í hús“ á öllum listum hakar sjálfkrafa „5. Efni lent“ og sendir Virkni-línu | 🔴 Ekkert samband þar á milli. `/framleidsla` sýnir „**Engar pantanir skráðar**“ fyrir T-15 (síu-misræmi, líklega tvöfalt bil í nafninu „Sólveig␣␣Arna“, ekki staðfest). `/ferli` sýnir ekki 📦-merki fyrir T-15 af sömu ástæðu. |
| 8 | Cutty → USB (sög) | Skrifstofa / sagari | `/cutlist`, skrifar Skurðarskrá. `/ferli` hakar „2“ næst þegar verkið er opnað. | Óbreytt | 🟢 |
| 9 | Merkingar | Gólf | `/labels` (Zebra, QR → `/velja`) | Óbreytt | 🟢 |
| 10 | Æðaplan | Skrifstofa → gólf | `/aedar` staðfestir, `/saga` keyrir. Eina lifandi tilkynningin (90 s). | Óbreytt | 🟢 |
| 11 | Smíða → USB (CNC) | Skrifstofa | `/smida` (skrifar „6. CNC yfirfarið“ eftir USB-skrif) | + Virkni „CNC tilbúið“ til fræsara | 🟠 T-15: „6“ ennþá ✗ og „Útflutt á USB: ekki enn“, þótt fræsing eigi að hefjast í dag. Annaðhvort ekki flutt út í gegnum appið eða gert framhjá. Þarf að staðfesta. |
| 12 | Sögun á gólfi | Sagari | `/verk` Sögunarlisti / `/velja` (Lokið) | Óbreytt | 🟢 (38/321) |
| 13 | Fræsing | Fræsari | `/fraesing`, `/velja` „Merkja fræst“ | + birta „🔬📌 Það sem Fræsari þarf að hafa í huga“ | 🟠 Athugasemd fræsara fyrir T-15 er sótt en **aldrei sýnd** |
| 14 | Skúffusamantekt | Skrifstofa | **Airtable-hnappur** (síðast 23.10.). `/verk` sýnir textann. | Hnappur í `/ferli` eða `/verk` (checkbox-trigger) | 🟠 T-15 tómt |
| 15 | Samsetning og pökkun | Gólf | Sjálfvirkt við 95% sögun og 60% fræsingu | Óbreytt (gátlisti var hafnað í okt.) | 🟢, en háð því að sögun/fræsing séu skráð |
| 16 | **Má afhenda** | Gólf | `/verk` „Allt pakkað“ (varið, Afturkalla) → chat SKRIFSTOFA + Konto lokagreiðsla | Chat-texti bendir á `/dagatal`. Bókaður tími birtist gólfinu. | 🟠 Textinn vísar í Airtable. Engin kvittun til baka til gólfsins. T-56/T-80 hanga þar. |
| 17 | Afhending bókuð / afhent | Skrifstofa / gólf | `/dagatal` (dagsetning), `/verk` Afhent → Konto uppgjör, MD verklok | + Morgunyfirlit grípur verk sem hanga | 🟠 Engin áminning |
| — | Senda aftur í forskipulag | Rakel | **Aðeins Airtable-hnappur** | `/ferli` hnappur „↩ Til baka“ + ástæða | 🟠 |
| — | LOKA PRENT Skipulag 5.0 | — | Airtable-hnappur, **síðast notaður 25.08.** | Eyða (dautt) | ⚪ |
| — | Breyta Eyðublaði / Pöntunarlista-línu / læsa Sögunarlista-línu | Rakel | **Aðeins Airtable** (VERKFERLI / STUÐNINGUR) | Breytingaform í `/ferli` | 🟠 Stærsta ástæðan fyrir því að Airtable er enn opið |
| — | Forgangur framleiðslu 🥇 | Jóel | Aðeins `/dagatal`-drag. Tómt á T-15. | Velja forgang í `/framleidsla` | 🟡 |

### B2. Þar sem gögnin brotna

1. **Framleiðslustaða skv. gögnum 🤖** telur Verktíma sem „byrjað“. Verk sem tímar voru skráðir á í skipulagi fara því beint í Í vinnslu um leið og þau verða Klárt.
   - Afleiðingar: „Tilbúið“-dálkurinn er gagnslaus og F2-pósturinn „byrjað í framleiðslu“ færi út á röngum tíma ef kveikt yrði á honum.
   - Lagfæring: telja aðeins Verktíma *eftir* „Upphafs framleiðsludag“, eða bara sögun/fræsingu.
2. **Hliðin eru ekki notuð:**
   - Klárt er ekki tengt gátlistanum.
   - „6. CNC“ og „5. Efni“ eru handhök og standast ekki á við raunverulegar pantanir eða USB-útflutning.
3. **Pantaðir listar eru dauðir sem stöðukerfi.** Pantað er í síma/tölvupósti og staðan uppfærist aldrei.
4. **Virkni-logg race:** les núverandi gildi í stað trigger-gildisins, sem veldur tvítekningum og týndum skrefum.
5. **Gömul og hávaðasöm yfirlit:**
   - „Ósnert >5 daga“ í `/ferli` sýnir verk sem hafa verið ósnert í 123 daga, svo enginn les það lengur.
   - „Næstu afhendingar“ sýnir liðnar dagsetningar án merkis.
6. **Smávægilegt:**
   - Webhook-slóðir og lyklar (Google Chat) eru afritaðir í mörgum skriftum. Ef rými er endurgert þarf að breyta 6+ skriftum. Einn útgangur (A3) leysir það.
   - `docs` og ops-map segja „Rauðir dagar [LAUN]“ slökkt, en sú automation er nú **kveikt**.

### B3. Smíðalisti (forgangsraðaður)

| # | Verk | Stærð | Hvar |
|---|---|---|---|
| 1 | **Klárt-hlið:** staðfestingargluggi listar opin gátlistaatriði (+ bæta „4. Verkfundur“ við CHECKLIST), rauð viðvörun ef „5 Efni“ eða „6 CNC“ vantar | S | ferli.html:624-736 |
| 2 | **Kveikja á „💬 Nýtt Quick Fix → G.CHAT“ og „💬 Verk eru klár til framleiðslu“.** Notandinn gerir þetta í Airtable (tilbúnar skriftur), þar til #6 kemur í staðinn. | S | Airtable |
| 3 | **Virkni-logg lagfæring:** gildið úr trigger-inntaki í stað `selectRecordAsync`. Sameina 3 automations í 1. | S | Airtable, 3 skriftur |
| 4 | **Efni samstillt:** „Komið í hús“ á öllum Pantaðum listum hakar „5. Efni lent“. Valkostur „Pantað utan kerfis“. Laga síu `/framleidsla` + `/ferli` 📦 (record-id í stað nafns). | S | framleidsla.html:253, ferli.html, pontun.html |
| 5 | **Birta athugasemdir gólfsins:** „🔬📌 Fræsari“, „🧠📌 Hafa í huga“, „🪛📌 Uppsetning“ í `/verk`, `/fraesing` og `/velja` | S | verk.html:421-424 |
| 6 | **Tilkynningar v1 (A3):** Virkni-svið, `api/virkni.js`, skrif úr verk-status/QF/pontun/cnc/ferli, „Virkni → G.Chat“ automation, 🔔 í office-shell + `/app` | M | Nýtt + Airtable |
| 7 | **Morgunyfirlit 07:30** (sein skil, Má afhenda án tíma, QF fram yfir, efni vantar fyrir byrjun) | M | Vercel cron |
| 8 | Laga formúlu „Framleiðslustaða skv. gögnum“ (Verktímar aðeins eftir upphafsdag) | S | Airtable (notandi) |
| 9 | Má afhenda-chattexti → `/dagatal`-tengill. Bókaður afhendingartími sýndur í `/verk`. | S | Airtable-skrifta + verk.html |
| 10 | „↩ Senda aftur í forskipulag“ og „Skúffusamantekt“ sem hnappar í appinu (nýr checkbox-trigger, skipta um trigger á núverandi automations, 0 nýjar) | M | ferli.html + Airtable |
| 11 | Búa til Auka-pöntunarlista og bæta við línum í `/pontun` | M | pontun.html + proxy |
| 12 | Breyta Eyðublaði (mál/frontar) + Pöntunarlista-línu + `Tilbúið 🔒` í `/ferli` | L | ferli.html + api |
| 13 | Forgangur 🥇 valinn í `/framleidsla` | S | framleidsla.html |
| 14 | Eyða LOKA PRENT 5.0 og Prenta Auka-pöntunarlista-hnappi úr Airtable ef staðfest dautt | S | Airtable (notandi) |

### B4. Topp 6 fyrir morgundaginn

1. **Klárt-hlið í `/ferli`** (S). Engin verk í framleiðslu án þess að sjáist hvað vantar.
2. **Birta fræsara-/samsetningarathugasemdir** í `/verk` og `/fraesing` (S). T-15 er í fræsingu *í dag*.
3. **Efni samstillt** + laga síuna „Engar pantanir skráðar“ (S).
4. **Kveikja á Quick Fix-chat + Klár til framleiðslu-chat** (S, notandinn í Airtable) sem brú.
5. **Virkni-logg lagfæring + sameining** (S). Forsenda fyrir #6.
6. **Tilkynningar v1** (M): Virkni-svið + `api/virkni.js` + einn Chat-útgangur + 🔔 í skrifstofu og `/app`. Kemur í stað #4.

---

## Samantekt

1. Samskipti í dag: tvö Google Chat-rými sem 41 kveikt Airtable-automation fóðrar, en þrjú mikilvægustu skilaboðin (Klárt til framleiðslu, Quick Fix úthlutað, sein skil) eru **slökkt**. Appið sendir sjálft ekkert.
2. Virkni-straumurinn er aðeins fyrir eiganda, hefur 18 línur og skráir rangt (race). Tillaga: Virkni 2.0 með `Til`/`Tengill`, skrifuð af appinu, **einn** Chat-útgangur og 🔔 í skrifstofu og `/app`. Nettó um −5 automations.
3. T-15 sýnir að **hliðin eru ekki notuð**: Klárt án CNC-haks, fór beint í „Í vinnslu“ vegna gamalla verktíma, og efnið er „komið“ þótt allar 3 pantanirnar séu „Í undirbúningi“. Pantað er utan kerfisins.
4. Airtable er enn nauðsynlegt fyrir: að breyta Eyðublöðum og Pöntunarlista-línum, Auka-pöntunarlista, Senda aftur í forskipulag, Skúffusamantekt og „4. Verkfundur“. LOKA PRENT er dautt síðan í ágúst.
5. Fyrst á morgun: Klárt-hlið, fræsara-athugasemdir í `/verk`, efnissamstilling, kveikja á 2 chat-automations, laga Virkni-logg, svo Tilkynningar v1.
