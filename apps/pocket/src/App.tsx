import { useEffect, useState } from "react";
import { Icon, Loading, Toaster } from "./components/ui";
import { startTracking } from "./lib/activity";
import { loadAll, type Content } from "./lib/content";
import * as db from "./lib/db";
import { isLoaded, loadState, useApp } from "./lib/store";
import type { GrammarTopic } from "./lib/types";
import { useRoute } from "./router";
import { GrammarScreen, ListeningScreen, PracticeScreen, ReadingScreen, WordsScreen } from "./screens/Browse";
import { Home } from "./screens/Home";
import { ProgressScreen } from "./screens/Progress";
import { SessionScreen } from "./screens/Session";
import { SettingsScreen } from "./screens/Settings";
import { Setup } from "./screens/Setup";

// Bottom navigation bar (Pocket is a phone app; on wide screens it stays in a centred column).
const BOTTOM = [
  { to: "/", label: "Today", icon: "today" },
  { to: "/practice", label: "Practice", icon: "practice" },
  { to: "/progress", label: "Progress", icon: "progress" },
  { to: "/settings", label: "Settings", icon: "settings" },
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
    const r = document.documentElement;
    r.dataset.theme = settings.theme === "system" ? "" : settings.theme;
    if (settings.theme === "system") delete r.dataset.theme;
    r.dataset.size = SIZE[settings.textSize] ?? settings.textSize;
    r.dataset.contrast = settings.highContrast ? "high" : "";
    r.dataset.seed = settings.seed ?? "violet";
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
    case "listening": page = <ListeningScreen c={content} />; break;
    case "practice": page = <PracticeScreen c={content} path={rest} />; break;
    case "progress": page = <ProgressScreen c={content} />; break;
    case "settings": page = <SettingsScreen c={content} path={rest} />; break;
    default: page = <Home c={content} />;
  }
  // Highlight the most specific matching item (e.g. "Writing" rather than "All practice").
  const match = (items: { to: string }[]) => items.filter((n) => n.to !== "-" && (n.to === "/" ? section === "" : route === n.to || route.startsWith(`${n.to}/`))).sort((x, y) => y.to.length - x.to.length)[0]?.to;
  const bottom = ["words", "grammar", "reading", "listening", "practice"].includes(section) ? "/practice" : match(BOTTOM);

  return (
    <div className={`app ${focus ? "focus-mode" : ""}`}>
      <main className="main" id="main">
        {page}
      </main>
      <nav className="bottomnav nav" aria-label="Main">
        {BOTTOM.map((n) => <a key={n.to} href={`#${n.to}`} aria-current={bottom === n.to ? "page" : undefined}><span className="ind"><Icon name={n.icon} filled={bottom === n.to} /></span>{n.label}</a>)}
      </nav>
      <Toaster />
    </div>
  );
}
