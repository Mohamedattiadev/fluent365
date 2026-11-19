// Automatic backup to the learner's own private GitHub repo: connect once with a key, then the
// app backs up by itself (at most once a day). Restore on a new phone from the same card.
import { useEffect, useState } from "react";
import { backupNow, connect, disconnect, fetchBackup, findRepos, getCloud, NEW_KEY_URL, type CloudConfig, type RepoChoice } from "../lib/cloud";
import type { BackupCheck } from "../lib/portability";
import { restoreFrom } from "../lib/sync";
import { toast } from "./ui";

/** A backup was found in the cloud and this device has progress too: the learner chooses. */
export function RestoreOrReplace({ found, busy, title, help, restoreLabel, replaceLabel, onRestore, onReplace }: {
  found: BackupCheck; busy: boolean; title: string; help: string; restoreLabel: string; replaceLabel: string; onRestore: () => void; onReplace: () => void;
}) {
  return (
    <div className="feedback info">
      <strong className="title">{title}</strong>
      <table><tbody>{Object.entries(found.summary).map(([k, v]) => <tr key={k}><td>{k}</td><td><b>{v}</b></td></tr>)}</tbody></table>
      <p>{help}</p>
      <div className="stack">
        <button className="btn big primary" disabled={busy} onClick={onRestore}>{restoreLabel}</button>
        <button className="btn big outline" disabled={busy} onClick={onReplace}>{replaceLabel}</button>
      </div>
    </div>
  );
}

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "never");

export function CloudBackup({ onRestored }: { onRestored?: () => void }) {
  const [cfg, setCfg] = useState<CloudConfig | null | undefined>(undefined);
  const [key, setKey] = useState("");
  const [repos, setRepos] = useState<RepoChoice[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<BackupCheck | null>(null);
  const reload = () => getCloud().then((c) => setCfg(c ?? null));
  useEffect(() => { void reload(); }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "No connection to GitHub. Check your internet and try again."); }
    finally { setBusy(false); void reload(); }
  }

  // After connecting: if the repo already has a backup, ask before anything is overwritten.
  const afterConnect = async () => {
    const r = await fetchBackup();
    if (r.ok) setFound(r);
    else if (r.error === "There is no backup in this repo yet.") { await backupNow(); toast("Connected. First backup saved."); }
    else throw new Error(r.error);
  };
  const pick = (repo: RepoChoice) => run(async () => { await connect(key, repo); setRepos(null); setKey(""); await afterConnect(); });
  const onConnect = () => run(async () => {
    const list = await findRepos(key.trim());
    if (!list.length) throw new Error("This key cannot write to any private repo. When making the key, choose “Only select repositories”, pick your private backup repo, and give “Contents: Read and write”.");
    if (list.length === 1) { await connect(key, list[0]); setKey(""); await afterConnect(); }
    else setRepos(list);
  });
  const restore = (check: BackupCheck) => run(async () => {
    await restoreFrom(check);
    setFound(null);
    toast("Progress restored from GitHub. Your previous data was kept as a safety copy.");
    onRestored?.();
  });

  if (cfg === undefined) return null;
  return (
    <div className="card stack">
      <h2>Automatic backup to GitHub</h2>
      {found ? (
        <RestoreOrReplace found={found} busy={busy} title="Your repo already has a backup:" help="Restore it on this device (new phone), or replace it with the progress on this device."
          restoreLabel="Restore it here" replaceLabel="Replace it with this device" onRestore={() => restore(found)}
          onReplace={() => run(async () => { await backupNow(); setFound(null); toast("Backup saved. The old one stays in the repo history."); })} />
      ) : cfg ? (
        <>
          <p>Backing up to your private repo <b>{cfg.repo}</b> once a day, by itself, when you open or leave the app.</p>
          <p className="small muted">Last backup: <b>{when(cfg.last)}</b>. Every backup is kept in the repo history.</p>
          {cfg.lastError && <div className="feedback no" role="alert">Last try failed: {cfg.lastError}</div>}
          <button className="btn big primary" disabled={busy} onClick={() => run(async () => { await backupNow(); toast("Backup saved to GitHub"); })}>{busy ? "Working…" : "Back up now"}</button>
          <button className="btn big outline" disabled={busy} onClick={() => run(async () => { const r = await fetchBackup(); if (r.ok) setFound(r); else throw new Error(r.error); })}>Restore from GitHub</button>
          <button className="btn quiet" disabled={busy} onClick={() => run(async () => { await disconnect(); toast("Disconnected. The key was removed from this device."); })}>Disconnect</button>
        </>
      ) : (
        <>
          <p>Keep your progress safe if you lose or change your phone: the app saves it by itself to <b>your own private</b> GitHub repo, once a day. Nothing goes anywhere else.</p>
          <ol className="steps">
            <li><a href="https://github.com/new" target="_blank" rel="noreferrer">Make a private repo</a> on GitHub (for example <i>fluent365-data</i>). Skip this if you have one.</li>
            <li><a href={NEW_KEY_URL} target="_blank" rel="noreferrer">Get a key</a>: under “Repository access” choose <b>Only select repositories</b> → your private repo; under “Permissions” set <b>Contents: Read and write</b>. Generate and copy it.</li>
            <li>Paste the key here once.</li>
          </ol>
          <label className="field"><span>Key</span>
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="github_pat_…" autoComplete="off" spellCheck={false} />
          </label>
          <button className="btn big primary" disabled={busy || key.trim().length < 20} onClick={onConnect}>{busy ? "Checking…" : "Connect"}</button>
          {repos && (
            <div className="stack" role="radiogroup" aria-label="Choose the backup repo">
              <p>This key can write to several private repos. Which one is for the backup?</p>
              {repos.map((r) => <button key={r.full_name} className="btn big outline" disabled={busy} onClick={() => pick(r)}>{r.full_name}</button>)}
            </div>
          )}
          <p className="small muted">The key stays only on this device and is never in the backup file. Public repos are refused.</p>
        </>
      )}
      {error && <div className="feedback no" role="alert">{error}</div>}
    </div>
  );
}
