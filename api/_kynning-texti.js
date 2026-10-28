// api/_kynning-texti.js — every piece of fixed wording in "Búa til kynningu (PDF)" in ONE place, so the owner can edit it
// without touching the layout code (api/kynning-pdf.js). Plain Icelandic, no emoji. Only characters that Helvetica
// (WinAnsi) can print: á é í ó ú ý þ ð æ ö are fine; arrows, check marks, emoji are not (they are dropped).

// What a customer pays for the 2D work drawings. The owner will give the number — until then the text below is printed.
// Change this ONE constant, e.g. "145.000 kr. með vsk".
export const PRICE_2D = "3.000 kr. á rými"; // owner 2026-10-28; VSK basis not stated — confirm whether it is with or without VSK
export const NOTE_2D_TITLE = "Vinnuteikningar í 2D";
export const NOTE_2D = (price = PRICE_2D) => `2D vinnuteikningar eru í boði gegn greiðslu: ${price}.`;

// "Ferlið frá tilboði til uppsetningar" — one page. The durations are PLACEHOLDERS (marked "til staðfestingar" on the page)
// until the owner gives the real typical times. Edit title / text / duration freely; add or remove steps as needed.
export const PROCESS_TITLE = "Ferlið frá tilboði til uppsetningar";
export const PROCESS_INTRO = "Svona gengur verkið fyrir sig eftir að þú hefur samþykkt tilboðið. Tímarnir eru viðmið og fara eftir stærð verkefnisins.";
export const PROCESS_DURATION_NOTE = "Tímarnir eru til staðfestingar (viðmið, ekki loforð).";
export const PROCESS_STEPS = [
  { title: "Samþykki", text: "Þú samþykkir tilboðið og við staðfestum verkið og greiðslufyrirkomulag.", duration: "1 til 2 dagar" },
  { title: "Mæling á staðnum", text: "Við komum og mælum rýmið svo allt passi nákvæmlega.", duration: "1 til 2 vikur frá samþykki" },
  { title: "Endanleg teikning", text: "Við útbúum endanlega teikningu sem þú yfirfer og samþykkir áður en framleiðsla hefst.", duration: "1 vika" },
  { title: "Framleiðsla", text: "Innréttingin er smíðuð á verkstæðinu okkar eftir samþykktri teikningu.", duration: "4 til 6 vikur" },
  { title: "Afhending og uppsetning", text: "Við afhendum og setjum innréttinguna upp hjá þér.", duration: "1 til 3 dagar" },
];

// Section names (also the table of contents)
export const SEC = {
  moodboard: "Efnisval",
  drawings: "Þrívíddarteikningar",
  report: "Verkefnaskýrsla og ferlið",
  quote: "Tilboð",
};
export const COVER_TAG = "Kynning á innréttingu";
export const VAT_PCT = 24;
