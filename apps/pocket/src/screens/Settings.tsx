import { useEffect, useRef, useState } from "react";
import { ActionBar, Icon, toast } from "../components/ui";
import type { Content } from "../lib/content";
import * as db from "../lib/db";
import { addCards } from "../lib/learning";
import { ankiExport, ankiImport, checkBackup, download, makeBackup, parseLearningText, pdfText, type BackupCheck } from "../lib/portability";
import { emptyState, getState, replaceState, today, uid, update, useApp } from "../lib/store";
import type { Exercise, GrammarTopic, ImportItem, Settings } from "../lib/types";
import { navigate } from "../router";
import { IDLE_LIMIT } from "../lib/activity";

const Back = ({ to = "/settings" }: { to?: string }) => <button className="btn link" onClick={() => navigate(to)}><Icon name="back" /> Back</button>;

export function SettingsScreen({ c, path }: { c: Content; path: string[] }) {
  if (path[0] === "backup") return <BackupScreen c={c} />;
  if (path[0] === "import") return <ImportCentre c={c} />;
  if (path[0] === "about") return <About c={c} />;
  return <Main />;
}

function Main() {
  const s = useApp((x) => x.settings);
  const set = (patch: Partial<Settings>) => update((st) => ({ settings: { ...st.settings, ...patch }, session: "minutes" in patch || "level" in patch || "newWords" in patch ? null : st.session }));
  const [confirmReset, setConfirmReset] = useState("");
  return (
    <div>
      <h1>Settings</h1>
      <div className="card">
        <h2>Your plan</h2>
        <label className="field"><span>Name (optional)</span><input type="text" value={s.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <div className="grid2">
          <label className="field"><span>English level</span><select value={s.level} onChange={(e) => set({ level: e.target.value as Settings["level"] })}><option value="A2">A2 Elementary</option><option value="B1">B1 Intermediate</option><option value="B2">B2 Upper-intermediate</option><option value="C1">C1 Advanced</option></select></label>
          <label className="field"><span>Goal</span><select value={s.goal} onChange={(e) => set({ goal: e.target.value as Settings["goal"] })}><option value="ielts-gt">IELTS General Training</option><option value="ielts-ac">IELTS Academic</option><option value="general">General English</option></select></label>
          <label className="field"><span>Daily time</span><select value={s.minutes} onChange={(e) => set({ minutes: Number(e.target.value) as Settings["minutes"] })}><option value={30}>About 25 minutes</option><option value={60}>About 1 hour</option><option value={90}>About 1.5 hours</option></select></label>
          <label className="field"><span>New words per day (max)</span><select value={s.newWords} onChange={(e) => set({ newWords: Number(e.target.value) })}>{[5, 8, 10, 12, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="field"><span>Explanations in</span><select value={s.explainLang} onChange={(e) => set({ explainLang: e.target.value as Settings["explainLang"] })}><option value="en">English</option><option value="tr">Türkçe (where available)</option><option value="ar">العربية (where available)</option></select></label>
        </div>
        <p className="small muted">New words are reduced automatically when your reviews pile up. Changing these rebuilds today's session.</p>
      </div>
      <div className="card">
        <h2>Display</h2>
        <div className="grid2">
          <label className="field"><span>Text size</span><select value={s.textSize} onChange={(e) => set({ textSize: e.target.value as Settings["textSize"] })}><option value="normal">Normal</option><option value="large">Large</option><option value="xl">Extra large</option></select></label>
          <label className="field"><span>Theme</span><select value={s.theme} onChange={(e) => set({ theme: e.target.value as Settings["theme"] })}><option value="system">Same as device</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
        </div>
        <label className="row" style={{ minHeight: 48 }}><input type="checkbox" checked={s.comfortable} onChange={(e) => set({ comfortable: e.target.checked })} style={{ width: 24, height: 24 }} /> Comfortable mode (more space between things)</label>
        <label className="row" style={{ minHeight: 48 }}><input type="checkbox" checked={s.reduceMotion} onChange={(e) => set({ reduceMotion: e.target.checked })} style={{ width: 24, height: 24 }} /> Reduce motion</label>
      </div>
      <div className="card stack">
        <h2>Your data</h2>
        <button className="btn big outline" onClick={() => navigate("/settings/backup")}>Backup, restore & Anki</button>
        <button className="btn big outline" onClick={() => navigate("/settings/import")}>Import Centre (Praktika, PDF, text)</button>
        <button className="btn big outline" onClick={() => navigate("/settings/about")}>How Fluent365 works · privacy · licences</button>
      </div>
      <div className="card">
        <h2>Start over</h2>
        <p className="muted">Deletes all progress on this device. Download a backup first. Type <b>DELETE</b> to confirm.</p>
        <div className="row"><input type="text" value={confirmReset} onChange={(e) => setConfirmReset(e.target.value)} aria-label="Type DELETE to confirm" style={{ maxWidth: 200 }} />
          <button className="btn danger" disabled={confirmReset !== "DELETE"} onClick={async () => { await db.clear("blobs"); await replaceState(emptyState()); setConfirmReset(""); navigate("/"); }}>Delete everything</button></div>
      </div>
    </div>
  );
}

function BackupScreen({ c }: { c: Content }) {
  const [check, setCheck] = useState<BackupCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ankiRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void navigator.storage?.persisted?.().then(setPersisted); }, []);
  async function onFile(f: File | undefined) {
    setError(null); setCheck(null);
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) return setError("This file is too large to be a Fluent365 backup.");
    const r = checkBackup(await f.text());
    if (r.ok) setCheck(r); else setError(r.error);
  }
  async function restore() {
    if (!check) return;
    await db.set("kv", "backup:before-restore", makeBackup());
    await replaceState(check.state);
    setCheck(null);
    toast("Backup restored. Your previous data was kept as a safety copy.");
    navigate("/");
  }
  function exportAnki() {
    const s = getState();
    const rows = Object.entries(s.cards).map(([key, mc]) => {
      const v = mc.custom ?? (() => { const x = c.vocabById.get(Number(key)); return x ? { w: x.w, d: x.d, ex: x.ex, source: x.src.join(" ") } : null; })();
      if (!v) return null;
      return { key, front: v.w, back: [v.d, v.ex ? `"${v.ex}"` : ""].filter(Boolean).join(" — "), tags: ["fluent365", ...(v.source ? v.source.split(" ") : [])] };
    }).filter((x): x is NonNullable<typeof x> => !!x);
    download(`fluent365-anki-${today()}.txt`, ankiExport(rows), "text/plain");
    toast(`${rows.length} cards exported for Anki`);
  }
  async function importAnki(f: File | undefined) {
    if (!f) return;
    if (/\.apkg$/i.test(f.name)) return toast("Export from Anki as “Notes in Plain Text (.txt)” first. .apkg files are not supported yet.");
    const rows = ankiImport(await f.text());
    const custom: Record<string, { w: string; d?: string; source: string }> = {};
    const keys: string[] = [];
    for (const r of rows) {
      const existing = c.vocab.find((v) => v.w.toLowerCase() === r.w.toLowerCase());
      const key = existing ? String(existing.id) : `c:${r.w.toLowerCase()}`;
      if (!existing) custom[key] = { w: r.w, d: r.d, source: "Anki import" };
      keys.push(key);
    }
    const n = addCards(keys, custom);
    toast(`${n} new cards added from Anki (${rows.length - n} were already there).`);
  }
  return (
    <div>
      <Back />
      <h1>Backup & restore</h1>
      <div className="card">
        <p>Your progress is stored only in this browser on this device. If you clear browser data or lose the phone, it's gone — so download a backup every week or two.</p>
        {persisted !== null && <p className="small muted">{persisted ? "✓ This browser has agreed to keep your data safe from automatic clean-up." : "Tip: install Fluent365 to your home screen so the browser keeps your data safely."}</p>}
        <button className="btn big primary" onClick={() => { download(`fluent365-backup-${today()}.json`, JSON.stringify(makeBackup())); toast("Backup downloaded"); }}>Download backup</button>
      </div>
      <div className="card">
        <h2>Restore from a backup</h2>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={(e) => onFile(e.target.files?.[0])} className="sr-only" />
        <button className="btn big outline" onClick={() => fileRef.current?.click()}>Choose backup file</button>
        {error && <div className="feedback no" role="alert">{error}</div>}
        {check && (
          <div className="feedback info">
            <strong className="title">This backup contains:</strong>
            <table><tbody>{Object.entries(check.summary).map(([k, v]) => <tr key={k}><td>{k}</td><td><b>{v}</b></td></tr>)}</tbody></table>
            <p>Restoring <b>replaces</b> the progress on this device. A safety copy of your current data is kept.</p>
            <div className="row"><button className="btn primary" onClick={restore}>Restore this backup</button><button className="btn outline" onClick={() => setCheck(null)}>Cancel</button></div>
          </div>
        )}
      </div>
      <div className="card stack">
        <h2>Anki</h2>
        <p className="muted">Use Fluent365 cards in Anki, or bring Anki cards into Fluent365. Scheduling history stays in each app.</p>
        <button className="btn big outline" onClick={exportAnki}>Export my cards for Anki (.txt)</button>
        <p className="small muted">In Anki: File → Import → choose the file. Re-importing updates cards instead of duplicating them.</p>
        <input ref={ankiRef} type="file" accept=".txt,.csv,.tsv,text/plain,.apkg" onChange={(e) => importAnki(e.target.files?.[0])} className="sr-only" />
        <button className="btn big outline" onClick={() => ankiRef.current?.click()}>Import from Anki (Notes in Plain Text)</button>
      </div>
    </div>
  );
}

