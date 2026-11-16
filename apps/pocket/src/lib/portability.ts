// Backup (versioned JSON), Anki exchange (TSV), and the import parser for Praktika / shared text.
import { emptyState, getState, SLICES, uid, type AppState } from "./store";
import type { ImportItem } from "./types";

export const BACKUP_FORMAT = 1;

export function makeBackup() {
  const s = getState();
  return { app: "fluent365", format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), note: "Your private Fluent365 progress. Recordings are not included.", data: s };
}

export function download(name: string, content: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export interface BackupCheck { ok: true; state: AppState; summary: Record<string, number | string> }
export interface BackupError { ok: false; error: string }

/** Validate an imported backup. Unknown or malformed files are rejected without touching data. */
export function checkBackup(text: string): BackupCheck | BackupError {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not valid JSON." };
  }
  const r = raw as { app?: unknown; format?: unknown; data?: unknown; exportedAt?: unknown };
  if (!r || typeof r !== "object" || r.app !== "fluent365") return { ok: false, error: "This is not a Fluent365 backup file." };
  if (typeof r.format !== "number" || r.format > BACKUP_FORMAT) return { ok: false, error: "This backup was made by a newer version of Fluent365. Update the app first." };
  if (!r.data || typeof r.data !== "object") return { ok: false, error: "The backup has no data." };
  const base = emptyState();
  const data = r.data as Record<string, unknown>;
  for (const k of SLICES) {
    if (data[k] === undefined) continue;
    const expectArray = Array.isArray(base[k]);
    const v = data[k];
    if (k === "session" ? !(v === null || typeof v === "object") : expectArray ? !Array.isArray(v) : typeof v !== "object" || v === null || Array.isArray(v)) {
      return { ok: false, error: `The backup is damaged (section "${k}").` };
    }
    (base as unknown as Record<string, unknown>)[k] = v;
  }
  base.settings = { ...emptyState().settings, ...base.settings };
  return {
    ok: true,
    state: base,
    summary: {
      "Made on": typeof r.exportedAt === "string" ? new Date(r.exportedAt).toLocaleString() : "unknown",
      "Vocabulary cards": Object.keys(base.cards).length,
      "Grammar topics practised": Object.keys(base.grammar).length,
      "Study days": Object.keys(base.days).length,
      "Mistakes": base.mistakes.length,
      "Writing pieces": base.writing.length,
    },
  };
}

// ---------- Anki ----------
/** Anki-ready TSV: stable GUID column so re-importing updates instead of duplicating. */
export function ankiExport(rows: { key: string; front: string; back: string; tags: string[] }[]) {
  const clean = (s: string) => s.replace(/[\t\r\n]+/g, " ").trim();
  const lines = ["#separator:tab", "#html:false", "#guid column:1", "#tags column:4", "#notetype:Basic", "#deck:Fluent365"];
  for (const r of rows) lines.push([`fluent365-${r.key}`, clean(r.front), clean(r.back), r.tags.map((t) => t.replace(/\s+/g, "_")).join(" ")].join("\t"));
  return lines.join("\n") + "\n";
}

/** Parse Anki "Notes in Plain Text" (tab or comma separated): first two fields = front/back. */
export function ankiImport(text: string) {
  const out: { w: string; d: string }[] = [];
  const sep = text.split("\n").find((l) => l.startsWith("#separator:"))?.slice(11).trim();
  const delim = sep === "comma" || sep === "," ? "," : sep === "semicolon" ? ";" : "\t";
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) continue;
    const parts = line.split(delim).map((p) => p.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim());
    const hasGuid = parts.length >= 3 && /^[\w\-+/=]{6,}$/.test(parts[0]) && !/\s/.test(parts[0]);
    const [w, d] = hasGuid ? [parts[1], parts[2]] : [parts[0], parts[1]];
    if (w && w.length <= 80) out.push({ w, d: d ?? "" });
    if (out.length >= 5000) break;
  }
  return out;
}

// ---------- Praktika / shared text import ----------
const VOCAB_HEADINGS = /^(vocabulary|new words|words|expressions|useful (phrases|expressions)|key words|phrases)\b/i;
const OTHER_HEADINGS = /^(grammar|corrections|mistakes|feedback|pronunciation|summary|conversation|lesson)\b/i;

/**
 * Extract words and corrections from text. Deliberately conservative: only explicit patterns
 * (arrows, "Original/Corrected" labels, "word – meaning" lines). Nothing is applied until approved.
 */
