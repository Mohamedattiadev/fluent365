// Skill activities: reading/listening blocks, writing, speaking, fluency 4·3·2, dictation, recall, mistakes.
import { useEffect, useMemo, useRef, useState } from "react";
import { ping } from "../lib/activity";
import * as db from "../lib/db";
import { logComprehension, recordAttempt } from "../lib/learning";
import { getState, uid, update, useApp } from "../lib/store";
import { diffWords, matches, shuffle, wordCount } from "../lib/text";
import type { AudioBlock, Block, CueCard, Exercise as Ex, Lang, TtsRecording, VocabItem } from "../lib/types";
import { clearPersisted, ExerciseRunner, usePersisted } from "./Grammar";
import { ActionBar, Bold, Icon, mmss, skillStyle, Progress, Segmented, speak, SpeakButton, stopSpeaking, toast, useTimer, voices } from "./ui";
import { playableUrl, siteUrl } from "../lib/audio";
import { pause as globalPause } from "../lib/player";
import type { Content } from "../lib/content";

// ---------- Blocks ----------
export function blockToExercise(b: Block, lang: Lang): Ex | null {
  const why = "why" in b ? b.why[lang] || b.why.en : "";
  const example = "example" in b ? b.example : undefined;
  if (b.type === "choice") return { type: "choose", prompt: b.prompt, options: b.options, answer: b.answer, why, example };
  if (b.type === "gap") return { type: "gap", prompt: b.prompt, answers: b.answers, why, example };
  if (b.type === "tfng") return { type: "tfng", prompt: b.statement, answer: b.answer, why, example };
  return null;
}

export function Passage({ blocks }: { blocks: Block[] }) {
  return (
    <div className="passage">
      {blocks.map((b, i) =>
        b.type === "heading" ? <h3 key={i}>{b.text}</h3> : b.type === "text" ? <p key={i}>{b.text}</p> : b.type === "vocab" ? (
          <ul key={i} className="card soft">{b.items.map((it) => <li key={it.en}><b>{it.en}</b> — {it.example}</li>)}</ul>
        ) : null,
      )}
    </div>
  );
}

