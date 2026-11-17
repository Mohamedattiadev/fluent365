#!/usr/bin/env node
// Builds the public learning content in content/ into compact JSON files the app loads
// (apps/pocket/public/data). Pure Node, no dependencies. Run: pnpm content
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "content");
const out = join(root, "apps/pocket/public/data");
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "lessons"), { recursive: true });
mkdirSync(join(out, "courses"), { recursive: true });

const read = (p) => JSON.parse(readFileSync(join(src, p), "utf8"));
const write = (p, data) => writeFileSync(join(out, p), JSON.stringify(data));

// ---------- CSV ----------
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
const csv = (p) => parseCsv(readFileSync(join(src, p), "utf8")).slice(1);

// ---------- Grammar ----------
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
const tokens = (s) => s.trim().split(/\s+/);

const core = ["core-1.json", "core-2.json", "core-3.json"]
  .filter((f) => existsSync(join(src, "grammar", f)))
  .flatMap((f) => read(join("grammar", f)).topics)
  .map((t, i) => ({ ...t, track: "core", order: i + 1 }));

const lessonFiles = readdirSync(join(src, "lessons")).filter((f) => /^lesson-\d+\.json$/.test(f)).sort();
const lessonTopics = [];
const lessonIndex = [];
for (const f of lessonFiles) {
  const lesson = read(join("lessons", f));
  write(join("lessons", f), lesson);
  const lang = lesson.steps.find((s) => s.kind === "language");
  lessonIndex.push({ id: lesson.id, number: lesson.number, title: lesson.title, topic: lesson.topic, level: lesson.level, goal: lesson.goal, grammar: lang ? `l-${lesson.number}` : null, kinds: lesson.steps.map((s) => s.kind) });
  if (!lang) continue;
  const title = (lang.i18n?.en?.title ?? lang.title).replace(/^(Grammar|Language):\s*/i, "");
  const titleCased = title.charAt(0).toUpperCase() + title.slice(1);
  const exercises = [];
  for (const q of lang.questions) {
    const why = q.why?.en ?? "";
    if (q.type === "choice") exercises.push({ type: "choose", prompt: q.prompt, options: q.options, answer: q.answer, why, example: q.example });
    else if (q.type === "gap") exercises.push({ type: "gap", prompt: q.prompt, answers: q.answers, why, example: q.example });
  }
  // Sentence-building practice from the lesson's own model sentences (production with support).
  for (const ex of lang.examples.slice(0, 3)) {
    const words = tokens(ex);
    if (words.length < 4 || words.length > 16) continue;
    exercises.push({ type: "build", blocks: words, answer: ex, alts: [], why: "This is one of the lesson's model sentences." });
  }
  exercises.push({
    type: "produce",
    prompt: `Write your own sentence using this pattern (${title}). Base it on your life or the lesson topic: ${lesson.topic.toLowerCase()}.`,
    check: "",
    hint: "Look at the examples above, then write something true about you.",
    model: lang.examples[0],
  });
  lessonTopics.push({
    id: `l-${lesson.number}`,
    title: titleCased,
    level: lesson.level,
    summary: `From lesson ${lesson.number}: ${lesson.title}`,
    notice: lang.examples.slice(0, 4),
    explain: lang.explain,
    exercises,
    track: "lesson",
    lesson: lesson.number,
    order: 100 + lesson.number,
  });
}
const grammar = [...core, ...lessonTopics];
write("grammar.json", { topics: grammar });
write("lessons.json", { lessons: lessonIndex });

// ---------- Courses & IELTS ----------
for (const f of readdirSync(join(src, "courses")).filter((f) => f.endsWith(".json"))) write(join("courses", f), read(join("courses", f)));
const ielts = {
  part1: read("ielts/part1.json").topics,
  cueCards: read("ielts/cue-cards.json").cards,
  writing: read("ielts/writing-prompts.json").prompts.map((p) => ({ ...p, module: "academic" })),
  official: existsSync(join(src, "ielts/official-tests.json")) ? read("ielts/official-tests.json").tests : [],
};
if (existsSync(join(src, "ielts/gt-writing.json"))) ielts.writing.unshift(...read("ielts/gt-writing.json").prompts.map((p) => ({ ...p, module: "general" })));
write("ielts.json", ielts);

// ---------- Vocabulary ----------
const vocab = new Map();
const key = (w) => w.trim().toLowerCase();
function add(word, fields, source) {
  if (!word || !word.trim()) return;
  const k = key(word);
  const cur = vocab.get(k) ?? { w: word.trim(), src: [] };
  for (const [f, v] of Object.entries(fields)) if (v != null && v !== "" && cur[f] == null) cur[f] = typeof v === "string" ? v.trim() : v;
  if (!cur.src.includes(source)) cur.src.push(source);
  vocab.set(k, cur);
}
const rank = new Map(csv("vocabulary/NGSL_12_stats.csv").map((r) => [key(r[0]), Number(r[1])]));
const freq = read("vocabulary/wordfreq-en.json").words;
const freqRank = new Map(freq.map((w, i) => [w, i + 1]));
const POS = { n: "noun", v: "verb", adj: "adjective", adv: "adverb", prep: "preposition", conj: "conjunction", pron: "pronoun" };

