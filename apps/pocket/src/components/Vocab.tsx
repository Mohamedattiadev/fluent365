// Vocabulary: FSRS review (recall first, then reveal, then rate) and new-word introduction.
import { useEffect, useMemo, useState } from "react";
import type { Content } from "../lib/content";
import { addCards, dueCardKeys, reviewWord } from "../lib/learning";
import { preview, Rating, type Grade } from "../lib/srs";
import { getState, useApp } from "../lib/store";
import { shuffle } from "../lib/text";
import type { MyCard, VocabItem } from "../lib/types";
import { OptionMark } from "./Exercise";
import { ActionBar, Icon, Progress, speak, stopSpeaking } from "./ui";
import { ping } from "../lib/activity";

export interface CardView { key: string; w: string; d?: string; ex?: string; pos?: string; tr?: string; ar?: string; lvl?: string; source?: string }

export function cardView(key: string, mine: MyCard | undefined, c: Content): CardView | null {
  if (mine?.custom) return { key, w: mine.custom.w, d: mine.custom.d, ex: mine.custom.ex, source: mine.custom.source };
  const v = c.vocabById.get(Number(key));
  return v ? viewOf(v) : null;
}
export const viewOf = (v: VocabItem): CardView => ({ key: String(v.id), w: v.w, d: v.d, ex: v.ex, pos: v.pos, tr: v.tr, ar: v.ar, lvl: v.lvl });

/** Hide the word inside its example so the learner has to recall it. */
const cloze = (ex: string, w: string) => ex.replace(new RegExp(`\\b${w.split(" ")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\w*`, "gi"), "_____");

/** The example sentence with the target word in bold. */
function Example({ ex, w }: { ex: string; w: string }) {
  const stem = w.split(" ")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = ex.split(new RegExp(`(\\b${stem}\\w*)`, "i"));
  return <p className="example">"{parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>))}"</p>;
}

export function AudioIcon({ text, label = "Listen" }: { text: string; label?: string }) {
  return <button className="icon-btn" onClick={() => { stopSpeaking(); speak(text); }} aria-label={`${label}: ${text}`}><Icon name="audio" /></button>;
}

export function WordFace({ v, showWord = true }: { v: CardView; showWord?: boolean }) {
  const lang = useApp((s) => s.settings.explainLang);
  const own = lang === "tr" ? v.tr : lang === "ar" ? v.ar : undefined;
  return (
    <>
      {showWord && <div className="word">{v.w}</div>}
      {(v.pos || v.lvl) && <p className="small faint" style={{ margin: 0 }}>{[v.pos, v.lvl && `≈ ${v.lvl}`].filter(Boolean).join(" · ")}</p>}
      <hr className="divider" />
      {v.d && <p className="meaning">{v.d}</p>}
      {own && <p dir={lang === "ar" ? "rtl" : undefined} className="muted">{own}</p>}
      {v.ex && <Example ex={v.ex} w={v.w} />}
      {v.source && <p className="small faint">From: {v.source}</p>}
    </>
  );
}

