// First run: four short questions, all optional, all with a sensible default. Then straight to learning.
// When the deployment has a Supabase project, one more optional step offers Sign in with Google
// (backup + same progress on every device) or "Continue as guest"; the welcome screen also lets a
// returning learner sign in at once, which restores their progress and skips the questions.
import { useEffect, useState } from "react";
import { ActionBar, Icon, toast } from "../components/ui";
import { accountConfig, signIn } from "../lib/account";
import type { AccountText } from "../lib/accountText";
import * as db from "../lib/db";
import { persist } from "../lib/db";
import { flush, getState, today, update } from "../lib/store";
import type { Lang, Level, Settings } from "../lib/types";

export function Setup() {
  const [step, setStep] = useState(0);
  const [s, setS] = useState<Pick<Settings, "name" | "level" | "goal" | "minutes" | "explainLang">>({ name: "", level: "B1", goal: "ielts-gt", minutes: 60, explainLang: "en" });
  const [texts, setTexts] = useState<((l: Lang) => AccountText) | null>(null);
  const [busy, setBusy] = useState(false);
  // The account strings are loaded only when a Supabase project is configured (small main bundle).
  useEffect(() => { void accountConfig().then(async (c) => { if (c) { const m = await import("../lib/accountText"); setTexts(() => m.accountText); } }); }, []);
  const account = !!texts;
  const t = texts ? texts(s.explainLang) : ({} as AccountText);
  const finish = () => {
    update((st) => ({ settings: { ...st.settings, ...s, setupDone: true, startDate: today(), phaseReached: "B1" } }));
    void flush(); // save now, not after the usual short delay: setup must survive an immediate reload
    void persist();
  };
  // Sign in with Google from setup: the answers are written to storage only (not to the running app),
  // so this screen stays up, saying "Opening Google…", until the browser leaves for Google. Coming
  // back, the app loads with setup done and lands on Today (or restores the learner's backup).
  const google = async () => {
    setBusy(true);
    const before = getState().settings;
    await db.set("kv", "settings", { ...before, ...s, setupDone: true, startDate: today(), phaseReached: "B1" });
    try { await signIn("#/"); } catch (e) {
      await db.set("kv", "settings", before);
      setBusy(false);
      toast(e instanceof Error ? e.message : String(e));
    }
  };
  const Choice = <T extends string | number>({ value, options, onPick }: { value: T; options: [T, string, string?][]; onPick: (v: T) => void }) => (
    <div className="options" role="radiogroup">
      {options.map(([v, label, hint]) => (
        <button key={String(v)} role="radio" aria-checked={value === v} className={`btn option ${value === v ? "selected" : ""}`} onClick={() => onPick(v)}>
          <span className="opt-text"><b>{label}</b>{hint && <span className="muted small" style={{ display: "block" }}>{hint}</span>}</span>
        </button>
      ))}
    </div>
  );
  const screens = [
    <div key="0">
      <h1>Welcome to Fluent365</h1>
      <p>Every day, Fluent365 prepares one guided English session for you. You press <b>Start</b>, then <b>Next</b>. That's it.</p>
      <p className="muted">{account ? t.welcomeNote : "Your progress stays on this device. No account, no ads."}</p>
      {!account && <p className="small muted">New phone? Finish these four steps, then restore in Settings → Backup.</p>}
      <label className="field"><span>What should we call you? (optional)</span>
        <input type="text" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} placeholder="Your name" autoComplete="given-name" />
      </label>
    </div>,
    <div key="1">
      <h2>What is your English level now?</h2>
      <p className="muted">Not sure? Choose B1 — the plan adjusts to how you actually do.</p>
      <Choice<Level> value={s.level} onPick={(level) => setS({ ...s, level })} options={[["A2", "Elementary (A2)", "I understand simple everyday sentences"], ["B1", "Intermediate (B1)", "I can talk about familiar topics, with mistakes"], ["B2", "Upper-intermediate (B2)", "I can follow most conversations and texts"], ["C1", "Advanced (C1)", "I want to polish and reach IELTS 7.5+"]]} />
    </div>,
    <div key="2">
      <h2>What is your goal?</h2>
      <Choice value={s.goal} onPick={(goal) => setS({ ...s, goal })} options={[["ielts-gt", "IELTS General Training", "For work or migration"], ["ielts-ac", "IELTS Academic", "For university"], ["general", "Better English in general", "No exam"]]} />
    </div>,
    <div key="3">
      <h2>How much time per day?</h2>
      <Choice<30 | 60 | 90> value={s.minutes} onPick={(minutes) => setS({ ...s, minutes })} options={[[30, "About 25 minutes", "A short, steady habit"], [60, "About 1 hour", "Recommended"], [90, "About 1.5 hours", "Faster progress"]]} />
      <h3 style={{ marginTop: 20 }}>Explanations in</h3>
      <Choice<Lang> value={s.explainLang} onPick={(explainLang) => setS({ ...s, explainLang })} options={[["en", "English"], ["tr", "Türkçe (where available)"], ["ar", "العربية (where available)"]]} />
    </div>,
    ...(account ? [
      <div key="4" lang={s.explainLang} dir={s.explainLang === "ar" ? "rtl" : undefined}>
        <h2>{t.setupTitle}</h2>
        <ul className="benefits">
          {t.benefits.map((b) => <li key={b}><Icon name="done" size={22} /><span>{b}</span></li>)}
        </ul>
        <p className="muted small">{t.setupOptional}</p>
      </div>,
    ] : []),
  ];
  const last = step + 1 === screens.length;
  const accountStep = account && last;
  return (
    <main className="main setup" style={{ maxWidth: 640 }}>
      <p className="overline">Step {step + 1} of {screens.length}</p>
      <div>{screens[step]}</div>
      <ActionBar>
        {accountStep ? (
          <>
            <button className="btn big primary google" disabled={busy} onClick={google} lang={s.explainLang}><GoogleG />{busy ? t.opening : t.signIn}</button>
            <button className="btn big outline" style={{ width: "100%" }} disabled={busy} onClick={finish} lang={s.explainLang}>{t.guest}</button>
          </>
        ) : (
          <button className="btn big primary" onClick={() => (step + 1 < screens.length ? setStep(step + 1) : finish())}>
            {step + 1 < screens.length ? "Next" : "Start learning"} <Icon name="arrow" />
          </button>
        )}
        {step > 0 && <button className="btn quiet" style={{ width: "100%" }} onClick={() => setStep(step - 1)}>Back</button>}
        {step === 0 && account && <button className="btn quiet" style={{ width: "100%" }} disabled={busy} onClick={google}>{busy ? t.opening : t.haveAccountShort}</button>}
      </ActionBar>
    </main>
  );
}

/** Google's "G" mark, as Google's sign-in branding asks for on a "Sign in with Google" button. */
function GoogleG() {
  return (
    <span className="g-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48" width="20" height="20">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
    </span>
  );
}
