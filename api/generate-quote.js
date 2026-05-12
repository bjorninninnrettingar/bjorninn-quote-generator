module.exports = async function handler(req, res) {
  try {
    const printer = require('pdfmake/src/printer');
    const vfs = require('pdfmake/build/vfs_fonts');
    return res.status(200).json({ ok: true, printerType: typeof printer, vfsKeys: Object.keys(vfs).slice(0,3) });
  } catch (err) {
    return res.status(500).json({ error: err.message, code: err.code, stack: err.stack?.slice(0, 500) });
  }
};