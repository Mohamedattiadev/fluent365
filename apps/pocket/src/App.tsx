import { useEffect, useState } from "react";
import { InstallCard } from "./components/Install";
import { Icon, Toaster } from "./components/ui";
import { startTracking } from "./lib/activity";
import { loadAll, type Content } from "./lib/content";
import * as db from "./lib/db";
import { isLoaded, loadState, useApp } from "./lib/store";
import type { GrammarTopic } from "./lib/types";
import { navigate, useRoute } from "./router";
import { Home } from "./screens/Home";
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

  return (
    <div className={`app ${focus ? "focus-mode" : ""}`}>
      <header className="topnav nav" aria-label="Main">
        <a href="#/" className="brand"><svg className="logo" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="170" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="40"/><circle className="arc" cx="256" cy="256" r="170" fill="none" stroke="var(--accent)" strokeWidth="40" strokeLinecap="round" pathLength={100} transform="rotate(-90 256 256)" strokeDasharray="78 100"/><path d="M247.0 350.0 C205.0 320.0 163.2 324.0 140.0 342.0 V190.0 C163.2 170.0 205.0 172.0 247.0 204.0 Z" fill="currentColor"/><path d="M 265.0 350.0 C 307.0 320.0 348.8 324.0 372.0 342.0 V 190.0 C 348.8 170.0 307.0 172.0 265.0 204.0 Z" fill="currentColor"/></svg> Fluent365</a>
        <nav className="links" aria-label="Sections">
          {NAV.map((n) => <a key={n.to} className="link" href={`#${n.to}`} aria-current={current === n.to ? "page" : undefined}><Icon name={n.icon} size={20} filled={current === n.to} />{n.label}</a>)}
        </nav>
        <a className="gear" href="#/settings" aria-label="Settings" aria-current={gear ? "page" : undefined}><Icon name="settings" filled={gear} /></a>
      </header>
      <main className="main" id="main">
        {!focus && <a className="gear phone-gear" href="#/settings" aria-label="Settings" aria-current={gear ? "page" : undefined}><Icon name="settings" filled={gear} /></a>}
        <div className="page" key={focus ? "session" : section === "learn" && rest.length <= 1 ? "learn" : route}>{page}</div>
      </main>
      {!focus && section !== "listen" && <MiniPlayer />}
      <nav className="bottomnav nav" aria-label="Main">
        {NAV.map((n) => <a key={n.to} href={`#${n.to}`} aria-current={current === n.to ? "page" : undefined}><span className="ind"><Icon name={n.icon} filled={current === n.to} /></span>{n.label}</a>)}
      </nav>
      {!focus && <InstallCard />}
      <Toaster />
    </div>
  );
}

/** Same as the opening screen in index.html, so there is no flash while the app loads its data. */
function Splash() {
  return <div className="splash" role="status"><svg className="mark" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="170" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="40"/><circle className="arc" cx="256" cy="256" r="170" fill="none" stroke="var(--pen, #7b61ff)" strokeWidth="40" strokeLinecap="round" pathLength={100} transform="rotate(-90 256 256)" strokeDasharray="78 100"/><path d="M247.0 350.0 C205.0 320.0 163.2 324.0 140.0 342.0 V190.0 C163.2 170.0 205.0 172.0 247.0 204.0 Z" fill="currentColor"/><path d="M 265.0 350.0 C 307.0 320.0 348.8 324.0 372.0 342.0 V 190.0 C 348.8 170.0 307.0 172.0 265.0 204.0 Z" fill="currentColor"/></svg><div className="wm">Fluent<b>365</b></div><span className="sr-only">Opening Fluent365…</span></div>;
}
