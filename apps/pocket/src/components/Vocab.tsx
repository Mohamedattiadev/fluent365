// Vocabulary: FSRS review (recall first, then reveal, then rate) and new-word introduction.
import { useEffect, useMemo, useState } from "react";
import type { Content } from "../lib/content";
import { addCards, dueCardKeys, reviewWord } from "../lib/learning";
import { preview, Rating, type Grade } from "../lib/srs";
import { getState, useApp } from "../lib/store";
import { shuffle } from "../lib/text";
import type { MyCard, VocabItem } from "../lib/types";
import { ActionBar, Icon, Progress, SpeakButton } from "./ui";
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

export function WordFace({ v, showWord = true }: { v: CardView; showWord?: boolean }) {
  const lang = useApp((s) => s.settings.explainLang);
  const own = lang === "tr" ? v.tr : lang === "ar" ? v.ar : undefined;
  return (
    <div>
      {showWord && <div className="word">{v.w}</div>}
      {v.pos && <p className="pill">{v.pos}</p>} {v.lvl && <span className="pill" title="Estimated level from word frequency">≈ {v.lvl}</span>}
      {v.d && <p style={{ fontSize: "1.1rem", marginTop: 10 }}>{v.d}</p>}
      {own && <p dir={lang === "ar" ? "rtl" : undefined} className="muted">{own}</p>}
      {v.ex && <p className="muted"><i>"{v.ex}"</i></p>}
      {v.source && <p className="small muted">From: {v.source}</p>}
    </div>
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

  if (!all.length || i >= all.length || !view)
    return (
      <div className="center">
        <h2>{all.length ? "Reviews done" : "No reviews due"}</h2>
        <p className="muted">{all.length ? `You reviewed ${all.length} cards.` : "Nothing to review right now."}</p>
        <ActionBar><button className="btn big primary" onClick={onDone}>Continue <Icon name="arrow" /></button></ActionBar>
      </div>
    );

  async function rate(g: Grade) {
    await reviewWord(key, g);
    if (g === Rating.Again && again.filter((k) => k === key).length < 1) setAgain([...again, key]);
    setI(i + 1);
  }

  return (
    <div>
      <div className="row small muted" style={{ marginBottom: 8 }}>
        <span>{i + 1} / {all.length}</span>
        <div className="grow"><Progress value={i / all.length} /></div>
      </div>
      <div className="card flash" aria-live="polite">
        {!shown ? (
          recallFromMeaning && view.d ? (
            <>
              <p className="muted small">What is the word?</p>
              <p style={{ fontSize: "1.25rem", fontWeight: 700 }}>{view.d}</p>
              {view.ex && <p className="muted"><i>"{cloze(view.ex, view.w)}"</i></p>}
            </>
          ) : (
            <>
              <div className="word">{view.w}</div>
              <SpeakButton text={view.w} />
              <p className="muted small" style={{ marginTop: 12 }}>Say what it means — in English or your language — before you look.</p>
            </>
          )
        ) : (
          <>
            <WordFace v={view} />
            <SpeakButton text={view.ex ? `${view.w}. ${view.ex}` : view.w} />
          </>
        )}
      </div>
      <ActionBar>
        {!shown ? (
          <button className="btn big primary" onClick={() => { setShown(true); ping("vocabulary"); }} autoFocus>Show answer</button>
        ) : (
          <div>
            <p className="small muted center" style={{ margin: "0 0 6px" }}>How well did you remember?</p>
            <div className="grades">
              <button className="btn g-again" onClick={() => rate(Rating.Again as Grade)}>Again<small>{labels[Rating.Again]}</small></button>
              <button className="btn g-hard" onClick={() => rate(Rating.Hard as Grade)}>Hard<small>{labels[Rating.Hard]}</small></button>
              <button className="btn g-good" onClick={() => rate(Rating.Good as Grade)} autoFocus>Good<small>{labels[Rating.Good]}</small></button>
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
      <div className="row small muted" style={{ marginBottom: 8 }}>
        <span>New word {i + 1} of {items.length}</span>
        <div className="grow"><Progress value={i / items.length} /></div>
      </div>
      {phase === "see" ? (
        <>
          <div className="card flash">
            <WordFace v={viewOf(v)} />
            <SpeakButton text={v.ex ? `${v.w}. ${v.ex}` : v.w} />
          </div>
          <p className="muted small center">Say the word and the example out loud once.</p>
          <ActionBar>
            <div className="grid2">
              <button className="btn big outline" onClick={known}>I already know it</button>
              <button className="btn big primary" onClick={() => { ping("vocabulary"); setPhase("check"); }}>Next <Icon name="arrow" /></button>
            </div>
          </ActionBar>
        </>
      ) : (
        <>
          <h2 className="center" style={{ fontSize: "1.8rem" }}>{v.w}</h2>
          <p className="muted center">Which meaning is right?</p>
          <div className="options">
            {options.map((o, k) => (
              <button key={o.id} className={`btn option ${pick === null ? "" : o.id === v.id ? "right" : pick === k ? "wrong" : ""}`} disabled={pick !== null} onClick={() => { setPick(k); ping("vocabulary"); }}>
                {o.d}
              </button>
            ))}
          </div>
          {pick !== null && <ActionBar><button className="btn big primary" onClick={next} autoFocus>Next <Icon name="arrow" /></button></ActionBar>}
        </>
      )}
    </div>
  );
}
