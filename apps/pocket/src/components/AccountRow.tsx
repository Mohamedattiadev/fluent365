// Small pieces of the optional account that stay in the main bundle. The Account screen itself
// (./Account) and @supabase/supabase-js are loaded only when needed.
import { lazy, useEffect, useState } from "react";
import { accountConfig } from "../lib/account";
import { useApp } from "../lib/store";
import type { Lang } from "../lib/types";

export const CONFIG_CHANGED = "fluent365-account-config";
export const AccountScreen = lazy(() => import("./Account").then((m) => ({ default: m.AccountScreen })));
export const OwnSupabase = lazy(() => import("./Account").then((m) => ({ default: m.OwnSupabase })));

const ROW: Record<Lang, [string, string]> = {
  en: ["Account", "Optional: sign in with Google to back up your progress"],
  tr: ["Hesap", "İsteğe bağlı: ilerlemeni yedeklemek için Google ile giriş yap"],
  ar: ["الحساب", "اختياري: سجّل الدخول بحساب Google لحفظ نسخة احتياطية من تقدّمك"],
};

/** The Settings row's text, or null when no Supabase project is configured (row hidden). */
export function useAccountAvailable() {
  const lang = useApp((s) => s.settings.explainLang);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const check = () => void accountConfig().then((c) => setOn(!!c));
    check();
    addEventListener(CONFIG_CHANGED, check);
    return () => removeEventListener(CONFIG_CHANGED, check);
  }, []);
  const [label, hint] = ROW[lang] ?? ROW.en;
  return on ? { label, hint, lang } : null;
}
