// Download for offline: one button puts everything on the phone (app, books, lesson recordings and the
// LibriVox audiobooks). It skips what is already there, so pressing it again continues where it stopped.
import { useEffect, useRef, useState } from "react";
import { Icon, Progress, toast } from "../components/ui";
import { allItems, cachedSet, download, ensureAppFiles, keepStorage, mb, remove, storageEstimate, type Item } from "../lib/audio";
import type { Content } from "../lib/content";
import { currentBook } from "../lib/reading";
import { getState } from "../lib/store";
import { Back } from "./Learn";

export function OfflineScreen({ c }: { c: Content }) {
  const items = allItems(c.audio);
  const [stored, setStored] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<null | { label: string; done: number; total: number }>(null);
  const [error, setError] = useState("");
  const [space, setSpace] = useState<{ used: number; quota: number } | null>(null);
  const [appReady, setAppReady] = useState<boolean | null>(null);
  const stop = useRef<AbortController | null>(null);
  const refresh = async () => { setStored(await cachedSet(items)); setSpace(await storageEstimate()); };
  useEffect(() => {
    void refresh();
    void caches.keys().then((k) => setAppReady(k.some((x) => x.startsWith("fluent365-")))).catch(() => setAppReady(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const groups: { id: string; label: string; sub: string; items: Item[] }[] = [
    { id: "lessons", label: "Lesson recordings", sub: `${Object.keys(c.audio.tts).length} recordings`, items: items.filter((i) => i.group === "lessons") },
    ...c.books.filter((b) => c.audio.books[b.id]).map((b) => ({ id: b.id, label: b.title, sub: `Audiobook · read by ${c.audio.books[b.id].reader}`, items: items.filter((i) => i.group === b.id) })),
  ];
  const left = (list: Item[]) => list.filter((i) => !stored.has(i.url));
  const bytes = (list: Item[]) => list.reduce((n, i) => n + i.bytes, 0);
  const remaining = left(items);
  const book = currentBook(getState(), c.books);
  const essentials = items.filter((i) => i.group === "lessons" || i.group === book?.id);

  async function run(list: Item[], label: string) {
    setError("");
    stop.current = new AbortController();
    await keepStorage();
    try {
      setBusy({ label: "Checking the app and books…", done: 0, total: 1 });
      await ensureAppFiles((d, t) => setBusy({ label: "Checking the app and books…", done: d, total: t }));
      setAppReady(true);
      const todo = left(list);
      const total = bytes(todo);
      setBusy({ label, done: 0, total: Math.max(1, total) });
      await download(todo, (done) => setBusy({ label, done, total: Math.max(1, total) }), stop.current.signal);
      toast("Downloaded. Fluent365 now works offline.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(navigator.onLine ? "A download failed. Press the button again to continue where it stopped." : "You are offline. Connect to Wi-Fi and press the button again: it continues where it stopped.");
    } finally {
      setBusy(null);
      void refresh();
    }
  }

  const freeAfter = space ? space.quota - space.used - bytes(remaining) : null;
  return (
    <div className="offline">
      <Back to="/settings" label="Settings" />
      <h1>Download for offline</h1>
      <p className="lede">One tap puts everything on this phone: the app, all books and texts, the lesson recordings and the audiobooks. Then it works on the metro without internet, also with the screen off.</p>

      {busy ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 8px", fontWeight: 500 }}>{busy.label}</p>
          <Progress value={busy.done / busy.total} label={busy.label} />
          <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
            <span className="small muted">{busy.total > 1000 ? `${mb(busy.done)} of ${mb(busy.total)}` : `${busy.done} of ${busy.total}`}</span>
            <button className="btn quiet" onClick={() => stop.current?.abort()}>Stop</button>
          </div>
          <p className="small muted" style={{ margin: "8px 0 0" }}>Keep this page open (Wi-Fi is best). If it stops, press the button again: finished files are kept.</p>
        </div>
      ) : remaining.length === 0 && appReady ? (
        <div className="card ready" style={{ marginBottom: 16 }}><Icon name="offline" size={28} /><div><p style={{ margin: 0, fontWeight: 500 }}>Everything is on this phone</p><p className="small muted" style={{ margin: 0 }}>Fluent365 works offline. New lessons arrive when you open it online.</p></div></div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <button className="btn big primary" onClick={() => void run(items, "Downloading everything…")}><Icon name="download" /> Download everything · {mb(bytes(remaining))}</button>
          {left(essentials).length > 0 && left(essentials).length < remaining.length && <button className="btn quiet" style={{ width: "100%", marginTop: 4 }} onClick={() => void run(essentials, "Downloading lessons and your current book…")}>Only lessons + current book · {mb(bytes(left(essentials)))}</button>}
          {freeAfter !== null && freeAfter < 0 && <p className="small" style={{ color: "var(--md-error)" }}>The browser may not have enough space for everything ({mb(bytes(remaining))} needed). Start with lessons + current book.</p>}
        </div>
      )}
      {error && <p className="small" style={{ color: "var(--md-error)" }}>{error}</p>}

      <h2 className="section-title">What is on this phone</h2>
      <ul className="list">
        <li><div className="word-row"><Icon name={appReady ? "check" : "download"} /><span className="grow"><span style={{ display: "block" }}>App, books and lessons (text)</span><span className="small muted">{appReady ? "Ready offline" : appReady === null ? "Checking…" : "Downloads with the button"}</span></span></div></li>
        {groups.map((g) => {
          const l = left(g.items);
          const all = l.length === 0;
          return (
            <li key={g.id}><div className="word-row">
              <Icon name={all ? "check" : "download"} />
              <span className="grow" style={{ minWidth: 0 }}><span className="ellipsis" style={{ display: "block" }}>{g.label}</span><span className="small muted">{g.sub} · {all ? `${mb(bytes(g.items))} on this phone` : l.length < g.items.length ? `${mb(bytes(l))} left` : mb(bytes(g.items))}</span></span>
              {!busy && (all
                ? <button className="btn quiet" onClick={async () => { await remove(g.items); toast(`${g.label}: removed from this phone`); void refresh(); }} aria-label={`Remove ${g.label} from this phone`}><Icon name="delete" size={18} /></button>
                : <button className="btn outline" onClick={() => void run(g.items, `Downloading ${g.label}…`)}>Get</button>)}
            </div></li>
          );
        })}
      </ul>
      {space && <p className="small muted">Storage used by this browser: {mb(space.used)}{space.quota ? ` of about ${mb(space.quota)} it may use` : ""}.</p>}
      <p className="small muted">Audiobooks come from the Internet Archive (LibriVox, public domain). Only the files are downloaded; nothing about you is sent.</p>
    </div>
  );
}
