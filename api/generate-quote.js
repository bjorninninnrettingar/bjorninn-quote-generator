'use strict';

const PdfPrinter = require('pdfmake/src/printer');
const vfsFonts = require('pdfmake/build/vfs_fonts');

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const BASE_ID = 'app91U15z9K704Okd';
const TABLE_TAEK = 'tbl4LMXlQjp66RFKI';
const TABLE_LINUR = 'tblFcsUoGxsuUwNEH';
const TILBOD_FIELD_ID = 'flddIR5JAm8ZM753V';

const GOLD = '#CEB163';
const DARK = '#1A1A1A';
const GRAY = '#6E6E6E';
const LIGHT = '#F0F0F0';

const fontDescriptors = {
  Roboto: {
    normal: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Regular.ttf'], 'base64'),
    bold: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Medium.ttf'], 'base64'),
    italics: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Italic.ttf'], 'base64'),
    bolditalics: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-MediumItalic.ttf'], 'base64'),
  }
};

const printer = new PdfPrinter(fontDescriptors);

async function fetchAirtable(path) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${path}`, {
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
  });
  if (!res.ok) throw new Error(`Airtable ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

function getField(fields) {
  const keys = Array.from(arguments).slice(1);
  for (const key of keys) {
    if (fields[key] !== undefined && fields[key] !== null && fields[key] !== '') return fields[key];
  }
  return '';
}

