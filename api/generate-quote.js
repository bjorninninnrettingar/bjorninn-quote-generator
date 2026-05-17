// ─────────────────────────────────────────────────────────────────────────────
// Björninn Innréttingar – Quote PDF Generator
// Vercel serverless function
// Called by an Airtable automation (button) with { recordId, secret }
// Generates two PDFs: full detail + room summary, uploads both to Airtable.
// ─────────────────────────────────────────────────────────────────────────────

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// ── Airtable config ────────────────────────────────────────────────────────────
const BASE_ID        = 'app91U15z9K704Okd';
const TABLE_TAEK     = 'tbl4LMXlQjp66RFKI'; // Tækifæri (projects)
const TABLE_LINUR    = 'tblFcsUoGxsuUwNEH'; // Vöru línur (line items)
const TABLE_VORUR    = 'tblzuuRSRkeXaLWxC'; // Vörulisti (product list)
const TABLE_UTFAER   = 'tbl8HjvBwNJ41cTV0'; // Útfærslur (variants)
const TABLE_EFNI     = 'tbl8CrVWKF8CuI7HD'; // Efnislisti (materials)

// Field ID for the "Tilboð til sendingar" attachment field on Tækifæri
const TILBOD_FIELD_ID = 'flddIR5JAm8ZM753V';

// ── Airtable helpers ───────────────────────────────────────────────────────────

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

// ── Utilities ──────────────────────────────────────────────────────────────────

// Airtable lookup fields return arrays – grab the first value
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

// ── Grouping logic ─────────────────────────────────────────────────────────────
// Groups line items by Rými. A non-empty Rými starts a new group.
// Items with an empty Rými inherit the last named room above them.
// Totals are parsed from "Endanlegt söluverð texti" (pre-formatted ISK string).
// Returns: [{ name, count, total }, ...]

function parseISK(str) {
  if (!str) return 0;
  // Strip " kr." and Icelandic thousand-separators (dots), parse as integer
  return parseInt(String(str).replace(/[^\d]/g, ''), 10) || 0;
}

function groupByRymi(lines) {
  const groups = [];
  let current = null;

  for (const line of lines) {
    const rymiName = (line.room || '').trim();

    if (rymiName) {
      current = { name: rymiName, count: 0, total: 0 };
      groups.push(current);
    } else if (!current) {
      // Items before any named room
      current = { name: 'Óskilgreint', count: 0, total: 0 };
      groups.push(current);
    }

    current.count += 1;
    current.total += parseISK(line.samtals);
  }

  return groups;
}

// ── Shared CSS ─────────────────────────────────────────────────────────────────

const SHARED_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Kumbh Sans', sans-serif;
    font-size: 9pt;
    color: #000;
    background: #fff;
    padding: 28pt 36pt;
  }

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
`;

// ── Shared HTML fragments ──────────────────────────────────────────────────────

function buildHeaderHTML({ quoteName, customer, phone, email, innvols, framhlidar, notes }) {
  return `
<div class="header">
  <div>
    <div class="logo-title">
      <span class="logo-gold">BJÖRNINN</span> INNRÉTTINGAR
    </div>
    <div class="tagline">Íslensk framleiðsla í meira en hálfa öld</div>
  </div>
  <div class="header-right">
    <div class="quote-label">Tilboð:</div>
    <div class="quote-name">${quoteName}</div>
    <div class="cust-line">Tengiliður: <span>${customer}</span></div>
    <div class="cust-line">Sími/netfang: <span>${[phone, email].filter(Boolean).join(' / ')}</span></div>
    <div class="date-line" style="margin-top:6pt;">Dags: ${todayDate()}</div>
    <div class="date-line">Tilboð gildir í 30 daga frá útgáfudegi</div>
  </div>
</div>

<div class="info-grid">
  <div class="info-left">
    ${innvols    ? `<div class="spec-line"><span class="spec-bold">INNVOLS:</span> ${innvols}</div>` : ''}
    ${framhlidar ? `<div class="spec-line"><span class="spec-bold">FRAMHLIÐAR:</span> ${framhlidar}</div>` : ''}
  </div>
  <div class="info-right">
    ${notes ? `<div class="spec-line"><span class="spec-bold">Athugasemd:</span> ${notes}</div>` : ''}
  </div>
</div>`;
}

function buildTotalsHTML({ totalExVat, vat, totalInclVat }) {
  return `
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
</table>`;
}

const FOOTER_HTML = `
<div class="footer">
  Björninn ehf | Álfhella 5 | 221, Hafnarfjörður | bjorninn@bjorninninnrettingar.is | bjorninninnrettingar.is
  | Tilboði fylgir hvorki uppsetning né flutningur nema það komi sérstaklega fram<br>
  <strong>
    Skilmála Bjarnarins má finna hér: https://www.bjorninninnrettingar.is/skilmálar
    &nbsp;|&nbsp;
    Mikilvægt er að kynna sér skilmála en innborgun er samþykki við skilmálum
  </strong><br>
  Ath. endurgreiðsla á staðfestingargjaldi er ekki möguleg undir neinum kringumstæðum
