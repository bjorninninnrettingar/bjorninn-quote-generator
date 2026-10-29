# PRO — lifandi úttekt (2026-10-29, engar breytingar gerðar)

Aðferð: staðbundinn þjónn (allar skrifbeiðnir læstar) + sýndarverkefni, 1440×900 og 1280×720, nýtt verkefni teiknað frá grunni (Eldhús → Rýmið → Teikning → grunnskápur með skúffum og með hurðum → Smíða-wizard → Yfirferð → Tilboð → Teikningar → Hurðir → Mæling → Hjálp → Skoða → Rými → Sökkull → Efni). Ósnert/ósannreynt: Vista/Keyra skipulag á alvöru Airtable, Frá Studio, Merkja yfirfarna, Veggur→Merkingar, Málband/X-Ray/Ganga um, fleiri rými, drag-and-drop með mús.

## Staðfest lagað síðan kóðaúttektina 2026-10-28
Skref 4–5 í stepper (Yfirferð, Tilboð); PRO-leiðsögn (5 skref) + PRO-Hjálp; Cmd/Ctrl+S; proFail/Vista-villa býður „Velja verkefni“; Smíða = Ný eining wizard með Rétt-staðfestingu.

## Nýtt / enn opið (raðað eftir því hversu líklegt er að Rakel festist eða geri mistök)
A. Mistök / villandi
1. „✓ Línur í Airtable sem eru ekki í teikningunni — Gat ekki athugað (ekkert samband)“: bilað próf birtist sem GRÆNT og telst með í 9/12. Bilað próf má aldrei telja sem staðist.
2. „Vistun tókst ekki · ● óvistað“ helst í stikunni eftir að Yfirferð er lokað og meðan hún vinnur í öðru; stepper helst á „4. Yfirferð“ þegar spjaldið er lokað og hún er aftur í Teikningu.
3. Ný verkefni sýna strax „● óvistað“ og „Yfirferð 4/12“ áður en nokkuð er gert.
4. Eyða skáp: engin staðfesting, engin „Afturkalla“-tilkynning (bara Cmd+Z) — 8 smellir í Smíða tapast hljóðlega. Sama með að loka wizard hálfkláruðum (engin viðvörun).
5. Native `confirm()` á 11 stöðum (Byrja upp á nýtt — falið í Hjálp-valmynd, lögun rýmis, eyða vegg, skúffukerfisskipti, eyja, Tilboðs-afsláttur, eyða HU) — grátt vafra-box í annars samræmdu viðmóti; „Byrja upp á nýtt“ (eyðir allri hönnun) á ekki heima í Hjálp.
6. Tilboð-spjald sýnir hrá villuskilaboð („Verð: <tæknilegur strengur>“) þegar verð næst ekki; hvítt autt blað í miðju.
7. Hurðir-síðan fjarlægir alla PRO-stikuna (nafn verkefnis, Vista, Yfirferð…) — aðeins „Til baka/Áfram →“; lína „HU-1: Engin vara fannst…“ birtist strax við nýja tóma línu.
8. Haus: nafn verkefnis skarast á „BJÖRNINN STUDIO“ á skrefi 1 (Rými) — sést bæði í 1440 og 1280.

B. Of mörg skref / hægt
9. Smíða-wizard: 3-skúffu grunnskápur = Breidd Rétt, Hæð Rétt, Dýpt Rétt, 3× skúffuhæð Rétt, Yfirlit Klár = 8 aðgerðir; hurðaskápur 10+ (lamir). Á 24 skápum ~200 smellir. Vantar „Rétt allt“ í hluta/skáp. Ný eining sem hún valdi sjálf (breidd 600) er beðin um að staðfesta 600 aftur.
10. „Rýmið er klárt“ lokaskjárinn hefur aðeins „Loka“ — enginn „Áfram í Yfirferð“.
11. Yfirferð-spjald: 12 línur, 1359 px hátt; „Vista í Airtable“ og „Klár til framleiðslu“ eru á y=1230 á 900 px skjá (ekki sticky) — aðalaðgerðin er neðst eftir skrun.
12. Vista = opnar Yfirferð (ekki vistun). Cmd+S gerir það sama.

C. Rugl í orðalagi / skipulagi
13. „2D“ = veggmynd (Veggur 1 af 4), „Ofanmynd“ = grunnmynd; fólk býst við að 2D sé grunnmynd. Ofanmynd klippir „Veggur 1/3“ merkin við brún á 1440×900 og hefur engan zoom/fit-hnapp.
14. „Hurðir“ (stika, innihurðir/HU) vs „Hurð“ í Gluggar og hindranir (hurðarop) — sama orð, tvennt ólíkt. „HU-línur“, „Eyðublað“, „V1“, „Sk“ óútskýrð í viðmóti.
15. Lofthæð má breyta á 3 stöðum (Rýmið-síða, Rými-valmynd, Mæling) án þess að sjá hver gildir.
16. Efni: „ÓÁKVEÐIÐ + Staðfesta“ á hverju efni OG „Sjálfgefnu efnin eru rétt“ í Yfirferð (tvær leiðir að sama); Efni-valmyndin opnast sjálf við fyrsta Teikning og skarast við leiðsögnina (tveir yfirlagsgluggar í einu); Framhlið = litasýni + ~70 nafna texti (afrit).
17. Sk-númer er slökkt sjálfgefið í PRO þó það sé vinnumál; Ganga um / Málband / X-Ray / Vista mynd í sömu valmynd (blanda aðgerða og rofa).
18. Hjálp-valmynd í PRO: aðeins „Hvernig…?“ og „Byrja upp á nýtt“ — „Sýna leiðsögnina“ (skv. skjölum) vantar.
19. Sökkull-hnappur sýnir ekki gildið (100); popover með 4 reitum fyrir 4 veggi; setningin „Breytir aðeins hvað ‚Hæð‘ sýnir…“ óskýr; „Á alla veggi og eyjur“ við hlið tómra mm-reits.
20. Skápaspjald (hægri): „Smíða — skápur yfirfarinn ✓“ er hnappur sem lítur út eins og staða; „✕“ bæði lokar spjaldi og „✕ Fjarlægja“ eyðir; flipinn Annað: 20 tegundir sem flatur listi; Innvols: eins stafs dálkar N M K E P og „hlið 91“ án skýringar.
21. Smíða-wizard: forsýning með HVÍTUM bakgrunni og hvít rönd undir „chips“-yfirlitinu í dökku þema (litavilla); „Staðsetning: Skúffa Djúp · Sérhæð“ torskilið; lamir hurðar sjást í perspective og erfitt að lesa.
22. Emoji enn til: ⛔ í Hjálp („Hvað þýðir rauður ⛔“) og í leiðsögn skref 3.

D. Pláss / breidd
23. Öll spjöld (Yfirferð 360, Tilboð 558 hvítt, Mæling 360, Sk-spjald) eru yfirlög sem útiloka hvert annað og hylja senuna/Áfram-hnapp; ekki hægt að hafa Mæling og Teikningu opin saman. (Sama „modular“-hugmynd og skrifstofusíðurnar.)
24. Verkefnaval (`?pro=home`): þröngur miðjaður dálkur, hálfur skjárinn auður; raðir sýna bara nafn + stöðu (ekki viðskiptavin/síðast vistað); „Nýtt verkefni“ langt frá titli.
25. 3D-myndavél sýnir allt herbergið (5,6 m) þegar unnið er með 60 cm skáp: skápur lítill; engin „Zoom á valinn skáp“-flýtileið sjáanleg.
