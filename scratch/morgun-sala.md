# Morgunskýrsla — SALA (frá fyrstu snertingu að undirrituðu verki)

Skannað 2026-10-27 um nótt. **Eingöngu lestur:** repo (`main` @ 59c44cf), Airtable `app91U15z9K704Okd` (list/get automations, síður, schema, nokkrar talningar), og live `/crm` í Browser pane (bara lesið, ekkert smellt sem skrifar). Engar breytingar gerðar neins staðar.

Grunnur: operations-map 2026-10-26 + það sem kom síðan (Greiðslur & tilboð í verkefnaglugganum, `api/greidslur.js`).

---

## 0. Það mikilvægasta fyrst — tvær leiðir að „Unnið“ gera ekki það sama ⚠️

Í Airtable eru **tvær** leiðir til að merkja verk unnið, og `/crm` notar þá sem gerir minna:

| | Haka í `Tækifæri unnið 🏆` (Airtable-hak) | Færa spjald í „🏆 Tækifæri unnið“ í `/crm` (skrifar `Staða í söluferli` beint) |
|---|---|---|
| Staða í söluferli = Unnið | ✅ | ✅ |
| `Verk staðfest þann`, `Staðfest tilboðsupphæð 🔒` | ✅ (bæði automations) | ✅ („Skráir tíma þegar verk var samþykkt“) |
| `Staðfestar heildartekjur án vsk 🔒` | ❌ | ✅ |
| **`Staðfest tilboð 🔒` (PDF-afrit af Tilboð til sendingar)** | ✅ | **❌ — ekkert automation gerir þetta á stöðubreytingu** |
| **`Staða í skipulagi` = For-skipulag** | ✅ | **❌** (`/ferli` les tómt sem For-skipulag, svo það sést samt þar — en Airtable-síður og síur sem leita að „For-skipulag“ missa verkið) |
| **SKRIF-CHAT „UNNIÐ 🏆🎉 Senda mælingahlekk…“** | ✅ | **❌ — enginn fær tilkynningu** |
| Verðlás (verk + Line Items) | ✅ | ✅ |
| Ár/mánuður, Virkni-logg | ✅ | ✅ |

