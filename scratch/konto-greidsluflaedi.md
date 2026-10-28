# Konto: netsamþykki → greiðsla → Unnið — niðurstöður rannsóknar (2026-10-27)

Rannsókn eingöngu (ekkert byggt). Heimildir: kóðinn í repo (`api/konto-invoice.js`, `api/konto-vat.js`, `docs/api.md`), Konto-skjölun (docs.konto.is, konto.is/api/v1/document), og **lesköll** á lifandi Konto (`get-invoices`, 162 reikningar 2026) + Bókhald 💰 (Airtable, lesið).

## Stutta svarið

| Spurning | Svar |
|---|---|
| a) Getum við stofnað **raunverulegan** reikning með kröfu í heimabanka (ekki drög)? | **Já, að því er skjölun segir** — `create-invoice` með `is_claim: true`. Þetta er *ekki* reynt af okkur (kóðinn notar bara `create-draft-invoice`) og **ekki prófað** (bannað í þessu verkefni). Lifandi gögn sýna að bókhaldið gefur nú þegar út kröfur: 21 með `claim_status=sent`, 93 `paid`. |
| b) Lesa greiðslustöðu áreiðanlega? | **Já**, með polling. `get-invoices`/`get-invoice` skila `status` (Draft / Sent / Cancelled / Paid / Collection), `paid_date`, `claim_status` (sent / paid / cancel), `amount_deposited`. **Webhook er ekki til** í skjölun. |
| c) Hætta við / krefja til baka óborgaðan reikning? | **Óljóst.** Til er `create-invoice` með `type: credit` + `ref_invoice_guid` (kreditreikningur) og `do-paid-invoice` (merkir greitt; getur mistekist með „claim cancellation failed“ → bendir til að krafan sé afturkölluð við það). Ekkert skjalfest „cancel-invoice“ í API. Lifandi gögn hafa 10 reikninga í stöðunni `Cancelled` (T-32) — svo það er hægt í Konto-viðmótinu; hvort API getur það er ósvarað. |

## 1. Það sem kóðinn notar í dag

- Auth: **legacy** `username` + `api_key` (HTTP Basic fyrir GET; `username`, `api_key`, `data` sem form-fields fyrir POST). Env: `KONTO_USERNAME`, `KONTO_API_KEY`. Grunnslóð `https://konto.is/api/v1`.
- Köll sem við gerum: `hello`-próf, `get-customers-by-kennitala`, `create-customer`, **`create-draft-invoice`** (aðeins drög, `is_claim:true`, `output_select:"3"`), `get-invoices` (konto-vat.js, les `status==="Paid"`, `paid_date`, `items[].vat_amount`).
- Vörn í kóðanum: hver greiðsla (G1/G2/LOK/UPPGJOR) skráð í `Konto drög 🧾`; `alreadyDrafted` hafnar tvöföldun. Gjalddagi +3 virkir, eindagi +5.
- Skjölun nefnir líka `Idempotency-Key` haus fyrir endurtekningar (gildir um agent/OAuth API; óvíst um legacy) — við ættum áfram að treysta á eigin skráningu.

## 2. Konto API — hvað er skjalfest

- **Tvö API**: (1) legacy `username+api_key` (server-to-server, það sem við notum, „in-app reference“ á konto.is/api/v1/document), (2) OAuth2 „agent“ API með scopes (`create_invoice`, `nav`, `manage_customers`...). Fyrir okkur: halda áfram með legacy.
- `create-invoice`: sendir reikning út (Konto-skjölun MCP: „Creating an invoice issues and delivers it“). Skylt: customer, amount (= summa lína m. vsk, annars hafnað), items, `issue_date` (≤ í dag), `due_date` ≤ `settlement_date`, `type`.
- Krafa: `is_claim` — „Only available if user has active claim subscription“ og **notar krafnakvóta** („consumes claim quota“; hversu mikill er ekki skjalfest). Svar reikninga hefur `claim_id`, `claim_status`; villur geta verið `claim_not_configured`/kvóti búinn. `is_claim` má ekki vera með `mark_paid`/`is_payment_link`.
- Afhending: stýrist af **viðskiptavininum** (`output_select`: 3 = tölvupóstur/PDF án XML, 2 = rafrænn reikningur, 4 = prenta/ekki senda). Enginn sérstakur „send“ endapunktur. Núverandi kóði setur 3 → Konto sendir PDF í tölvupósti við útgáfu + krafa fer í banka.
- Kennitala viðskiptavinar: 10 stafir, mod-11 sannprófun; `email` skylt við stofnun; `create-customer` athugar ekki tvíverknað (við leitum fyrst — það gerir kóðinn þegar).
- Rate limits: **hvergi skjalfest** fyrir reikninga (aðeins 30/60s á einum agent-endapunkti). Lifandi `get-invoices` svar ~0,7 s, engir rate-limit hausar. Við þurfum aðeins nokkur köll á mínútu — engin hætta.
- Dev-umhverfi `dev.konto.is` er til en þarf maintenance-kóða frá Konto og **sendir raunverulegan tölvupóst**. Prófa þar með einnota viðskiptavin.

