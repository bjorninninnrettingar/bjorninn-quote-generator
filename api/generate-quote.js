// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// BjÃ¶rninn InnrÃ©ttingar â Quote PDF Generator
// Vercel serverless function
// Called by an Airtable automation (button) with { recordId, secret }
// Generates a PDF quote and uploads it to the Airtable record.
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// ââ Airtable config ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const BASE_ID        = 'app91U15z9K704Okd';
const TABLE_TAEK     = 'tbl4LMXlQjp66RFKI'; // TÃ¦kifÃ¦ri (projects)
const TABLE_LINUR    = 'tblFcsUoGxsuUwNEH'; // VÃ¶ru lÃ­nur (line items)
const TABLE_VORUR    = 'tblzuuRSRkeXaLWxC'; // VÃ¶rulisti (product list)
const TABLE_UTFAER   = 'tbl8HjvBwNJ41cTV0'; // ÃtfÃ¦rslur (variants)
const TABLE_EFNI     = 'tbl8CrVWKF8CuI7HD'; // Efnislisti (materials)

// Field ID for the "TilboÃ° til sendingar" attachment field on TÃ¦kifÃ¦ri
const TILBOD_FIELD_ID = 'flddIR5JAm8ZM753V';

// ââ Airtable helpers âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

// ââ Utilities ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

// Airtable lookup fields return arrays â grab the first value
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

// ââ HTML template ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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

  /* ââ Header ââ */
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

  /* ââ Info block ââ */
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

  /* ââ Table ââ */
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

  /* ââ Totals ââ */
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

  /* ââ Footer ââ */
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

<!-- ââ Header ââ -->
<div class="header">
  <div>
    <div class="logo-title">
      <span class="logo-gold">BJÃRNINN</span> INNRÃTTINGAR
    </div>
    <div class="tagline">Ãslensk framleiÃ°sla Ã­ meira en hÃ¡lfa Ã¶ld</div>
  </div>
  <div class="header-right">
    <div class="quote-label">TilboÃ°:</div>
    <div class="quote-name">${quoteName}</div>
    <div class="cust-line">TengiliÃ°ur: <span>${customer}</span></div>
    <div class="cust-line">SÃ­mi/netfang: <span>${[phone, email].filter(Boolean).join(' / ')}</span></div>
    <div class="date-line" style="margin-top:6pt;">Dags: ${todayDate()}</div>
    <div class="date-line">TilboÃ° gildir Ã­ 30 daga frÃ¡ ÃºtgÃ¡fudegi</div>
  </div>
</div>

<!-- ââ Material specs + comment ââ -->
<div class="info-grid">
  <div class="info-left">
    ${innvols    ? `<div class="spec-line"><span class="spec-bold">INNVOLS:</span> ${innvols}</div>` : ''}
    ${framhlidar ? `<div class="spec-line"><span class="spec-bold">FRAMHLIÃAR:</span> ${framhlidar}</div>` : ''}
  </div>
  <div class="info-right">
    ${notes ? `<div class="spec-line"><span class="spec-bold">Athugasemd:</span> ${notes}</div>` : ''}
  </div>
</div>

<!-- ââ Line items table ââ -->
<table class="main-table">
  <thead>
    <tr>
      <th style="width:52pt">(RÃ½mi)</th>
      <th style="width:40pt">VÃ¶runr</th>
      <th style="width:50pt">Tegund</th>
      <th style="width:100pt">Vara</th>
      <th>ÃtfÃ¦rsla</th>
      <th class="center" style="width:32pt">Afsl.</th>
      <th class="center" style="width:30pt">Magn</th>
      <th class="right" style="width:68pt">EiningarverÃ°</th>
      <th class="right" style="width:72pt">Samtals m.vsk</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>

<!-- ââ Totals ââ -->
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

<!-- ââ Footer ââ -->
<div class="footer">
  BjÃ¶rninn ehf | Ãlfhella 5 | 221, HafnarfjÃ¶rÃ°ur | bjorninn@bjorninninnrettingar.is | bjorninninnrettingar.is
  | TilboÃ°i fylgir hvorki uppsetning nÃ© flutningur nema Ã¾aÃ° komi sÃ©rstaklega fram<br>
  <strong>
    SkilmÃ¡la Bjarnarins mÃ¡ finna hÃ©r: https://www.bjorninninnrettingar.is/skilmÃ¡lar
    &nbsp;|&nbsp;
    MikilvÃ¦gt er aÃ° kynna sÃ©r skilmÃ¡la en innborgun er samÃ¾ykki viÃ° skilmÃ¡lum
  </strong><br>
  Ath. endurgreiÃ°sla Ã¡ staÃ°festingargjaldi er ekki mÃ¶guleg undir neinum kringumstÃ¦Ã°um
</div>

