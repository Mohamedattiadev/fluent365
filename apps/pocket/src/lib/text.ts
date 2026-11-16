// Answer checking: forgiving about case, spacing, apostrophes, final punctuation and contractions.
const CONTRACTIONS: [RegExp, string][] = [
  [/\bwon't\b/g, "will not"],
  [/\bcan't\b/g, "cannot"],
  [/\bcan not\b/g, "cannot"],
  [/\bshan't\b/g, "shall not"],
  [/\b(\w+)n't\b/g, "$1 not"],
  [/\bi'm\b/g, "i am"],
  [/\b(you|we|they)'re\b/g, "$1 are"],
  [/\b(i|you|we|they)'ve\b/g, "$1 have"],
  [/\b(i|you|we|they|he|she|it)'ll\b/g, "$1 will"],
  [/\b(i|you|we|they|he|she)'d\b/g, "$1 would"],
  [/\b(he|she|it|that|there|what|who|where)'s\b/g, "$1 is"],
  [/\blet's\b/g, "let us"],
];

export function normalize(s: string) {
  let t = s
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/[.!?,;:]+$/g, "")
    .trim();
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep);
  return t.replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ");
}

export const matches = (given: string, answers: string[]) => {
  const g = normalize(given);
  return g.length > 0 && answers.some((a) => normalize(a) === g);
};

/** Word-level diff for feedback: marks words in `given` missing from / extra to `expected`. */
export function diffWords(given: string, expected: string) {
  const a = given.trim().split(/\s+/);
  const b = expected.trim().split(/\s+/);
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const eq = (x: string, y: string) => normalize(x) === normalize(y);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: { text: string; op: "same" | "del" | "add" }[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) { out.push({ text: b[j], op: "same" }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ text: a[i++], op: "del" });
    else out.push({ text: b[j++], op: "add" });
  }
  while (i < n) out.push({ text: a[i++], op: "del" });
  while (j < m) out.push({ text: b[j++], op: "add" });
  return out;
}

export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0);

export function shuffle<T>(list: T[], seed = Math.random()): T[] {
  const a = [...list];
  let x = Math.floor(seed * 2 ** 31) || 1;
  for (let i = a.length - 1; i > 0; i--) {
    x = (x * 48271) % 2147483647;
    const j = x % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Render **bold** markers as segments. */
export const boldParts = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p) => (p.startsWith("**") ? { b: true, t: p.slice(2, -2) } : { b: false, t: p }));