for (const [w, d] of csv("vocabulary/NGSL_12_with_English_definitions.csv")) add(w, { d, r: rank.get(key(w)) }, "ngsl");
for (const [w, d] of csv("vocabulary/NGSL-Spoken_12_with_en_definitions.csv")) add(w, { d }, "spoken");
for (const [w, d, pos] of csv("vocabulary/NAWL_12_with_en_definitions.csv")) add(w, { d, pos: POS[pos?.trim()] ?? pos }, "nawl");
for (const [w, d] of csv("vocabulary/TSL_12_definitions.csv")) add(w, { d }, "tsl");
for (const it of read("vocabulary/daily-en.json").items) add(it.en, { d: it.definition, pos: it.pos, ex: it.quote, exSrc: it.title }, it.list);
for (const f of lessonFiles) {
  const lesson = read(join("lessons", f));
  const words = lesson.steps.find((s) => s.kind === "words")?.words ?? [];
  for (const w of words) add(w.en, { pos: w.pos, ex: w.example, tr: w.tr, ar: w.ar, topic: lesson.topic, lesson: lesson.number }, "lesson");
}
for (const f of ["phrasal-verbs.json", "collocations.json", "linking.json"]) {
  if (!existsSync(join(src, "vocabulary", f))) continue;
  const data = read(join("vocabulary", f));
  for (const it of data.items) add(it.w, { d: it.d, ex: it.ex, pos: it.pos, lvl: it.lvl, topic: it.topic }, data.source);
}

// Rank every entry: NGSL rank if present, else wordfreq rank, else after the lists.
const items = [];
for (const v of vocab.values()) {
  let r = v.r ?? freqRank.get(key(v.w));
  if (v.src.includes("nawl") && !v.r) r = Math.max(r ?? 0, 3000) + (r ? 0 : 1000);
  if (r == null) r = v.src.includes("lesson") ? 4500 : v.src.includes("tsl") ? 6000 : 5000;
  v.r = r;
  v.band = r <= 1000 ? 1 : r <= 2000 ? 2 : r <= 3000 ? 3 : r <= 5000 ? 5 : 9;
  // Approximate CEFR from frequency (labelled as an estimate in the app).
  v.lvl ??= r <= 1000 ? "A2" : r <= 2000 ? "B1" : r <= 3500 ? "B2" : "C1";
  items.push(v);
}
items.sort((a, b) => a.r - b.r || a.w.localeCompare(b.w));
items.forEach((v, i) => (v.id = i + 1));
write("vocab.json", {
  licence: "NGSL, NGSL-Spoken, NAWL, TSL by Browne, Culligan & Phillips (newgeneralservicelist.com), CC BY-SA 4.0. Example quotes from public-domain books (Project Gutenberg). Lesson words, phrasal verbs and collocations: original Fluent365 content, CC BY-SA 4.0.",
  items,
});

const counts = { grammar: grammar.length, coreGrammar: core.length, lessons: lessonIndex.length, vocab: items.length, writing: ielts.writing.length, cueCards: ielts.cueCards.length, official: ielts.official.length };
// ---------- Books (reading ladder) ----------
mkdirSync(join(out, "books"), { recursive: true });
const ladder = read("books/ladder.json");
const countWords = (t) => (t.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length;
const books = ladder.books.map((meta) => {
  const book = read(join("books", `${meta.id}.json`));
  const blocks = book.blocks.filter((b) => b.text && b.text.trim()).map((b) => ({ type: b.type === "h2" ? "h2" : "p", text: b.text.trim() }));
  write(join("books", `${meta.id}.json`), { id: book.id, title: book.title, author: book.author, blocks });
  let words = 0;
  const chapters = [];
  blocks.forEach((b, i) => {
    if (b.type === "h2") chapters.push({ title: b.text, start: i, startWord: words });
    words += countWords(b.text);
  });
  return { ...meta, title: book.title, author: book.author, words, blocks: blocks.length, chapters };
});
// Covers (from the owner's Bo-ok project; sources in docs/CONTENT_LICENSING.md).
mkdirSync(join(out, "books", "covers"), { recursive: true });
for (const meta of ladder.books) {
  const src = join(root, "content", "books", "covers", `${meta.id}.jpg`);
  if (existsSync(src)) { copyFileSync(src, join(out, "books", "covers", `${meta.id}.jpg`)); meta.cover = `books/covers/${meta.id}.jpg`; }
}
for (const b of books) b.cover = ladder.books.find((m) => m.id === b.id)?.cover;
write("books.json", { about: ladder.about, books });
counts.books = books.length;
counts.bookWords = books.reduce((n, b) => n + b.words, 0);

write("manifest.json", { built: new Date().toISOString(), counts });
console.log("content built:", counts);
