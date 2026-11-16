import { useEffect, useState } from "react";
import { Icon, Loading, Toaster } from "./components/ui";
import { startTracking } from "./lib/activity";
import { loadAll, type Content } from "./lib/content";
import * as db from "./lib/db";
import { isLoaded, loadState, useApp } from "./lib/store";
import type { GrammarTopic } from "./lib/types";
import { navigate, useRoute } from "./router";
import { GrammarScreen, PracticeScreen, ReadingScreen, WordsScreen } from "./screens/Browse";
import { Home } from "./screens/Home";
import { ProgressScreen } from "./screens/Progress";
import { SessionScreen } from "./screens/Session";
import { SettingsScreen } from "./screens/Settings";
import { Setup } from "./screens/Setup";

const NAV = [
  { to: "/", label: "Home", icon: "home", mobile: true },
  { to: "/grammar", label: "Grammar", icon: "grammar", mobile: true },
  { to: "/words", label: "Words", icon: "words", mobile: true },
  { to: "/reading", label: "Reading", icon: "reading", mobile: false },
  { to: "/practice", label: "Practice", icon: "practice", mobile: true },
  { to: "/progress", label: "Progress", icon: "progress", mobile: true },
  { to: "/settings", label: "Settings", icon: "settings", mobile: false },
];

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
    const r = document.documentElement;
    r.dataset.theme = settings.theme === "system" ? "" : settings.theme;
    if (settings.theme === "system") delete r.dataset.theme;
    r.dataset.size = settings.textSize;
    r.dataset.comfortable = String(settings.comfortable);
    r.dataset.motion = settings.reduceMotion ? "reduce" : "";
  }, [settings]);

  if (error)
    return (
      <main className="main">
        <h1>Fluent365</h1>
        <p>The learning content could not be loaded. Connect to the internet once; after that Fluent365 works offline.</p>
        <button className="btn primary" onClick={() => location.reload()}>Try again</button>
      </main>
    );
  if (!ready || !content) return <main className="main"><Loading what="Opening Fluent365…" /></main>;
  if (!settings.setupDone) return <Setup />;

  const [, section = "", ...rest] = route.split("/");
  const focus = section === "session";
  let page;
  switch (section) {
    case "": page = <Home c={content} />; break;
    case "session": page = <SessionScreen c={content} />; break;
    case "grammar": page = <GrammarScreen c={content} path={rest} />; break;
    case "words": page = <WordsScreen c={content} path={rest} />; break;
    case "reading": page = <ReadingScreen c={content} path={rest} />; break;
    case "practice": page = <PracticeScreen c={content} path={rest} />; break;
    case "progress": page = <ProgressScreen c={content} />; break;
    case "settings": page = <SettingsScreen c={content} path={rest} />; break;
    default: page = <Home c={content} />;
  }
  const active = (to: string) => (to === "/" ? section === "" : route.startsWith(to));

  return (
    <div className={`app ${focus ? "focus-mode" : ""}`}>
      <nav className="sidebar" aria-label="Main">
        <a href="#/" className="brand" style={{ marginBottom: 16, padding: "0 14px", minHeight: 48 }}><img src="./icons/icon.svg" alt="" /> Fluent365</a>
        {NAV.map((n) => <a key={n.to} href={`#${n.to}`} aria-current={active(n.to) ? "page" : undefined}><Icon name={n.icon} /> {n.label}</a>)}
      </nav>
      <main className="main" id="main">
        {!focus && (
          <header className="topbar">
            <a href="#/" className="brand"><img src="./icons/icon.svg" alt="" /> Fluent365</a>
            <button className="btn link mobile-only" onClick={() => navigate("/settings")}><Icon name="settings" /> Settings</button>
          </header>
        )}
        {page}
      </main>
      <nav className="bottomnav" aria-label="Main">
        {NAV.filter((n) => n.mobile).map((n) => <a key={n.to} href={`#${n.to}`} aria-current={active(n.to) ? "page" : undefined}><Icon name={n.icon} /> {n.label}</a>)}
      </nav>
      <Toaster />
    </div>
  );
}
