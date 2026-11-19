// Small pieces of the optional account that stay in the main bundle. The Account screen itself
// (./Account) and @supabase/supabase-js are loaded only when needed.
import { lazy, useEffect, useState } from "react";
import { accountConfig, getAccount } from "../lib/account";
import { useApp } from "../lib/store";
import type { Lang } from "../lib/types";

export const CONFIG_CHANGED = "fluent365-account-config";
export const AccountScreen = lazy(() => import("./Account").then((m) => ({ default: m.AccountScreen })));
export const OwnSupabase = lazy(() => import("./Account").then((m) => ({ default: m.OwnSupabase })));

const ROW: Record<Lang, [string, string, string]> = {
  en: ["Account", "Optional: sign in with Google to back up your progress", "Signed in as"],
  tr: ["Hesap", "İsteğe bağlı: ilerlemeni yedeklemek için Google ile giriş yap", "Giriş yapıldı:"],
  ar: ["الحساب", "اختياري: سجّل الدخول بحساب Google لحفظ نسخة احتياطية من تقدّمك", "تم تسجيل الدخول باسم"],
};

/** The Settings row's text, or null when no Supabase project is configured (row hidden). */
export function useAccountAvailable() {
  const lang = useApp((s) => s.settings.explainLang);
  const [on, setOn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    const check = () => {
      void accountConfig().then((c) => setOn(!!c));
      void getAccount().then((a) => setEmail(a.on && a.email ? a.email : null));
    };
    check();
    addEventListener(CONFIG_CHANGED, check);
    return () => removeEventListener(CONFIG_CHANGED, check);
  }, []);
  const [label, optional, signedIn] = ROW[lang] ?? ROW.en;
  const hint = email ? `${signedIn} ${email}` : optional;
  return on ? { label, hint, lang } : null;
}
