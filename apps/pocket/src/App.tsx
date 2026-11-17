import { useEffect, useState } from "react";
import { FullPlayer } from "./components/FullPlayer";
import { InstallCard } from "./components/Install";
import { Icon, ShortcutsHelp, Toaster, useWide } from "./components/ui";
import { startTracking } from "./lib/activity";
import { loadAll, type Content } from "./lib/content";
import * as db from "./lib/db";
import * as player from "./lib/player";
import { usePlayer } from "./lib/player";
import { isLoaded, loadState, useApp } from "./lib/store";
import type { GrammarTopic } from "./lib/types";
import { navigate, useRoute } from "./router";
import { Home, TodayExtras } from "./screens/Home";
import { LearnScreen } from "./screens/Learn";
import { ListenScreen, MiniPlayer } from "./screens/Listen";
import { PracticeScreen } from "./screens/LocalOnly";
import { ReadScreen } from "./screens/Read";
import { SessionScreen } from "./screens/Session";
import { SettingsScreen } from "./screens/Settings";
import { Setup } from "./screens/Setup";

// Four places, the same on phone (bottom bar) and laptop (top bar). Settings is a small gear.
const NAV = [
  { to: "/", label: "Today", icon: "today" },
  { to: "/learn", label: "Learn", icon: "school" },
  { to: "/read", label: "Read", icon: "reading" },
  { to: "/listen", label: "Listen", icon: "listening" },
];
// Old addresses (bookmarks, earlier versions) go to their new place.
const LEGACY: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^\/words(\/review)?$/, (m) => `/learn/words${m[1] ?? ""}`],
  [/^\/words\/learn\/(.+)$/, (m) => `/learn/words/new/${m[1]}`],
  [/^\/grammar(\/.*)?$/, (m) => `/learn/grammar${m[1] ?? ""}`],
  [/^\/practice\/mistakes$/, () => "/learn/grammar/mistakes"],
  [/^\/reading\/(book|chapters)\/(.+)$/, (m) => `/read/${m[1]}/${m[2]}`],
  [/^\/reading(\/.*)?$/, () => "/read"],
  [/^\/listening$/, () => "/listen"],
  [/^\/(progress|speak)$/, () => "/"],
];
const SIZE: Record<string, string> = { normal: "m", large: "l" };