export function parseLearningText(text: string, source: ImportItem["source"], method: ImportItem["method"], name: string): ImportItem {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.replace(/^\s*(?:[•\-–*·]+|\d{1,3}[.)])\s*/, "").trim()).filter(Boolean);
  const vocab: ImportItem["vocab"] = [];
  const corrections: ImportItem["corrections"] = [];
  let inVocab = false;
  let pendingOriginal: string | null = null;
  const seen = new Set<string>();
  const addWord = (w: string, d?: string, ex?: string) => {
    const k = w.toLowerCase();
    if (!w || w.length > 60 || w.split(/\s+/).length > 6 || seen.has(k)) return;
    seen.add(k);
    vocab.push({ w, d, ex, approved: true });
  };

  for (const line of lines) {
    if (VOCAB_HEADINGS.test(line) && line.length < 40) { inVocab = true; continue; }
    if (OTHER_HEADINGS.test(line) && line.length < 40) { inVocab = false; }

    // "I goed there → I went there" / "->" / "⇒"
    const arrow = line.match(/^(.{3,200}?)\s*(?:→|->|=>|⇒)\s*(.{3,200})$/);
    if (arrow && /\s/.test(arrow[1].trim()) && /\s/.test(arrow[2].trim())) {
      corrections.push({ original: strip(arrow[1]), corrected: strip(arrow[2]), approved: true });
      continue;
    }
    const orig = line.match(/^(?:original|you said|your sentence|incorrect|before)\s*[:：]\s*(.+)$/i);
    if (orig) { pendingOriginal = strip(orig[1]); continue; }
    const corr = line.match(/^(?:corrected|correct|better|improved|after|suggested|try)\s*(?:version|sentence)?\s*[:：]\s*(.+)$/i);
    if (corr && pendingOriginal) {
      corrections.push({ original: pendingOriginal, corrected: strip(corr[1]), approved: true });
      pendingOriginal = null;
      continue;
    }
    const expl = line.match(/^(?:explanation|why|note|tip)\s*[:：]\s*(.+)$/i);
    if (expl && corrections.length && !corrections[corrections.length - 1].explanation) {
      corrections[corrections.length - 1].explanation = expl[1].trim();
      continue;
    }
    // "word – meaning" / "word: meaning" / "word - meaning"
    const def = line.match(/^([A-Za-z][A-Za-z' -]{0,50}?)\s*(?:[–—:]|\s-\s)\s*(.{3,200})$/);
    if (def && (inVocab || def[1].trim().split(/\s+/).length <= 3) && !/^(topic|date|lesson|duration|time|level|teacher|tutor)$/i.test(def[1].trim())) {
      addWord(def[1].trim(), def[2].trim());
      continue;
    }
    if (inVocab && /^[A-Za-z][A-Za-z' -]{1,40}$/.test(line)) addWord(line);
  }

  const date = text.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})\b/)?.[1];
  const topic = text.match(/^(?:topic|lesson|subject)\s*[:：]\s*(.+)$/im)?.[1]?.trim();
  const minutes = Number(text.match(/\b(\d{1,3})\s*(?:min|minutes|mins)\b/i)?.[1]) || undefined;
  return { id: uid(), at: new Date().toISOString(), source, method, name, vocab: vocab.slice(0, 300), corrections: corrections.slice(0, 200), session: date || topic || minutes ? { date, topic, minutes } : undefined, status: "pending" };
}

const strip = (s: string) => s.trim().replace(/^["“'‘]|["”'’]$/g, "").trim();

/** Text from a PDF, fully on-device (pdf.js, loaded only when needed). */
export async function pdfText(data: ArrayBuffer): Promise<{ text: string; scanned: boolean }> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 60); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let last = -1;
    let line = "";
    const out: string[] = [];
    for (const it of content.items as { str: string; transform: number[]; hasEOL?: boolean }[]) {
      const y = Math.round(it.transform[5]);
      if (last !== -1 && Math.abs(y - last) > 3) { out.push(line); line = ""; }
      line += (line && !line.endsWith(" ") ? " " : "") + it.str;
      last = y;
      if (it.hasEOL) { out.push(line); line = ""; last = -1; }
    }
    if (line) out.push(line);
    pages.push(out.join("\n"));
  }
  const text = pages.join("\n\n");
  return { text, scanned: text.replace(/\s/g, "").length < 40 * Math.min(doc.numPages, 60) };
}
