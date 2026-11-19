// The only file that imports @supabase/supabase-js (loaded on demand by ./account).
// The sign-in session is kept in IndexedDB (not localStorage), like all private data, and is
// never part of the backup. Only the public anon key is used; Row Level Security limits every
// request to the signed-in learner's own row.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AccountClient, AccountConfig } from "./account";
import * as db from "./db";
import { checkBackup } from "./portability";

const TABLE = "backups";

const storage = {
  getItem: (k: string) => db.get<string>("kv", `sb:${k}`).then((v) => v ?? null),
  setItem: (k: string, v: string) => db.set("kv", `sb:${k}`, v),
  removeItem: (k: string) => db.del("kv", `sb:${k}`),
};

const clients = new Map<string, SupabaseClient>();
const get = (cfg: AccountConfig) => {
  let c = clients.get(cfg.url + cfg.key);
  if (!c) {
    c = createClient(cfg.url, cfg.key, {
      auth: { flowType: "pkce", detectSessionInUrl: false, persistSession: true, autoRefreshToken: true, storage, storageKey: "fluent365-auth" },
    });
    clients.set(cfg.url + cfg.key, c);
  }
  return c;
};

const fail = (e: { message?: string } | null, what: string) => {
  if (e) throw new Error(`${what}: ${e.message || "the server refused"}.`);
};

export function supa(cfg: AccountConfig): AccountClient {
  const sb = get(cfg);
  const userId = async () => {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error("You are signed out. Sign in again.");
    return id;
  };
  return {
    async signIn(redirectTo) {
      // Gym (same origin) forwards a returning ?code to /gym/ while its own sign-in is pending (index.html); ours wins now.
      try { localStorage.removeItem("gym-pkce"); } catch { /* storage blocked */ }
      const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
      fail(error, "Sign-in could not start");
    },
    async exchange(code) {
      const { data, error } = await sb.auth.exchangeCodeForSession(code);
      fail(error, "Sign-in did not finish");
      return { email: data.user?.email ?? undefined };
    },
    async email() {
      const { data } = await sb.auth.getSession();
      return data.session?.user.email ?? undefined;
    },
    async load() {
      const { data, error } = await sb.from(TABLE).select("data, updated_at").eq("user_id", await userId()).maybeSingle();
      fail(error, "Could not read the backup");
      return data ? checkBackup(JSON.stringify(data.data)) : null;
    },
    async save(backup) {
      const { error } = await sb.from(TABLE).upsert({ user_id: await userId(), data: backup, updated_at: new Date().toISOString() });
      fail(error, "Could not save the backup");
    },
    async remove() {
      const { error } = await sb.from(TABLE).delete().eq("user_id", await userId());
      fail(error, "Could not delete the cloud data");
    },
    async signOut() {
      await sb.auth.signOut({ scope: "local" });
    },
  };
}
