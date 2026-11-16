// Learn: one page, two tabs. Words (reviews, new words, your lists) and Grammar (topics, your mistakes).
import { useMemo, useState } from "react";
import { GrammarLesson, GrammarReview } from "../components/Grammar";
import { FixMistakes } from "../components/Skills";
import { cardView, NewWords, ReviewSession, WordFace, viewOf } from "../components/Vocab";
import { Icon, SpeakButton, toast } from "../components/ui";
import type { Content } from "../lib/content";
import { addCards, dueCardKeys, markKnown } from "../lib/learning";
import { pickNewWords } from "../lib/session";
import { interval, statusOf } from "../lib/srs";
import { getState, useApp } from "../lib/store";
import { navigate } from "../router";

export const Back = ({ to, label = "Back" }: { to: string; label?: string }) => (
  <button className="btn quiet back" onClick={() => navigate(to)}><Icon name="back" size={20} /> {label}</button>
);

/** Open mistakes that can be practised as a rewrite (listening slips are not). */
export const openMistakes = (s = getState()) => s.mistakes.filter((m) => !m.fixed && m.expected && m.kind !== "listening");

export function LearnScreen({ c, path }: { c: Content; path: string[] }) {
  const [tab = "words", sub, arg] = path;
  // Inner pages (a review, a grammar topic) replace the tabs and have a Back button.
  if (tab === "words" && sub === "review") return <div><Back to="/learn/words" /><ReviewSession c={c} limit={200} onDone={() => navigate("/learn/words")} /></div>;
  if (tab === "words" && sub === "new") {
    const ids = arg?.split(",").map(Number).filter(Boolean) ?? [];
    return <div><Back to="/learn/words" /><NewWords c={c} ids={ids} onDone={() => navigate("/learn/words")} /></div>;
  }
  if (tab === "grammar" && sub === "mistakes") return <div><Back to="/learn/grammar" /><h1>My mistakes</h1><FixMistakes max={10} onDone={() => navigate("/learn/grammar")} /><MistakeList /></div>;
  if (tab === "grammar" && sub === "mix") {
    const learned = c.grammar.filter((t) => !!getState().grammar[t.id]?.learnedAt);
    return <div><Back to="/learn/grammar" /><h1>Mixed grammar review</h1><GrammarReview topics={learned.slice(-6)} count={10} onDone={() => navigate("/learn/grammar")} /></div>;
  }
  if (tab === "grammar" && sub) {
    const t = c.grammarById.get(sub);
    if (!t) return <div><Back to="/learn/grammar" /><p>Topic not found.</p></div>;
    return <div><Back to="/learn/grammar" label="Grammar" /><GrammarLesson topic={t} onDone={() => navigate("/learn/grammar")} /></div>;
  }
  return (
    <div className="learn">
      <h1 className="sr-only">Learn</h1>
      <div className="ptabs" role="tablist" aria-label="Learn">
        {([["words", "Words", "words"], ["grammar", "Grammar", "grammar"]] as const).map(([k, label, icon]) => (
          <a key={k} role="tab" href={`#/learn/${k}`} aria-selected={tab === k}><Icon name={icon} size={20} filled={tab === k} />{label}</a>
        ))}
        <span className="ptabs-ind" style={{ transform: `translateX(${tab === "grammar" ? 100 : 0}%)` }} aria-hidden />
      </div>
      <div className="tab-panel" key={tab}>{tab === "grammar" ? <GrammarTab c={c} /> : <WordsTab c={c} />}</div>
    </div>
  );
}

// ---------- Words ----------
type WordTab = "learning" | "learned" | "known" | "hard";

