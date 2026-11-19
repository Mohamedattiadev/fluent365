// First run: four short questions, all optional, all with a sensible default. Then straight to learning.
// When the deployment has a Supabase project, one more optional step offers Sign in with Google
// (backup + same progress on every device) or "Continue as guest"; the welcome screen also lets a
// returning learner sign in at once, which restores their progress and skips the questions.
import { useEffect, useState } from "react";
import { ActionBar, Icon, toast } from "../components/ui";
import { accountConfig, signIn } from "../lib/account";
import type { AccountText } from "../lib/accountText";
import { persist } from "../lib/db";
import { flush, today, update } from "../lib/store";
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
  // Sign in with Google from setup: save the answers, then go to Google; the app comes back to Today.
  const google = async () => {
    setBusy(true);
    finish();
    await flush();
    try { await signIn("#/"); } catch (e) { setBusy(false); toast(e instanceof Error ? e.message : String(e)); }
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
      <p className="muted">Your progress stays on this device. No account, no ads.</p>
      {account ? (
        <button className="btn outline" style={{ width: "100%", margin: "4px 0 12px" }} disabled={busy} onClick={google}>{t.haveAccount}</button>
      ) : (
        <p className="small muted">New phone? Finish these four steps, then restore in Settings → Backup.</p>
      )}
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
        <p>{t.setupBody}</p>
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
            <button className="btn big primary" disabled={busy} onClick={google} lang={s.explainLang}>{busy ? t.opening : t.signIn}</button>
            <button className="btn big outline" style={{ width: "100%" }} disabled={busy} onClick={finish} lang={s.explainLang}>{t.guest}</button>
          </>
        ) : (
          <button className="btn big primary" onClick={() => (step + 1 < screens.length ? setStep(step + 1) : finish())}>
            {step + 1 < screens.length ? "Next" : "Start learning"} <Icon name="arrow" />
          </button>
        )}
        {step > 0 && <button className="btn quiet" style={{ width: "100%" }} onClick={() => setStep(step - 1)}>Back</button>}
      </ActionBar>
    </main>
  );
}