</div>`;

// ── Detail HTML template ───────────────────────────────────────────────────────

function buildDetailHTML({ quoteName, customer, phone, email, notes,
                           innvols, framhlidar, lines,
                           totalExVat, vat, totalInclVat }) {
  let rows = '';
  let lastRoom = null;

  for (const line of lines) {
    if (line.room !== lastRoom) {
      rows += `
        <tr class="room-row">
          <td class="room-label">${line.room || ''}</td>
          <td colspan="8"></td>
        </tr>`;
      lastRoom = line.room;
    }

    const afslDisplay = line.afsl ? (line.afsl * 100).toFixed(0) + ' %' : '';
    const descDisplay = line.lysing || line.utfaersla || '';

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
  ${SHARED_CSS}

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
</style>
</head>
<body>

${buildHeaderHTML({ quoteName, customer, phone, email, innvols, framhlidar, notes })}

<table class="main-table">
  <thead>
    <tr>
      <th style="width:52pt">(Rými)</th>
      <th style="width:40pt">Vörunr</th>
      <th style="width:50pt">Tegund</th>
      <th style="width:100pt">Vara</th>
      <th>Útfærsla</th>
      <th class="center" style="width:32pt">Afsl.</th>
      <th class="center" style="width:30pt">Magn</th>
      <th class="right" style="width:68pt">Einingarverð</th>
      <th class="right" style="width:72pt">Samtals m.vsk</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>

${buildTotalsHTML({ totalExVat, vat, totalInclVat })}
${FOOTER_HTML}

</body>
</html>`;
}

// ── Summary HTML template ──────────────────────────────────────────────────────

function buildSummaryHTML({ quoteName, customer, phone, email, notes,
                            innvols, framhlidar, groups,
                            totalExVat, vat, totalInclVat }) {
  let rows = '';
  for (let i = 0; i < groups.length; i++) {
    const g  = groups[i];
    const bg = i % 2 === 0 ? '' : 'style="background:#F8F8F8"';
    rows += `
      <tr ${bg}>
        <td class="room-name">${g.name}</td>
        <td class="center">${g.count}</td>
        <td class="right nowrap">${fmtISK(g.total)}</td>
      </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="is">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Kumbh+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
  ${SHARED_CSS}

  tbody td {
    font-size: 9.5pt;
    padding: 7pt 4pt;
    border-bottom: 0.5pt solid #F0F0F0;
    vertical-align: middle;
  }
  td.room-name { font-weight: 600; }
  td.right  { text-align: right; }
  td.center { text-align: center; }
  td.nowrap { white-space: nowrap; }
</style>
</head>
<body>

${buildHeaderHTML({ quoteName, customer, phone, email, innvols, framhlidar, notes })}

<table class="main-table">
  <thead>
    <tr>
      <th>Rými</th>
      <th class="center" style="width:80pt">Fjöldi eininga</th>
      <th class="right" style="width:110pt">Samtals m. vsk.</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>

${buildTotalsHTML({ totalExVat, vat, totalInclVat })}
${FOOTER_HTML}

</body>
</html>`;
}

// ── PDF rendering ──────────────────────────────────────────────────────────────

async function renderPDF(browser, html) {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({
      format:          'A4',
      printBackground: true,
      margin:          { top: '0', right: '0', bottom: '0', left: '0' },
    });
  } finally {
    await page.close();
  }
}

// ── Upload helper ──────────────────────────────────────────────────────────────

async function uploadPDF(recordId, pdfBuffer, filename) {
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
    throw new Error(`Airtable upload failed [${uploadRes.status}]: ${await uploadRes.text()}`);
  }
  return uploadRes.json();
}

