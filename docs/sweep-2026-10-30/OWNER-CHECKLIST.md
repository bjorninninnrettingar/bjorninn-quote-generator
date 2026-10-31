# Owner checklist, 2026-10-30

Everything below was fixed and tested with mocks or node tests only. Nothing has run against the real Airtable base. Click through each once with the real key and tick it off.

## Do by hand (cannot be done from code)
- [ ] **Vercel Firewall → Rate limiting**: path `/api/skrifstofa-login`, method POST, key IP, 10 requests per 1 minute, action deny. (The in-code lockout is per warm instance only; this is the real protection.)
- [ ] **VSK due dates 2027** (guessed, marked "owner to confirm" in skrifstofa.html): 2027-04-05, 06-07, 08-05, 10-05, 12-06.
- [ ] **Anthropic Console**: monthly spend limit + auto-reload on the account. The $5 from August ran out on 2026-10-30; $20 added.
- [ ] **Airtable**: bulk-delete the fields tagged `🗑️ EYÐA`.
- [ ] `git stash drop` (stash@{0} is a stale autostash, everything in it is already on main).
- [ ] Run `source .env.local && npm run test:live` (read-only) to check hard-coded Airtable ids.

## PRO (docs/sweep-2026-10-30/pro.md)
- [ ] Vista, then edit something while it saves (big project): chip stays "● óvistað", a second Vista saves the edit.
- [ ] Save from a second tab, then Vista in the first: the 409 dialog focuses "Hætta við"; Enter does not overwrite.
- [ ] Edit, Vista, Afturkalla: first click works, next Vista gives no false 409.
- [ ] Teikningar re-upload: exactly one new PDF afterwards; a failed upload keeps the old one.
- [ ] Multi-room project over 99k characters: red card with sizes, nothing written.
- [ ] Remove or replace the first cabinet of a counter run: depth, overhang, sink cutout and joint stay, toast appears.
- [ ] Rennihurð, then change Skipting fronta: Vista names the Sk numbers.
- [ ] Reset the drawing in PRO: lands on the Byrja picker; next Vista has no false "someone else saved".

## Office (docs/sweep-2026-10-30/office.md)
- [ ] Wrong PIN 6 times: lockout message in Icelandic (429).
- [ ] `/ferli` board shows only live projects; an API error shows the retry note.
- [ ] Tick and untick a `Tilbúið 🔒` box and reload.
- [ ] `/pontun` on a throwaway project: change an order status; "Senda í Skipulagsleið →" opens `/ferli`.
- [ ] `/crm`: drag a deal to "Tilboð sent": a confirm appears.
- [ ] `/skrifstofa`: drag a job to "Má afhenda": the confirm names the Konto draft.
- [ ] `/yfirferd?recordId=<unit id>` lands on that unit in `/ferli`.
- [ ] `LOCKS_ON` in `/ferli` is still false (deliberate).

## Studio (docs/sweep-2026-10-30/studio2.md)
- [ ] `/skipuleggja` at 1024 wide, in an editor: "Rýmin þín" is visible and clickable.
- [ ] Senda inn with an empty or "123" phone: separate message, focus on the field.
- [ ] Toolbar says "Innvols" and the toggle works.
- [ ] Fataskápur and Bað, first entry into a room: the room sits above the "Viltu fá tillögu" card.
- [ ] Senda inn with a wardrobe: its thumbnail is a floor plan.
- [ ] Wall 2 page ("← Fyrri veggur"): a gap above "Bæta við".

## Floor and other pages (not tested with real data)
- [ ] `/saga` with a confirmed plan (dark theme, name not truncated).
- [ ] `/verk` with a real project.
- [ ] `/app`: bell size, "Sög" opens a usable `/labels` on a phone.
- [ ] `/sop` loads the SOPs (now behind the floor key).
- [ ] Chatbot on a floor phone: ask 3 questions on `/labels`, `/velja`, `/cutlist`.

## Decisions still open
- Second Eldhús in "Bæta við rými" (Studio says "Í verkefninu · 1" yet allows another): one per type?
- Studio primary button: black pill (welcome) vs blue rectangle (rest).
- Emoji: line icons vs keep emoji on floor tiles and office pages.
- Nav chip "SÖGUNARLISTI" (links to /labels): rename "MERKINGAR"?
- `/smida` project picker; `/app` offline shell; SOP key is the shared workshop key (visible in page source).
- Questions for Isak in docs/chatbot-gaps.md; 22 draft FAQ answers waiting for review.

