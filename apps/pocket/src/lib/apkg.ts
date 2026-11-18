// Anki package (.apkg) export with each card's schedule, so Anki continues where Fluent365 is:
// due date, interval, reps, lapses, the FSRS memory state (stability/difficulty) and the last review.
// Built on the device with sql.js (MIT; loaded only when you export). Same GUIDs as the .txt export,
// so importing again updates notes instead of duplicating them.
import type { StoredCard } from "./types";

export interface ApkgRow { key: string; front: string; back: string; tags: string[]; card?: StoredCard }

const DAY = 86400000;
/** Fixed ids: re-importing keeps using the same note type and deck in Anki. */
export const MODEL_ID = 1731900000001;
export const DECK_ID = 1731900000002;

const SCHEMA = `
CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn on notes (usn);
CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid);
CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_cid on revlog (cid);
CREATE INDEX ix_notes_csum on notes (csum);`;

const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** Anki's scheduling columns for one card (schema 11). */
export function schedFor(card: StoredCard | undefined, crt: number, newPos: number, now: number) {
  if (!card || card.state === 0) return { type: 0, queue: 0, due: newPos, ivl: 0, reps: 0, lapses: 0, left: 0, data: "" };
  const due = Date.parse(card.dueAt);
  const last = card.lastReviewAt ? Date.parse(card.lastReviewAt) : now;
  const ivl = Math.max(1, Math.round((due - last) / DAY));
  const dayIndex = Math.round((startOfDay(due) - crt) / DAY);
  const data = JSON.stringify({ s: +card.stability.toFixed(4), d: +card.difficulty.toFixed(4) });
  const base = { reps: card.reps, lapses: card.lapses, data };
  if (card.state === 2) return { ...base, type: 2, queue: 2, due: dayIndex, ivl, left: 0 };
  // Learning (1) / relearning (3): same day → due as a timestamp; later → as a day.
  const sameDay = due - now < DAY;
  return { ...base, type: card.state === 3 ? 3 : 1, queue: sameDay ? 1 : 3, due: sameDay ? Math.floor(due / 1000) : dayIndex, ivl: card.state === 3 ? ivl : 0, left: 1 };
}

async function checksum(text: string) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text)));
  return ((hash[0] << 24) >>> 0) + (hash[1] << 16) + (hash[2] << 8) + hash[3];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function collectionJson(now: number) {
  const mod = Math.floor(now / 1000);
  const model = {
    id: MODEL_ID, name: "Fluent365 (Basic)", type: 0, mod, usn: -1, sortf: 0, did: DECK_ID,
    tmpls: [{ name: "Card 1", ord: 0, qfmt: "{{Front}}", afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}", did: null, bqfmt: "", bafmt: "" }],
    flds: ["Front", "Back"].map((name, ord) => ({ name, ord, sticky: false, rtl: false, font: "Arial", size: 20, media: [] })),
    css: ".card { font-family: arial; font-size: 22px; text-align: center; color: black; background-color: white; }",
    latexPre: "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
    latexPost: "\\end{document}", latexsvg: false, req: [[0, "any", [0]]], tags: [], vers: [],
  };
  const deck = (id: number, name: string) => ({ id, name, desc: "", mod, usn: -1, collapsed: false, browserCollapsed: false, dyn: 0, conf: 1, extendNew: 0, extendRev: 0, newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0] });
  const dconf = {
    1: {
      id: 1, name: "Default", mod: 0, usn: 0, maxTaken: 60, autoplay: true, timer: 0, replayq: true, dyn: false,
      new: { bury: false, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 0], order: 1, perDay: 20 },
      rev: { bury: false, ease4: 1.3, ivlFct: 1, maxIvl: 36500, perDay: 200, hardFactor: 1.2 },
      lapse: { delays: [10], leechAction: 1, leechFails: 8, minInt: 1, mult: 0 },
    },
  };
  const conf = { activeDecks: [1], curDeck: 1, newSpread: 0, collapseTime: 1200, timeLim: 0, estTimes: true, dueCounts: true, curModel: String(MODEL_ID), nextPos: 1, sortType: "noteFld", sortBackwards: false, addToCur: true };
  return { models: { [MODEL_ID]: model }, decks: { 1: deck(1, "Default"), [DECK_ID]: deck(DECK_ID, "Fluent365") }, dconf, conf };
}

/** The SQLite collection (collection.anki2) as bytes. */
export async function buildCollection(rows: ApkgRow[], now = Date.now(), wasm?: string): Promise<Uint8Array> {
  const { default: initSqlJs } = await import("sql.js");
  const wasmUrl = wasm ?? (await import("sql.js/dist/sql-wasm.wasm?url")).default;
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = new SQL.Database();
  try {
    db.exec(SCHEMA);
    const dues = rows.map((r) => (r.card && r.card.state !== 0 ? Date.parse(r.card.dueAt) : now));
    const crt = startOfDay(Math.min(now, ...dues));
    const j = collectionJson(now);
    const mod = Math.floor(now / 1000);
    db.run("INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, '{}')", [Math.floor(crt / 1000), now, now, JSON.stringify(j.conf), JSON.stringify(j.models), JSON.stringify(j.decks), JSON.stringify(j.dconf)]);
    const note = db.prepare("INSERT INTO notes VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, '')");
    const card = db.prepare("INSERT INTO cards VALUES (?, ?, ?, 0, ?, -1, ?, ?, ?, ?, 2500, ?, ?, ?, 0, 0, 0, ?)");
    const rev = db.prepare("INSERT INTO revlog VALUES (?, ?, -1, 3, ?, 0, 2500, 0, ?)");
    const revIds = new Set<number>();
    let newPos = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const id = now + i;
      const front = esc(r.front), back = esc(r.back);
      const tags = r.tags.length ? ` ${r.tags.map((t) => t.replace(/\s+/g, "_")).join(" ")} ` : "";
      note.run([id, `fluent365-${r.key}`, MODEL_ID, mod, tags, `${front}\x1f${back}`, r.front, await checksum(r.front)]);
      const s = schedFor(r.card, crt, newPos, now);
      if (s.type === 0) newPos++;
      card.run([id, id, DECK_ID, mod, s.type, s.queue, s.due, s.ivl, s.reps, s.lapses, s.left, s.data]);
      if (r.card?.lastReviewAt) {
        let rid = Date.parse(r.card.lastReviewAt);
        while (revIds.has(rid)) rid++;
        revIds.add(rid);
        rev.run([rid, id, s.ivl, r.card.state === 2 ? 1 : 0]);
      }
    }
    note.free(); card.free(); rev.free();
    return db.export();
  } finally {
    db.close();
  }
}

// ---------- A minimal ZIP writer (stored, no compression) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(b: Uint8Array) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

export function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = new TextEncoder().encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(12, 33, true); // 1980-01-01
    local.setUint32(14, crc, true); local.setUint32(18, f.data.length, true); local.setUint32(22, f.data.length, true); local.setUint16(26, name.length, true);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(14, 33, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, f.data.length, true); cen.setUint32(24, f.data.length, true); cen.setUint16(28, name.length, true); cen.setUint32(42, offset, true);
    parts.push(new Uint8Array(local.buffer), name, f.data);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const size = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, size, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) { out.set(p, at); at += p.length; }
  return out;
}

/** The whole .apkg file. */
export async function buildApkg(rows: ApkgRow[], now = Date.now(), wasm?: string) {
  const col = await buildCollection(rows, now, wasm);
  return zip([{ name: "collection.anki2", data: col }, { name: "media", data: new TextEncoder().encode("{}") }]);
}