function WordsTab({ c }: { c: Content }) {
  const cards = useApp((s) => s.cards);
  const known = useApp((s) => s.known);
  const newWords = useApp((s) => s.settings.newWords);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const due = dueCardKeys().length;

  // Every card you have, with its status. Imported/Anki words (custom cards) are included.
  const mine = useMemo(() => Object.entries(cards).map(([key, mc]) => {
    const view = cardView(key, mc, c);
    const status = statusOf(mc.card.fresh ? undefined : mc.card);
    return view ? { key, view, mc, learned: status === "learned", hard: mc.card.lapses > 0 || mc.card.difficulty >= 7 } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x), [cards, c]);
  const knownList = useMemo(() => Object.keys(known).map((k) => c.vocabById.get(Number(k))).filter((v): v is NonNullable<typeof v> => !!v).sort((a, b) => a.w.localeCompare(b.w)), [known, c]);
  const counts = { learning: mine.filter((x) => !x.learned).length, learned: mine.filter((x) => x.learned).length, known: knownList.length, hard: mine.filter((x) => x.hard).length };
  const [tab, setTab] = useState<WordTab>("learning");
  const needle = q.trim().toLowerCase();
  const hit = (w: string, d?: string, tr?: string) => w.toLowerCase().includes(needle) || (d ?? "").toLowerCase().includes(needle) || (tr ?? "").toLowerCase().includes(needle);

  type Row = { key: string; w: string; d?: string; right: string; vocabId?: number };
  const rows: Row[] = useMemo(() => {
    const now = Date.now();
    const when = (dueAt: string) => { const ms = new Date(dueAt).getTime() - now; return ms <= 0 ? "due now" : `in ${interval(ms)}`; };
    // Searching looks through the whole word list, so you can add any word.
    if (needle) {
      const out: Row[] = [];
      for (const v of c.vocab) {
        if (!hit(v.w, v.d, v.tr)) continue;
        const card = cards[String(v.id)];
        out.push({ key: String(v.id), w: v.w, d: v.d, right: card ? (statusOf(card.card) === "learned" ? "learned" : "learning") : known[String(v.id)] ? "known" : "", vocabId: v.id });
        if (out.length >= 60) break;
      }
      for (const x of mine) if (Number.isNaN(Number(x.key)) && hit(x.view.w, x.view.d, x.view.tr)) out.push({ key: x.key, w: x.view.w, d: x.view.d, right: "learning" });
      return out;
    }
    if (tab === "known") return knownList.map((v) => ({ key: String(v.id), w: v.w, d: v.d, right: "known", vocabId: v.id }));
    const pick = mine.filter((x) => (tab === "learned" ? x.learned : tab === "hard" ? x.hard : !x.learned));
    pick.sort((a, b) => (tab === "learned" ? (a.mc.card.lastReviewAt ?? "") < (b.mc.card.lastReviewAt ?? "") ? 1 : -1 : new Date(a.mc.card.dueAt).getTime() - new Date(b.mc.card.dueAt).getTime()));
    return pick.map((x) => ({ key: x.key, w: x.view.w, d: x.view.d, right: x.mc.card.fresh ? "new" : when(x.mc.card.dueAt), vocabId: Number.isNaN(Number(x.key)) ? undefined : Number(x.key) }));
  }, [tab, mine, knownList, c, needle, cards, known]); // eslint-disable-line react-hooks/exhaustive-deps

  const TABS: [WordTab, string, number][] = [["learning", "Learning", counts.learning], ["learned", "Learned", counts.learned], ["known", "Known", counts.known], ["hard", "Difficult", counts.hard]];
  const explain: Record<WordTab, string> = {
    learning: "In your reviews, not solid yet. Sorted by when they come back.",
    learned: "You should still remember these after 3 weeks or more. They come back now and then.",
    known: "Words you marked as already known. They are never shown as new words.",
    hard: "Words you forgot at least once or found hard. They come back more often.",
  };
  const learnNew = () => {
    const ids = pickNewWords(getState(), c, Math.min(10, newWords));
    if (!ids.length) toast("No new words left at your level");
    else navigate(`/learn/words/new/${ids.join(",")}`);
  };

  return (
    <div>
      <div className="learn-actions">
        {due > 0 ? <button className="btn big primary" onClick={() => navigate("/learn/words/review")}>Review {due} {due === 1 ? "word" : "words"}</button>
          : <p className="muted" style={{ margin: 0 }}>No words due right now.</p>}
        <button className="btn quiet" onClick={learnNew}><Icon name="arrow" size={18} /> Learn new words</button>
      </div>
      <label className="field search"><span className="sr-only">Search all words</span><input type="search" value={q} onChange={(e) => { setQ(e.target.value); setOpen(null); }} placeholder={`Search ${c.vocab.length.toLocaleString()} words`} /></label>
      {!needle && (
        <div className="tabs" role="tablist" aria-label="Word lists">
          {TABS.map(([k, label, n]) => <button key={k} role="tab" aria-selected={tab === k} title={explain[k]} className={`chip ${tab === k ? "on" : ""}`} onClick={() => { setTab(k); setOpen(null); }}>{label} <span className="num">{n}</span></button>)}
        </div>
      )}
      <ul className="list" aria-live="polite">
        {rows.length === 0 && <li className="muted small">{needle ? "No words found." : explain[tab]}</li>}
        {rows.map((r) => {
          const v = r.vocabId != null ? c.vocabById.get(r.vocabId) : undefined;
          const card = cards[r.key];
          const view = card ? cardView(r.key, card, c) : v ? viewOf(v) : null;
          return (
            <li key={r.key}>
              <button className="rowbtn" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key}>
                <span className="grow" style={{ minWidth: 0 }}><span style={{ display: "block" }}>{r.w}</span><span className="small muted ellipsis" style={{ display: "block" }}>{r.d ?? ""}</span></span>
                {r.right && <span className="small muted num" style={{ whiteSpace: "nowrap" }}>{r.right}</span>}
              </button>
              {open === r.key && view && (
                <div className="card soft" style={{ margin: "0 16px 12px" }}>
                  <WordFace v={view} showWord={false} />
                  <div className="row">
                    <SpeakButton text={view.ex ? `${view.w}. ${view.ex}` : view.w} />
                    {!card && v && <button className="btn outline" onClick={() => { addCards([String(v.id)]); toast(`"${v.w}" added to your reviews`); }}>Add to my reviews</button>}
                    {v && (!known[String(v.id)] ? <button className="btn quiet" onClick={() => markKnown(String(v.id))}>I know it</button> : <button className="btn quiet" onClick={() => markKnown(String(v.id), false)}>Not known</button>)}
                  </div>
                  {card && !card.card.fresh && <p className="small muted" style={{ margin: "8px 0 0" }}>Reviewed {card.card.reps}× · forgotten {card.card.lapses}× · next review {new Date(card.card.dueAt).toLocaleDateString()}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {needle && <p className="small muted">{c.licence}</p>}
    </div>
  );
}

// ---------- Grammar ----------
function GrammarTab({ c }: { c: Content }) {
  const mastery = useApp((s) => s.grammar);
  const mistakes = useApp((s) => openMistakes(s).length);
  const learned = c.grammar.filter((t) => !!mastery[t.id]?.learnedAt).length;
  const core = c.grammar.filter((t) => t.track === "core");
  const lesson = c.grammar.filter((t) => t.track === "lesson");
  const personal = c.grammar.filter((t) => t.track !== "core" && t.track !== "lesson");
  const Row = ({ id, title, level }: { id: string; title: string; level: string }) => {
    const m = mastery[id];
    const score = m ? Math.round(((m.rec + m.ctl + m.prod + m.auto) / 4) * 100) : null;
    return (
      <li>
        <button className="rowbtn" onClick={() => navigate(`/learn/grammar/${id}`)}>
          <span className="grow">{title}</span>
          {score !== null && <span className="small muted num" title={`Practised ${m!.attempts}× · average of recognition, practice, production and automatic use`}>{score}%</span>}
          <span className="pill">{level}</span>
          <Icon name="chevron" size={20} />
        </button>
      </li>
    );
  };
  return (
    <div>
      {(mistakes > 0 || learned > 0) && (
        <ul className="list boxed">
          {mistakes > 0 && <li><button className="rowbtn" onClick={() => navigate("/learn/grammar/mistakes")}><Icon name="again" /><span className="grow"><span style={{ display: "block" }}>Practise my mistakes</span><span className="small muted">{mistakes} to fix · from your answers and imports</span></span><Icon name="chevron" size={20} /></button></li>}
          {learned > 0 && <li><button className="rowbtn" onClick={() => navigate("/learn/grammar/mix")}><Icon name="grammar" /><span className="grow"><span style={{ display: "block" }}>Mixed review</span><span className="small muted">Questions from the {learned} {learned === 1 ? "topic" : "topics"} you have learned</span></span><Icon name="chevron" size={20} /></button></li>}
        </ul>
      )}
            {personal.length > 0 && <><h2 className="section-title">Your corrections</h2><ul className="list">{personal.map((t) => <Row key={t.id} id={t.id} title={t.title} level={t.level} />)}</ul></>}
      <h2 className="section-title">Core patterns</h2>
      <ul className="list">{core.map((t) => <Row key={t.id} id={t.id} title={t.title} level={t.level} />)}</ul>
      <h2 className="section-title">More grammar</h2>
      <ul className="list">{lesson.map((t) => <Row key={t.id} id={t.id} title={t.title} level={t.level} />)}</ul>
    </div>
  );
}

function MistakeList() {
  const mistakes = useApp((s) => s.mistakes);
  return (
    <div className="section">
      <h2 className="section-title">Mistake notebook</h2>
      {mistakes.length === 0 && <p className="muted">No mistakes recorded yet.</p>}
      <ul className="list">
        {mistakes.slice(0, 100).map((m) => (
          <li key={m.id}>
            <p style={{ margin: 0 }}><b>{m.prompt}</b></p>
            <p className="small" style={{ margin: 0 }}><span className="diff"><span className="del">{m.given}</span></span> <Icon name="arrow" size={16} label="corrected to" /> <span style={{ color: "var(--success)", fontWeight: 600 }}>{m.expected}</span></p>
            <p className="small faint" style={{ margin: 0 }}>{new Date(m.at).toLocaleDateString()} · {m.kind}{m.fixed ? " · fixed" : ""}{m.source ? ` · ${m.source}` : ""}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
