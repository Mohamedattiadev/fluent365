import { useEffect, useRef, useState, type ReactNode } from "react";
import { boldParts } from "../lib/text";

const paths: Record<string, string> = {
  home: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
  grammar: "M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3zM4 17a3 3 0 0 1 3-3h11M8 8h6",
  words: "M3 6h13v13H3zM8 3h13v13",
  reading: "M2 5c3-1 6-1 10 1 4-2 7-2 10-1v14c-3-1-6-1-10 1-4-2-7-2-10-1zM12 6v14",
  practice: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  progress: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  play: "M7 4l13 8-13 8z",
  stop: "M6 6h12v12H6z",
  mic: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  check: "M4 12l5 5L20 6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5M11 6l-6 6 6 6",
};

export function Icon({ name, label }: { name: keyof typeof paths | string; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      <path d={paths[name] ?? paths.arrow} />
    </svg>
  );
}

export const Bold = ({ text }: { text: string }) => <>{boldParts(text).map((p, i) => (p.b ? <b key={i}>{p.t}</b> : <span key={i}>{p.t}</span>))}</>;

export function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <div style={{ width: `${v * 100}%` }} />
    </div>
  );
}

/** The one obvious action at the bottom of the screen. */
export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="actionbar">{children}</div>;
}

export function Loading({ what = "Loading…" }: { what?: string }) {
  return <p className="muted" role="status">{what}</p>;
}

export function useTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return [seconds, setSeconds] as const;
}

export const mmss = (s: number) => `${Math.floor(Math.abs(s) / 60)}:${String(Math.floor(Math.abs(s) % 60)).padStart(2, "0")}`;

let toastSet: ((s: string | null) => void) | null = null;
export function toast(msg: string) {
  toastSet?.(msg);
}
export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    toastSet = (m) => {
      setMsg(m);
      clearTimeout(t.current);
      t.current = setTimeout(() => setMsg(null), 3500);
    };
    return () => {
      toastSet = null;
    };
  }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

// ---------- Speech (browser voices, offline where the device has them) ----------
export function voices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === "undefined") return [];
  return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
}

export function speak(text: string, opts: { voiceIndex?: number; rate?: number; onEnd?: () => void } = {}) {
  if (typeof speechSynthesis === "undefined") {
    opts.onEnd?.();
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  const list = voices();
  const preferred = list.filter((v) => /GB|US|AU|IE|NZ/i.test(v.lang));
  const pool = preferred.length ? preferred : list;
  if (pool.length) u.voice = pool[(opts.voiceIndex ?? 0) % pool.length];
  u.lang = u.voice?.lang ?? "en-GB";
  u.rate = opts.rate ?? 0.95;
  u.onend = () => opts.onEnd?.();
  u.onerror = () => opts.onEnd?.();
  speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}

export function SpeakButton({ text, label = "Listen" }: { text: string; label?: string }) {
  return (
    <button className="btn outline" onClick={() => { stopSpeaking(); speak(text); }} aria-label={`${label}: ${text}`}>
      <Icon name="play" /> {label}
    </button>
  );
}