</body>
</html>`;
}

// ââ Main handler âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

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
    // ââ 1. Fetch the project (TÃ¦kifÃ¦ri) record âââââââââââââââââââââââââââââ
    const project = await fetchRecord(TABLE_TAEK, recordId);
    const pf = project.fields;

    // ââ 2. Fetch all linked line items âââââââââââââââââââââââââââââââââââââ
    // The field name includes special characters â use the exact name from Airtable
    const lineItemIds = pf["VÃ¶ru lÃ­nur â¡ï¸ð¦ (Line item's)"] || [];
    // (the field name is: "VÃ¶ru lÃ­nur âð¦ (Line item's)" â stored as a Unicode string)
    // If the above doesn't work, try the key below (Airtable sometimes uses field IDs internally)
    // Fallback: look for any key containing "VÃ¶ru lÃ­nur"
    const lineItemIdsResolved = lineItemIds.length > 0
      ? lineItemIds
      : (() => {
          const key = Object.keys(pf).find(k => k.includes('VÃ¶ru lÃ­nur'));
          return key ? (pf[key] || []) : [];
        })();

    const lineRecords = await batchFetch(TABLE_LINUR, lineItemIdsResolved, [
      'RÃ½mi ð¡',
      'Vara ðª',
      'ÃºtfÃ¦rsla ð¨',
      'Magn',
      'Afsl. %',
      'EiningarverÃ° texti',
      'Endanlegt sÃ¶luverÃ° texti',
      'LÃ½sing Ã¡ verki',
      'VÃ¶ru reitur 1',
      'VÃ¶ru reitur 2',
    ]);

    // Preserve the order Airtable has them in (lineItemIdsResolved order)
    const lineMap = Object.fromEntries(lineRecords.map(r => [r.id, r]));
    const orderedLines = lineItemIdsResolved.map(id => lineMap[id]).filter(Boolean);

    // ââ 3. Batch-fetch products (VÃ¶rulisti) & variants (ÃtfÃ¦rslur) âââââââââ
    const productIds = orderedLines.flatMap(r => r.fields['VÃ¶ru reitur 1'] || []);
    const variantIds = orderedLines.flatMap(r => r.fields['VÃ¶ru reitur 2'] || []);

    const [productRecords, variantRecords] = await Promise.all([
      batchFetch(TABLE_VORUR, productIds, ['Heiti vÃ¶ru ð£', 'VÃ¶runÃºmer #ï¸â£']),
      batchFetch(TABLE_UTFAER, variantIds, ['LÃ½sing Ã¡ ÃºtfÃ¦rslu', 'VÃ¶runÃºmer']),
    ]);

    const prodMap    = Object.fromEntries(productRecords.map(r => [r.id, r.fields]));
    const variantMap = Object.fromEntries(variantRecords.map(r => [r.id, r.fields]));

    // ââ 4. Fetch material specs (Efnislisti) âââââââââââââââââââââââââââââââ
    const skrokkaIds = pf['Skrokka efni ð² viÃ°skiptavinar'] || [];
    const frontaIds  = pf['Fronta efni viÃ°skiptavinar ð¼ï¸']  || [];
    const efniIds    = [...skrokkaIds, ...frontaIds];

    const efniRecords = await batchFetch(TABLE_EFNI, efniIds, [
      'Heiti efnis',
      'EfnisnÃºmer / kÃ³Ã°i #ï¸â£',
      'Ãykkt (mm)',
    ]);
    const efniMap = Object.fromEntries(efniRecords.map(r => [r.id, r.fields]));

    // Build the material spec strings (e.g. "Plastl spÃ³napl 16mm U963 dÃ¶kkgrÃ¡ ST2")
    const buildMatStr = id => {
      if (!id || !efniMap[id]) return '';
      const m = efniMap[id];
      const parts = [m['Ãykkt (mm)'] ? m['Ãykkt (mm)'] + ' mm' : '', m['Heiti efnis'] || ''];
      return parts.filter(Boolean).join(' ');
    };
    const innvols    = buildMatStr(skrokkaIds[0]);
    const framhlidar = buildMatStr(frontaIds[0]);

    // ââ 5. Build enriched line item list âââââââââââââââââââââââââââââââââââ
    const lines = orderedLines.map(r => {
      const f   = r.fields;
      const pid = (f['VÃ¶ru reitur 1'] || [])[0];
      const vid = (f['VÃ¶ru reitur 2'] || [])[0];
      const prod    = prodMap[pid]    || {};
      const variant = variantMap[vid] || {};

      return {
        room:         f['RÃ½mi ð¡']                   || '',
        vorunr:       prod['VÃ¶runÃºmer #ï¸â£']           || '',
        tegund:       variant['VÃ¶runÃºmer']            || '', // variant code = "Tegund" column
        vara:         first(f['Vara ðª'])             || prod['Heiti vÃ¶ru ð£'] || '',
        utfaersla:    first(f['ÃºtfÃ¦rsla ð¨'])         || variant['LÃ½sing Ã¡ ÃºtfÃ¦rslu'] || '',
        magn:         f['Magn']                       ?? '',
        afsl:         f['Afsl. %']                    || 0,
        einingarverd: f['EiningarverÃ° texti']         || '',
        samtals:      f['Endanlegt sÃ¶luverÃ° texti']   || '',
        lysing:       f['LÃ½sing Ã¡ verki']             || '',
      };
    });

    // ââ 6. Pull totals from the project record âââââââââââââââââââââââââââââ
    const totalExVat   = pf['TilboÃ°supphÃ¦Ã°'] || 0;
    const vat          = pf['vsk.']           || 0;
    const totalInclVat = totalExVat + vat;

    const quoteName = pf['TilboÃ°sblaÃ°s heiti']
      || pf['Heiti tÃ¦kifÃ¦ris / verkefnis']
      || 'TilboÃ°';
    const customer  = first(pf['Fullt nafn ð¤']);
    const phone     = first(pf['SÃ­manÃºmer âï¸']);
    const email     = first(pf['Netfang ð§']);
    const notes     = stripHtml(pf['GlÃ³sur']);

    // ââ 7. Render HTML â PDF âââââââââââââââââââââââââââââââââââââââââââââââ
    const html = buildHTML({
      quoteName, customer, phone, email, notes,
      innvols, framhlidar, lines,
      totalExVat, vat, totalInclVat,
    });

    const browser = await puppeteer.launch({
      args:            chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath:  await chromium.executablePath(),
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

    // ââ 8. Upload PDF to Airtable attachment field âââââââââââââââââââââââââ
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
