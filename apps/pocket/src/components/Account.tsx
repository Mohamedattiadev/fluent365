// Settings → Account: optional Sign in with Google + backup to the learner's own Supabase row.
// Hidden when no Supabase project is configured (build Variables or "Use my own Supabase").
import { useEffect, useState, type ReactNode } from "react";
import {
  accountBackupNow, accountConfig, accountRestore, currentEmail, deleteCloudData, fetchAccountBackup, getAccount, getOwnConfig,
  NO_BACKUP, setOwnConfig, signIn, signOut, type AccountState,
} from "../lib/account";
import { accountText } from "../lib/accountText";
import type { BackupCheck } from "../lib/portability";
import { useApp } from "../lib/store";
import { navigate } from "../router";
import { RestoreOrReplace } from "./Cloud";
import { toast } from "./ui";

import { CONFIG_CHANGED } from "./AccountRow";

export function AccountScreen({ back }: { back: ReactNode }) {
  const lang = useApp((s) => s.settings.explainLang);
  const t = accountText(lang);
  const [a, setA] = useState<AccountState | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<BackupCheck | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(lang === "en" ? undefined : lang, { dateStyle: "medium", timeStyle: "short" }) : t.never);

  const reload = async () => {
    if (!(await accountConfig())) return navigate("/settings");
    const st = await getAccount();
    setA(st);
    setEmail(await currentEmail());
    if (st.ask) { const r = await fetchAccountBackup(); if (r.ok) setFound(r); }
  };
  useEffect(() => { void reload(); }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); void reload(); }
  }

  if (!a) return <div>{back}</div>;
  const signedIn = !!a.on;
  return (
    <div>
      {back}
      <h1>{t.account}</h1>
      <div className="card stack" dir={lang === "ar" ? "rtl" : undefined} lang={lang}>
        {found ? (
          <RestoreOrReplace found={found} busy={busy} title={t.found} help={t.foundHelp} restoreLabel={t.restoreHere} replaceLabel={t.replace}
            onRestore={() => run(async () => { await accountRestore(found); setFound(null); toast(t.restored); navigate("/"); })}
            onReplace={() => run(async () => { await accountBackupNow(); setFound(null); toast(t.replaced); })} />
        ) : signedIn ? (
          <>
            <p>{t.signedInAs} <b dir="ltr">{email ?? a.email ?? "—"}</b></p>
            <p className="small muted">{t.last}: <b>{when(a.last)}</b></p>
            {a.lastError && <div className="feedback no" role="alert">{t.failed}: {a.lastError}</div>}
            <button className="btn big primary" disabled={busy} onClick={() => run(async () => { await accountBackupNow(); toast(t.saved); })}>{busy ? t.working : t.backupNow}</button>
            <button className="btn big outline" disabled={busy} onClick={() => run(async () => { const r = await fetchAccountBackup(); if (r.ok) setFound(r); else throw new Error(r.error === NO_BACKUP ? NO_BACKUP : r.error); })}>{t.restoreFromAccount}</button>
            <button className="btn big outline" disabled={busy} onClick={() => run(async () => { await signOut(); toast(t.signedOut); })}>{t.signOut}</button>
            {confirmDel === null ? (
              <button className="btn quiet" disabled={busy} onClick={() => setConfirmDel("")}>{t.del}</button>
            ) : (
              <div className="stack">
                <label className="field"><span>{t.delConfirm}</span>
                  <input type="text" value={confirmDel} onChange={(e) => setConfirmDel(e.target.value)} autoComplete="off" spellCheck={false} dir="ltr" />
                </label>
                <button className="btn big danger" disabled={busy || confirmDel !== "DELETE"} onClick={() => run(async () => { await deleteCloudData(); setConfirmDel(null); toast(t.deleted); })}>{t.del}</button>
              </div>
            )}
          </>
        ) : (
          <>
            <p>{t.intro}</p>
            {a.lastError && <div className="feedback no" role="alert">{t.failed}: {a.lastError}</div>}
            <button className="btn big primary" disabled={busy} onClick={() => run(signIn)}>{busy ? t.opening : t.signIn}</button>
          </>
        )}
        <p className="small muted">{t.privacy}</p>
        {error && <div className="feedback no" role="alert">{error}</div>}
      </div>
    </div>
  );
}

/** "Use my own Supabase": for people who run their own copy without build Variables. */
export function OwnSupabase() {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void getOwnConfig().then((c) => { if (c) { setUrl(c.url); setKey(c.key); setSaved(true); } }); }, []);
  const changed = () => dispatchEvent(new Event(CONFIG_CHANGED));
  return (
    <details className="card">
      <summary><h2 style={{ display: "inline" }}>Use my own Supabase</h2></summary>
      <div className="stack" style={{ marginTop: 12 }}>
        <p className="small">Advanced. If you made your own Supabase project (see <i>docs/SUPABASE_SETUP.md</i>), enter its URL and its <b>anon public</b> key. Then Settings shows <b>Account</b> with Sign in with Google. Never enter a service key.</p>
        <label className="field"><span>Project URL</span>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoComplete="off" spellCheck={false} />
        </label>
        <label className="field"><span>Anon public key</span>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
        </label>
        <button className="btn big primary" onClick={async () => {
          setError(null);
          try { await setOwnConfig({ url, key }); setSaved(true); changed(); toast("Saved. Account is now in Settings."); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
        }}>Save</button>
        {saved && <button className="btn quiet" onClick={async () => { await setOwnConfig(null); setUrl(""); setKey(""); setSaved(false); changed(); toast("Removed. The app's own setting is used again."); }}>Remove my Supabase</button>}
        {error && <div className="feedback no" role="alert">{error}</div>}
      </div>
    </details>
  );
}
