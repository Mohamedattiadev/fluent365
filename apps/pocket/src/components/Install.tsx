// "Install the app" card. Android/Chromium: the browser's own install prompt (beforeinstallprompt).
// iPhone/iPad Safari: the Share → Add to Home Screen steps. Hidden when the app already runs installed,
// and the pop-up for good after "Not now" (remembered in IndexedDB on this device). If the app was installed
// and then removed, the browser offers its install prompt again: then the card comes back (the old
// "installed" mark is cleared). Settings always has an "Install app" row (InstallRow).
import { useEffect, useState } from "react";
import * as db from "../lib/db";
import { Icon } from "./ui";

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
let deferred: InstallEvent | null = null;
const subs = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallEvent; subs.forEach((f) => f()); });
  window.addEventListener("appinstalled", () => { deferred = null; void db.set("kv", "installDone", true); subs.forEach((f) => f()); });
}

const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const ua = () => navigator.userAgent;
const isIos = () => /iphone|ipad|ipod/i.test(ua()) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isIosSafari = () => isIos() && !/crios|fxios|edgios|opios/i.test(ua());
const isAndroid = () => /android/i.test(ua());

export function InstallCard() {
  const [mode, setMode] = useState<"prompt" | "ios" | "android" | null>(null);
  useEffect(() => {
    if (standalone()) return;
    let live = true;
    let timer = 0;
    const decide = async () => {
      if (!live) return;
      // The browser only offers its prompt when the app is not installed (e.g. installed, then removed).
      if (deferred) { void db.set("kv", "installDone", false); if (!(await db.get<boolean>("kv", "installDismissed"))) return setMode("prompt"); return setMode(null); }
      if ((await db.get<boolean>("kv", "installDismissed")) || (await db.get<boolean>("kv", "installDone"))) return setMode(null);
      if (isIosSafari()) return setMode("ios");
      // Android browsers without the prompt (or before it arrives): show the menu steps after a moment.
      if (isAndroid()) timer = window.setTimeout(() => { if (live && !deferred) setMode("android"); }, 4000);
    };
    void decide();
    const on = () => { window.clearTimeout(timer); void decide(); };
    subs.add(on);
    return () => { live = false; window.clearTimeout(timer); subs.delete(on); };
  }, []);
  if (!mode) return null;

  const notNow = () => { setMode(null); void db.set("kv", "installDismissed", true); };
  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    if (outcome === "accepted") { setMode(null); void db.set("kv", "installDone", true); }
  };

  return (
    <div className="install-scrim" role="presentation">
      <section className="install-card" role="dialog" aria-modal="false" aria-labelledby="install-title">
        <img src="./icons/icon-192-g1.png" alt="" width={56} height={56} />
        <h2 id="install-title">Install Fluent365</h2>
        <p className="muted">It opens like an app, works offline on the metro, and keeps playing audio with the screen off. Your data stays on this device.</p>
        {mode === "ios" && (
          <ol className="install-steps">
            <li>Tap <b>Share</b> <Icon name="upload" size={18} /> at the bottom of Safari.</li>
            <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
            <li>Tap <b>Add</b>.</li>
          </ol>
        )}
        {mode === "android" && (
          <ol className="install-steps">
            <li>Open the browser menu <b>⋮</b> (top right).</li>
            <li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>
          </ol>
        )}
        <div className="install-actions">
          {mode === "prompt" && <button className="btn big primary" onClick={() => void install()}><Icon name="download" /> Install</button>}
          <button className={mode === "prompt" ? "btn quiet" : "btn big primary"} style={{ width: "100%" }} onClick={notNow}>{mode === "prompt" ? "Not now" : "Got it"}</button>
        </div>
      </section>
    </div>
  );
}

/** Settings row: install at any time (also after removing the app). Hidden when running installed. */
export function InstallRow() {
  const [, tick] = useState(0);
  const [steps, setSteps] = useState(false);
  useEffect(() => { const on = () => tick((x) => x + 1); subs.add(on); return () => { subs.delete(on); }; }, []);
  if (standalone()) return null;
  const go = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      if (outcome === "accepted") void db.set("kv", "installDone", true);
      tick((x) => x + 1);
    } else setSteps(!steps);
  };
  return (
    <div className="install-row">
      <button className="navrow" onClick={() => void go()}><Icon name="download" size={22} /><span className="grow"><span style={{ display: "block", fontWeight: 500 }}>Install app</span><span className="setting-hint">Home-screen app: opens full screen, works offline, plays with the screen off</span></span><Icon name="arrow" size={20} /></button>
      {steps && (
        <ol className="install-steps small">
          {isIosSafari() ? <><li>Tap <b>Share</b> <Icon name="upload" size={16} /> at the bottom of Safari.</li><li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></>
            : <><li>Open the browser menu <b>⋮</b> (top right).</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li><li>Just removed the app? Some browsers need the page reloaded once before they offer it again.</li></>}
        </ol>
      )}
    </div>
  );
}