export function ReviewSession({ c, limit = 60, onDone }: { c: Content; limit?: number; onDone: () => void }) {
  const queue = useMemo(() => dueCardKeys().slice(0, limit), [limit]);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [again, setAgain] = useState<string[]>([]);
  const all = [...queue, ...again];
  const key = all[i];
  const mine = useApp((s) => (key ? s.cards[key] : undefined));
  const view = key ? cardView(key, mine, c) : null;
  const recallFromMeaning = (mine?.card.stability ?? 0) >= 3; // harder direction once the word is familiar

  useEffect(() => {
    setShown(false);
    if (mine) void preview(mine.card.fresh ? undefined : mine.card).then(setLabels);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  async function rate(g: Grade) {
    await reviewWord(key, g);
    if (g === Rating.Again && again.filter((k) => k === key).length < 1) setAgain([...again, key]);
    setI(i + 1);
  }

  // Keyboard: Space shows the answer, 1–4 grade it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!view || (e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (!shown && e.key === " ") { e.preventDefault(); setShown(true); ping("vocabulary"); }
      else if (shown && ["1", "2", "3", "4"].includes(e.key)) { e.preventDefault(); void rate(([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[])[Number(e.key) - 1]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!all.length || i >= all.length || !view)
    return (
      <div>
        <h2>{all.length ? "Reviews done" : "No reviews due"}</h2>
        <p className="muted">{all.length ? `You reviewed ${all.length} cards.` : "Nothing to review right now."}</p>
        <ActionBar><button className="btn big primary" onClick={onDone}>Continue <Icon name="arrow" /></button></ActionBar>
      </div>
    );

  return (
    <div>
      <div className="counter">
        <span>{i + 1} / {all.length}</span>
        <div className="grow"><Progress value={i / all.length} label={`Card ${i + 1} of ${all.length}`} /></div>
      </div>
      <div className="flash" key={`${key}-${shown}`} aria-live="polite">
        {!shown ? (
          recallFromMeaning && view.d ? (
            <>
              <p className="overline">What is the word?</p>
              <p className="prompt-text">{view.d}</p>
              {view.ex && <p className="example">"{cloze(view.ex, view.w)}"</p>}
            </>
          ) : (
            <>
              <div className="word">{view.w}</div>
              <AudioIcon text={view.w} />
              <p className="muted small" style={{ marginTop: 12 }}>Say what it means, in English or your language, before you look.</p>
            </>
          )
        ) : (
          <>
            <WordFace v={view} />
            <AudioIcon text={view.ex ? `${view.w}. ${view.ex}` : view.w} label="Listen to the example" />
          </>
        )}
      </div>
      <ActionBar>
        {!shown ? (
          <button className="btn big primary" onClick={() => { setShown(true); ping("vocabulary"); }} autoFocus>Show answer</button>
        ) : (
          <div>
            <p className="small muted center" style={{ margin: "0 0 8px" }}>How well did you remember?</p>
            <div className="grades">
              <button className="btn g-again" onClick={() => rate(Rating.Again as Grade)}>Again<small>{labels[Rating.Again]}</small></button>
              <button className="btn" onClick={() => rate(Rating.Hard as Grade)}>Hard<small>{labels[Rating.Hard]}</small></button>
              <button className="btn primary" onClick={() => rate(Rating.Good as Grade)} autoFocus>Good<small>{labels[Rating.Good]}</small></button>
              <button className="btn g-easy" onClick={() => rate(Rating.Easy as Grade)}>Easy<small>{labels[Rating.Easy]}</small></button>
            </div>
          </div>
        )}
      </ActionBar>
    </div>
  );
}

/** Introduce new words: see it → hear it → quick meaning check (recall) → card added. */
export function NewWords({ c, ids, onDone }: { c: Content; ids: number[]; onDone: () => void }) {
  const items = useMemo(() => ids.map((id) => c.vocabById.get(id)).filter((v): v is VocabItem => !!v), [ids, c]);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"see" | "check">("see");
  const [pick, setPick] = useState<number | null>(null);
  const v = items[i];
  const options = useMemo(() => {
    if (!v) return [];
    const others = shuffle(c.vocab.filter((x) => x.d && x.id !== v.id && Math.abs(x.r - v.r) < 800)).slice(0, 2);
    return shuffle([v, ...others]);
  }, [v, c]);

  if (!v) {
    return (
      <div className="center">
        <h2>{items.length} new words added</h2>
        <p className="muted">They will come back in your reviews — first in a few minutes, then after longer and longer gaps.</p>
        <ActionBar><button className="btn big primary" onClick={onDone}>Continue <Icon name="arrow" /></button></ActionBar>
      </div>
    );
  }

  const next = () => {
    addCards([String(v.id)]);
    setPick(null);
    setPhase("see");
    setI(i + 1);
  };
  const known = () => {
    // Already known: don't make a card; mark known so it is never offered again.
    const s = getState();
    if (!s.known[String(v.id)]) import("../lib/learning").then((m) => m.markKnown(String(v.id)));
    setPick(null);
    setPhase("see");
    setI(i + 1);
  };

  return (
    <div>
      <div className="counter">
        <span>New word {i + 1} of {items.length}</span>
        <div className="grow"><Progress value={i / items.length} label={`New word ${i + 1} of ${items.length}`} /></div>
      </div>
      {phase === "see" ? (
        <>
          <div className="flash" key={v.id}>
            <WordFace v={viewOf(v)} />
            <AudioIcon text={v.ex ? `${v.w}. ${v.ex}` : v.w} />
          </div>
          <p className="muted small center" style={{ marginTop: 12 }}>Say the word and the example out loud once.</p>
          <ActionBar>
            <div className="grid2">
              <button className="btn big outline" onClick={known}>I already know it</button>
              <button className="btn big primary" onClick={() => { ping("vocabulary"); setPhase("check"); }}>Next <Icon name="arrow" /></button>
            </div>
          </ActionBar>
        </>
      ) : (
        <>
          <p className="overline">Which meaning is right?</p>
          <h2 style={{ fontSize: "var(--fs-2xl)" }}>{v.w}</h2>
          <div className="options" role="radiogroup">
            {options.map((o, k) => {
              const state = pick === null ? "" : o.id === v.id ? "right" : pick === k ? "wrong" : "";
              return (
                <button key={o.id} role="radio" aria-checked={pick === k} className={`btn option ${state}`} disabled={pick !== null} onClick={() => { setPick(k); ping("vocabulary"); }}>
                  <span className="opt-text">{o.d}</span><OptionMark state={state} />
                </button>
              );
            })}
          </div>
          {pick !== null && <ActionBar><button className="btn big primary" onClick={next} autoFocus>Next <Icon name="arrow" /></button></ActionBar>}
        </>
      )}
    </div>
  );
}