/** Plays a listening script with the device's English voices (one voice per speaker). */
export function AudioPlayer({ audio, once = false, onPlayed }: { audio: AudioBlock; once?: boolean; onPlayed?: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [plays, setPlays] = useState(0);
  const [rate, setRate] = useState(0.95);
  const speakerIndex = useMemo(() => Object.fromEntries(Object.keys(audio.speakers).map((k, i) => [k, i])), [audio]);
  useEffect(() => () => stopSpeaking(), []);
  function play() {
    stopSpeaking();
    setPlaying(true);
    ping("listening");
    let i = 0;
    const nextLine = () => {
      if (i >= audio.lines.length) {
        setPlaying(false);
        setPlays((p) => p + 1);
        onPlayed?.();
        return;
      }
      const line = audio.lines[i++];
      ping("listening");
      speak(line.text, { voiceIndex: speakerIndex[line.speaker] ?? 0, rate, onEnd: () => setTimeout(nextLine, line.pauseAfterMs ?? 350) });
    };
    nextLine();
  }
  const blocked = once && plays > 0;
  return (
    <div className="player">
      {playing ? (
        <button className="play-btn" onClick={() => { stopSpeaking(); setPlaying(false); }} aria-label="Stop the recording"><Icon name="stop" size={32} /></button>
      ) : (
        <button className="play-btn" onClick={play} disabled={blocked} aria-label={plays ? "Play the recording again" : "Play the recording"}><Icon name="play" size={32} /></button>
      )}
      <div className="grow">
        <p style={{ margin: 0, fontWeight: 600 }}>{playing ? "Playing…" : blocked ? "Played once" : plays ? "Play again" : "Play the recording"}</p>
        <p className="small muted" style={{ margin: 0 }}>{once ? "Exam mode: you can play it once. Read the questions first." : "The recording uses your device's voices."}</p>
      </div>
      {!once && <Segmented label="Speed" value={rate} onChange={setRate} options={[[0.8, "0.8×"], [0.95, "1×"], [1.15, "1.15×"]]} />}
    </div>
  );
}

/** Plays the generated MP3 of a listening text (works offline once downloaded). Exam mode plays once. */
export function RecordingPlayer({ recording, audio, once = false, onPlayed }: { recording: TtsRecording; audio: AudioBlock; once?: boolean; onPlayed?: () => void }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [plays, setPlays] = useState(0);
  const [t, setT] = useState(0);
  const [rate, setRate] = useState(1);
  useEffect(() => {
    let url: string | null = null;
    void playableUrl(siteUrl(recording.file)).then((u) => { url = u; setSrc(u); });
    return () => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [recording.file]);
  useEffect(() => { if (ref.current) ref.current.playbackRate = rate; }, [rate, src]);
  const blocked = once && plays > 0;
  const line = recording.starts.reduce((n, s, i) => (t >= s ? i : n), 0);
  function toggle() {
    const a = ref.current;
    if (!a) return;
    if (playing) { a.pause(); return; }
    globalPause();
    void a.play().catch(() => setPlaying(false));
  }
  return (
    <div>
      <div className="player">
        <button className="play-btn" onClick={toggle} disabled={blocked || !src} aria-label={playing ? "Pause the recording" : plays ? "Play the recording again" : "Play the recording"}><Icon name={playing ? (once ? "stop" : "pause") : "play"} size={32} /></button>
        <div className="grow">
          <p style={{ margin: 0, fontWeight: 600 }}>{playing ? `Playing · ${mmss(t)} / ${mmss(recording.seconds)}` : blocked ? "Played once" : plays ? "Play again" : `Play the recording · ${mmss(recording.seconds)}`}</p>
          <p className="small muted" style={{ margin: 0 }}>{once ? "Exam mode: you can play it once. Read the questions first." : `${audio.lines.length} lines · recorded voices`}</p>
          <Progress value={t / recording.seconds} label="Position in the recording" />
        </div>
        {!once && <Segmented label="Speed" value={rate} onChange={setRate} options={[[0.8, "0.8×"], [1, "1×"], [1.15, "1.15×"]]} />}
      </div>
      {src && <audio ref={ref} src={src} preload="auto" onPlay={() => { setPlaying(true); ping("listening"); }} onPause={() => setPlaying(false)} onTimeUpdate={(e) => { setT(e.currentTarget.currentTime); if (Math.floor(e.currentTarget.currentTime) % 15 === 0) ping("listening"); }} onEnded={() => { setPlaying(false); setPlays((p) => p + 1); onPlayed?.(); }} />}
      {!once && playing && <p className="small muted now-line" aria-live="polite"><b>{audio.speakers[audio.lines[line]?.speaker]?.name}:</b> {audio.lines[line]?.text}</p>}
    </div>
  );
}

export function Transcript({ audio, open, current }: { audio: AudioBlock; open?: boolean; current?: number }) {
  return (
    <details className="card soft transcript" open={open}>
      <summary>Show transcript</summary>
      {audio.lines.map((l, i) => <p key={i} className={current === i ? "now" : undefined}><b>{audio.speakers[l.speaker]?.name ?? l.speaker}:</b> {l.text}</p>)}
    </details>
  );
}

/** Read or listen, then answer questions; transcript afterwards. Used by lessons and courses. */
export function InputTask({ title, intro, tip, passage, audio, recording, questions, once, onDone, kind, persistKey }: { title: string; intro?: string; tip?: string; passage?: Block[]; audio?: AudioBlock; recording?: TtsRecording; questions: Block[]; once?: boolean; kind: "reading" | "listening"; onDone: (acc: number) => void; persistKey?: string }) {
  const lang = useApp((s) => s.settings.explainLang);
  // Where you are inside the step survives a reload (stage, whether you played it, the score so far).
  const k = (x: string) => (persistKey ? `input:${persistKey}:${x}` : undefined);
  const [stage, setStage] = usePersisted<"input" | "questions" | "after">(k("stage"), "input");
  const [acc, setAcc] = usePersisted(k("acc"), 0);
  const canSpeak = !!recording || (typeof speechSynthesis !== "undefined" && voices().length > 0);
  const [played, setPlayed] = usePersisted(k("played"), !audio || !canSpeak);
  const finish = (a: number) => { clearPersisted(k("stage"), k("acc"), k("played"), k("q")); onDone(a); };
  const items = questions.map((b) => blockToExercise(b, lang)).filter((x): x is Ex => !!x).map((ex) => ({ ex }));
  return (
    <div>
      <h2>{title}</h2>
      {intro && <p className="muted">{intro}</p>}
      {tip && stage === "input" && <div className="feedback info"><strong className="title"><Icon name="hint" size={22} /> Tip</strong><p>{tip}</p></div>}
      {audio && stage !== "after" && canSpeak && (recording ? <RecordingPlayer recording={recording} audio={audio} once={once} onPlayed={() => setPlayed(true)} /> : <AudioPlayer audio={audio} once={once} onPlayed={() => setPlayed(true)} />)}
      {audio && !canSpeak && stage === "input" && (
        <>
          <p className="small muted">This device has no English voice for this recording, so read the transcript instead, then answer.</p>
          <Transcript audio={audio} open />
        </>
      )}
      {passage && stage !== "after" && <Passage blocks={passage} />}
      {stage === "input" && (
        <ActionBar><button className="btn big primary" disabled={!played} onClick={() => setStage("questions")}>{audio ? (played ? "Answer the questions" : "Play the recording first") : "Answer the questions"} <Icon name="arrow" /></button></ActionBar>
      )}
      {stage === "questions" && audio && !canSpeak && <Transcript audio={audio} />}
      {stage === "questions" && items.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <ExerciseRunner items={items} persistKey={k("q")} onFinish={(a) => { setAcc(a); logComprehension(kind, a, items.length); setStage("after"); }} />
        </div>
      )}
      {stage === "questions" && items.length === 0 && <ActionBar><button className="btn big primary" onClick={() => finish(1)}>Continue</button></ActionBar>}
      {stage === "after" && (
        <div>
          <div className="stats"><div><p className="big-number">{Math.round(acc * 100)}%</p><p className="label">correct on the first try</p></div></div>
          {audio && <Transcript audio={audio} />}
          {passage && <details className="card soft"><summary>Read the text again</summary><Passage blocks={passage} /></details>}
          <ActionBar><button className="btn big primary" onClick={() => finish(acc)}>Continue <Icon name="arrow" /></button></ActionBar>
        </div>
      )}
      <span className="sr-only">{kind}</span>
    </div>
  );
}

// ---------- Writing ----------
const LINKERS = ["however", "moreover", "furthermore", "in addition", "therefore", "as a result", "on the other hand", "in contrast", "whereas", "although", "even though", "despite", "for example", "for instance", "such as", "firstly", "secondly", "finally", "in conclusion", "overall", "nevertheless", "because", "since", "due to", "i am writing", "yours sincerely", "yours faithfully", "best wishes"];

export function analyse(text: string) {
  const words = wordCount(text);
  const paragraphs = text.split(/\n\s*\n|\n(?=\s*\S)/).filter((p) => wordCount(p) > 3).length;
  const sentences = text.split(/(?<=[.!?])\s+/).filter((p) => /\p{L}/u.test(p)).length;
  const lower = ` ${text.toLowerCase().replace(/[^\p{L}' ]+/gu, " ")} `;
  const linkers = LINKERS.filter((l) => lower.includes(` ${l} `));
  const contractions = [...new Set(text.match(/\b\w+['’](t|s|re|ve|ll|d|m)\b/gi) ?? [])];
  return { words, paragraphs, sentences, linkers, contractions };
}

const WRITING_CHECK = [
  "I answered every part of the task",
  "Each paragraph has one main idea",
  "I used linking words naturally",
  "I used some of today's words or collocations",
  "I checked tenses, articles and plurals",
  "The tone fits the reader (formal / informal)",
];

export function WritingTask({ title, prompt, data, minutes, minWords, tip, model, promptId, onDone }: { title: string; prompt: string; data?: string; minutes: number; minWords: number; tip?: string; model?: string; promptId: string; onDone: () => void }) {
  const draftKey = `draft:${promptId}`;
  const [text, setText] = useState("");
  const [stage, setStage] = useState<"write" | "review" | "rewrite">("write");
  const [checks, setChecks] = useState<string[]>([]);
  const [rewrite, setRewrite] = useState("");
  const [seconds] = useTimer(stage === "write");
  const [showTimer, setShowTimer] = useState(true);
  const lastPing = useRef(0);
  useEffect(() => { void db.get<string>("kv", draftKey).then((d) => d && setText(d)); }, [draftKey]);
  const onType = (v: string) => {
    setText(v);
    if (Date.now() - lastPing.current > 10000) { ping("writing"); lastPing.current = Date.now(); void db.set("kv", draftKey, v); }
  };
  const a = analyse(text);
  const left = minutes * 60 - seconds;
  function save() {
    const id = uid();
    update((s) => ({ writing: [{ id, at: new Date().toISOString(), promptId, prompt, text, words: a.words, seconds, selfCheck: checks }, ...s.writing] }));
    if (rewrite.trim()) update((s) => ({ writing: [{ id: uid(), at: new Date().toISOString(), promptId, prompt, text: rewrite, words: wordCount(rewrite), seconds: 0, selfCheck: [], rewriteOf: id }, ...s.writing] }));
    void db.del("kv", draftKey);
    toast("Writing saved in Progress → Writing");
    onDone();
  }
  if (stage === "write")
    return (
      <div>
        <h2>{title}</h2>
        <div className="prompt-box" style={skillStyle("writing")}><p>{prompt}</p>{data && <pre style={{ whiteSpace: "pre-wrap" }}>{data}</pre>}</div>
        {tip && <details><summary>How to plan it</summary><p>{tip}</p></details>}
        <textarea className="writing-area" value={text} onChange={(e) => onType(e.target.value)} placeholder="Write here. Your draft is saved on this device." aria-label="Your writing" />
        <div className="writing-foot">
          <span>{a.words} words <span className="faint">(aim for {minWords}+)</span></span>
          <span aria-hidden>·</span>
          {showTimer ? <span className={left < 120 ? "late" : ""} aria-label="Time left">{left >= 0 ? `${mmss(left)} left` : `${mmss(left)} over time`}</span> : <span>Timer hidden</span>}
          <button className="btn quiet" style={{ minHeight: 44, padding: "4px 8px" }} onClick={() => setShowTimer(!showTimer)}>{showTimer ? "Hide timer" : "Show timer"}</button>
        </div>
        <ActionBar><button className="btn big primary" disabled={a.words < Math.min(20, minWords)} onClick={() => { ping("writing"); setStage("review"); }}>I've finished <Icon name="arrow" /></button></ActionBar>
      </div>
    );
  if (stage === "review")
    return (
      <div>
        <h2>Check your writing</h2>
        <div className="stats">
          <div><p className="big-number">{a.words}</p><p className="label">words {a.words < minWords ? `(aim for ${minWords}+)` : "(enough)"}</p></div>
          <div><p className="big-number">{a.paragraphs}</p><p className="label">paragraphs</p></div>
        </div>
        <div>
          <p><b>Linking words you used:</b> {a.linkers.length ? a.linkers.join(", ") : "none yet — add some (however, for example, as a result)"}</p>
          {a.contractions.length > 0 && <p><b>Contractions:</b> {a.contractions.join(", ")} — fine in an informal letter, avoid them in an essay or formal letter.</p>}
          <p className="small muted">These are counts, not a band score. Fluent365 does not give official IELTS scores.</p>
        </div>
        {model && <details className="card soft" open><summary>Model answer: compare it with yours</summary><p style={{ whiteSpace: "pre-wrap" }}>{model}</p></details>}
        <div>
          <h3>Self-check</h3>
          {WRITING_CHECK.map((c) => (
            <label key={c} className="check">
              <input type="checkbox" checked={checks.includes(c)} onChange={(e) => { ping("writing"); setChecks(e.target.checked ? [...checks, c] : checks.filter((x) => x !== c)); }} /> {c}
            </label>
          ))}
        </div>
        <ActionBar><button className="btn big primary" onClick={() => setStage("rewrite")}>Next: improve one part <Icon name="arrow" /></button></ActionBar>
      </div>
    );
  return (
    <div>
      <h2>Improve one part</h2>
      <p className="muted">Pick your weakest sentence or paragraph and write it again, better. Rewriting after feedback is where writing improves most.</p>
      <div className="card soft small" style={{ whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>{text}</div>
      <textarea value={rewrite} onChange={(e) => { setRewrite(e.target.value); ping("writing"); }} placeholder="Your improved version" aria-label="Improved version" />
      <ActionBar><button className="btn big primary" onClick={save}>Save and continue <Icon name="check" /></button></ActionBar>
    </div>
  );
}

// ---------- Recording ----------
export function useRecorder() {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: r.mimeType || "audio/webm" });
        blobRef.current = blob;
        setUrl(URL.createObjectURL(blob));
      };
      r.start();
      setRec(r);
      ping("speaking");
    } catch {
      setError("Recording isn't available (no microphone or permission). You can still practise out loud.");
    }
  }
  function stop() {
    rec?.stop();
    setRec(null);
  }
  async function save(prompt: string, seconds: number, selfCheck: string[] = []) {
    let audioKey: string | undefined;
    if (blobRef.current) {
      audioKey = `rec:${uid()}`;
      await db.set("blobs", audioKey, blobRef.current);
    }
    update((s) => ({ speaking: [{ id: uid(), at: new Date().toISOString(), prompt, seconds, audioKey, selfCheck }, ...s.speaking] }));
  }
  return { recording: !!rec, url, error, start, stop, save, supported: typeof MediaRecorder !== "undefined" };
}

const SPEAK_CHECK = ["I kept talking without long stops", "I used linking words (first, then, because, so)", "I used some new words", "I used more than one tense correctly", "I gave examples and reasons"];

export function SpeakingTask({ part1 = [], card, useful = [], onDone }: { part1?: string[]; card?: { title: string; points: string[]; explain: string }; useful?: string[]; onDone: () => void }) {
  const [stage, setStage] = useState<"part1" | "prep" | "talk" | "check">(part1.length ? "part1" : "prep");
  const [q, setQ] = useState(0);
  const [prepRunning, setPrepRunning] = useState(false);
  const [prep] = useTimer(stage === "prep" && prepRunning);
  const [talk] = useTimer(stage === "talk");
  const [checks, setChecks] = useState<string[]>([]);
  const r = useRecorder();
  useEffect(() => { if (stage === "prep" && prep >= 60) setStage("talk"); }, [prep, stage]);
  useEffect(() => { if (stage === "talk" && talk % 15 === 0) ping("speaking"); }, [talk, stage]);

  if (stage === "part1")
    return (
      <div>
        <p className="overline">Part 1 style · question {q + 1} of {part1.length}</p>
        <h2>{part1[q]}</h2>
        <p className="muted">Answer out loud in 2–4 sentences. Give a reason or an example.</p>
        <SpeakButton text={part1[q]} label="Hear the question" />
        <ActionBar><button className="btn big primary" onClick={() => { ping("speaking"); if (q + 1 < part1.length) setQ(q + 1); else setStage(card ? "prep" : "check"); }}>I answered · Next <Icon name="arrow" /></button></ActionBar>
      </div>
    );
  if (!card) return <ActionBar><button className="btn big primary" onClick={onDone}>Continue</button></ActionBar>;
  if (stage === "prep")
    return (
      <div>
        <p className="overline">Part 2 style · cue card</p>
        <div className="prompt-box" style={skillStyle("speaking")}><h2>{card.title}</h2><p>You should say:</p><ul>{card.points.map((p) => <li key={p}>{p}</li>)}</ul><p>{card.explain}</p></div>
        {useful.length > 0 && <details><summary>Useful phrases</summary><ul>{useful.map((u) => <li key={u}>{u}</li>)}</ul></details>}
        <p><span className="timer">{mmss(60 - prep)}</span> <span className="muted">to prepare. Write 3–5 key words, not sentences.</span></p>
        <ActionBar>
          {prepRunning ? <button className="btn big primary" onClick={() => setStage("talk")}>Start speaking now <Icon name="arrow" /></button>
            : <button className="btn big primary" onClick={() => { setPrepRunning(true); ping("speaking"); }}>Start 1 minute to prepare</button>}
        </ActionBar>
      </div>
    );
  if (stage === "talk")
    return (
      <div>
        <div className="prompt-box" style={skillStyle("speaking")}><h3>{card.title}</h3><ul className="small">{card.points.map((p) => <li key={p}>{p}</li>)}</ul></div>
        <p><span className="timer">{mmss(talk)}</span> <span className="muted">/ aim for 2:00</span></p>
        <Progress value={talk / 120} label="Speaking time" />
        {r.supported && (
          <div className="row" style={{ marginTop: 16 }}>
            <button className={`record-btn ${r.recording ? "on" : ""}`} onClick={r.recording ? r.stop : r.start} aria-label={r.recording ? "Stop recording" : "Record myself"}><Icon name={r.recording ? "stop" : "mic"} size={32} /></button>
            <span className={r.recording ? "" : "muted"} style={r.recording ? { color: "var(--error)", fontWeight: 600 } : undefined}>{r.recording ? `Recording… ${mmss(talk)}` : r.url ? "Recorded. Tap to record again." : "Record myself (optional)"}</span>
          </div>
        )}
        {r.error && <p className="small muted">{r.error}</p>}
        <ActionBar><button className="btn big primary" onClick={() => { r.stop(); setStage("check"); }}>I've finished <Icon name="arrow" /></button></ActionBar>
      </div>
    );
  return (
    <div>
      <h2>How did it go?</h2>
      {r.url && <div className="card soft"><p className="small">Listen to yourself:</p><audio controls src={r.url} style={{ width: "100%" }} /></div>}
      <div>
        {SPEAK_CHECK.map((c) => (
          <label key={c} className="check">
            <input type="checkbox" checked={checks.includes(c)} onChange={(e) => setChecks(e.target.checked ? [...checks, c] : checks.filter((x) => x !== c))} /> {c}
          </label>
        ))}
      </div>
      <p className="small muted">Recordings stay on this device only.</p>
      <ActionBar><button className="btn big primary" onClick={async () => { await r.save(card.title, talk, checks); onDone(); }}>Save and continue <Icon name="check" /></button></ActionBar>
    </div>
  );
}

// ---------- Fluency 4·3·2 ----------
export function Fluency({ cue, minutes, onDone }: { cue: CueCard; minutes: number; onDone: () => void }) {
  const rounds = minutes >= 9 ? [240, 180, 120] : [180, 120, 60];
  const [round, setRound] = useState(-1);
  const [t, setT] = useTimer(round >= 0 && round < 3);
  useEffect(() => { if (round >= 0 && round < 3 && t % 15 === 0) ping("speaking"); }, [t, round]);
  useEffect(() => {
    if (round >= 0 && round < 3 && t >= rounds[round]) { setT(0); setRound(round + 1); }
  }, [t, round]); // eslint-disable-line react-hooks/exhaustive-deps
  if (round === -1)
    return (
      <div>
        <h2>Fluency: {rounds.map((r) => r / 60).join(" · ")} minutes</h2>
        <div className="prompt-box" style={skillStyle("speaking")}><h3>{cue.title}</h3><ul>{cue.points.map((p) => <li key={p}>{p}</li>)}</ul></div>
        <p className="muted">Talk about this three times: {rounds.map((r) => mmss(r)).join(", then ")}. Same content, faster each time. Use only words you already know. No new words, no stopping to correct.</p>
        <ActionBar><button className="btn big primary" onClick={() => { setRound(0); ping("speaking"); }}>Start round 1</button></ActionBar>
      </div>
    );
  if (round < 3)
    return (
      <div className="center">
        <p className="overline">Round {round + 1} of 3</p>
        <h2>{cue.title}</h2>
        <p className="timer" style={{ fontSize: "var(--fs-3xl)" }}>{mmss(rounds[round] - t)}</p>
        <Progress value={t / rounds[round]} label={`Round ${round + 1}`} />
        <p className="muted">Keep talking out loud until the timer ends.</p>
        <ActionBar><button className="btn big outline" onClick={() => { setT(0); setRound(round + 1); }}>Next round</button></ActionBar>
      </div>
    );
  return (
    <div>
      <h2>Done</h2>
      <p className="muted">Was the third time smoother than the first? That smoothness is fluency.</p>
      <ActionBar><button className="btn big primary" onClick={onDone}>Continue <Icon name="arrow" /></button></ActionBar>
    </div>
  );
}

// ---------- Dictation ----------
export function dictationSentences(c: Content, n = 3) {
  const s = getState();
  const mine = Object.keys(s.cards).map((k) => c.vocabById.get(Number(k))).filter((v): v is VocabItem => !!v?.ex);
  const pool = (mine.length >= n ? mine : c.vocab.filter((v) => v.src.includes("lesson"))).map((v) => v.ex!).filter((e) => { const w = wordCount(e); return w >= 6 && w <= 16; });
  return shuffle(pool).slice(0, n);
}

/** Whether the device has an English voice (voices load late on some browsers, so this updates). */
function useHasVoice() {
  const [has, setHas] = useState(() => voices().length > 0);
  useEffect(() => {
    if (typeof speechSynthesis === "undefined") return;
    const on = () => setHas(voices().length > 0);
    speechSynthesis.addEventListener?.("voiceschanged", on);
    const t = setTimeout(on, 800);
    return () => { speechSynthesis.removeEventListener?.("voiceschanged", on); clearTimeout(t); };
  }, []);
  return has;
}

export function Dictation({ sentences, onDone }: { sentences: string[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);
  const [peek, setPeek] = useState(false);
  const hasVoice = useHasVoice();
  const s = sentences[i];
  if (!s) return <div><h2>Dictation done</h2><ActionBar><button className="btn big primary" onClick={onDone}>Continue <Icon name="arrow" /></button></ActionBar></div>;
  const ok = matches(text, [s]);
  return (
    <div>
      <p className="overline">Sentence {i + 1} of {sentences.length}</p>
      {hasVoice ? (
        <>
          <h2>Listen and write exactly what you hear</h2>
          <div className="row">
            <button className="play-btn" onClick={() => { stopSpeaking(); speak(s, { rate: 0.9 }); ping("listening"); }} aria-label="Play the sentence"><Icon name="play" size={32} /></button>
            <button className="btn outline" onClick={() => { stopSpeaking(); speak(s, { rate: 0.7 }); ping("listening"); }}>Play slower</button>
          </div>
        </>
      ) : (
        <>
          <h2>Read, remember, then write it</h2>
          <p className="small muted">This device has no English voice, so this is a memory dictation: show the sentence, read it, hide it, then type it exactly.</p>
          {peek ? <p className="prompt-box" style={{ fontSize: "var(--fs-lg)" }}>{s}</p> : null}
          {!checked && <button className="btn outline" onClick={() => { setPeek(!peek); ping("listening"); }}>{peek ? "Hide the sentence" : "Show the sentence"}</button>}
        </>
      )}
      <input type="text" value={text} onChange={(e) => setText(e.target.value)} disabled={checked} placeholder="Type the sentence" aria-label="What you heard" style={{ marginTop: 12 }} autoCapitalize="off" autoComplete="off" />
      {checked && (
        <div className={`feedback ${ok ? "ok" : "no"}`}>
          <strong className="title"><Icon name={ok ? "check" : "x"} size={22} /> {ok ? "Exactly right" : "Compare"}</strong>
          <p className="diff">{diffWords(text, s).map((d, k) => <span key={k} className={d.op}>{d.text} </span>)}</p>
          {!ok && <p className="muted">Now say the sentence out loud, copying the speaker's rhythm (shadowing).</p>}
        </div>
      )}
      <ActionBar>
        {checked ? <button className="btn big primary" onClick={() => { setI(i + 1); setText(""); setChecked(false); setPeek(false); }}>Next <Icon name="arrow" /></button>
          : <button className="btn big primary" disabled={!text.trim()} onClick={() => { setPeek(false); recordAttempt({ kind: "listening", ok, prompt: `Dictation: ${s}`, given: text, expected: s }); setChecked(true); }}>Check</button>}
      </ActionBar>
    </div>
  );
}

// ---------- Recall warm-up ----------
export function Recall({ items, onDone }: { items: VocabItem[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const v = items[i];
  if (!v) return <div><h2>Warmed up</h2><ActionBar><button className="btn big primary" onClick={onDone}>Continue <Icon name="arrow" /></button></ActionBar></div>;
  return (
    <div>
      <p className="overline">Warm-up {i + 1} of {items.length}</p>
      <h2>Which word from yesterday means…</h2>
      <div className="flash" key={`${i}-${shown}`}><p className="prompt-text">{v.d ?? v.tr}</p>{shown && <><hr className="divider" /><div className="word">{v.w}</div></>}</div>
      <ActionBar>
        {shown ? <button className="btn big primary" onClick={() => { setShown(false); setI(i + 1); }}>Next <Icon name="arrow" /></button>
          : <button className="btn big primary" onClick={() => { setShown(true); ping("vocabulary"); }}>I said it · Show</button>}
      </ActionBar>
    </div>
  );
}

// ---------- Mistake notebook practice ----------
export function FixMistakes({ onDone, max = 5 }: { onDone: () => void; max?: number }) {
  const list = useMemo(() => getState().mistakes.filter((m) => !m.fixed && m.expected && m.kind !== "listening").slice(0, max), [max]);
  const items = list.map((m) => ({ ex: { type: "rewrite", prompt: m.prompt.startsWith("Correct:") ? m.prompt : `${m.prompt}`, answers: [m.expected], why: m.why ? `${m.why} (You wrote: "${m.given}")` : `You wrote: "${m.given}"` } as Ex, topic: m.topic }));
  if (!items.length) return <div><h2>No open mistakes</h2><ActionBar><button className="btn big primary" onClick={onDone}>Continue</button></ActionBar></div>;
  return <ExerciseRunner items={items} review onFinish={() => onDone()} />;
}

// ---------- Speaking prompt (the speaking itself happens in HelloTalk / Praktika) ----------
export function SpeakPrompt({ c, cueId, onDone }: { c: Content; cueId?: string; onDone: () => void }) {
  const s = getState();
  const day = Object.keys(s.days).length;
  const cue = c.ielts.cueCards.find((x) => x.id === cueId) ?? c.ielts.cueCards[day % c.ielts.cueCards.length];
  const part1 = c.ielts.part1[day % c.ielts.part1.length];
  // Five recent words to use, newest first (only words with a meaning).
  const words = Object.entries(s.cards)
    .sort((a, b) => (a[1].added < b[1].added ? 1 : -1))
    .map(([k, mc]): { w: string; d?: string } | undefined => (mc.custom ? { w: mc.custom.w, d: mc.custom.d } : c.vocabById.get(Number(k))))
    .filter((v): v is { w: string; d: string } => !!v?.d)
    .slice(0, 5);
  const pattern = Object.entries(s.grammar).filter(([, m]) => m.learnedAt).sort((a, b) => (a[1].learnedAt! < b[1].learnedAt! ? 1 : -1)).map(([id]) => c.grammarById.get(id)).find((t) => t && t.notice.length);
  const [app, setApp] = useState<"hellotalk" | "praktika" | "other">("hellotalk");
  const [minutes, setMinutes] = useState("");
  function save() {
    update((st) => ({ external: [{ id: uid(), at: new Date().toISOString(), source: app, topic: cue.title, minutes: Number(minutes), method: "manual" }, ...st.external] }));
    toast(`${minutes} min of speaking logged`);
    onDone();
  }
  return (
    <div>
      <h2>Today's topic: {cue.title.replace(/^Describe /, "")}</h2>
      <p className="muted small">Read this on the way, then talk about it in HelloTalk (a voice message or call) or Praktika. Try to use the words and the pattern.</p>
      <h3 style={{ marginTop: 16 }}>Part 1 · {part1.name}</h3>
      <ul>{part1.questions.slice(0, 3).map((q) => <li key={q}>{q}</li>)}</ul>
      <h3>Part 2 · Talk for 2 minutes</h3>
      <div className="prompt-box"><p style={{ margin: 0 }}><b>{cue.title}</b></p><ul>{cue.points.map((p) => <li key={p}>{p}</li>)}</ul></div>
      <h3>Part 3 · Discuss</h3>
      <ul>{cue.followUp.slice(0, 3).map((q) => <li key={q}>{q}</li>)}</ul>
      {words.length > 0 && (<><h3>Use these words</h3><ul>{words.map((w) => <li key={w.w}><b>{w.w}</b> <span className="muted">· {w.d}</span></li>)}</ul></>)}
      {pattern && (<><h3>Use this pattern: {pattern.title}</h3><p className="muted"><Bold text={pattern.notice[0]} /></p></>)}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>After you speak, log it</h3>
        <div className="row" style={{ marginBottom: 12 }}>
          <Segmented label="App" value={app} onChange={setApp} options={[["hellotalk", "HelloTalk"], ["praktika", "Praktika"], ["other", "Other"]]} />
        </div>
        <div className="row">
          {[10, 15, 20, 30].map((m) => <button key={m} className={`chip ${minutes === String(m) ? "on" : ""}`} aria-pressed={minutes === String(m)} onClick={() => setMinutes(String(m))}>{m} min</button>)}
          <input type="number" min={1} max={300} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="Minutes" aria-label="Minutes you spoke" style={{ width: 120, minHeight: 40, padding: "0 12px" }} />
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>Kept separate from Fluent365's own active time. Fluent365 is not connected to these apps; you type the minutes yourself.</p>
      </div>
      <ActionBar>
        <button className="btn big primary" disabled={!(Number(minutes) > 0)} onClick={save}>Save and continue</button>
        <button className="btn quiet" style={{ width: "100%" }} onClick={onDone}>I'll speak later</button>
      </ActionBar>
    </div>
  );
}