## Próf eftir smíði 30.–31.10 (T-32 = prufuverk, notaðu aðeins það)
Hvert próf tekur um 5 mínútur. Merktu við og segðu mér hvað fór úrskeiðis.

### Smíða (PRO), lota 2
- [ ] Opnaðu skáp í Smíða → Staðsetning: sést „Hilla 1 af N“, myndavélin á hillunni, reiturinn með núverandi mm?
- [ ] Ýttu á Rétt → ✓. Ýttu aftur → fer til baka. Veldu Laus: gatafjöldi og bil með tölum; Rétt án þess að snerta þær heldur tölunum.
- [ ] Dragðu hillu/slá upp í gegnum aðra: hún fer í gegn; innan við 40 mm frá annarri → villa í Yfirliti.
- [ ] Lamir: „Löm 1 af N“, myndavél nálægt, aðeins sú löm teiknuð; rauð löm sýnir ástæðu, „Færa í N mm“ lagar; „Allar lamir rétt“ kemur á síðustu löm hurðar.
- [ ] Raðborun sýnir Af í bláu. Valið er blátt alls staðar. Yfirlit er í réttum litum.
- [ ] Ný eining í PRO: fataskápur sýnir „Tilbúnar lausnir“ og „Stakir hlutir“; Áfram setur skápinn í herbergið og heldur áfram í Smíða; Til baka tekur hann út.
- [ ] „Rýmin í þessu verki“: kort með „X / Y Klár“, „Halda áfram“ opnar rétt herbergi.

### Bitar í lofti
- [ ] Veldu bita → „Sýna loft“. Bláa rammann, punktur og fjarlægðir sjást.
- [ ] Drag: mjúkt í 10 mm skrefum; Shift = 1 mm; smellur að vegg innan 5 cm.
- [ ] Snúningshandfang: 5° skref, festist á 0/45/90. Sláðu 30 í „Snúningur (°)“.
- [ ] Esc í miðju dragi skilar bitanum; Ctrl+Z; drag út úr herbergi gefur skilaboð.

### Áfella (veggur)
- [ ] PRO: sláðu 60 mm við vegg-enda; skápar færast eða skilaboð um að þetta passi ekki.
- [ ] Vista → í Airtable Line Item `AF1` með Smíðagögn `w:60`. (Studio sendir enn engar AF-línur: flaggið `AFELLA_LINES_IN_STUDIO_SUBMIT` er slökkt.)
- [ ] Keyra skipulag → Eyðublað „Áfella“ 60 × hæð → röð „Áfella“ í Sögunarlista → fermetrar í Pöntunarlista.
- [ ] Segðu mér þegar þetta virkar, þá kveiki ég á Studio-sendingunni.

### Vasahurð (Revego/Hawa)
- [ ] Ný eining → Tækjaskápar → Vasahurð, breidd 90 cm: uno, texti „Vasinn tekur 100 mm af 900 mm. Innanmál: 800 mm“.
- [ ] 95 cm: uno rautt, valið færist í duo (150 mm). 40 cm: „of mjór“.
- [ ] Hawa → „2 hurðir, felli“: textinn nefnir pláss sem áætlun.
- [ ] Loka/Opna hurð: lokað í sléttu án handfanga, opið í vasa. Ofanmynd sýnir vasadraug. Sökkull: Nei tekur sökkulinn.

### Eyja
- [ ] Ný eining → Eyja → Ein röð → A2 → Háir skápar → Hurðir með hillum: úthliðar á báðum endum og báðum hliðum háa skápsins.
- [ ] 3D: bakið í þremur hlutum (lágt, 2500, lágt); borðplatan í tveimur hlutum, endinn við háa skápinn án yfirhangs.
- [ ] Veldu eyjuna: fjarlægðir í mm í litum; sláðu 1050 í „Bil frá vegg 1“ → hún færist.
- [ ] Biti yfir háa skápnum: „rekst á biti“ og eyjan fer ekki undir bitann.
- [ ] „Bæta við úthliðum“ á eyju án háa skápsins; „＋ Skápur“ opnar Ný eining með öllum einingum.

### Gólf og skrifstofa (í síma)
- [ ] `/app`: öll tákn eru línutákn; `/verk-i-gangi` og verk án emoji; `/velar` og `/sop` flokkar.
- [ ] `/smida` án verkefnis: listi með leit; veldu verkefni og venjuleg Smíða opnast.
- [ ] Settu `/app` á heimaskjáinn, flugstilling, opnaðu aftur: skelin sést og „Ekkert net“.