// ── Main handler ───────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recordId, secret } = req.body || {};

  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!recordId) {
    return res.status(400).json({ error: 'recordId is required' });
  }

  try {
    // ── 1. Fetch the project (Tækifæri) record ─────────────────────────────
    const project = await fetchRecord(TABLE_TAEK, recordId);
    const pf = project.fields;

    // ── 2. Fetch all linked line items ─────────────────────────────────────
    const lineItemIds = pf["Vöru línur ➡️📦 (Line item's)"] || [];
    const lineItemIdsResolved = lineItemIds.length > 0
      ? lineItemIds
      : (() => {
          const key = Object.keys(pf).find(k => k.includes('Vöru línur'));
          return key ? (pf[key] || []) : [];
        })();

    const lineRecords = await batchFetch(TABLE_LINUR, lineItemIdsResolved, [
      'Rými 🏡',
      'Vara 🚪',
      'útfærsla 🎨',
      'Magn',
      'Afsl. %',
      'Einingarverð texti',
      'Endanlegt söluverð texti',
      'Lýsing á verki',
      'Vöru reitur 1',
      'Vöru reitur 2',
    ]);

    // Preserve the order Airtable has them in (lineItemIdsResolved order)
    const lineMap = Object.fromEntries(lineRecords.map(r => [r.id, r]));
    const orderedLines = lineItemIdsResolved.map(id => lineMap[id]).filter(Boolean);

    // ── 3. Batch-fetch products (Vörulisti) & variants (Útfærslur) ─────────
    const productIds = orderedLines.flatMap(r => r.fields['Vöru reitur 1'] || []);
    const variantIds = orderedLines.flatMap(r => r.fields['Vöru reitur 2'] || []);

    const [productRecords, variantRecords] = await Promise.all([
      batchFetch(TABLE_VORUR, productIds, ['Heiti vöru 📣', 'Vörunúmer #️⃣']),
      batchFetch(TABLE_UTFAER, variantIds, ['Lýsing á útfærslu', 'Vörunúmer']),
    ]);

    const prodMap    = Object.fromEntries(productRecords.map(r => [r.id, r.fields]));
    const variantMap = Object.fromEntries(variantRecords.map(r => [r.id, r.fields]));

    // ── 4. Fetch material specs (Efnislisti) ───────────────────────────────
    const skrokkaIds = pf['Skrokka efni 🔲 viðskiptavinar'] || [];
    const frontaIds  = pf['Fronta efni viðskiptavinar 🖼️']  || [];
    const efniIds    = [...skrokkaIds, ...frontaIds];

    const efniRecords = await batchFetch(TABLE_EFNI, efniIds, [
      'Heiti efnis',
      'Efnisnúmer / kóði #️⃣',
      'Þykkt (mm)',
    ]);
    const efniMap = Object.fromEntries(efniRecords.map(r => [r.id, r.fields]));

    const buildMatStr = id => {
      if (!id || !efniMap[id]) return '';
      const m = efniMap[id];
      const parts = [m['Þykkt (mm)'] ? m['Þykkt (mm)'] + ' mm' : '', m['Heiti efnis'] || ''];
      return parts.filter(Boolean).join(' ');
    };
    const innvols    = buildMatStr(skrokkaIds[0]);
    const framhlidar = buildMatStr(frontaIds[0]);

    // ── 5. Build enriched line item list ───────────────────────────────────
    const lines = orderedLines.map(r => {
      const f   = r.fields;
      const pid = (f['Vöru reitur 1'] || [])[0];
      const vid = (f['Vöru reitur 2'] || [])[0];
      const prod    = prodMap[pid]    || {};
      const variant = variantMap[vid] || {};

      return {
        room:         f['Rými 🏡']                   || '',
        vorunr:       prod['Vörunúmer #️⃣']           || '',
        tegund:       variant['Vörunúmer']            || '',
        vara:         first(f['Vara 🚪'])             || prod['Heiti vöru 📣'] || '',
        utfaersla:    first(f['útfærsla 🎨'])         || variant['Lýsing á útfærslu'] || '',
        magn:         f['Magn']                       ?? '',
        afsl:         f['Afsl. %']                    || 0,
        einingarverd: f['Einingarverð texti']         || '',
        samtals:      f['Endanlegt söluverð texti']   || '',
        lysing:       f['Lýsing á verki']             || '',
      };
    });

    // ── 6. Pull totals from the project record ─────────────────────────────
    const totalExVat   = pf['Tilboðsupphæð'] || 0;
    const vat          = pf['vsk.']           || 0;
    const totalInclVat = totalExVat + vat;

    const quoteName = pf['Tilboðsblaðs heiti']
      || pf['Heiti tækifæris / verkefnis']
      || 'Tilboð';
    const customer  = first(pf['Fullt nafn 👤']);
    const phone     = first(pf['Símanúmer ☎️']);
    const email     = first(pf['Netfang 📧']);
    const notes     = stripHtml(pf['Glósur']);

    // ── 7. Group lines by room (for summary PDF) ───────────────────────────
    const groups = groupByRymi(lines);

    // ── 8. Build both HTML templates ───────────────────────────────────────
    const sharedProps = { quoteName, customer, phone, email, notes, innvols, framhlidar };

    const detailHTML  = buildDetailHTML({
      ...sharedProps, lines, totalExVat, vat, totalInclVat,
    });
    const summaryHTML = buildSummaryHTML({
      ...sharedProps, groups, totalExVat, vat, totalInclVat,
    });

    // ── 9. Render both PDFs with a single browser instance ─────────────────
    const browser = await puppeteer.launch({
      args:            chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath:  await chromium.executablePath(),
      headless:        true,
    });

    let detailBuffer, summaryBuffer;
    try {
      // Render sequentially — reuses the same browser, avoids memory spikes
      detailBuffer  = await renderPDF(browser, detailHTML);
      summaryBuffer = await renderPDF(browser, summaryHTML);
    } finally {
      await browser.close();
    }

    // ── 10. Upload both PDFs to Airtable ───────────────────────────────────
    const safeTitle = quoteName.replace(/[/\\:*?"<>|]/g, '-').trim();

    await uploadPDF(recordId, detailBuffer,  `${safeTitle} | Tilboð.pdf`);
    await uploadPDF(recordId, summaryBuffer, `${safeTitle} | Yfirlit.pdf`);

    return res.status(200).json({
      success:   true,
      filename:  `${safeTitle} | Tilboð.pdf`,
      lineItems: lines.length,
      rooms:     groups.length,
    });

  } catch (err) {
    console.error('[generate-quote] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};