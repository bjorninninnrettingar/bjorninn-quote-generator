# Chatbot knowledge gaps (2026-10-30)

Written by the chatbot-knowledge round. Everything below is something customers or staff will ask that the bots
**cannot answer from facts already in the repo** — so they say "veit ekki" and escalate. Answer these (one line each is
enough), then the text goes into `faq.html` DATA + `FAQ_CORPUS` (same wording, `tests/faq-sync.test.js`) or the Studio guide.

## How the draft answers work

- 22 new Q&As in `faq.html` are marked `draft:true` (the "Drög" badge shows on /adstod). They only restate facts that were
  already written in the Studio guide / `kitchen-planner-help.js` / existing FAQ answers. Category "Hönnunartólið (Studio)" is new.
- **They are NOT in the public bot's prompt yet.** In `api/_chatbot-faq-prompt.js` a third tuple element `"draft"` keeps them out
  of `renderCorpus()`. To switch on: remove `draft:true` (faq.html) and `"draft"` (FAQ_CORPUS) per answer once reviewed, or set
  Vercel env `CHATBOT_INCLUDE_DRAFTS=1` to turn on all drafts at once (needs a redeploy). The Studio-context bot already knows
  all of these facts through its own guide, so Studio users lose nothing meanwhile.
- `npm run eval:chat -- --drafts` checks the draft answers through the public bot.

## Svarað af eiganda 2026-10-30 (komið í faq.html, FAQ_CORPUS, Studio-bot og fallback-texta)
- Mæling á staðnum: innifalin í tilboði; við gerum hana ekki ef þú ert ekki í verkefni hjá okkur.
- Biðtími frá staðfestingu til afhendingar: 8–12 vikur, mögulega fyrr; fer eftir flækjustigi.
- Tilboð gildir í 15 daga.
- Ábyrgð: 2 ár.
- Sími 779-5777 og netfang bjorninn@bjorninninnrettingar.is — botinn má gefa upp bæði (Studio-reglan „netfang eingöngu“ afnumin).
- Hönnunarpakki: heilt hús 380.000 kr (100% upp í tilboð), eldhús 240.000 (100%), skápa-teikningar 100.000 (50%), baðinnrétting 100.000 (50%), hurðir 100.000 (50%), sérpælingar tilboð.
- Uppsetning, heimsending, niðurrif/förgun: alltaf sér tilboð. Uppsetning: við sjáum um hana en höfum ekki alltaf tök á því, þá tengjum við aðra uppsetningarmenn.
- Steinborðplötur: samstarf við HQ (hq.is), 15% afsláttur ef verslað er í gegnum okkur (gamla „selur ekki stein“-textinn fjarlægður).
- Sýningarsalur aðeins eftir bókun; engin geymsla í boði; frontategundir: engin full upptalning, vísað á Efnisúrval.
- Enn óvitað: hvað er EKKI hægt að smíða (skáþak, bogadregnir frontar, litir utan EGGER), nákvæm lágmarks-/hámarksmál, og afgangur þessa skjals.

## Spurning → hvað vantar frá Ísak

### Verð og greiðslur
- Má sýna "Áætlað verð" í Studio (parkað frá 2026-10-26)? → nei sem stendur; bot nefnir aldrei verð.

### Tími
- Hversu langur tími líður frá "Senda inn" í Studio þar til tilboð kemur? (Núna: söluaðili hefur samband innan 3 virkra daga — er tilboðið komið þá, eða bara fyrsta samband?)

### Efni, höldur, borðplötur, frontar
- Er til skrá yfir EGGER-liti sem hægt er að vísa í, eða á alltaf að vísa á Efnisúrval síðuna?
- Hvaða höldur eru í boði og eru allar sýndar í Studio? Hvað kosta höldur umfram það sem er innifalið?
- Þykkt borðplatna (harðplast, compact, límtré) og hámarkslengd án samskeyta?

### Hönnun og hvað er hægt að breyta
- Hámarks-/lágmarksmál skápa og skúffa (breidd, hæð, dýpt) sem bot má nefna?
- Hvað er ekki hægt að gera: t.d. skápar undir skáþaki, bogadregnir frontar, sérstakir litir utan EGGER?
- Fataskápar: er hægt að fá innréttingu innan í (hillur, slár, skúffur) og hvað fylgir með í grunnverði?
- Rennihurðir/vasahurðir/fellihurðir: söluaðili staðfestir verð — er lágmarksbreidd eða -hæð?
- Baðherbergi: spegill og vaskur — selur Björninn vask og blöndunartæki eða bara skápana? (Studio: handlaug er bara teiknuð.)

### Mælingar, afhending, uppsetning
- Hvernig bóka ég mælingu í reynd (hlekkur) og hvað þarf að vera tilbúið (FAQ: aðgangur að veggjum, gólfi og lofti)? Er dagsetning bókuð eða kemur mælingamaður á tímabili?
- Afhending: hvar er afhent, hver ber upp, hvað gerist ef enginn er heima?
- Uppsetning: hvað tekur hún langan tíma fyrir dæmigert eldhús? (hvort við séum með eigin iðnaðarmenn er svarað: stundum, annars aðrir uppsetningarmenn)

### Fyrirtækið

### Studio (/skipuleggja)
- Hversu lengi geymast innsend gögn og hver sér þau (persónuvernd)? Þarf Studio-síðan persónuverndartexta sem bot getur vitnað í?
- Hvað gerist ef ég sendi inn aftur eftir breytingu — býr það til nýtt tilboðsbeiðni eða uppfærir það fyrra?
- Hvaða rými/atriði eru EKKI í Studio (stigar, eldstæði, sérsmíðuð húsgögn) svo bot geti sagt "nei" með vissu?

## Staff bot gaps
- `/sop` og `/velar`: bot vísar eingöngu á síðurnar (efnið er ekki afritað í repo). Vilt þú að hann geti svarað beint úr völdum SOP (t.d. neyðarstöðvun, öryggi)? Þá þarf að fara yfir hvaða texti má vera í prompti.
- Hver á að vera tengiliður þegar Ísak/Rakel eru ekki við? (Allir staff-svör enda núna á "Ísak eða Rakel".)
- Hvernig para ég nýtt stimpilklukku-tæki og hver gerir það? (Bot segir: biddu Ísak.)
- Hvaða prentari/Zebra villur eru algengastar á gólfinu og hvað er lagfæringin (bot veit aðeins "athugaðu að hann sé kveiktur og með miða").