function formatISK(amount) {
  if (!amount || isNaN(amount)) return '-';
  return new Intl.NumberFormat('is-IS').format(Math.round(amount)) + ' kr.';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { recordId, secret } = req.body || {};
  if (secret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  if (!recordId) return res.status(400).json({ error: 'recordId required' });

  try {
    const projectData = await fetchAirtable(`${TABLE_TAEK}/${recordId}`);
    const f = projectData.fields;
    console.log('Fields:', Object.keys(f).join(', '));

    const quoteNum = getField(f, 'Tilboðsnúmer', 'Quote number', 'Heiti', 'Name');
    const customerName = getField(f, 'Nafn viðskiptavinar', 'Viðskiptavinur', 'Nafn', 'Customer');
    const phone = getField(f, 'Sími', 'Phone', 'Símanúmer');
    const email = getField(f, 'Netfang', 'Email');
    const carcassMat = getField(f, 'Skrokkaefni', 'Innvið');
    const frontMat = getField(f, 'Frontaefni', 'Framhliðarefni');
    const countertop = getField(f, 'Borðplata', 'Countertop');
    const handles = getField(f, 'Höldur', 'Handles');
    const edgebanding = getField(f, 'Kantlíming', 'Edgebanding');

    const lineItemIds = f['Vöru línur'] || f['Line items'] || f['Linur'] || [];
    let lineItems = [];
    if (Array.isArray(lineItemIds) && lineItemIds.length > 0) {
      const formula = encodeURIComponent('OR(' + lineItemIds.map(id => `RECORD_ID()='${id}'`).join(',') + ')');
      const lineData = await fetchAirtable(`${TABLE_LINUR}?filterByFormula=${formula}`);
      lineItems = lineData.records || [];
    }

    const tableBody = [[
      { text: 'Vörur', style: 'th' },
      { text: 'Útfærsla', style: 'th' },
      { text: 'Magn', style: 'th', alignment: 'center' },
      { text: 'Afsl.', style: 'th', alignment: 'center' },
      { text: 'Einingarverð', style: 'th', alignment: 'right' },
      { text: 'Samtals m. vsk.', style: 'th', alignment: 'right' },
    ]];

    let subtotal = 0;
    lineItems.forEach(item => {
      const lf = item.fields;
      const name = getField(lf, 'Heiti', 'Name', 'Vara', 'Lýsing');
      const desc = getField(lf, 'Útfærsla', 'Lýsing', 'Description');
      const qty = parseFloat(getField(lf, 'Magn', 'Quantity', 'Fjöldi') || 1);
      const discPct = parseFloat(getField(lf, 'Afsláttur', 'Afsl', 'Discount') || 0);
      const unitPrice = parseFloat(getField(lf, 'Einingarverð', 'Verð', 'Price') || 0);
      const lineTotal = qty * unitPrice * (1 - discPct / 100);
      subtotal += lineTotal;
      tableBody.push([
        { text: name, fontSize: 8 },
        { text: desc, fontSize: 8 },
        { text: String(qty % 1 === 0 ? qty.toFixed(0) : qty), fontSize: 8, alignment: 'center' },
        { text: discPct > 0 ? discPct + '%' : '', fontSize: 8, alignment: 'center' },
        { text: formatISK(unitPrice), fontSize: 8, alignment: 'right' },
        { text: formatISK(lineTotal * 1.24), fontSize: 8, alignment: 'right' },
      ]);
    });

    if (tableBody.length === 1) {
      tableBody.push([{ text: 'Engar vörulínur skráðar', colSpan: 6, fontSize: 8, color: GRAY, italics: true }, '', '', '', '', '']);
    }

    const vat = subtotal * 0.24;
    const total = subtotal + vat;
    const today = new Date().toLocaleDateString('is-IS', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const matRows = [
      ['Innvið', carcassMat], ['Framhliðar', frontMat],
      ['Borðplata', countertop], ['Höldur', handles], ['Kantlíming', edgebanding],
    ].filter(r => r[1]).map(([k, v]) => [
      { text: k, fontSize: 8, color: GRAY }, { text: v, fontSize: 8 }
    ]);
    if (!matRows.length) matRows.push([{ text: '-', fontSize: 8, color: GRAY, colSpan: 2 }, '']);

    const doc = {
      pageSize: 'A4', pageMargins: [40, 40, 40, 90],
      footer: (currentPage, pageCount) => ({
        margin: [40, 8, 40, 0],
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: GOLD }] },
          { margin: [0, 5, 0, 0], columns: [
            { text: 'Alfhella 5, 221 Hafnarfjordur', fontSize: 7, color: GRAY },
            { text: 'bjorninn@bjorninninnrettingar.is', fontSize: 7, color: GRAY, alignment: 'center' },
            { text: 'Sida ' + currentPage + '/' + pageCount, fontSize: 7, color: GRAY, alignment: 'right' },
          ]},
          { margin: [0, 3, 0, 0], fontSize: 7, color: GRAY, text: 'Tilbodi fylgir hvorki uppsetning ne flutningur nema thad komi serstaklega fram  |  Skilmalar: bjorninninnrettingar.is/skilmalar' },
          { margin: [0, 2, 0, 0], fontSize: 7, color: GRAY, text: 'Innborgun er samthykki vid skilmala. Endurgreidsla stadfestingargjalds er ekki moguleg undir neinum kringumstaethum.' },
        ]
      }),
      content: [
        { columns: [
          { stack: [
            { text: 'BJORNINN INNRETTINGAR', fontSize: 18, bold: true, color: GOLD },
            { text: 'Islensk framleidlsa i meira en halfa old', fontSize: 8, color: GRAY, margin: [0, 2, 0, 0] },
          ]},
          { stack: [
            { text: today, fontSize: 9, alignment: 'right', color: GRAY },
            { text: 'Tilbod gildir i 30 daga fra utgafudegi', fontSize: 7.5, alignment: 'right', color: GRAY, margin: [0, 2, 0, 0] },
          ]}
        ]},
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: GOLD }], margin: [0, 10, 0, 14] },
        { text: quoteNum || recordId, fontSize: 15, bold: true, color: DARK, margin: [0, 0, 0, 14] },
        { columns: [
          { width: '48%', stack: [
            { text: 'TENGILIDIR', fontSize: 7.5, bold: true, color: GOLD, margin: [0, 0, 0, 4] },
            { text: customerName || '-', fontSize: 10, bold: true, margin: [0, 0, 0, 2] },
            phone ? { text: phone, fontSize: 8.5, color: GRAY } : {},
            email ? { text: email, fontSize: 8.5, color: GRAY } : {},
            { text: '', margin: [0, 10, 0, 0] },
            { text: 'EFNI OG YFIRBORID', fontSize: 7.5, bold: true, color: GOLD, margin: [0, 0, 0, 5] },
            { table: { widths: [70, '*'], body: matRows }, layout: 'noBorders' },
          ]},
          { width: 16, text: '' },
          { width: '*', stack: [
            { text: 'SKILMALAR OG ATHUGASEMDIR', fontSize: 7.5, bold: true, color: GOLD, margin: [0, 0, 0, 5] },
            { fontSize: 8, color: GRAY, lineHeight: 1.5, text: 'Tilbod thetta tekur til framleidlslu og efnis samkvaemt lysingu her ad nedhan. Uppsetning og flutningur eru ekki innifalin nema serstaklega komi fram.' },
            { fontSize: 8, color: GRAY, lineHeight: 1.5, margin: [0, 6, 0, 0], text: 'Ol mal eru i millimetrum. Bjorninn ehf. askilur ser reitt til litilshatar breytinga a malum vegna framleidlslutaekni.' },
          ]}
        ], margin: [0, 0, 0, 18] },
        { text: 'VORULISTI', fontSize: 7.5, bold: true, color: GOLD, margin: [0, 0, 0, 5] },
        { table: { headerRows: 1, widths: ['*', '*', 36, 32, 70, 82], body: tableBody },
          layout: {
            hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.75 : 0.25,
            vLineWidth: () => 0,
            hLineColor: (i) => i <= 1 ? GOLD : '#DDDDDD',
            fillColor: (i) => i === 0 ? LIGHT : null,
            paddingTop: () => 5, paddingBottom: () => 5,
          }
        },
        { margin: [0, 14, 0, 0], columns: [
          { text: '', width: '*' },
          { width: 210, table: { widths: ['*', 95], body: [
            [{ text: 'Samtals (an vsk.)', fontSize: 9, color: GRAY }, { text: formatISK(subtotal), fontSize: 9, alignment: 'right' }],
            [{ text: 'VSK (24%)', fontSize: 9, color: GRAY }, { text: formatISK(vat), fontSize: 9, alignment: 'right' }],
            [{ text: 'Samtals m. vsk.', fontSize: 11, bold: true }, { text: formatISK(total), fontSize: 11, bold: true, alignment: 'right' }],
          ]},
          layout: {
            hLineWidth: (i, node) => i === node.table.body.length - 1 ? 0 : (i === node.table.body.length ? 0 : 0.25),
            vLineWidth: () => 0,
            hLineColor: () => '#DDDDDD',
            paddingTop: (i) => i === 2 ? 8 : 4, paddingBottom: () => 4,
          }}
        ]},
      ],
      styles: { th: { fontSize: 8, bold: true, color: GRAY } },
      defaultStyle: { font: 'Roboto', fontSize: 9, color: DARK, lineHeight: 1.3 }
    };

    const pdfDoc = printer.createPdfKitDocument(doc);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    await new Promise((resolve, reject) => { pdfDoc.on('end', resolve); pdfDoc.on('error', reject); pdfDoc.end(); });

    const pdfBuffer = Buffer.concat(chunks);
    const filename = (quoteNum || recordId).replace(/[^a-zA-Z0-9_\- ]/g, '_') + '.pdf';

    const uploadRes = await fetch(
      `https://content.airtable.com/v0/${BASE_ID}/${recordId}/${TILBOD_FIELD_ID}/uploadAttachment`,
      { method: 'POST',
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: 'application/pdf', filename, file: pdfBuffer.toString('base64') })
      }
    );

    if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status}): ${await uploadRes.text()}`);
    return res.status(200).json({ success: true, filename });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
};