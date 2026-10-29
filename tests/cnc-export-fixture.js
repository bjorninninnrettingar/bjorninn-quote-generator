// Shared fixture for tests/cnc-export.test.js: a small project (Airtable rows served by a fake fetch), stand-in masters
// (same macro names the real ones on the stick have, tiny bodies) and an in-memory USB directory handle.
export const PROJECT = { id: "recPROJECTaaaaaaa", name: "T-77 | Prufuverkefni" };
const row = (teg, unit) => (Partur, H, B, Þ, M) => ({ id: "recS" + Partur.length + H + B, fields: { Partur, H, B, "Þ": Þ, M, "Tegund einingu": [teg], "Eyðublað ✏️": [{ id: unit }] } });
const hr = row("Hárskápur", "recU1aaaaaaaaaaaa"), ef = row("Efriskápur", "recU2aaaaaaaaaaaa"), of = row("Ofnaskápur", "recU3aaaaaaaaaaaa");
export const ROWS = [
  hr("Frontur", 2527, 570, 19, 1), hr("Innskúffubotn - Merivo", 474, 517, 16, 3), hr("Skúffubak K - Merivo", 121, 517, 16, 3), hr("Föst hilla", 558, 568, 16, 1),
  hr("Skápur hlið", 2530, 580, 16, 2), hr("Innskúffufrontur K - Merivo Skrokkaefni", 144, 562, 16, 3),
  ef("Laus hilla", 258, 381, 16, 8), ef("Frontur", 897, 383, 19, 4), ef("Skápur hlið", 880, 280, 16, 8),
  of("Skúffufrontur K - Merivo", 370, 597, 19, 1), of("Skúffubak K - Merivo", 121, 517, 16, 1), of("Laus loftunarhilla", 558, 568, 16, 1),
  of("Skápur hlið", 2296, 580, 16, 2), of("Skúffufrontur E - Merivo", 370, 597, 19, 1), of("Föst loftunarhilla", 558, 568, 16, 3),
  of("Frontur f. ofan ofn", 447, 597, 19, 1), of("Innskúffufrontur M - Merivo Skrokkaefni", 106, 562, 16, 1), of("Skúffubak E - Merivo", 184, 517, 16, 1),
];
export const UNITS = [
  { id: "recU1aaaaaaaaaaaa", fields: { Athugasemd: "Sk23", "Fjöldi eininga": 1, "Hæð": 2530, Breidd: 600, "Dýpt": 600, "Grip?": "JEY lárétt",
    "Smíðagögn (JSON) 🔧": JSON.stringify({ v: 1, hinge: "haegri", ready: true, shelves: { loose: 0, fixed: 1, list: [{ mm: 1500, fixed: true }] } }) } },
  { id: "recU2aaaaaaaaaaaa", fields: { Athugasemd: "Sk5-8", "Fjöldi eininga": 4, "Hæð": 880, Breidd: 413, "Dýpt": 300 } },
  { id: "recU3aaaaaaaaaaaa", fields: { Athugasemd: "Sk2", "Fjöldi eininga": 1, "Hæð": 2300, Breidd: 600, "Dýpt": 600 } },
  { id: "recD1aaaaaaaaaaaa", fields: { Athugasemd: "HU 4.1", "Sérsmíði tegund": "Hurð", "Hæð": 2403, Breidd: 901, "Dýpt": 129, "Þykkt karms [Hurð]": 37, "Karmabil frá vegg [Hurð]": 3,
    "Toppstykki hurðakarms": "Á milli hliða", "Opnun [Hurð]": "Hægri 👉", "Lamir [Hurð]": [{ id: "recoQeJKpvKLowWK3" }], "Skrá [Hurð]": [{ id: "recgXxgK8jwfkFyhp" }], "Felliþr. [Hurð]": [{ id: "recRJ3d2MCFv4DDJi" }], "Fjöldi eininga": 1 } },
];
// `calls` collects every write (PATCH / POST) so a test can compare what the export tells Airtable and the Virkni bell
export function fakeFetch(calls) {
  return async (url, o) => {
    const u = new URL(url, "http://x"), path = u.searchParams.get("path") || "";
    if (calls && o && o.method && o.method !== "GET") calls.push({ url: String(url).replace(/k=[^&]*/, "k=KEY"), method: o.method, body: o.body });
    if (u.pathname === "/api/virkni") return { ok: true, json: async () => ({}) };
    const recs = (rs) => ({ ok: true, json: async () => ({ records: rs }) });
    if (path === "tbl0WcyHhz63pSzZX") return recs(UNITS);
    if (path === "tblhdgyvTcBfP8kov") return recs(ROWS);
    if (path === "tbl4LMXlQjp66RFKI") return recs([{ id: PROJECT.id, fields: { "Heiti tækifæris / verkefnis": PROJECT.name } }]);
    return recs([]);
  };
}
// In-memory directory handle (File System Access API shape, as much as the export uses).
export class Dir {
  constructor(name) { this.name = name; this.kind = "directory"; this.kids = new Map(); }
  async getDirectoryHandle(n, o) { let k = this.kids.get(n); if (!k) { if (!(o && o.create)) throw new Error("NotFound " + n); k = new Dir(n); this.kids.set(n, k); } if (!(k instanceof Dir)) throw new Error("TypeMismatch"); return k; }
  async getFileHandle(n, o) { let k = this.kids.get(n); if (!k) { if (!(o && o.create)) throw new Error("NotFound " + n); k = new FileH(n); this.kids.set(n, k); } if (k instanceof Dir) throw new Error("TypeMismatch"); return k; }
  async *values() { for (const k of this.kids.values()) yield k; }
}
export class FileH {
  constructor(n) { this.name = n; this.kind = "file"; this.bytes = new Uint8Array(0); }
  async getFile() { const b = this.bytes; return { name: this.name, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; }
  async createWritable() { const self = this; return { write: async (d) => { self.bytes = d instanceof Uint8Array ? d : new Uint8Array(d); }, close: async () => {} }; }
}
export function dump(dir, prefix = "", out = {}) { for (const [n, k] of dir.kids) { if (k instanceof Dir) dump(k, prefix + n + "/", out); else out[prefix + n] = Buffer.from(k.bytes).toString("latin1"); } return out; }

// Stand-in masters at the real paths on the stick: every macro the generator manages has a template line, the panel
// variables are there, the rest is a few fixed lines — enough that the output depends on every code path in the writer.
function master(vars, macros, extra) {
  return ["[HEADER]", "TYPE=BPP", "", "[VARIABLES]", ...vars, "", "[PROGRAM]", ...extra,
    ...macros.map((m, i) => `@ ${m}, "", "", ${130000000 + i * 7}, "", 0 : 1, 2, 3`),
    `@ STAT_BLOCK, "", "", 100000001, "", 0 : LPY+100, 1`, "", "[VBSCRIPT]", ""].join("\r\n");
}
export function standInMasters(S, D) {
  const out = new Map(), put = (p, t) => out.set(p, t);
  const pan = ["PAN=LPX|0||4|", "PAN=LPY|0||4|", "PAN=LPZ|0||4|"];
  put(S.MASTER.join("/"), master(pan, S.MANAGED.filter((m) => m !== "CUT_X"), [
    `' CUT_X, "", "Sögun f. masonit", 133054388, "", 0 : 0, "2", -32, lpy-18, 0, 7, lpx+64, 0, 100, "", 1`,
    `' CUT_X, "", "LED 4x8 (default Y 57)", 144058572, "", 0 : 0, "2", -50, 60, 0, 8+.5, lpx+50+50, 0, 100, "", 1`]));
  for (const k of Object.keys(S.FRONT_MASTERS)) put(S.FRONT_MASTERS[k].join("/"), master(pan, S.FRONT_MANAGED[k], []));
  const dv = ["PAN=LPX|HURD_H+HG_BIL+HK_BIL+KARMAR_Z||4|", "PAN=LPY|KARMAR_B||4|", "PAN=LPZ|KARMAR_Z||4|", ...D.VARS.map((v) => `GLB=${v}|${v}|x|0|`)];
  const leaf = master(["PAN=LPX|HURD_H||4|", "PAN=LPY|HURD_B||4|", "PAN=LPZ|HURD_Z||4|", ...D.VARS.map((v) => `GLB=${v}|${v}|x|0|`)], D.MANAGED.leaf, [`@ GEOTEXT, "", "", 4, "", 0 : "P1080", 0, "2", HURD_H+HG_BIL, 100`]);
  put(D.MASTERS.leaf.path.join("/"), leaf);
  const m = D.MASTERS["Á milli hliða"], dir = ["[05] - Hurdir", "01 - Karmur", m.dir];
  put(dir.concat(m.lamir).join("/"), master(dv, D.MANAGED.jambHinge, []));
  put(dir.concat(m.slut).join("/"), master(dv, D.MANAGED.jambStrike, []));
  put(dir.concat(m.topp).join("/"), master(dv, D.MANAGED.jambTop, []));
  return out;
}
export async function putMasters(root, S, D) {
  for (const [p, text] of standInMasters(S, D)) {
    const parts = p.split("/"); let d = root;
    for (const part of parts.slice(0, -1)) d = await d.getDirectoryHandle(part, { create: true });
    (await d.getFileHandle(parts[parts.length - 1], { create: true })).bytes = new Uint8Array(Buffer.from(text, "latin1"));
  }
}
