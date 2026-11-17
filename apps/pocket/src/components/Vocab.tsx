// Vocabulary: FSRS review (recall first, then reveal, then rate) and new-word introduction.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Content } from "../lib/content";
import { addCards, dueCardKeys, reviewWord } from "../lib/learning";
import { pickNewWords } from "../lib/session";
import { preview, Rating, type Grade } from "../lib/srs";
import { getState, useApp } from "../lib/store";
import { shuffle } from "../lib/text";
import type { MyCard, VocabItem } from "../lib/types";
import { OptionMark } from "./Exercise";
import { ActionBar, buzz, Icon, Progress, speak, stopSpeaking, toast } from "./ui";
import { ping } from "../lib/activity";

export interface CardView { key: string; w: string; d?: string; ex?: string; pos?: string; tr?: string; ar?: string; trSrc?: string; exTr?: string; exAr?: string; lvl?: string; source?: string }

export function cardView(key: string, mine: MyCard | undefined, c: Content): CardView | null {
  if (mine?.custom) return { key, w: mine.custom.w, d: mine.custom.d, ex: mine.custom.ex, source: mine.custom.source };
  const v = c.vocabById.get(Number(key));
  return v ? viewOf(v) : null;
}
export const viewOf = (v: VocabItem): CardView => ({ key: String(v.id), w: v.w, d: v.d, ex: v.ex, pos: v.pos, tr: v.tr, ar: v.ar, trSrc: v.trSrc, exTr: v.exTr, exAr: v.exAr, lvl: v.lvl });

/** Turkish and Arabic lines (both, when known). */
export function Xlate({ tr, ar, note }: { tr?: string; ar?: string; note?: string }) {
  if (!tr && !ar) return null;
  return (
    <div className="xlate">
      {tr && <p lang="tr"><span className="xl-tag">TR</span>{tr}</p>}
      {ar && <p lang="ar"><span className="xl-tag">AR</span><span dir="rtl">{ar}</span></p>}
      {note && <p className="xl-note">{note}</p>}
    </div>
  );
}

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
  return (
    <>
      {showWord && <div className="word">{v.w}</div>}
      {(v.pos || v.lvl) && <p className="small faint" style={{ margin: 0 }}>{[v.pos, v.lvl && `≈ ${v.lvl}`].filter(Boolean).join(" · ")}</p>}
      <hr className="divider" />
      {v.d && <p className="meaning">{v.d}</p>}
      {/* Turkish and Arabic, always both (owner's request): if one is unclear, the other helps. */}
      <Xlate tr={v.tr} ar={v.ar} note={v.trSrc === "wiktionary" ? "Wiktionary · may be another meaning of the word" : undefined} />
      {v.ex && <Example ex={v.ex} w={v.w} />}
      <Xlate tr={v.exTr} ar={v.exAr} note={v.exTr || v.exAr ? "Sentence: AI translation" : undefined} />
      {v.source && <p className="small faint">From: {v.source}</p>}
    </>
  );
}

/** Anki-style card (owner's choice, 2026-11-17): double-tap flips the card, double-tap again flips it back.
 *  Swipe right = Good, left = Again, at any time: you do not have to look at the answer first.
 *  The card follows the finger; a short swipe springs back. Buttons keep working the same. */