export function App() {
  const [content, setContent] = useState<Content | null>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(isLoaded());
  const settings = useApp((s) => s.settings);
  const route = useRoute();
  const expanded = usePlayer().expanded;
  const wide = useWide();
  const [help, setHelp] = useState(false);

  // Laptop shortcuts: ? = help, Space = play/pause, ←/→ = ±10 s on Listen (the reader and cards have their own keys).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName) || el?.isContentEditable) return;
      if (e.key === "?") { e.preventDefault(); setHelp((h) => !h); return; }
      if (!player.current() || location.hash.startsWith("#/session") || document.querySelector(".flash, .swipe")) return;
      if (e.key === " " && el?.tagName !== "BUTTON") { e.preventDefault(); player.toggle(); }
      else if ((location.hash.startsWith("#/listen") || document.querySelector(".fp")) && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); player.seek(e.key === "ArrowLeft" ? -10 : 10); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    void loadState().then(() => setReady(true));
    loadAll()
      .then(async (c) => {
        const personal = await db.get<GrammarTopic>("kv", "personal-topic");
        if (personal?.exercises.length) {
          c.grammar.push(personal);
          c.grammarById.set(personal.id, personal);
        }
        setContent(c);
      })
      .catch(() => setError(true));
    startTracking();
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [route]);
  useEffect(() => {
    for (const [re, to] of LEGACY) { const m = route.match(re); if (m) { navigate(to(m)); break; } }
  }, [route]);

  useEffect(() => {
    const r = document.documentElement;
    r.dataset.theme = settings.theme === "system" ? "" : settings.theme;
    if (settings.theme === "system") delete r.dataset.theme;
    r.dataset.size = SIZE[settings.textSize] ?? settings.textSize;
    r.dataset.contrast = settings.highContrast ? "high" : "";
    r.dataset.accent = settings.accent ?? "violet";
    r.dataset.comfortable = String(settings.comfortable);
    r.dataset.motion = settings.reduceMotion ? "reduce" : "";
    // Phone status bar and navigation bar follow the app's light/dark choice, not only the device setting.
    const dark = settings.theme === "dark" || (settings.theme !== "light" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.removeAttribute("media"); m.setAttribute("content", dark ? "#131313" : "#F9F9F9"); });
    // Remembered only so the opening screen (index.html) already uses your theme; not learner data.
    try { localStorage.setItem("f365-look", JSON.stringify({ theme: settings.theme, accent: settings.accent ?? "violet" })); } catch { /* storage blocked */ }
  }, [settings]);

  if (error)
    return (
      <main className="main">
        <h1>Fluent365</h1>
        <p>The learning content could not be loaded. Connect to the internet once; after that Fluent365 works offline.</p>
        <button className="btn primary" onClick={() => location.reload()}>Try again</button>
      </main>
    );
  if (!ready || !content) return <Splash />;
  if (!settings.setupDone) return <Setup />;

  const [, section = "", ...rest] = route.split("/");
  const focus = section === "session";
  let page;
  switch (section) {
    case "": page = <Home c={content} />; break;
    case "session": page = <SessionScreen c={content} />; break;
    case "learn": page = <LearnScreen c={content} path={rest} />; break;
    case "read": page = <ReadScreen c={content} path={rest} />; break;
    case "listen": page = <ListenScreen c={content} path={rest} />; break;
    case "practice": page = <PracticeScreen c={content} path={rest} />; break; // hidden: Local app features
    case "settings": page = <SettingsScreen c={content} path={rest} />; break;
    default: page = <Home c={content} />;
  }
  const current = section === "" ? "/" : NAV.find((n) => n.to === `/${section}`)?.to;
  const gear = section === "settings";
  // Laptop: a right-hand panel (week, word of the day, progress) next to Today, Learn and Read.
  const side = wide && ["", "learn", "read"].includes(section);

  return (
    <div className={`app ${focus ? "focus-mode" : ""} ${side ? "has-side" : ""}`}>
      <header className="topnav nav" aria-label="Main">
        <a href="#/" className="brand"><svg className="logo" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="176" fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth="30"/><circle className="arc" cx="256" cy="256" r="176" fill="none" stroke="var(--accent)" strokeWidth="30" strokeLinecap="round" pathLength={100} transform="rotate(-90 256 256)" strokeDasharray="25 100"/><path d="M251.0 345.0 C203.5 319.0 167.8 323.0 151.0 339.0 V201.0 C167.8 185.0 203.5 187.0 251.0 215.0 Z" fill="currentColor"/><path d="M261.0 345.0 C308.5 319.0 344.2 323.0 361.0 339.0 V201.0 C344.2 185.0 308.5 187.0 261.0 215.0 Z" fill="currentColor"/></svg> Fluent365</a>
        <nav className="links" aria-label="Sections">
          {NAV.map((n) => <a key={n.to} className="link" href={`#${n.to}`} aria-current={current === n.to ? "page" : undefined}><Icon name={n.icon} size={20} filled={current === n.to} />{n.label}</a>)}
        </nav>
        <a className="gear" href="#/settings" aria-label="Settings" aria-current={gear ? "page" : undefined}><Icon name="settings" filled={gear} /><span className="rail-label">Settings</span></a>
        <button className="rail-help" onClick={() => setHelp(true)} aria-label="Keyboard shortcuts"><Icon name="keyboard" size={20} /><span className="rail-label">Shortcuts <kbd>?</kbd></span></button>
      </header>
      <main className="main" id="main">
        {!focus && <a className="gear phone-gear" href="#/settings" aria-label="Settings" aria-current={gear ? "page" : undefined}><Icon name="settings" filled={gear} /></a>}
        <div className="page" key={focus ? "session" : section === "learn" && rest.length <= 1 ? "learn" : route}>{page}</div>
      </main>
      {!focus && side && <aside className="side-panel" aria-label="Your week"><TodayExtras c={content} /></aside>}
      {!focus && (section !== "listen" || wide) && <MiniPlayer />}
      <nav className="bottomnav nav" aria-label="Main">
        {NAV.map((n) => <a key={n.to} href={`#${n.to}`} aria-current={current === n.to ? "page" : undefined}><span className="ind"><Icon name={n.icon} filled={current === n.to} /></span>{n.label}</a>)}
      </nav>
      {expanded && <FullPlayer c={content} />}
      {help && <ShortcutsHelp onClose={() => setHelp(false)} />}
      {!focus && <InstallCard />}
      <Toaster />
    </div>
  );
}

/** Same as the opening screen in index.html, so there is no flash while the app loads its data. */
function Splash() {
  return <div className="splash" role="status"><svg className="mark" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="176" fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth="30"/><circle className="arc" cx="256" cy="256" r="176" fill="none" stroke="var(--pen, #7b61ff)" strokeWidth="30" strokeLinecap="round" pathLength={100} transform="rotate(-90 256 256)" strokeDasharray="25 100"/><path d="M251.0 345.0 C203.5 319.0 167.8 323.0 151.0 339.0 V201.0 C167.8 185.0 203.5 187.0 251.0 215.0 Z" fill="currentColor"/><path d="M261.0 345.0 C308.5 319.0 344.2 323.0 361.0 339.0 V201.0 C344.2 185.0 308.5 187.0 261.0 215.0 Z" fill="currentColor"/></svg><div className="wm">Fluent<b>365</b></div><span className="sr-only">Opening Fluent365…</span></div>;
}
