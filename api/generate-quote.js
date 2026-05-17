// ─────────────────────────────────────────────────────────────────────────────
// Björninn Innréttingar – Quote PDF Generator
// Vercel serverless function
// Called by Airtable automation with { recordId } in body
// and x-webhook-secret header for auth.
// Generates two PDFs (detail + room summary) and uploads both to Airtable.
// ─────────────────────────────────────────────────────────────────────────────

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// ── Airtable config ────────────────────────────────────────────────────────────
const BASE_ID         = 'app91U15z9K704Okd';
const TABLE_TAEK      = 'tbl4LMXlQjp66RFKI'; // Tækifæri (projects)
const TABLE_LINUR     = 'tblFcsUoGxsuUwNEH'; // Vöru línur (line items)
const TABLE_VORUR     = 'tblzuuRSRkeXaLWxC'; // Vörulisti (product list)
const TABLE_UTFAER    = 'tbl8HjvBwNJ41cTV0'; // Útfærslur (variants)
const TABLE_EFNI      = 'tbl8CrVWKF8CuI7HD'; // Efnislisti (materials)
const TILBOD_FIELD_ID = 'flddIR5JAm8ZM753V'; // Attachment field on Tækifæri

// ── Airtable helpers ───────────────────────────────────────────────────────────

function airtableHeaders() {
  return {
    'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function fetchRecord(tableId, recordId) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${tableId}/${recordId}`, {
    headers: airtableHeaders(),
  });
  if (!res.ok) throw new Error(`Airtable fetchRecord [${res.status}]: ${await res.text()}`);
  return res.json();
}