export function SwipeCard({ shown, onFlip, onLeft, onRight, children, labels = ["Again", "Good"] }: { shown: boolean; onFlip: () => void; onLeft: () => void; onRight: () => void; children: React.ReactNode; labels?: [string, string] }) {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(0);
  const start = useRef<{ x: number; y: number; id: number; horizontal: boolean | null } | null>(null);
  const lastTap = useRef(0);
  const width = () => Math.min(window.innerWidth, 720);
  const done = (dir: -1 | 1) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce";
    const act = () => { setDx(0); setLeaving(0); if (dir > 0) onRight(); else onLeft(); };
    buzz(dir > 0 ? 12 : [20, 40, 20]);
    if (reduce) return act();
    setLeaving(dir);
    setTimeout(act, 160);
  };
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: null };
  };
  const onMove = (e: React.PointerEvent) => {
    const st = start.current;
    if (!st || st.id !== e.pointerId) return;
    const mx = e.clientX - st.x, my = e.clientY - st.y;
    if (st.horizontal === null && Math.hypot(mx, my) > 8) {
      st.horizontal = Math.abs(mx) > Math.abs(my);
      if (st.horizontal) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (st.horizontal) setDx(mx);
  };
  const onUp = (e: React.PointerEvent) => {
    const st = start.current;
    start.current = null;
    if (!st) return;
    const mx = e.clientX - st.x, my = e.clientY - st.y;
    if (st.horizontal && Math.abs(mx) > Math.max(80, width() * 0.22)) done(mx > 0 ? 1 : -1);
    else {
      setDx(0);
      if (!st.horizontal && Math.hypot(mx, my) < 8) {
        const now = Date.now();
        if (now - lastTap.current < 400) { lastTap.current = 0; onFlip(); } else lastTap.current = now;
      }
    }
  };
  const x = leaving ? leaving * width() * 1.2 : dx;
  const strength = Math.min(1, Math.abs(dx) / 90);
  const label = dx > 0 ? labels[1] : labels[0];
  return (
    <div className="swipe-wrap">
      <div
        className={`swipe ${dx || leaving ? "moving" : ""} ${leaving ? "leaving" : ""}`}
        style={{ transform: x ? `translateX(${x}px) rotate(${x / 40}deg)` : undefined }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { start.current = null; setDx(0); }}
      >
        {Math.abs(dx) > 12 && <span className={`swipe-label ${dx > 0 ? "right" : "left"}`} style={{ opacity: strength }} aria-hidden>{label}</span>}
        {children}
      </div>
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

  async function rate(g: Grade) {
    await reviewWord(key, g);
    if (g === Rating.Again && again.filter((k) => k === key).length < 1) setAgain([...again, key]);
    setI(i + 1);
  }

  // Keyboard: Space shows the answer, 1–4 grade it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!view || (e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === " ") { e.preventDefault(); setShown((x) => !x); ping("vocabulary"); }
      else if (["1", "2", "3", "4"].includes(e.key)) { e.preventDefault(); void rate(([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[])[Number(e.key) - 1]); }
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
      <SwipeCard key={key} shown={shown} onFlip={() => { setShown((x) => !x); ping("vocabulary"); }} onLeft={() => void rate(Rating.Again as Grade)} onRight={() => void rate(Rating.Good as Grade)}>
      <div className={`flash ${shown ? "back" : ""}`} key={`${key}-${shown}`} aria-live="polite">
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
      </SwipeCard>
      <p className="swipe-hint">Double-tap to flip · swipe right: Good · left: Again</p>
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
  const [list, setList] = useState(ids);
  const [added, setAdded] = useState(0);
  const items = useMemo(() => list.map((id) => c.vocabById.get(id)).filter((v): v is VocabItem => !!v), [list, c]);
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
        <h2>{added} new {added === 1 ? "word" : "words"} added</h2>
        <p className="muted">They will come back in your reviews — first in a few minutes, then after longer and longer gaps.</p>
        <ActionBar>
          <button className="btn big primary" onClick={onDone}>Continue <Icon name="arrow" /></button>
          <MoreWords c={c} onPick={(more) => { setList(more); setI(0); }} />
        </ActionBar>
      </div>
    );
  }

  const next = () => {
    addCards([String(v.id)]);
    setAdded(added + 1);
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

/** New words as flip cards (Anki-style): tap to see the meaning, swipe right = got it, left = see it again at the end. */
export function IntroCards({ items, onDone, title }: { items: CardView[]; onDone: () => void; title?: string }) {
  const [queue, setQueue] = useState(() => items.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [shown, setShown] = useState(false);
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const idx = queue[pos];
  const v = idx != null ? items[idx] : undefined;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement)?.tagName;
      if (!v || t === "INPUT" || t === "TEXTAREA") return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
      else if (e.key === "1" || e.key === "ArrowLeft") { e.preventDefault(); again(); }
      else if (e.key === "3" || e.key === "ArrowRight") { e.preventDefault(); gotIt(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const finished = !v;
  useEffect(() => { if (finished) onDone(); }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!v) return null;
  function flip() { setShown((x) => !x); ping("vocabulary"); }
  function gotIt() { setSeen(new Set(seen).add(idx)); setShown(false); setPos(pos + 1); ping("vocabulary"); }
  function again() { setQueue([...queue, idx]); setShown(false); setPos(pos + 1); ping("vocabulary"); }
  return (
    <div>
      {title && <h2>{title}</h2>}
      <div className="counter">
        <span>{Math.min(seen.size + 1, items.length)} / {items.length}</span>
        <div className="grow"><Progress value={seen.size / items.length} label={`New word ${seen.size + 1} of ${items.length}`} /></div>
      </div>
      <SwipeCard key={`${idx}-${pos}`} shown={shown} onFlip={flip} onLeft={again} onRight={gotIt} labels={["Again", "Got it"]}>
        <div className={`flash ${shown ? "back" : ""}`} key={`${idx}-${shown}`} aria-live="polite">
          {!shown ? (
            <>
              <p className="overline">New word</p>
              <div className="word">{v.w}</div>
              {v.pos && <p className="small muted" style={{ margin: 0 }}>{v.pos}</p>}
              <AudioIcon text={v.w} />
              <p className="muted small" style={{ marginTop: 8 }}>Guess the meaning, then tap the card.</p>
            </>
          ) : (
            <>
              <WordFace v={v} />
              <AudioIcon text={v.ex ? `${v.w}. ${v.ex}` : v.w} label="Listen to the example" />
            </>
          )}
        </div>
      </SwipeCard>
      <p className="swipe-hint">Double-tap to flip · swipe right: Got it · left: Again</p>
      <ActionBar>
        {!shown ? (
          <button className="btn big primary" onClick={flip}>Show meaning</button>
        ) : (
          <div className="grades" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <button className="btn" onClick={again}>Again<small>see it again</small></button>
            <button className="btn primary" onClick={gotIt}>Got it<small>next word</small></button>
          </div>
        )}
      </ActionBar>
    </div>
  );
}

/** Optional extra: 10 more frequency words at your level (the plan's daily amount is already done). */
export function MoreWords({ c, onPick }: { c: Content; onPick: (ids: number[]) => void }) {
  return (
    <button className="btn quiet" style={{ width: "100%" }} onClick={() => {
      const ids = pickNewWords(getState(), c, 10);
      if (ids.length) onPick(ids); else toast("No new words left at your level");
    }}>Learn 10 more <span className="muted small">· optional, from the frequency list</span></button>
  );
}