## 3. Lifandi lesprófun (aðeins `get-invoices`, ekkert skrifað, engir lyklar prentaðir)

- 162 reikningar 2026: Paid 145, Sent 7, Cancelled 10. **Engin „partially paid“ staða** fannst; í 8 Paid-reikningum er `amount_deposited` ≠ `amount` (smámunur, líklega ísl. kr. námundun/innheimtugjald) — **ekki treysta á `amount_deposited == amount`**, treystu á `status=="Paid"` / `claim_status=="paid"`.
- Kröfureikningur: `Sent` + `claim_status:sent`, `paid_date:""`. Þegar greitt: `Paid` + `claim_status:paid`, `paid_date`, `booking_date`, `value_date`, `amount_deposited` fyllt. Dæmi: reikningur með gjalddaga 23.10 sýndi `paid_date` 26.10 (bankinn skilar 1–3 dögum eftir greiðslu — sýnir seinkun á stöðu).
- Reikningur hefur `number` (t.d. IPKT-1281), `guid`, `claim_id`, `description`, `customer`, `project_guid`. `description` hjá okkur inniheldur oft „T-xx | nafn“ (6 af 162) — **ekki treysta á það til pörunar**; geymdu guid sjálf.
- Ógreiddar kröfur eru ekki settar í `Cancelled` sjálfkrafa; `Collection` er innheimtustaða.

## 4. Varaleið: Bókhald 💰 (daglegur bankasync)

Töflan (`tbl5wXBjHf437yKQx`, 2005 raðir): `Lýsing` (nafn greiðanda/viðtakanda, t.d. „Sigurjón Valsson“ eða „Ríkissjóðsinnheimtur“), `Dagsetning`, `Upphæð`, `Tegund` (Inngreiðsla 💰 o.fl.), `Tengt tækifæri` (frjáls texti, oftast tómur), `Banka-ID` (bankafærsla), `Óunnið (banki) 🏦`.
- **Engin krafa/KID/tilvísun/kröfunúmer** í raðirnar — aðeins nafn + upphæð + dagsetning. Pörun yrði „upphæð = reikningur ± nafn ≈ viðskiptavinur“ → **ekki áreiðanleg** (sama upphæð tvisvar, greiðandi ≠ viðskiptavinur, hjón, fyrirtæki). Gott sem *sannprófun/öryggisnet* (t.d. viðvörun ef Konto segir Paid en engin bankafærsla finnst), ekki sem aðaluppspretta.

## 5. Ráðlagt tæknilegt flæði

1. **Samþykkja (vefsíða)** → `api/accept.js` (nýr, token-varinn tilboðslinkur): skráir val (Skipting greiðslu), kennitölu (**aðeins á tengilið**), samþykki skilmála (tímastimpill + IP + skilmálaútgáfa) → **staðfest tilboð + verðlás hér** (Staðfest tilboð PDF, `Staðfest tilboðsupphæð 🔒`). Staða verkefnis breytist **ekki** í Unnið.
2. **Stofna G1**: `get-customers-by-kennitala` → `create-customer` ef vantar → **`create-invoice`** (ekki draft) með `is_claim:true`, sömu línum og `invoiceLines(project,"G1")` (endurnýta), gjalddagi +3 virkir. Vista `guid`, `number`, `claim_id` í ný reiti á Tækifæri (ekki bara textalog); sama idempotency-vörn og `alreadyDrafted`. Ef villa (`claim_not_configured`/kvóti): stoppa, láta bókara vita, **ekki** gefa út reikning án kröfu án samþykkis.
3. **Greiðsla greind**: Vercel cron (t.d. á 15 mín fresti virka daga 8–18, annars klst.) → `get-invoice?guid=` fyrir hvern opinn G1 (aðeins nokkur) eða eitt `get-invoices` með `from_date`. Greitt þegar `status=="Paid"` **og** `paid_date` ≠ "" (`claim_status=="paid"` sem stuðningur). Bankar uppfæra 0–3 daga seinna; sýna viðskiptavini „bíðum eftir greiðslu“.
4. **Þegar G1 greidd** → *þá* fer staða í Unnið (gegnum sama gated endapunkt og nú, með öllum cascade-um: For-skipulag, Chat). **Athuga áður** með `list_automations` hvaða sjálfvirkni hlaupa á stöðubreytingu (reglan úr 2026-10-18 atviki).
5. G2/G3 eins og í dag (drög/greiðsluáminning) — þær má síðar fara sömu leið (create-invoice + polling).
6. Hætt við: sjá spurningu A hér að neðan; til bráðabirgða getur skrifstofan afturkallað í Konto-viðmóti, og cron sér `Cancelled` og setur verkefnið aftur í „Tilboð staðfest – ógreitt“.

