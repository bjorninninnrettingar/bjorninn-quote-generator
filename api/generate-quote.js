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

const fonts = {
  Roboto: {
    normal: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Regular.ttf'], 'base64'),
    bold: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Medium.ttf'], 'base64'),
    italics: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-Italic.ttf'], 'base64'),
    bolditalics: Buffer.from(vfsFonts.pdfMake.vfs['Roboto-MediumItalic.ttf'], 'base64'),
  }
};
const printer = new PdfPrinter(fonts);

async function airtable(path) {
  const r = await fetch('https://api.airtable.com/v0/' + BASE_ID + '/' + path, {
    headers: { Authorization: 'Bearer ' + AIRTABLE_TOKEN }
  });
  if (!r.ok) throw new Error('Airtable ' + r.status + ': ' + await r.text());
  return r.json();
}

function g(obj) {
  const keys = Array.prototype.slice.call(arguments, 1);
  for (const k of keys) { if (obj[k] != null && obj[k] !== '') return obj[k]; }
  return '';
}

function isk(n) {
  if (!n || isNaN(n)) return '-';
  return new Intl.NumberFormat('is-IS').format(Math.round(n)) + ' kr.';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { recordId, secret } = req.body || {};
  if (secret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  if (!recordId) return res.status(400).json({ error: 'recordId required' });

  try {
    const proj = await airtable(TABLE_TAEK + '/' + recordId);
    const f = proj.fields;
    console.log('Project fields:', Object.keys(f).join(', '));

    const quoteNum = g(f, 'Tilbodsnum', 'Tilbodsnumer', 'Quote number', 'Name');
    const customer = g(f, 'Nafn vidskiptavinar', 'Vidskiptavinur', 'Customer', 'Nafn');
    const phone = g(f, 'Simi', 'Phone');
    const email = g(f, 'Netfang', 'Email');
    const carcass = g(f, 'Skrokkaefni', 'Innvid');
    const front = g(f, 'Frontaefni', 'Framhlidaefni');
    const top = g(f, 'Bordplata', 'Countertop');
    const handles = g(f, 'Holdur', 'Handles');
    const edge = g(f, 'Kantliming', 'Edgebanding');

    const ids = f['Voru linur'] || f['Vöru línur'] || f['Line items'] || [];
    let lines = [];
    if (Array.isArray(ids) && ids.length) {
      const formula = encodeURIComponent('OR(' + ids.map(id => "RECORD_ID()='" + id + "'").join(',') + ')');
      const ld = await airtable(TABLE_LINUR + '?filterByFormula=' + formula);
      lines = ld.records || [];
      if (lines[0]) console.log('Line fields:', Object.keys(lines[0].fields).join(', '));
    }

    const rows = [[
      { text: 'Vorur', style: 'th' },
      { text: 'Utfaersla', style: 'th' },
      { text: 'Magn', style: 'th', alignment: 'center' },
      { text: 'Afsl.', style: 'th', alignment: 'center' },
      { text: 'Einingarv.', style: 'th', alignment: 'right' },
      { text: 'Samtals m.vsk.', style: 'th', alignment: 'right' },
    ]];

    let sub = 0;
    lines.forEach(item => {
      const lf = item.fields;
      const name = g(lf, 'Heiti', 'Name', 'Vara', 'Lysing');
      const desc = g(lf, 'Utfaersla', 'Lysing', 'Description');
      const qty = parseFloat(g(lf, 'Magn', 'Quantity') || 1);
      const disc = parseFloat(g(lf, 'Afslattr', 'Afsl', 'Discount') || 0);
      const unit = parseFloat(g(lf, 'Einingarverd', 'Verd', 'Price') || 0);
      const tot = qty * unit * (1 - disc / 100);
      sub += tot;
      rows.push([
        { text: name, fontSize: 8 },
        { text: desc, fontSize: 8 },
        { text: String(qty % 1 === 0 ? qty.toFixed(0) : qty), fontSize: 8, alignment: 'center' },
        { text: disc > 0 ? disc + '%' : '', fontSize: 8, alignment: 'center' },
        { text: isk(unit), fontSize: 8, alignment: 'right' },
        { text: isk(tot * 1.24), fontSize: 8, alignment: 'right' },
      ]);
    });

    if (rows.length === 1) {
      rows.push([{ text: 'Engar vorulinar skraddar', colSpan: 6, fontSize: 8, color: GRAY, italics: true }, '', '', '', '', '']);
    }

    const vat = sub * 0.24;
    const total = sub + vat;
    const today = new Date().toLocaleDateString('is-IS', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const matRows = [['Innvid', carcass], ['Framhlidar', front], ['Bordplata', top], ['Holdur', handles], ['Kantliming', edge]]
      .filter(r => r[1])
      .map(([k, v]) => [{ text: k, fontSize: 8, color: GRAY }, { text: v, fontSize: 8 }]);
    if (!matRows.length) matRows.push([{ text: '-', fontSize: 8, color: GRAY, colSpan: 2 }, '']);

    const docDef = {
      pageSize: 'A4', pageMargins: [40, 40, 40, 90],
      footer: (cp, pc) => ({
        margin: [40, 8, 40, 0],
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: GOLD }] },
          { margin: [0, 5, 0, 0], columns: [
            { text: 'Alfhella 5, 221 Hafnarfjordur', fontSize: 7, color: GRAY },
            { text: 'bjorninn@bjorninninnrettingar.is', fontSize: 7, color: GRAY, alignment: 'center' },
            { text: 'Sida ' + cp + '/' + pc, fontSize: 7, color: GRAY, alignment: 'right' },
          ]},
          { margin: [0, 3, 0, 0], fontSize: 7, color: GRAY, text: 'Tilbodi fylgir hvorki uppsetning ne flutningur nema thad komi serstaklega fram' },
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
            { text: customer || '-', fontSize: 10, bold: true, margin: [0, 0, 0, 2] },
            phone ? { text: phone, fontSize: 8.5, color: GRAY } : {},
            email ? { text: email, fontSize: 8.5, color: GRAY } : {},
            { text: '', margin: [0, 10, 0, 0] },
            { text: 'EFNI OG YFIRBORID', fontSize: 7.5, bold: true, color: GOLD, margin: [0, 0, 0, 5] },
            { table: { widths: [70, '*'], body: matRows }, layout: 'noBorders' },
          ]},
          { width: 16, text: '' },
          { width: '*', stack: [
            { text: 'SKILMALAR', fontSize: 7.5, bold: true, color: GOLD, margin: [0, 0, 0, 5] },
            { fontSize: 8, color: GRAY, lineHeight: 1.5, text: 'Tilbod thetta tekur til framleidlslu og efnis samkvaemt lysingu her ad nedhan. Uppsetning og flutningur eru ekki innifalin nema serstaklega komi fram.' },
          ]}
        ], margin: [0, 0, 0, 18] },
        { text: 'VORULISTI', fontSize: 7.5, bold: true, color: GOLD, margin: [0, 0, 0, 5] },
        { table: { headerRows: 1, widths: ['*', '*', 36, 32, 70, 82], body: rows },
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
            [{ text: 'Samtals (an vsk.)', fontSize: 9, color: GRAY }, { text: isk(sub), fontSize: 9, alignment: 'right' }],
            [{ text: 'VSK (24%)', fontSize: 9, color: GRAY }, { text: isk(vat), fontSize: 9, alignment: 'right' }],
            [{ text: 'Samtals m. vsk.', fontSize: 11, bold: true }, { text: isk(total), fontSize: 11, bold: true, alignment: 'right' }],
          ]}, layout: { hLineWidth: (i, n) => i === n.table.body.length - 1 ? 1 : 0.25, vLineWidth: () => 0, hLineColor: (i, n) => i === n.table.body.length - 1 ? GOLD : '#DDD', paddingTop: (i) => i === 2 ? 8 : 4, paddingBottom: () => 4 } }
        ]},
      ],
      styles: { th: { fontSize: 8, bold: true, color: GRAY } },
      defaultStyle: { font: 'Roboto', fontSize: 9, color: DARK, lineHeight: 1.3 }
    };

    const pdfDoc = printer.createPdfKitDocument(docDef);
    const chunks = [];
    pdfDoc.on('data', c => chunks.push(c));
    await new Promise((resolve, reject) => { pdfDoc.on('end', resolve); pdfDoc.on('error', reject); pdfDoc.end(); });

    const pdf64 = Buffer.concat(chunks).toString('base64');
    const filename = (quoteNum || recordId).replace(/[^a-zA-Z0-9_\- ]/g, '_') + '.pdf';

    const up = await fetch('https://content.airtable.com/v0/' + BASE_ID + '/' + recordId + '/' + TILBOD_FIELD_ID + '/uploadAttachment', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + AIRTABLE_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: 'application/pdf', filename, file: pdf64 })
    });
    if (!up.ok) throw new Error('Upload ' + up.status + ': ' + await up.text());
    return res.status(200).json({ success: true, filename });

  } catch (err) {
    console.error('ERR:', err.message, err.stack);
    return res.status(500).json({ error: err.message });
  }
};