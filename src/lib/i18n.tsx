"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LANG_COOKIE, type Lang } from "./lang";

export type { Lang };

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** 一屏只出现一种语言：每段文案同时写中英两份，按当前语言取一份 */
  t: (zh: string, en: string) => string;
}

const Ctx = createContext<LangCtx | null>(null);

export function LangProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    setLangState(l);
  }, []);

  const value = useMemo<LangCtx>(
    () => ({ lang, setLang, t: (zh, en) => (lang === "zh" ? zh : en) }),
    [lang, setLang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLang outside LangProvider");
  return v;
}

/** 在 JSX 里直接写 <T zh="…" en="…" /> */
export function T({ zh, en }: { zh: string; en: string }) {
  return <>{useLang().t(zh, en)}</>;
}
