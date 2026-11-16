import { useEffect, useRef, useState, type ReactNode } from "react";
import { boldParts } from "../lib/text";
import type { Skill } from "../lib/types";
export type { Skill };

import { ICON_PATHS } from "./icons.gen";

// Material Symbols Rounded (Apache-2.0), generated into icons.gen.ts. Never emoji.
export function Icon({ name, label, size, filled }: { name: string; label?: string; size?: number; filled?: boolean }) {
  const p = ICON_PATHS[name] ?? ICON_PATHS.arrow;
  const px = size ?? 24;
  return (
    <svg className="icon" viewBox="0 -960 960 960" width={px} height={px} fill="currentColor" aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label} focusable="false">
      <path d={filled ? p.f : p.d} />
    </svg>
  );
}

export const Bold = ({ text }: { text: string }) => <>{boldParts(text).map((p, i) => (p.b ? <b key={i}>{p.t}</b> : <span key={i}>{p.t}</span>))}</>;

export function Progress({ value, label }: { value: number; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-valuetext={label} aria-label={label ?? "Progress"}>
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
    <button className="btn quiet" onClick={() => { stopSpeaking(); speak(text); }} aria-label={`${label}: ${text}`}>
      <Icon name="audio" size={20} /> {label}
    </button>
  );
}

// ---------- Skills: each has a muted ink colour used only for a thin rule, a label and an icon ----------
export const SKILLS: Record<Skill, { label: string; icon: string }> = {
  words: { label: "Words", icon: "words" },
  grammar: { label: "Grammar", icon: "grammar" },
  reading: { label: "Reading", icon: "reading" },
  listening: { label: "Listening", icon: "listening" },
  writing: { label: "Writing", icon: "writing" },
  speaking: { label: "Speaking", icon: "speaking" },
};
export const skillStyle = (sk?: Skill) =>
  sk ? ({ "--skill": `var(--sk-${sk})`, "--skill-container": `var(--sk-${sk}-container)`, "--skill-on": `var(--sk-${sk}-on)` } as React.CSSProperties) : undefined;

/** Round 40px badge with the skill's container colour (Material list "leading avatar"). */
export function SkillBadge({ skill, icon }: { skill?: Skill; icon?: string }) {
  return <span className="badge" style={skillStyle(skill)} aria-hidden><Icon name={icon ?? (skill ? SKILLS[skill].icon : "list")} size={22} /></span>;
}

/** Assist-chip style label: skill icon in its colour, then "Grammar · Present perfect". */
export function SkillLabel({ skill, text }: { skill?: Skill; text?: string }) {
  if (!skill) return text ? <p className="overline">{text}</p> : null;
  return (
    <p className="skill-label" style={skillStyle(skill)}>
      <Icon name={SKILLS[skill].icon} size={18} /> <span>{SKILLS[skill].label}{text ? ` · ${text}` : ""}</span>
    </p>
  );
}

/** Segmented control (radio group) for 2–4 short choices. */
export function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>{value === v && <Icon name="check" size={18} />}{l}</button>
      ))}
    </div>
  );
}

/** 52×32 switch: teal fill and a check glyph when on (colour is never the only signal). */
export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="setting-row">
      <span className="grow"><span className="setting-label">{label}</span>{hint && <span className="setting-hint">{hint}</span>}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)}>
        <span className="thumb">{checked ? <Icon name="check" size={16} /> : null}</span>
      </button>
    </div>
  );
}