async function batchFetch(tableId, recordIds, fields = []) {
  if (!recordIds || recordIds.length === 0) return [];
  const unique = [...new Set(recordIds)];
  const formula = unique.length === 1
    ? `RECORD_ID()="${unique[0]}"`
    : `OR(${unique.map(id => `RECORD_ID()="${id}"`).join(',')})`;

  const params = new URLSearchParams({ filterByFormula: formula });
  fields.forEach(f => params.append('fields[]', f));

  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${tableId}?${params}`, {
    headers: airtableHeaders(),
  });
  if (!res.ok) throw new Error(`Airtable batchFetch [${res.status}]: ${await res.text()}`);
  const data = await res.json();
  return data.records || [];
}

// ── Utilities ──────────────────────────────────────────────────────────────────

const first = val => (Array.isArray(val) ? (val[0] ?? '') : (val ?? ''));

function fmtISK(n) {
  return new Intl.NumberFormat('is-IS').format(Math.round(n || 0)) + ' kr.';
}

function todayDate() {
  return new Date().toLocaleDateString('is-IS', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function stripHtml(str) {
  return str ? String(str).replace(/<[^>]+>/g, '') : '';
}

function parseISK(str) {
  return parseInt(String(str || '').replace(/[^\d]/g, ''), 10) || 0;
}

// ── Room grouping ──────────────────────────────────────────────────────────────

function groupByRymi(lines) {
  const groups = [];
  let current = null;
  for (const line of lines) {
    const name = (line.room || '').trim();
    if (name) {
      current = { name, count: 0, total: 0 };
      groups.push(current);
    } else if (!current) {
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
  body { font-family: 'Kumbh Sans', sans-serif; font-size: 9pt; color: #000; background: #fff; padding: 28pt 36pt; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18pt; }
  .logo-title { font-size: 20pt; font-weight: 700; line-height: 1.1; }
  .logo-gold  { color: #CEB163; }
  .tagline    { font-size: 7.5pt; color: #6E6E6E; margin-top: 3pt; }
  .header-right { text-align: right; }
  .quote-label  { font-size: 9pt; font-weight: 700; }
  .quote-name   { font-size: 8.5pt; border-bottom: 0.75pt solid #000; padding-bottom: 2pt; margin-bottom: 6pt; }
  .date-line    { font-size: 7.5pt; color: #6E6E6E; }
  .info-grid { display: flex; gap: 24pt; margin-bottom: 16pt; }
  .info-left, .info-right { flex: 1; }
  .spec-line { font-size: 8pt; margin-bottom: 2pt; }
  .spec-bold { font-weight: 700; }
  .cust-line { font-size: 8.5pt; margin-bottom: 3pt; }
  .cust-line span { border-bottom: 0.75pt solid #000; padding-bottom: 1pt; }
  table { width: 100%; border-collapse: collapse; }
  .main-table { margin-bottom: 16pt; }
  thead th { font-size: 7.5pt; font-weight: 700; padding: 5pt 3pt; text-align: left; border-top: 1.5pt solid #000; border-bottom: 1.5pt solid #000; white-space: nowrap; }
  thead th.right  { text-align: right; }
  thead th.center { text-align: center; }
  .totals-table { width: 100%; }
  .totals-table td { font-size: 9pt; padding: 2pt 3pt; }
  .totals-table .lbl { text-align: left; }
  .totals-table .val { text-align: right; white-space: nowrap; }
  .totals-table .vsk td { text-decoration: underline; }
  .totals-table .grand td { font-size: 11pt; font-weight: 700; color: #CEB163; border-top: 1pt solid #000; padding-top: 5pt; }
  .footer { margin-top: 28pt; padding-top: 8pt; border-top: 0.5pt solid #C2C2C2; font-size: 6.5pt; color: #6E6E6E; text-align: center; line-height: 1.7; }
  .footer strong { font-weight: 600; color: #000; }
`;

// ── Shared HTML fragments ──────────────────────────────────────────────────────

function buildHeaderHTML({ quoteName, customer, phone, email, innvols, framhlidar, notes }) {
  return `
<div class="header">
  <div>
    <div class="logo-title"><span class="logo-gold">BJÖRNINN</span> INNRÉTTINGAR</div>
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
  <tr><td class="lbl">Samtals</td><td class="val">${fmtISK(totalExVat)}</td></tr>
  <tr class="vsk"><td class="lbl">Vsk.</td><td class="val">${fmtISK(vat)}</td></tr>
  <tr class="grand"><td class="lbl">Samtals m. vsk.</td><td class="val">${fmtISK(totalInclVat)}</td></tr>
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

// ── Detail PDF ─────────────────────────────────────────────────────────────────

function buildDetailHTML({ quoteName, customer, phone, email, notes, innvols, framhlidar,
                           lines, totalExVat, vat, totalInclVat }) {
  let rows = '';
  let lastRoom = null;
  for (const line of lines) {
    if (line.room !== lastRoom) {
      rows += `<tr class="room-row"><td class="room-label">${line.room || ''}</td><td colspan="8"></td></tr>`;
      lastRoom = line.room;
    }
    rows += `
      <tr>
        <td></td><td>${line.vorunr}</td><td>${line.tegund}</td><td>${line.vara}</td>
        <td class="desc">${line.lysing || line.utfaersla || ''}</td>
        <td class="center">${line.afsl ? (line.afsl * 100).toFixed(0) + ' %' : ''}</td>
        <td class="center">${line.magn}</td>
        <td class="right nowrap">${line.einingarverd}</td>
        <td class="right nowrap">${line.samtals}</td>
      </tr>`;
  }
  return `<!DOCTYPE html><html lang="is"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Kumbh+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>${SHARED_CSS}
  tbody tr.room-row td.room-label { font-size: 7.5pt; font-weight: 600; color: #6E6E6E; padding: 8pt 3pt 2pt; }
  tbody tr:not(.room-row) td { font-size: 7.5pt; padding: 3pt; border-bottom: 0.5pt solid #F0F0F0; vertical-align: top; }
  td.right { text-align: right; } td.center { text-align: center; }
  td.nowrap { white-space: nowrap; } td.desc { max-width: 160pt; }
</style></head><body>
${buildHeaderHTML({ quoteName, customer, phone, email, innvols, framhlidar, notes })}
<table class="main-table">
  <thead><tr>
    <th style="width:52pt">(Rými)</th><th style="width:40pt">Vörunr</th>
    <th style="width:50pt">Tegund</th><th style="width:100pt">Vara</th>
    <th>Útfærsla</th><th class="center" style="width:32pt">Afsl.</th>
    <th class="center" style="width:30pt">Magn</th>
    <th class="right" style="width:68pt">Einingarverð</th>
    <th class="right" style="width:72pt">Samtals m.vsk</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
${buildTotalsHTML({ totalExVat, vat, totalInclVat })}${FOOTER_HTML}
</body></html>`;
}

// ── Summary PDF ────────────────────────────────────────────────────────────────

function buildSummaryHTML({ quoteName, customer, phone, email, notes, innvols, framhlidar,
                            groups, totalExVat, vat, totalInclVat }) {
  const rows = groups.map((g, i) => `
    <tr ${i % 2 ? 'style="background:#F8F8F8"' : ''}>
      <td class="room-name">${g.name}</td>
      <td class="center">${g.count}</td>
      <td class="right nowrap">${fmtISK(g.total)}</td>
    </tr>`).join('');
  return `<!DOCTYPE html><html lang="is"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Kumbh+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>${SHARED_CSS}
  tbody td { font-size: 9.5pt; padding: 7pt 4pt; border-bottom: 0.5pt solid #F0F0F0; vertical-align: middle; }
  td.room-name { font-weight: 600; } td.right { text-align: right; }
  td.center { text-align: center; } td.nowrap { white-space: nowrap; }
</style></head><body>
${buildHeaderHTML({ quoteName, customer, phone, email, innvols, framhlidar, notes })}
<table class="main-table">
  <thead><tr>
    <th>Rými</th>
    <th class="center" style="width:80pt">Fjöldi eininga</th>
    <th class="right" style="width:110pt">Samtals m. vsk.</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
${buildTotalsHTML({ totalExVat, vat, totalInclVat })}${FOOTER_HTML}
</body></html>`;
}

// ── PDF rendering ──────────────────────────────────────────────────────────────

async function renderPDF(browser, html) {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({ format: 'A4', printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' } });
  } finally {
    await page.close();
  }
}

// ── Upload to Airtable ─────────────────────────────────────────────────────────

async function uploadPDF(recordId, pdfBuffer, filename) {
  const formData = new FormData();
  formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), filename);
  formData.append('filename', filename);
  formData.append('contentType', 'application/pdf');

  const res = await fetch(
    `https://content.airtable.com/v0/${BASE_ID}/${recordId}/${TILBOD_FIELD_ID}/uploadAttachment`,
    { method: 'POST', headers: { 'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}` }, body: formData }
  );
  if (!res.ok) throw new Error(`Airtable upload [${res.status}]: ${await res.text()}`);
  return res.json();
}

// ── Main handler ───────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth: secret sent as header by Airtable automation
  const secret = req.headers['x-webhook-secret'];
  if (secret !== process.env.WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const { recordId } = req.body || {};
  if (!recordId) return res.status(400).json({ error: 'recordId is required' });

  try {
    // 1. Fetch project record
    const { fields: pf } = await fetchRecord(TABLE_TAEK, recordId);

    // 2. Fetch line items
    const lineItemIds  = pf["Vöru línur ➡️📦 (Line item's)"] || [];
    const lineRecords  = await batchFetch(TABLE_LINUR, lineItemIds, [
      'Rými 🏡', 'Vara 🚪', 'útfærsla 🎨', 'Magn', 'Afsl. %',
      'Einingarverð texti', 'Endanlegt söluverð texti', 'Lýsing á verki',
      'Vöru reitur 1', 'Vöru reitur 2',
    ]);
    const lineMap      = Object.fromEntries(lineRecords.map(r => [r.id, r]));
    const orderedLines = lineItemIds.map(id => lineMap[id]).filter(Boolean);

    // 3. Batch-fetch products and variants
    const productIds = orderedLines.flatMap(r => r.fields['Vöru reitur 1'] || []);
    const variantIds = orderedLines.flatMap(r => r.fields['Vöru reitur 2'] || []);
    const [productRecords, variantRecords] = await Promise.all([
      batchFetch(TABLE_VORUR, productIds, ['Heiti vöru 📣', 'Vörunúmer #️⃣']),
      batchFetch(TABLE_UTFAER, variantIds, ['Lýsing á útfærslu', 'Vörunúmer']),
    ]);
    const prodMap    = Object.fromEntries(productRecords.map(r => [r.id, r.fields]));
    const variantMap = Object.fromEntries(variantRecords.map(r => [r.id, r.fields]));

    // 4. Fetch material specs
    const skrokkaIds  = pf['Skrokka efni 🔲 viðskiptavinar'] || [];
    const frontaIds   = pf['Fronta efni viðskiptavinar 🖼️']  || [];
    const efniRecords = await batchFetch(TABLE_EFNI, [...skrokkaIds, ...frontaIds], [
      'Heiti efnis', 'Efnisnúmer / kóði #️⃣', 'Þykkt (mm)',
    ]);
    const efniMap = Object.fromEntries(efniRecords.map(r => [r.id, r.fields]));
    const matStr  = id => {
      const m = efniMap[id];
      if (!m) return '';
      return [m['Þykkt (mm)'] ? m['Þykkt (mm)'] + ' mm' : '', m['Heiti efnis'] || ''].filter(Boolean).join(' ');
    };

    // 5. Build enriched line items
    const lines = orderedLines.map(r => {
      const f       = r.fields;
      const prod    = prodMap[(f['Vöru reitur 1'] || [])[0]]    || {};
      const variant = variantMap[(f['Vöru reitur 2'] || [])[0]] || {};
      return {
        room:         f['Rými 🏡']                || '',
        vorunr:       prod['Vörunúmer #️⃣']         || '',
        tegund:       variant['Vörunúmer']          || '',
        vara:         first(f['Vara 🚪'])           || prod['Heiti vöru 📣'] || '',
        utfaersla:    first(f['útfærsla 🎨'])       || variant['Lýsing á útfærslu'] || '',
        magn:         f['Magn']                     ?? '',
        afsl:         f['Afsl. %']                  || 0,
        einingarverd: f['Einingarverð texti']       || '',
        samtals:      f['Endanlegt söluverð texti'] || '',
        lysing:       f['Lýsing á verki']           || '',
      };
    });

    // 6. Totals and quote metadata
    const totalExVat   = pf['Tilboðsupphæð'] || 0;
    const vat          = pf['vsk.']           || 0;
    const totalInclVat = totalExVat + vat;
    const quoteName    = pf['Tilboðsblaðs heiti'] || pf['Heiti tækifæris / verkefnis'] || 'Tilboð';
    const sharedProps  = {
      quoteName,
      customer:   first(pf['Fullt nafn 👤']),
      phone:      first(pf['Símanúmer ☎️']),
      email:      first(pf['Netfang 📧']),
      notes:      stripHtml(pf['Glósur']),
      innvols:    matStr(skrokkaIds[0]),
      framhlidar: matStr(frontaIds[0]),
    };
    const groups = groupByRymi(lines);

    // 7. Render both PDFs with a single browser instance
    const browser = await puppeteer.launch({
      args:            chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath:  await chromium.executablePath(),
      headless:        true,
    });

    let detailBuffer, summaryBuffer;
    try {
      detailBuffer  = await renderPDF(browser, buildDetailHTML({ ...sharedProps, lines, totalExVat, vat, totalInclVat }));
      summaryBuffer = await renderPDF(browser, buildSummaryHTML({ ...sharedProps, groups, totalExVat, vat, totalInclVat }));
    } finally {
      await browser.close();
    }

    // 8. Upload both to Airtable
    const safeTitle = quoteName.replace(/[/\\:*?"<>|]/g, '-').trim();
    await uploadPDF(recordId, detailBuffer,  `${safeTitle} | Tilboð.pdf`);
    await uploadPDF(recordId, summaryBuffer, `${safeTitle} | Yfirlit.pdf`);

    return res.status(200).json({
      success: true, filename: `${safeTitle} | Tilboð.pdf`,
      lineItems: lines.length, rooms: groups.length,
    });

  } catch (err) {
    console.error('[generate-quote] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