// ---------- Import Centre (Praktika and other sources) ----------
function ImportCentre({ c }: { c: Content }) {
  const enabled = useApp((s) => s.integrations.praktika.enabled);
  const imports = useApp((s) => s.imports);
  const external = useApp((s) => s.external);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [minutes, setMinutes] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Items shared from other Android apps arrive in the inbox (see public/sw.js).
  useEffect(() => {
    void (async () => {
      const inbox = await db.entries<{ kind: string; name: string; text?: string; blob?: Blob }>("inbox");
      for (const [key, item] of inbox) {
        try {
          if (item.kind === "text" && item.text) addImport(parseLearningText(item.text, "praktika", "share", item.name));
          else if (item.blob) await handleFile(new File([item.blob], item.name, { type: item.blob.type }), "share");
        } finally {
          await db.del("inbox", key);
        }
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addImport = (it: ImportItem) => update((s) => ({ imports: [it, ...s.imports].slice(0, 200) }));

  async function handleFile(f: File, method: ImportItem["method"] = "pdf") {
    if (f.size > 20 * 1024 * 1024) return toast("That file is too large (max 20 MB).");
    setBusy(`Reading ${f.name}…`);
    try {
      if (/pdf/.test(f.type) || /\.pdf$/i.test(f.name)) {
        const { text, scanned } = await pdfText(await f.arrayBuffer());
        if (scanned) toast("This PDF looks like a scan (pictures, no text). Text recognition (OCR) is not available yet — try copying the text instead.");
        addImport(parseLearningText(text, "praktika", method === "share" ? "share" : "pdf", f.name));
      } else if (/text|csv|tsv/.test(f.type) || /\.(txt|md|csv|tsv)$/i.test(f.name)) {
        addImport(parseLearningText(await f.text(), "praktika", method === "share" ? "share" : "text", f.name));
      } else toast("Only PDF and text files can be imported.");
    } catch {
      toast("Could not read that file. It may be damaged or protected.");
    } finally {
      setBusy(null);
    }
  }

  const pending = imports.filter((i) => i.status === "pending");
  return (
    <div>
      <Back />
      <h1>Import Centre</h1>
      <div className="card">
        <h2>Praktika</h2>
        <div className="feedback info" role="status">
          <strong className="title">Automatic Praktika account synchronisation is not currently available.</strong>
          Praktika has no public API or official way to connect other apps (checked 16 Nov 2026). You can import supported lesson exports or shared material: download a lesson summary PDF in Praktika and share it to Fluent365, choose the file here, or paste text.
        </div>
        <label className="row" style={{ minHeight: 48, marginTop: 12 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => update((s) => ({ integrations: { ...s.integrations, praktika: { enabled: e.target.checked } } }))} style={{ width: 24, height: 24 }} />
          Show Praktika tools (status: {enabled ? "import enabled — not connected to any account" : "off"})
        </label>
      </div>

      <div className="card stack">
        <h2>Add material</h2>
        <p className="small muted">On Android: in Praktika (or any app) tap Share → Fluent365. The file opens here. Everything is processed on this device and nothing is uploaded.</p>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf,text/plain,.txt" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }} />
        <button className="btn big outline" onClick={() => fileRef.current?.click()} disabled={!!busy}>Choose a PDF or text file</button>
        {busy && <p role="status">{busy}</p>}
        <label className="field"><span>…or paste text (words, "original → corrected" lines)</span><textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Vocabulary\nto commute – to travel to work\n\nYou said: I am agree with you\nCorrected: I agree with you"} /></label>
        <button className="btn primary" disabled={!paste.trim()} onClick={() => { addImport(parseLearningText(paste, "praktika", "paste", "Pasted text")); setPaste(""); }}>Read this text</button>
      </div>

      {pending.map((it) => <ReviewImport key={it.id} item={it} c={c} />)}

      {enabled && (
        <div className="card">
          <h2>Log a Praktika session</h2>
          <p className="small muted">Kept separate from Fluent365's own active time.</p>
          <div className="row"><input type="number" min={1} max={300} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Minutes" style={{ maxWidth: 140 }} aria-label="Minutes practised in Praktika" />
            <button className="btn" disabled={!minutes} onClick={() => { update((s) => ({ external: [{ id: uid(), at: new Date().toISOString(), source: "praktika", topic: "Speaking practice", minutes: Number(minutes), method: "manual" }, ...s.external] })); setMinutes(""); toast("Praktika session logged"); }}>Save</button></div>
        </div>
      )}

      <div className="card">
        <h2>Import history</h2>
        {imports.filter((i) => i.status !== "pending").length === 0 && <p className="muted">Nothing imported yet.</p>}
        <ul className="list">{imports.filter((i) => i.status !== "pending").map((i) => <li key={i.id}><b>{i.name}</b> <span className="small muted">· {new Date(i.at).toLocaleDateString()} · {i.method} · {i.status} · {i.vocab.filter((v) => v.approved).length} words, {i.corrections.filter((x) => x.approved).length} corrections</span></li>)}</ul>
        <p className="small muted">External sessions logged: {external.length}</p>
        {!confirmDelete ? <button className="btn danger" onClick={() => setConfirmDelete(true)}>Delete all imported data…</button> : (
          <div className="feedback no"><p>This removes imported words, corrections, the "My corrections" grammar topic and logged sessions. Continue?</p>
            <div className="row"><button className="btn danger" onClick={() => { deleteImported(); setConfirmDelete(false); toast("Imported data deleted"); }}>Yes, delete</button><button className="btn outline" onClick={() => setConfirmDelete(false)}>Cancel</button></div></div>
        )}
      </div>
    </div>
  );
}

function ReviewImport({ item, c }: { item: ImportItem; c: Content }) {
  const [it, setIt] = useState(item);
  const save = (status: ImportItem["status"]) => update((s) => ({ imports: s.imports.map((x) => (x.id === it.id ? { ...it, status } : x)) }));
  const nothing = !it.vocab.length && !it.corrections.length;
  function apply() {
    const words = it.vocab.filter((v) => v.approved);
    const custom: Record<string, { w: string; d?: string; ex?: string; source: string }> = {};
    const keys = words.map((w) => {
      const existing = c.vocab.find((v) => v.w.toLowerCase() === w.w.toLowerCase());
      const key = existing ? String(existing.id) : `c:${w.w.toLowerCase()}`;
      if (!existing) custom[key] = { w: w.w, d: w.d, ex: w.ex, source: `Imported: ${it.name}` };
      return key;
    });
    // Avoid flooding: imported words beyond 30 are kept as "known" candidates for later.
    const added = addCards(keys.slice(0, 30), custom);
    const corr = it.corrections.filter((x) => x.approved && x.original.trim() !== x.corrected.trim());
    update((s) => ({
      mistakes: [...corr.map((x) => ({ id: uid(), at: new Date().toISOString(), kind: "imported" as const, topic: "my-corrections", prompt: `Correct: ${x.original}`, given: x.original, expected: x.corrected, why: x.explanation, fixed: false, source: it.name })), ...s.mistakes],
      external: it.session ? [{ id: uid(), at: new Date().toISOString(), source: it.source, topic: it.session.topic ?? it.name, minutes: it.session.minutes, method: it.method }, ...s.external] : s.external,
    }));
    if (corr.length) addPersonalTopic(corr.map((x) => ({ type: "fix", wrong: x.original, answers: [x.corrected], why: x.explanation ?? "This is the corrected version from your lesson." } as Exercise)));
    save("applied");
    toast(`Added ${added} words and ${corr.length} corrections to your practice.`);
  }
  return (
    <div className="card">
      <h2>Review: {it.name}</h2>
      <p className="small muted">Untick anything that's wrong. Nothing is added until you press "Add to my practice".{it.session?.topic ? ` Topic: ${it.session.topic}.` : ""}{it.session?.minutes ? ` ${it.session.minutes} min.` : ""}</p>
      {nothing && <p>No words or corrections were found. Fluent365 only reads clear patterns like "word – meaning" or "original → corrected".</p>}
      {it.vocab.length > 0 && <h3>Words ({it.vocab.filter((v) => v.approved).length})</h3>}
      {it.vocab.map((v, i) => (
        <label key={i} className="row" style={{ minHeight: 44 }}>
          <input type="checkbox" checked={v.approved} onChange={(e) => setIt({ ...it, vocab: it.vocab.map((x, j) => (j === i ? { ...x, approved: e.target.checked } : x)) })} style={{ width: 24, height: 24 }} />
          <span><b>{v.w}</b>{v.d ? ` — ${v.d}` : ""}</span>
        </label>
      ))}
      {it.corrections.length > 0 && <h3>Corrections ({it.corrections.filter((v) => v.approved).length})</h3>}
      {it.corrections.map((x, i) => (
        <label key={i} className="row" style={{ minHeight: 44, alignItems: "flex-start" }}>
          <input type="checkbox" checked={x.approved} onChange={(e) => setIt({ ...it, corrections: it.corrections.map((y, j) => (j === i ? { ...y, approved: e.target.checked } : y)) })} style={{ width: 24, height: 24, marginTop: 4 }} />
          <span><span style={{ color: "var(--bad)", textDecoration: "line-through" }}>{x.original}</span><br /><span style={{ color: "var(--good)" }}>{x.corrected}</span></span>
        </label>
      ))}
      <ActionBar>
        <div className="grid2">
          <button className="btn outline" onClick={() => save("discarded")}>Discard</button>
          <button className="btn primary" disabled={nothing} onClick={apply}>Add to my practice</button>
        </div>
      </ActionBar>
    </div>
  );
}

/** Approved corrections become a personal grammar topic, scheduled like any other. */
function addPersonalTopic(exs: Exercise[]) {
  void db.get<GrammarTopic>("kv", "personal-topic").then((t) => {
    const topic: GrammarTopic = t ?? { id: "my-corrections", title: "My corrections", level: "Personal", summary: "Sentences corrected in your own lessons.", notice: [], explain: { en: "These are your own sentences, corrected. Fix each one again from memory." }, exercises: [], track: "personal", order: 999 };
    topic.exercises = [...topic.exercises, ...exs].slice(-200);
    void db.set("kv", "personal-topic", topic);
  });
}

function deleteImported() {
  update((s) => ({
    imports: [],
    external: [],
    mistakes: s.mistakes.filter((m) => m.kind !== "imported"),
    cards: Object.fromEntries(Object.entries(s.cards).filter(([, v]) => !v.custom?.source?.startsWith("Imported"))),
    grammar: Object.fromEntries(Object.entries(s.grammar).filter(([k]) => k !== "my-corrections")),
  }));
  void db.del("kv", "personal-topic");
}

function About({ c }: { c: Content }) {
  return (
    <div>
      <Back />
      <h1>How Fluent365 works</h1>
      <div className="card">
        <h2>Your daily session</h2>
        <p>Each day Fluent365 builds one session: reviews first, then new words, a grammar pattern, reading or listening, speaking or writing, and a short fluency task. The balance follows research on how adults learn languages (Nation's four strands, spaced retrieval, pushed output). You move forward based on what you actually manage, not the calendar.</p>
      </div>
      <div className="card">
        <h2>Active time</h2>
        <p>Time counts only while this page is open on your screen <b>and</b> you did something in the last {IDLE_LIMIT} seconds (answered, checked, rated a card, typed, played audio). An idle tab is not counted. There is no keystroke logging. Active time is an estimate, not proof of attention.</p>
      </div>
      <div className="card">
        <h2>Privacy</h2>
        <p>All progress, recordings and imports stay in this browser on this device. Nothing is sent to a server. The website only delivers the app and public learning content. There is no automatic sync between devices: use Backup to move data.</p>
      </div>
      <div className="card">
        <h2>Scores</h2>
        <p>Practice scores and "rough bands" are estimates for your own tracking. Fluent365 does not give official IELTS scores.</p>
      </div>
      <div className="card">
        <h2>Licences</h2>
        <p className="small">{c.licence}</p>
        <p className="small">Lessons, grammar topics and IELTS-style prompts: original content, CC BY-SA 4.0. Software: MIT. Spaced repetition: ts-fsrs (MIT). PDF reading: pdf.js (Apache-2.0). IELTS is a registered trademark of the British Council, IDP and Cambridge University Press & Assessment; Fluent365 is not affiliated with them.</p>
      </div>
    </div>
  );
}