Lýsingin á „Skráir tíma þegar verk var samþykkt“ segist frysta PDF-ið, en skrefið skrifar bara dagsetningu + tvær upphæðir. Á live gögnum: T-113 (unnið 18.10.) er eina unna verkið síðustu 90 daga með tóma `Staða í skipulagi` — passar við CRM-leiðina (ekki staðfest hvaða leið var notuð). **Þetta er fyrsta lagfæringin á morgun** (sjá topp 6, #1).

Athugið líka: Google Chat webhook-slóðin (með key/token) er harðkóðuð í Airtable-scriptunum (t.d. „Færir verk → unnið“). Ekki prentuð hér. Sama gildir líklega um hin chat-scriptin.

---

## 1. Söluferlið — skref fyrir skref

Tíðni = gróft mat út frá live gögnum (25 opin tækifæri, 14 í „Tilboð sent“, 18 unnin síðustu 90 daga ≈ 6/mán, 8 svör í Töpuð-formi frá upphafi, 2 vefspjöll skráð, 1 smásala frá upphafi).

| # | Skref | Hvar í dag | Hversu oft | Markmið (100% app) |
|---|---|---|---|---|
| 1 | **Lead úr Studio** (`/skipuleggja` → kp-submit: tengiliður → Tækifæri → Line Items, flagg `Sjálfsafgreiðsla — óyfirfarið ⚠️`) | **App.** `/crm` „Til yfirferðar“ listi (4 núna, ⅔ eru prufur) → opnar PRO, PRO tekur flaggið af | vikulega | Komið. Vantar: „Eyða / merkja sem prufa“ í listanum; F0 þakkarpóstur er **óvirkur** (bíður textayfirferðar) |
| 2 | **Lead úr vefspjalli** (chat-widget → `Vefspjall 💬`) | **Hvergi lesið.** Taflan í Airtable, 2 færslur frá upphafi, báðar „Nýtt“ (aldrei afgreiddar) | sjaldan | Lítill „Fyrirspurnir“ listi í `/crm` (Vefspjall með `Óleyst spurning` + netfang → „Búa til verkefni“). Athuga fyrst hvort skráningin virki yfirhöfuð (2 færslur á 6 vikum er grunsamlega lítið) |
| 3 | **Lead úr tölvupósti/síma** | Gmail (Make → `api/email-draft.js` gerir drög, Rakel sendir) → **App** `/crm` „+ Nýtt verkefni“ (leita/búa til tengilið → teikna eða fljótleg lína) | daglega | Komið. Póstur sjálfur er utan sviðs |
| 4 | **Tengiliðir & fyrirtæki** | **App** (`/crm` 👤 Tengiliðir: leita, skoða, breyta, búa til). Airtable: SKRIFSTOFA Tengiliðir/Fyrirtæki síður + innfelld form „Nýr tengiliður“, „Tengja tengilið við sölu“ | daglega | Næstum komið. Vantar: **samþykkja `Óyfirfarið — Rakel ⚠️`** (appið sýnir pilluna en getur ekki tekið hana af — það er bara gert í Airtable); tengja annan tengilið við núverandi Tækifæri |
| 5 | **Söluferli / kanban** (Staða í söluferli, Sölumaður, Næsta skref + dags.) | **App** `/crm` (drag, dropdown, Næstu skref listi, KPI, tölfræði) | daglega | Komið, en: aðeins **2 af 25** opnum hafa Næsta skref; „Líklegt“ dálkurinn tómur. Sjá #6 |
| 6 | **Eftirfylgni** (Eftirfylgni 1.0 3 d., 2.0 15 d. → G.Chat; `Eftirfylgnisstaða❓`, `Svar við eftirfylgni`) | Automations í Airtable (fína). **Skráning símtals/pósts** („☎️ RH tók símtal“, „📤 RH sendi póst“, svar viðskiptavinar) = **bara í Airtable** — `/crm` sýnir reitina read-only | daglega (14 tilboð úti, flest „2 sinnum eftirfylgt“) | Takkar í deal-glugga: „☎️ Hringdi“ / „📤 Sendi póst“ (skrifar `Eftirfylgnisstaða❓` með upphafsstöfum þess sem er innskráður) + reitur fyrir `Svar við eftirfylgni` + `Líkur á sölu`. „Næsta söluskref – G.CHAT“ automationið er **óvirkt** — kveikja á því eða sýna yfirdregin skref á `/skrifstofa` |
| 7 | **Teikning & Line Items** (V1/V2/V3, Aukahlutir) | **App:** PRO `/pro` (teikning + lifandi verð `api/kp-price.js`), `/crm` Vörulínur (Rými, V1–3, Magn, Afsl.), Efni verkefnis, Aukahlutir. Airtable: VERKFERLI „2.5 Aukahlutir 🧩“ | daglega | Næstum komið. Vantar: búa til nýja **Vörulista-vöru** (bara Airtable-form „➕🚪 Skrá nýja vöru“); `Ósýnilegur afsláttur %`, `Afsláttur í uppsetningu`, `heimsendingaverð`, `Uppsetning Bjarnarins` sem sýnilegir reitir í `/crm` deal-glugga (eru í PRO) |
| 8 | **Prenta tilboð** (cabinets) | **App** (`/crm` „🖨️ Prenta tilboð“, PRO, og 💳 Greiðslur & tilboð) + Airtable-hnappur | nokkrum sinnum í viku | Komið |
| 9 | **Sameinað tilboð, Verðhugmynd** | **App síðan 26.10.** (💳 Greiðslur & tilboð → prentar með sömu `generate-quote` mode). Airtable-hnapparnir lifa enn | vikulega | Komið — slökkva á Airtable-hnöppunum þegar Rakel hefur notað app-leiðina í 2 vikur |
| 10 | **Senda tilboð til viðskiptavinar** | Gmail, handvirkt (PDF sótt úr `Tilboð til sendingar`) → svo færa í „📤 Tilboð sent“ í `/crm` | nokkrum sinnum í viku | Utan sviðs (póstur), en: „📤 Merkja sent“ takki við PDF-ið í deal-glugganum sem færir stöðuna + setur Næsta skref (sparar 2 smelli og gleymist ekki) |
| 11 | **Verðlás** | Airtable automation á Unnið (fína). Ekkert að gera í appi | 6/mán | Komið (keyrir á báðum leiðum) |
| 12 | **Unnið** 🏆 | `/crm` drag/dropdown **eða** Airtable-hak `Tækifæri unnið 🏆` — **gera ekki það sama** (kafli 0) | ~6/mán | Ein leið: `/crm` skrifar **hakið** (ekki stöðuna) svo sama automation keyri og í Airtable. Sýna „Staðfest tilboð 🔒“ PDF í glugganum eftir á |
| 13 | **Konto drög G1** (staðfestingargjald) | Airtable-hnappur. App-hnappur til (💳) en **bíður** eftir að eigandi búi til `🧾 Búa til G1 drög` + skipti trigger (skref í docs/api.md) | ~6/mán | 5 mín vinna eigenda í Airtable — þá er þetta komið |
| 14 | **Tapað / Neitað** 🥀 | `/crm` drag (með staðfestingu) **eða** Airtable-hak `Tækifæri tapað 🥀` (sömu áhrif hér — hakið setur bara stöðuna). Sjálfvirkt: „Verk ósnert í 30 daga → tapað“ | vikulega | Komið að mestu. Vantar: ástæða við tap (dropdown sem skrifar í `Töpuð tækifæri svör🥀` eða reit á Tækifæri). F1 tap-pósturinn (sjálfvirkur + handvirkur) **óvirkur** → `Tapað form sent` aldrei hakað |
| 15 | **Af hverju töpum við?** (svör úr Töpuð-formi) | **Bara Airtable** (8 svör: **5 × „📈 Verð“**, 2 × afhendingartími, 1 × annað fyrirtæki) | mánaðarlega skoðað | Lítið „Töpuð — ástæður“ spjald í `/crm` tölfræðinni. Ódýrt, og segir eigendum eitthvað raunverulegt |
| 16 | **Viðbætur / viðbótartilboð** (eftir staðfestingu) | **App síðan 26.10.** (💳: prenta viðbótartilboð, samþykkja viðbætur — upphæð athuguð á þjóni) | nokkrum sinnum á mán. | Komið |
| 17 | **Smásala** (`Smásala (ekki verkefni)` + `Ljúka smásölu` → „Smásala A-Ö“ beint í LOKIÐ) | **Bara Airtable** | **1 færsla frá upphafi** (T-170, júlí) | Lágt forgang. Ef notað: „Smásala“ hak í „+ Nýtt verkefni“ + „Ljúka smásölu“ takki |
| 18 | **Velkomin-/mælingapóstur eftir sölu** | **Hvergi** — F1 „móttaka + mælingahlekkur“ er **óvirkt**; mælingahlekkur sendur handvirkt | ~6/mán | Eigendaákvörðun: kveikja á F1 (texti tilbúinn). Ekki byggingarverk |

---

## 2. Automations sem sölustöðubreyting ræsir (staðfest í Airtable 2026-10-27)

**Á 🏆 Tækifæri unnið (stöðubreyting, eins og `/crm` gerir):**
1. Skráir tíma þegar verk var samþykkt — `Verk staðfest þann`, `Staðfest tilboðsupphæð 🔒`, `Staðfestar heildartekjur án vsk 🔒` *(virkt)*
2. 🔒 Verðlás við staðfestingu — hölduverð + hver ólæst Line Item *(virkt)*
3. Skráir ár og mánuð — keyrir af `Verk staðfest þann` *(virkt)*
4. 🔔 Virkni-logg — Söluferli *(virkt)*
5. F1 🏆 móttaka + mælingahlekkur *(ÓVIRKT)*
6. Seinna í ferlinu, háð Unnið: Konto G2 (Klárt til framleiðslu), Konto lokagreiðsla (Má afhenda), Konto uppgjör (Afhent), 🏭 Framleiðsla →… , Skráir raun afhendingartíma *(öll virk)*

**Aðeins á hakinu `Tækifæri unnið 🏆`** („Færir verk → tækifæri unnið“, virkt): allt ofan + `Staðfest tilboð 🔒` PDF + `Staða í skipulagi` = For-skipulag + SKRIF-CHAT tilkynning, og tekur hakið af.

**Á 🥀 Tækifæri tapað:** Virkni-logg *(virkt)*; F1 tap sjálfvirkt *(ÓVIRKT)*; F1 tap handvirkt (hnappur) *(ÓVIRKT)*. Hakið `Tækifæri tapað 🥀` setur bara stöðuna.
**Sjálfvirkt tap:** „Verk ósnert í 30 daga → tapað“ *(virkt)* — á Teikna/yfirfara, Tilboð sent, Líklegt (ekki Hönnun); setur `Eftirfylgnisstaða❓` = ⌛ Rann út á tíma + keyrir script.
**Á 📤 Tilboð sent:** Skráir tíma þegar tilboð var sent → Eftirfylgni 1.0 (3 d.) og 2.0 (13/15 d.) *(virk)*; Virkni-logg.
**Annað sölutengt:** Næsta söluskref – G.CHAT *(ÓVIRKT)*, F0 Takk fyrir Studio *(ÓVIRKT)*, Smásala A-Ö *(virkt)*, ✅ Samþykkja viðbætur *(virkt, hak)*, 🧾 Konto G1 *(virkt, enn Interface-hnappur)*, 🖨️ Prenta Tilboð / sameinað / Verðhugmynd / 📄 viðbótartilboð *(virk, Interface-hnappar — app kallar beint á `generate-quote`)*.

---

## 3. Áhætta

1. **Unnið-gatið** (kafli 0) — tilboðs-PDF frystist ekki, enginn fær chat, Airtable For-skipulag-sía missir verkið. Gerist við *hvert* verk sem er unnið úr `/crm`.
2. **Stöðubreyting = fossar.** Unnið ræsir verðlás + Konto-keðju síðar. `/crm` er með `confirm()` á lokastöðum — það er eina vörnin; ekkert „afturkalla“ (verðlás og dagsetningar ganga ekki til baka þó stöðu sé breytt aftur). Prófun á live gögnum = raunverulegar færslur. Aldrei prófa stöðubreytingu nema á prufuverki og með `list_automations` opið (sbr. atvikið 18.10.).
3. **Tvöföld verðlógík:** `api/kp-price.js` endurgerir Airtable-formúlurnar. Mildað: hann reiknar `drift` og PRO sýnir „Útreikningurinn víkur frá Airtable á N línum“. Prentað tilboð kemur alltaf úr Airtable (rétt), svo versta tilvik = Rakel sér rangt verð á meðan hún teiknar. Regla: hver breyting á verðformúlu í Airtable → keyra PRO á einu verki og athuga drift.
4. **Prent-automations bera GitHub-token** („Muna að uppfæra token…“) — ef appið kallar beint á `generate-quote` er sá veikleiki úr sögunni fyrir app-leiðina; Airtable-hnapparnir geta enn þagað.
5. **Chat webhook keys** harðkóðaðir í Airtable-scriptum (lesanleg öllum sem geta opnað automations).
6. **Prufufærslur í söluferli** (T-248 TEST TESTI, T-249, T-242/246 Jóel, T-243, T-113 unnið á 60 þ.) skekkja KPI („Sala þessa mánaðar“ og opið virði).
7. **Allir viðskiptavinapóstar slökktir** (F0, F1 unnið, F1 tapað, F2) — það er meðvitað, en þýðir að „Tapað form sent“ og svörin hætta að safnast.

---

## 4. Forgangsraðaður byggingarlisti (S = < ½ dagur, M = ~1 dagur, L = fleiri dagar)

| # | Verk | Stærð | Af hverju |
|---|---|---|---|
| 1 | **`/crm` Unnið/Tapað skrifar hakið** (`Tækifæri unnið 🏆` / `Tækifæri tapað 🥀`) í stað stöðunnar; Neitað áfram sem staða. Bæta hökunum í WRITABLE (eða í `greidslur.js` bak við VERK_KEY) | **S** | Lagar kafla 0 án þess að snerta automations. Eigandinn þarf ekkert að gera |
| 2 | **Eftirfylgni-skráning í deal-glugga:** ☎️ Hringdi / 📤 Sendi póst (velur RH/JK eftir innskráðum), `Svar við eftirfylgni`, `Líkur á sölu` | **S** | Daglegt, eina ástæðan fyrir Rakel að opna Airtable-grid í sölu |
| 3 | **Samþykkja tengilið/fyrirtæki** (`Óyfirfarið — Rakel ⚠️` af) — takki í Tengiliða-glugganum, aðeins eigandi/Rakel | **S** | Allt sem búið er til í appinu lendir í þessari biðröð; hún tæmist bara í Airtable |
| 4 | **Ástæða við tap** — litill dropdown þegar spjald fer í Tapað (sömu valkostir og formið) → færsla í `Töpuð tækifæri svör🥀` tengd verkinu; + „Af hverju töpum við“ spjald í tölfræðinni | **S–M** | Gögnin sem til eru (5/8 = verð) eru verðmætustu söluupplýsingarnar og sjást hvergi |
| 5 | **„📤 Merkja tilboð sent“** við PDF-ið í 💳 (staða + Næsta skref „⏳ Bíða eftir svari“ +3 d.) | **S** | Lokar tilboðshringnum á einum stað; tryggir að Eftirfylgni-klukkan fari af stað |
| 6 | **Fyrirspurnir-listi** (Vefspjall + seinna póstflokkun úr email-draft) í `/crm` með „Búa til verkefni“ | **M** | Ný lead-uppspretta sem enginn sér í dag. Athuga fyrst hvort logging virkar |
| 7 | **Vörulista-vara (ný)** í `/crm` (sama mynstur og Ný útfærsla / Nýtt efni) | **M** | Síðasta katalóg-formið sem er bara í Airtable |
| 8 | **Verðstillingar í deal-glugga** (Ósýnilegur afsláttur, Afsláttur í uppsetningu, uppsetning já/nei, heimsending/Fjöldi ferða, Skipting greiðslu) | **M** | Í dag aðeins í PRO eða Airtable; fljótleg-lína-verk hafa enga PRO-teikningu |
| 9 | **Prufu-merki** á Tækifæri (eða sía „T-… TEST“) sem KPI og listar hunsa | **S** | Hreinni tölur |
| 10 | **Tengja annan tengilið við verk** (í stað „Tengja tengilið við sölu“ formsins) | **S** | Sjaldgæft en eina leiðin er Airtable |
| 11 | **Smásala** í „+ Nýtt verkefni“ + „Ljúka smásölu“ | **S** | 1 færsla frá upphafi — bara ef eigendur segja að þetta sé notað |
| 12 | **Slökkva á Airtable-sölu-hnöppum** (Prenta ×4, G1) eftir 2 vikna notkun á app-leiðinni | (eigandi) | Ein leið = engin ósamræmd gögn |
| 13 | **Söluvirkni-saga per deal** (hver gerði hvað hvenær, úr `Virkni 🔔`) í deal-glugga | **M** | Gefur „dagar í stöðu“ sem tölfræðin segir sjálf að vanti |

Eigendaverk (ekki kóði): búa til `🧾 Búa til G1 drög` + skipta trigger (docs/api.md); ákveða F0 / F1 unnið / F1 tapað póstana; ákveða „Næsta söluskref – G.CHAT“.

---

## 5. Topp 6 fyrir morgundaginn

1. **Unnið/Tapað í `/crm` skrifar hakið** (#1) — S, lagar raunverulegt gagnatap á hverju unnu verki. Prófa eingöngu á prufuverki (T-248) og staðfesta að PDF, For-skipulag og chat komi.
2. **Eftirfylgni-takkar + Svar + Líkur á sölu** (#2) — S.
3. **Samþykkja tengilið/fyrirtæki** (#3) — S.
4. **„Merkja tilboð sent“** (#5) — S.
5. **Ástæða við tap + „Af hverju töpum við“** (#4) — S–M.
6. **Prufu-merki á Tækifæri** (#9) — S, svo KPI-in sem allir horfa á séu rétt.

(Fyrir eiganda á sama tíma: G1-reiturinn í Airtable — 5 mín, og þá er öll peningahlið sölunnar komin í appið.)

---

## Samantekt (5 línur)

1. Salan er ~85% í appinu: leads úr Studio/síma/pósti, tengiliðir, kanban, teikning, verð og öll fjögur tilboðs-PDF eru í `/crm`/PRO.
2. Alvarlegasta fundið: `/crm` „Unnið“ skrifar stöðuna beint og sleppir því automation sem frystir tilboðs-PDF, setur For-skipulag og sendir chat-tilkynninguna (Airtable-hakið gerir það).
3. Það sem enn neyðir Rakel í Airtable: eftirfylgni-skráning, samþykkt tengiliða, ný Vörulista-vara, tapsástæður, smásala og (þangað til eigandi tengir hann) G1-hnappurinn.
4. Áhætta: stöðubreytingar fossa óafturkræft (verðlás, Konto síðar), kp-price.js tvöfaldar verðformúlur (mildað með drift-viðvörun), chat-keys harðkóðaðir í scriptum, prufuverk skekkja KPI.
5. Á morgun: sex lítil verk (öll S) — hakið fyrir Unnið/Tapað fyrst, svo eftirfylgni, samþykkt tengiliða, „merkja sent“, tapsástæður og prufu-merki.
