// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
// BjÃÂ¶rninn InnrÃÂ©ttingar Ã¢ÂÂ Quote PDF Generator
// Vercel serverless function
// Called by an Airtable automation (button) with { recordId, secret }
// Generates a PDF quote and uploads it to the Airtable record.
// Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

const chromium = require('@sparticuz/chromium-min');
const puppeteer = require('puppeteer-core');

// Ã¢ÂÂÃ¢ÂÂ Airtable config Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
const BASE_ID        = 'app91U15z9K704Okd';
const TABLE_TAEK     = 'tbl4LMXlQjp66RFKI'; // TÃÂ¦kifÃÂ¦ri (projects)
const TABLE_LINUR    = 'tblFcsUoGxsuUwNEH'; // VÃÂ¶ru lÃÂ­nur (line items)
const TABLE_VORUR    = 'tblzuuRSRkeXaLWxC'; // VÃÂ¶rulisti (product list)
const TABLE_UTFAER   = 'tbl8HjvBwNJ41cTV0'; // ÃÂtfÃÂ¦rslur (variants)
const TABLE_EFNI     = 'tbl8CrVWKF8CuI7HD'; // Efnislisti (materials)

// Field ID for the "TilboÃÂ° til sendingar" attachment field on TÃÂ¦kifÃÂ¦ri
const TILBOD_FIELD_ID = 'flddIR5JAm8ZM753V';

// Ã¢ÂÂÃ¢ÂÂ Airtable helpers Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

