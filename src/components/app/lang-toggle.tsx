"use client";

import { cn } from "cn";
import { useLang, type Lang } from "@/lib/i18n";

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  const item = (l: Lang, label: string) => (
    <button
      type="button"
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      className={cn(
        "h-7 rounded-full px-3 text-xs font-medium transition-colors",
        lang === l ? "bg-white text-ink shadow-[0_1px_2px_rgba(28,27,31,0.08)]" : "text-soft hover:text-ink",
      )}
    >
      {label}
    </button>
  );
  return (
    <div className={cn("inline-flex items-center rounded-full bg-[#ebe8f2] p-0.5", className)} role="group" aria-label="Language">
      {item("zh", "中文")}
      {item("en", "EN")}
    </div>
  );
}