Verðlás vs. Unnið: **verðlás við samþykki** (verðið sem viðskiptavinurinn sá), Unnið við greiðslu. Í dag gerist hvort tveggja við Unnið (`🔒 Verðlás`) → þarf að skipta upp; ef viðskiptavinur borgar aldrei helst verðið fryst en verkefnið ekki Unnið (skrifstofa ákveður fyrningu tilboðs).

## 6. Áhættur

- **Raunverulegir reikningar fara strax út** (tölvupóstur + banki). Engin „prófun“ á production; dev-umhverfi sendir líka tölvupóst. Fyrsta prófun með einnota viðskiptavini og lágri upphæð, helst með bókara viðstöddum.
- **Krafnakvóti / `claim_not_configured`** — óþekkt mörk, getur stöðvað flæðið.
- **Tvöföld útgáfa** (tvísmellir, endurtekin köll): krefst varnar áður en kallað er (læsa á Tækifæri fyrst; `Idempotency-Key` ef legacy styður það — óstaðfest).
- **Kennitala**: aðeins á tengilið; gæta þess að bjóða ekki upp á að slá inn annarra kennitölu (greiðandi ≠ þiggjandi) án staðfestingar; mod-11 sannprófun í viðmóti; kennitala má ekki í URL/logg.
- **Seinkun á stöðu** (bankasamræming 1–3 dagar); viðskiptavinur þarf að sjá „greiðsla móttekin“ ekki strax.
- **Hlutagreiðsla / ofgreiðsla / önnur upphæð**: engin skjalfest „partially paid“ staða — krafa er annaðhvort sent eða paid. Ef borgar rangt skilar bankinn líklega ekki kröfunni greiddri; skrifstofa handunnið.
- **Opinn endapunktur**: samþykkis-endapunktur er á netinu → token (óraunhæft að giska), hraðatakmörkun, og aðeins gated átaka á stöðu.
- Lög: rafræn samþykkt tilboðs + skilmálar eru bindandi; lögfræðileg staða skilmála/„14 daga skilaréttur“ fyrir neytendur (fjarsala/ utan atvinnuhúsnæðis) — spurning til bókara/lögfræðings.

## 7. Opnar spurningar

**Til bókara / Konto:**
- A. Hvernig er kröfu **hætt við** þegar viðskiptavinur hættir við? Er til API-kall (kreditreikningur `type:credit` afturkallar kröfuna sjálfvirkt, eða þarf handvirkt í Konto)? Hvað gerðu T-32 reikningarnir (Cancelled)?
- B. Hve margar kröfur eru innifaldar í áskriftinni (kvóti) og hvað kostar hver? Hvað gerist þegar kvóti klárast?
- C. Er til webhook / tilkynning þegar krafa er greidd? (Annars polling — í lagi.)
- D. Styður legacy API `Idempotency-Key`? Er rate limit?
- E. Hvaða dev/test-aðgang getum við fengið (maintenance-kóði) til að prófa án raunverulegra viðskiptavina?
- F. Hvernig á að meðhöndla ofgreiðslu/vangreiðslu (krafa greidd að hluta)?
- G. Á reikningur að fara sem PDF í tölvupósti *auk* kröfu (`output_select 3`), eða aðeins krafa?

**Til eiganda:**
- 1. Á G1 að vera 100 % / 50 % / 40 % af tilboði (+50 % uppsetning) eins og nú (`invoiceLines`)?
- 2. Hve lengi gildir tilboð eftir samþykki ef ekki er greitt (fyrning, áminning)? Hver hefur samband við viðskiptavin?
- 3. Má viðskiptavinur borga með korti/greiðslulinki í stað kröfu? (`is_payment_link` er til í Konto.)
- 4. Á skrifstofan að samþykkja handvirkt fyrst (öryggisnet) áður en reikningur er gefinn út, eða sjálfvirkt strax?
- 5. Hver er fastur skilmálatexti/útgáfa sem viðskiptavinur samþykkir?

**Mælt með:** fyrst svar við A + B + E (30 mín símtal við Konto/bókara), síðan bygging skv. kafla 5 með `create-invoice` á dev/einnota viðskiptavini. Varaleiðin (Bókhald) bara sem viðvörunar-samanburður.