function airtableHeaders() {
  return {
    'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function fetchRecord(tableId, recordId) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}/${recordId}`;
  const res = await fetch(url, { headers: airtableHeaders() });
  if (!res.ok) {
    throw new Error(`Airtable fetchRecord failed [${res.status}]: ${await res.text()}`);
  }
  return res.json();
}

// Fetch multiple records by their IDs (batched into one API call per table)
async function batchFetch(tableId, recordIds, fields = []) {
  if (!recordIds || recordIds.length === 0) return [];

  const unique = [...new Set(recordIds)];
  const formula = unique.length === 1
    ? `RECORD_ID()="${unique[0]}"`
    : `OR(${unique.map(id => `RECORD_ID()="${id}"`).join(',')})`;

  const params = new URLSearchParams();
  params.set('filterByFormula', formula);
  fields.forEach(f => params.append('fields[]', f));

  const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}?${params}`;
  const res = await fetch(url, { headers: airtableHeaders() });
  if (!res.ok) {
    throw new Error(`Airtable batchFetch failed [${res.status}]: ${await res.text()}`);
  }
  const data = await res.json();
  return data.records || [];
}

// Ã¢ÂÂÃ¢ÂÂ Utilities Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

// Airtable lookup fields return arrays Ã¢ÂÂ grab the first value
const first = val => (Array.isArray(val) ? (val[0] ?? '') : (val ?? ''));

// Format ISK currency
function fmtISK(n) {
  return new Intl.NumberFormat('is-IS').format(Math.round(n || 0)) + ' kr.';
}

// Today's date as DD-MM-YYYY
function todayDate() {
  return new Date().toLocaleDateString('is-IS', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// Strip rich-text HTML tags from Airtable richText fields
function stripHtml(str) {
  return str ? String(str).replace(/<[^>]+>/g, '') : '';
}

// Ã¢ÂÂÃ¢ÂÂ HTML template Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

function buildHTML({ quoteName, customer, phone, email, notes,
                     innvols, framhlidar, lines,
                     totalExVat, vat, totalInclVat }) {
  // Build table rows, grouping by room
  let rows = '';
  let lastRoom = null;

  for (const line of lines) {
    // Room header row (only when room changes)
    if (line.room !== lastRoom) {
      rows += `
        <tr class="room-row">
          <td class="room-label">${line.room || ''}</td>
          <td colspan="8"></td>
        </tr>`;
      lastRoom = line.room;
    }

    const afslDisplay = line.afsl ? (line.afsl * 100).toFixed(0) + ' %' : '';
    // Prefer a custom work description; fall back to the variant description
    const descDisplay  = line.lysing || line.utfaersla || '';

    rows += `
      <tr>
        <td></td>
        <td>${line.vorunr}</td>
        <td>${line.tegund}</td>
        <td>${line.vara}</td>
        <td class="desc">${descDisplay}</td>
        <td class="center">${afslDisplay}</td>
        <td class="center">${line.magn}</td>
        <td class="right nowrap">${line.einingarverd}</td>
        <td class="right nowrap">${line.samtals}</td>
      </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="is">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Kumbh+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Kumbh Sans', sans-serif;
    font-size: 9pt;
    color: #000;
    background: #fff;
    padding: 28pt 36pt;
  }

  /* Ã¢ÂÂÃ¢ÂÂ Header Ã¢ÂÂÃ¢ÂÂ */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 18pt;
  }
  .logo-title { font-size: 20pt; font-weight: 700; line-height: 1.1; }
  .logo-gold  { color: #CEB163; }
  .tagline    { font-size: 7.5pt; color: #6E6E6E; margin-top: 3pt; }

  .header-right { text-align: right; }
  .quote-label  { font-size: 9pt; font-weight: 700; }
  .quote-name   { font-size: 8.5pt; border-bottom: 0.75pt solid #000; padding-bottom: 2pt; margin-bottom: 6pt; }
  .date-line    { font-size: 7.5pt; color: #6E6E6E; }

  /* Ã¢ÂÂÃ¢ÂÂ Info block Ã¢ÂÂÃ¢ÂÂ */
  .info-grid {
    display: flex;
    gap: 24pt;
    margin-bottom: 16pt;
  }
  .info-left, .info-right { flex: 1; }

  .spec-line { font-size: 8pt; margin-bottom: 2pt; }
  .spec-bold { font-weight: 700; }

  .cust-line { font-size: 8.5pt; margin-bottom: 3pt; }
  .cust-line span { border-bottom: 0.75pt solid #000; padding-bottom: 1pt; }

  /* Ã¢ÂÂÃ¢ÂÂ Table Ã¢ÂÂÃ¢ÂÂ */
  table { width: 100%; border-collapse: collapse; }

  .main-table { margin-bottom: 16pt; }

  thead th {
    font-size: 7.5pt;
    font-weight: 700;
    padding: 5pt 3pt;
    text-align: left;
    border-top: 1.5pt solid #000;
    border-bottom: 1.5pt solid #000;
    white-space: nowrap;
  }
  thead th.right  { text-align: right; }
  thead th.center { text-align: center; }

  tbody tr.room-row td.room-label {
    font-size: 7.5pt;
    font-weight: 600;
    color: #6E6E6E;
    padding: 8pt 3pt 2pt;
  }
  tbody tr:not(.room-row) td {
    font-size: 7.5pt;
    padding: 3pt 3pt;
    border-bottom: 0.5pt solid #F0F0F0;
    vertical-align: top;
  }
  td.right  { text-align: right; }
  td.center { text-align: center; }
  td.nowrap { white-space: nowrap; }
  td.desc   { max-width: 160pt; }

  /* Ã¢ÂÂÃ¢ÂÂ Totals Ã¢ÂÂÃ¢ÂÂ */
  .totals-table { width: 100%; }
  .totals-table td { font-size: 9pt; padding: 2pt 3pt; }
  .totals-table .lbl { text-align: left; }
  .totals-table .val { text-align: right; white-space: nowrap; }
  .totals-table .vsk td { text-decoration: underline; }
  .totals-table .grand td {
    font-size: 11pt;
    font-weight: 700;
    color: #CEB163;
    border-top: 1pt solid #000;
    padding-top: 5pt;
  }

  /* Ã¢ÂÂÃ¢ÂÂ Footer Ã¢ÂÂÃ¢ÂÂ */
  .footer {
    margin-top: 28pt;
    padding-top: 8pt;
    border-top: 0.5pt solid #C2C2C2;
    font-size: 6.5pt;
    color: #6E6E6E;
    text-align: center;
    line-height: 1.7;
  }
  .footer strong { font-weight: 600; color: #000; }
</style>
</head>
<body>

<!-- Ã¢ÂÂÃ¢ÂÂ Header Ã¢ÂÂÃ¢ÂÂ -->
<div class="header">
  <div>
    <div class="logo-title">
      <span class="logo-gold">BJÃÂRNINN</span> INNRÃÂTTINGAR
    </div>
    <div class="tagline">ÃÂslensk framleiÃÂ°sla ÃÂ­ meira en hÃÂ¡lfa ÃÂ¶ld</div>
  </div>
  <div class="header-right">
    <div class="quote-label">TilboÃÂ°:</div>
    <div class="quote-name">${quoteName}</div>
    <div class="cust-line">TengiliÃÂ°ur: <span>${customer}</span></div>
    <div class="cust-line">SÃÂ­mi/netfang: <span>${[phone, email].filter(Boolean).join(' / ')}</span></div>
    <div class="date-line" style="margin-top:6pt;">Dags: ${todayDate()}</div>
    <div class="date-line">TilboÃÂ° gildir ÃÂ­ 30 daga frÃÂ¡ ÃÂºtgÃÂ¡fudegi</div>
  </div>
</div>

<!-- Ã¢ÂÂÃ¢ÂÂ Material specs + comment Ã¢ÂÂÃ¢ÂÂ -->
<div class="info-grid">
  <div class="info-left">
    ${innvols    ? `<div class="spec-line"><span class="spec-bold">INNVOLS:</span> ${innvols}</div>` : ''}
    ${framhlidar ? `<div class="spec-line"><span class="spec-bold">FRAMHLIÃÂAR:</span> ${framhlidar}</div>` : ''}
  </div>
  <div class="info-right">
    ${notes ? `<div class="spec-line"><span class="spec-bold">Athugasemd:</span> ${notes}</div>` : ''}
  </div>
</div>

<!-- Ã¢ÂÂÃ¢ÂÂ Line items table Ã¢ÂÂÃ¢ÂÂ -->
<table class="main-table">
  <thead>
    <tr>
      <th style="width:52pt">(RÃÂ½mi)</th>
      <th style="width:40pt">VÃÂ¶runr</th>
      <th style="width:50pt">Tegund</th>
      <th style="width:100pt">Vara</th>
      <th>ÃÂtfÃÂ¦rsla</th>
      <th class="center" style="width:32pt">Afsl.</th>
      <th class="center" style="width:30pt">Magn</th>
      <th class="right" style="width:68pt">EiningarverÃÂ°</th>
      <th class="right" style="width:72pt">Samtals m.vsk</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>

<!-- Ã¢ÂÂÃ¢ÂÂ Totals Ã¢ÂÂÃ¢ÂÂ -->
<table class="totals-table">
  <tr>
    <td class="lbl">Samtals</td>
    <td class="val">${fmtISK(totalExVat)}</td>
  </tr>
  <tr class="vsk">
    <td class="lbl">Vsk.</td>
    <td class="val">${fmtISK(vat)}</td>
  </tr>
  <tr class="grand">
    <td class="lbl">Samtals m. vsk.</td>
    <td class="val">${fmtISK(totalInclVat)}</td>
  </tr>
</table>

<!-- Ã¢ÂÂÃ¢ÂÂ Footer Ã¢ÂÂÃ¢ÂÂ -->
<div class="footer">
  BjÃÂ¶rninn ehf | ÃÂlfhella 5 | 221, HafnarfjÃÂ¶rÃÂ°ur | bjorninn@bjorninninnrettingar.is | bjorninninnrettingar.is
  | TilboÃÂ°i fylgir hvorki uppsetning nÃÂ© flutningur nema ÃÂ¾aÃÂ° komi sÃÂ©rstaklega fram<br>
  <strong>
    SkilmÃÂ¡la Bjarnarins mÃÂ¡ finna hÃÂ©r: https://www.bjorninninnrettingar.is/skilmÃÂ¡lar
    &nbsp;|&nbsp;
    MikilvÃÂ¦gt er aÃÂ° kynna sÃÂ©r skilmÃÂ¡la en innborgun er samÃÂ¾ykki viÃÂ° skilmÃÂ¡lum
  </strong><br>
  Ath. endurgreiÃÂ°sla ÃÂ¡ staÃÂ°festingargjaldi er ekki mÃÂ¶guleg undir neinum kringumstÃÂ¦ÃÂ°um
</div>

</body>
</html>`;
}

// Ã¢ÂÂÃ¢ÂÂ Main handler Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recordId, secret } = req.body || {};

  // Simple secret check so random people can't call your endpoint
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!recordId) {
    return res.status(400).json({ error: 'recordId is required' });
  }

  try {
    // Ã¢ÂÂÃ¢ÂÂ 1. Fetch the project (TÃÂ¦kifÃÂ¦ri) record Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
    const project = await fetchRecord(TABLE_TAEK, recordId);
    const pf = project.fields;

    // Ã¢ÂÂÃ¢ÂÂ 2. Fetch all linked line items Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
    // The field name includes special characters Ã¢ÂÂ use the exact name from Airtable
    const lineItemIds = pf["VÃÂ¶ru lÃÂ­nur Ã¢ÂÂ¡Ã¯Â¸ÂÃ°ÂÂÂ¦ (Line item's)"] || [];
    // (the field name is: "VÃÂ¶ru lÃÂ­nur Ã¢ÂÂÃ°ÂÂÂ¦ (Line item's)" Ã¢ÂÂ stored as a Unicode string)
    // If the above doesn't work, try the key below (Airtable sometimes uses field IDs internally)
    // Fallback: look for any key containing "VÃÂ¶ru lÃÂ­nur"
    const lineItemIdsResolved = lineItemIds.length > 0
      ? lineItemIds
      : (() => {
          const key = Object.keys(pf).find(k => k.includes('VÃÂ¶ru lÃÂ­nur'));
          return key ? (pf[key] || []) : [];
        })();

    const lineRecords = await batchFetch(TABLE_LINUR, lineItemIdsResolved, [
      'RÃÂ½mi Ã°ÂÂÂ¡',
      'Vara Ã°ÂÂÂª',
      'ÃÂºtfÃÂ¦rsla Ã°ÂÂÂ¨',
      'Magn',
      'Afsl. %',
      'EiningarverÃÂ° texti',
      'Endanlegt sÃÂ¶luverÃÂ° texti',
      'LÃÂ½sing ÃÂ¡ verki',
      'VÃÂ¶ru reitur 1',
      'VÃÂ¶ru reitur 2',
    ]);

    // Preserve the order Airtable has them in (lineItemIdsResolved order)
    const lineMap = Object.fromEntries(lineRecords.map(r => [r.id, r]));
    const orderedLines = lineItemIdsResolved.map(id => lineMap[id]).filter(Boolean);

    // Ã¢ÂÂÃ¢ÂÂ 3. Batch-fetch products (VÃÂ¶rulisti) & variants (ÃÂtfÃÂ¦rslur) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
    const productIds = orderedLines.flatMap(r => r.fields['VÃÂ¶ru reitur 1'] || []);
    const variantIds = orderedLines.flatMap(r => r.fields['VÃÂ¶ru reitur 2'] || []);

    const [productRecords, variantRecords] = await Promise.all([
      batchFetch(TABLE_VORUR, productIds, ['Heiti vÃÂ¶ru Ã°ÂÂÂ£', 'VÃÂ¶runÃÂºmer #Ã¯Â¸ÂÃ¢ÂÂ£']),
      batchFetch(TABLE_UTFAER, variantIds, ['LÃÂ½sing ÃÂ¡ ÃÂºtfÃÂ¦rslu', 'VÃÂ¶runÃÂºmer']),
    ]);

    const prodMap    = Object.fromEntries(productRecords.map(r => [r.id, r.fields]));
    const variantMap = Object.fromEntries(variantRecords.map(r => [r.id, r.fields]));

    // Ã¢ÂÂÃ¢ÂÂ 4. Fetch material specs (Efnislisti) Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
    const skrokkaIds = pf['Skrokka efni Ã°ÂÂÂ² viÃÂ°skiptavinar'] || [];
    const frontaIds  = pf['Fronta efni viÃÂ°skiptavinar Ã°ÂÂÂ¼Ã¯Â¸Â']  || [];
    const efniIds    = [...skrokkaIds, ...frontaIds];

    const efniRecords = await batchFetch(TABLE_EFNI, efniIds, [
      'Heiti efnis',
      'EfnisnÃÂºmer / kÃÂ³ÃÂ°i #Ã¯Â¸ÂÃ¢ÂÂ£',
      'ÃÂykkt (mm)',
    ]);
    const efniMap = Object.fromEntries(efniRecords.map(r => [r.id, r.fields]));

    // Build the material spec strings (e.g. "Plastl spÃÂ³napl 16mm U963 dÃÂ¶kkgrÃÂ¡ ST2")
    const buildMatStr = id => {
      if (!id || !efniMap[id]) return '';
      const m = efniMap[id];
      const parts = [m['ÃÂykkt (mm)'] ? m['ÃÂykkt (mm)'] + ' mm' : '', m['Heiti efnis'] || ''];
      return parts.filter(Boolean).join(' ');
    };
    const innvols    = buildMatStr(skrokkaIds[0]);
    const framhlidar = buildMatStr(frontaIds[0]);

    // Ã¢ÂÂÃ¢ÂÂ 5. Build enriched line item list Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
    const lines = orderedLines.map(r => {
      const f   = r.fields;
      const pid = (f['VÃÂ¶ru reitur 1'] || [])[0];
      const vid = (f['VÃÂ¶ru reitur 2'] || [])[0];
      const prod    = prodMap[pid]    || {};
      const variant = variantMap[vid] || {};

      return {
        room:         f['RÃÂ½mi Ã°ÂÂÂ¡']                   || '',
        vorunr:       prod['VÃÂ¶runÃÂºmer #Ã¯Â¸ÂÃ¢ÂÂ£']           || '',
        tegund:       variant['VÃÂ¶runÃÂºmer']            || '', // variant code = "Tegund" column
        vara:         first(f['Vara Ã°ÂÂÂª'])             || prod['Heiti vÃÂ¶ru Ã°ÂÂÂ£'] || '',
        utfaersla:    first(f['ÃÂºtfÃÂ¦rsla Ã°ÂÂÂ¨'])         || variant['LÃÂ½sing ÃÂ¡ ÃÂºtfÃÂ¦rslu'] || '',
        magn:         f['Magn']                       ?? '',
        afsl:         f['Afsl. %']                    || 0,
        einingarverd: f['EiningarverÃÂ° texti']         || '',
        samtals:      f['Endanlegt sÃÂ¶luverÃÂ° texti']   || '',
        lysing:       f['LÃÂ½sing ÃÂ¡ verki']             || '',
      };
    });

    // Ã¢ÂÂÃ¢ÂÂ 6. Pull totals from the project record Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
    const totalExVat   = pf['TilboÃÂ°supphÃÂ¦ÃÂ°'] || 0;
    const vat          = pf['vsk.']           || 0;
    const totalInclVat = totalExVat + vat;

    const quoteName = pf['TilboÃÂ°sblaÃÂ°s heiti']
      || pf['Heiti tÃÂ¦kifÃÂ¦ris / verkefnis']
      || 'TilboÃÂ°';
    const customer  = first(pf['Fullt nafn Ã°ÂÂÂ¤']);
    const phone     = first(pf['SÃÂ­manÃÂºmer Ã¢ÂÂÃ¯Â¸Â']);
    const email     = first(pf['Netfang Ã°ÂÂÂ§']);
    const notes     = stripHtml(pf['GlÃÂ³sur']);

    // Ã¢ÂÂÃ¢ÂÂ 7. Render HTML Ã¢ÂÂ PDF Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
    const html = buildHTML({
      quoteName, customer, phone, email, notes,
      innvols, framhlidar, lines,
      totalExVat, vat, totalInclVat,
    });

    const browser = await puppeteer.launch({
      args:            chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'),
      headless:        true,
    });

    let pdfBuffer;
    try {
      const page = await browser.newPage();
      // waitUntil:'networkidle0' lets Google Fonts load before generating the PDF
      await page.setContent(html, { waitUntil: 'networkidle0' });
      pdfBuffer = await page.pdf({
        format:          'A4',
        printBackground: true,
        margin:          { top: '0', right: '0', bottom: '0', left: '0' },
      });
    } finally {
      await browser.close();
    }

    // Ã¢ÂÂÃ¢ÂÂ 8. Upload PDF to Airtable attachment field Ã¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂÃ¢ÂÂ
    const filename = `${quoteName}.pdf`;

    // Native FormData + Blob (Node 18+)
    const blob     = new Blob([pdfBuffer], { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file',        blob, filename);
    formData.append('filename',    filename);
    formData.append('contentType', 'application/pdf');

    const uploadRes = await fetch(
      `https://content.airtable.com/v0/${BASE_ID}/${recordId}/${TILBOD_FIELD_ID}/uploadAttachment`,
      {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}` },
        body:    formData,
      }
    );

    if (!uploadRes.ok) {
      const errBody = await uploadRes.text();
      throw new Error(`Airtable upload failed [${uploadRes.status}]: ${errBody}`);
    }

    return res.status(200).json({ success: true, filename });

  } catch (err) {
    console.error('[generate-quote] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
