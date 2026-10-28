// PRO (Rakel's designer, ?pro=<rec>) — leiðsögn, Hjálp og skýrir villutextar (2026-10-28, PRO UX audit #6, #13).
// Pure data + string builders so tests can read them without the page. Icelandic only: PRO stays Icelandic and is
// NOT read by the Studio chatbot (the customers' kitchen-planner-help.js is) — PRO words (Sk, Smíða, Yfirferð) stay
// out of what the chatbot tells a customer.
(function(root){
  // ---- Hjálp → „Hvernig…?“ in PRO ----
  var C1 = "Byrja", C2 = "Teikna og smíða", C3 = "Yfirferð og tilboð";
  root.KPHELP_PRO = [
    { cat:C1, q:"Hvað er Sk?", a:"Sk er skápanúmerið. Hver eining í teikningunni fær Sk1, Sk2 … og sama númer er á línunni í Airtable, í Smíða, á Eyðublaðinu og á teikningunum. Kveiktu á „Sk-númer“ yfir 3D myndinni til að sjá númerin á skápunum." },
    { cat:C1, q:"Hvar byrja ég?", a:"Rými (veldu eða bættu við rými) → Rýmið (lögun og mál í mm) → Teikning. Í Teikningu setur þú inn skápa með „＋ Ný eining“, velur efni í Efni-valmyndinni, yfirferð hvern skáp í Smíða og endar á Yfirferð og Tilboð." },
    { cat:C1, q:"Hvar vistast teikningin?", a:"Sjálfkrafa í þessum vafra á meðan þú vinnur (efst stendur „óvistað“ þar til þú vistar). Í Airtable fer hún þegar þú ýtir á „Vista“ og svo „Vista í Airtable“ í Yfirferð. Ef þú lokar flipanum óvistaðri er afritið aðeins í þessum vafra." },
    { cat:C2, q:"Hvernig set ég inn skáp?", a:"„＋ Ný eining“ hægra megin við 3D myndina. Veldu tegund, stilltu málin í mm og innvolsið og ýttu á „Setja inn“. Þú getur dregið skápinn eftir veggnum (bláar línur sýna hvar hann smellur við næsta), hægrismellt til að kíkja inn og ýtt á Delete til að eyða." },
    { cat:C2, q:"Hvað er Smíða?", a:"Smíða er kassaritillinn á hverjum skáp: gerð hurðar, lamir, hillur, skúffuhæðir, ofn og innskúffur — það sem CNC borar og Pöntunarlistinn pantar. Smelltu á skáp í teikningunni og ýttu á „Smíða“. Grænt „Yfirfarinn →“ merkir skápinn tilbúinn og opnar þann næsta." },
    { cat:C2, q:"Hvað þýðir rauður ⛔ í Smíða?", a:"Skápurinn gengur ekki upp (skúffur fylla ekki skápinn, of fáar lamir, löm lendir á hillu). Textinn segir hvað er rangt og hvað á að gera. Ýttu á „Laga“ við hann — það breytir um eitt skref sem hægt er að afturkalla (Afturkalla eða Cmd+Z) — eða lagaðu það sjálf/ur í Smíða." },
    { cat:C2, q:"Hvernig vel ég efni?", a:"Efni-valmyndin í tækjastikunni yfir myndinni: skrokkur, skúffukerfi, framhlið, höldur og borðplata. Gult „óákveðið“ merkir sjálfgefið efni sem enginn hefur valið — veldu það, eða staðfestu í Yfirferð að sjálfgefna efnið sé rétt. Hvert rými getur haft sín efni." },
    { cat:C3, q:"Hvað er Yfirferð og talan 2/12?", a:"Yfirferð er listinn sem verkefnið þarf að komast í gegnum áður en það fer í framleiðslu: rýmið teiknað og mælt, efni valin, hver skápur tengdur vöru og yfirfarinn í Smíða, engar ⛔ villur. Talan sýnir hve margar línur eru grænar. Smelltu á línu til að fara þangað sem hún er löguð." },
    { cat:C3, q:"Hvað gerist þegar ég ýti á Klár til framleiðslu?", a:"Teikningin vistast í Airtable, Eyðublöð eru búin til úr línunum og verkefnið læsist (skoðunarhamur). Hnappurinn kviknar aðeins þegar allar línur í Yfirferð eru grænar. „Opna til breytinga“ opnar verkefnið aftur — þá þarf að keyra pöntunarlistann aftur, láttu Ísak vita." },
    { cat:C3, q:"Hvernig sendi ég tilboð?", a:"„Tilboð“ efst: yfirfarðu verðið, ýttu á „Prenta tilboð“ til að fá PDF eða senda tilboðið til viðskiptavinar. Afsláttur og álag eru bara sýnileg skrifstofunni — viðskiptavinurinn sér aðeins lokaverðið." },
    { cat:C3, q:"Hvernig opna ég læst verkefni?", a:"Verkefni sem er komið í skipulag er í skoðunarham. „Opna til breytinga“ efst opnar það. Breytingar eftir að framleiðsla hefst þarf að keyra aftur í gegnum pöntunarlistann — láttu Ísak vita áður en þú breytir." }
  ];

  // ---- Leiðsögn (the PRO tour) — selectors tried in order; none visible = a centred card ----
  // Steps point at real controls and "Næsta →" always works (same behaviour as the customers' tour).
  root.KPPROTOUR = [
    { center:true, next:"Sýna mér →", title:"Velkomin í PRO",
      html:"Hér teiknar þú verkefni fyrir viðskiptavin og skilar því tilbúnu í framleiðslu. Fimm stutt skref, hálf mínúta. Þú getur alltaf sleppt eða ýtt á Esc." },
    { sel:["#edNewUnit"], next:"Næsta →", title:"Teiknaðu rýmið",
      html:"<b>＋ Ný eining</b> setur inn skáp. Málin eru í mm. <ul class=\"tour-list\"><li><b>Dragðu</b> skáp eftir veggnum — bláar línur sýna hvar hann smellur</li><li><b>Hægrismelltu</b> til að kíkja inn, <kbd>Delete</kbd> eyðir</li><li><b>Sk1, Sk2 …</b> eru skápanúmerin — kveiktu á Sk-númer yfir myndinni til að sjá þau</li></ul>" },
    { sel:[".ed-menus .cat-sec[data-sec=\"efni\"] > summary", "#catalogPanel .cat-sec[data-sec=\"efni\"] > summary"], next:"Næsta →", title:"Veldu efni",
      html:"Skrokkur, skúffukerfi, framhlið, höldur og borðplata. Gult <b>óákveðið</b> er sjálfgefið efni sem enginn hefur valið — veldu það, eða staðfestu í Yfirferð." },
    { center:true, next:"Næsta →", title:"Smíða — hver skápur yfirfarinn",
      html:"Smelltu á skáp og ýttu á <b>Smíða</b>: hurðir, lamir, hillur, skúffur, ofn. Rauður <b>⛔</b> segir hvað er rangt og hvað á að gera — ýttu á <b>Laga</b>. Grænt <b>Yfirfarinn →</b> merkir skápinn tilbúinn og opnar þann næsta." },
    { sel:["#proYfirferd", "#proSave", "#proBar"], next:"Næsta →", title:"Yfirferð",
      html:"Listinn sem verkefnið þarf að komast í gegnum áður en það fer í framleiðslu. Talan sýnir hve margar línur eru grænar. Smelltu á línu til að fara þangað sem hún er löguð. <b>Klár til framleiðslu</b> kviknar þegar allt er grænt og læsir verkefninu." },
    { sel:["#proTilbodToggle", "#proBar"], next:"Næsta →", title:"Tilboð",
      html:"Verð, afsláttur og álag (aðeins skrifstofan sér þau) og PDF fyrir viðskiptavininn. Teikningarnar fylgja með." },
    { center:true, next:"Byrja", title:"Gangi þér vel!",
      html:"<ul class=\"tour-list tour-keys\"><li><kbd>←</kbd> <kbd>→</kbd> færa valinn skáp (<kbd>Shift</kbd> = fínt)</li><li><kbd>Delete</kbd> eyðir · <kbd>Cmd/Ctrl+Z</kbd> afturkallar · <kbd>Esc</kbd> afvelur</li></ul><p class=\"tour-note\">Hjálp efst til hægri: „Hvernig…?“ svarar Sk, Smíða, Yfirferð og tilboði — og „Sýna leiðsögnina“ spilar þetta aftur.</p>" }
  ];

  // ---- Yfirferð / Smíða issue texts: "Hvað er rangt — hvað á að gera" (audit #13) ----
  // Every text says what to click. „Laga“ is the button beside the text in Smíða; in Yfirferð the line opens that cabinet.
  var r = Math.round;
  root.KPPROTEXT = {
    drawerSum:function(sum, space){
      var d = r(space) - r(sum);
      return "Skúffuhæðirnar eru samtals " + r(sum) + " mm en skápurinn þarf " + r(space) + " mm (" + (d > 0 ? d + " mm vantar" : -d + " mm of mikið") + ") — ýttu á „Laga“ til að jafna þær, eða stilltu hæðirnar í Smíða.";
    },
    drawerMin:function(label, h, min){
      return label + " skúffa er " + r(h) + " mm, minnst " + min + " mm — ýttu á „Laga“ til að hækka hana, eða stilltu hæðirnar í Smíða.";
    },
    hingeCount:function(label, box, need, have){
      var miss = need - have;
      return label + ": " + box + " mm há hurð þarf minnst " + need + " lamir en hefur " + have + " — ýttu á „Laga“ til að bæta " + (miss === 1 ? "einni" : miss) + " við.";
    },
    // ---- Tilboð: afsláttur og álag (audit #11) ----
    // Typed percent -> what is allowed: 0-30 (more is clamped), above 15 asks "ertu viss?" first.
    tilbodDiscount:function(raw){
      var v = raw === "" || raw == null ? 0 : Number(String(raw).replace(",", "."));
      if (!isFinite(v) || v < 0) v = 0;
      var clamped = v > 30; if (clamped) v = 30;
      return { value:v, clamped:clamped, confirm:v > 15 };
    },
    tilbodConfirm:function(v){ return "Afsláttur " + v + " % lækkar verð allra lína — ertu viss?"; },
    // The visible sentence in the panel (not only a tooltip): what the number above already contains.
    tilbodFactors:function(pct, markupLabel){
      var parts = [];
      if (pct > 0) parts.push(pct + " % afsláttur");
      if (markupLabel) parts.push("álagning " + markupLabel);
      return "Verðið að ofan er það sem viðskiptavinurinn sér" + (parts.length ? " — " + parts.join(" og ") + " er þegar inni í því" : "") + ". Afsláttur og álag sjást aðeins hér; smáverka álagning er álag fyrir lítil verk.";
    },
    hingeHit:function(label, from, what, noun){
      return label + ": löm " + from + " lendir á " + what + " — ýttu á „Laga“ til að færa lömina, eða færðu " + (noun || "hilluna") + ".";
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
