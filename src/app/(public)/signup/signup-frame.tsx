"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/i18n";

const STEPS = [
  { href: "/signup", zh: "手机号", en: "Phone" },
  { href: "/signup/passkey", zh: "通行密钥", en: "Passkey" },
  { href: "/signup/wallet", zh: "连接钱包", en: "Wallet" },
  { href: "/signup/age", zh: "年龄", en: "Age" },
  { href: "/signup/done", zh: "完成", en: "Done" },
];

export function SignupFrame({ children }: { children: React.ReactNode }) {
  const { t, lang } = useLang();
  const path = usePathname();
  const current = Math.max(
    0,
    STEPS.findIndex((s) => s.href === path),
  );
  return (
    <div className="mx-auto w-full max-w-[520px] flex-1 px-5 py-8 sm:py-12">
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between text-[12px] text-soft">
          <span>
            {t(`第 ${current + 1} 步，共 ${STEPS.length} 步`, `Step ${current + 1} of ${STEPS.length}`)} · {t("大约 1 分钟", "about a minute")}
          </span>
          <Link href="/login" className="hover:text-ink">
            {t("已有账号", "I have an account")}
          </Link>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s.href}>
              <div className={cn("h-1.5 rounded-full transition-colors", i <= current ? "bg-violet" : "bg-violet/15")} />
              <div className={cn("mt-1.5 hidden text-[11px] sm:block", i === current ? "text-ink" : "text-soft")}>{s[lang]}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_24px_60px_-30px_rgba(28,27,31,0.25)] backdrop-blur-xl sm:p-8">{children}</div>
    </div>
  );
}

export function StepTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-heading text-[28px] leading-tight">{title}</h1>
      {sub && <p className="mt-2 text-[14px] leading-relaxed text-soft">{sub}</p>}
    </div>
  );
}

/** 6 位数字输入，自动跳到下一格 */
export function CodeBoxes({ value, onChange, masked, autoFocus }: { value: string; onChange: (v: string) => void; masked?: boolean; autoFocus?: boolean }) {
  const cells = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  return (
    <div className="flex justify-between gap-2">
      {cells.map((c, i) => (
        <input
          key={i}
          id={`code-${i}`}
          value={c}
          autoFocus={autoFocus && i === 0}
          inputMode="numeric"
          type={masked ? "password" : "text"}
          maxLength={6}
          aria-label={`${i + 1}`}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            if (!digits) {
              onChange(value.slice(0, i));
              return;
            }
            const next = (value.slice(0, i) + digits).slice(0, 6);
            onChange(next);
            document.getElementById(`code-${Math.min(next.length, 5)}`)?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !c && i > 0) {
              onChange(value.slice(0, i - 1));
              document.getElementById(`code-${i - 1}`)?.focus();
            }
          }}
          className="h-14 w-full min-w-0 rounded-2xl border border-line bg-white text-center font-heading text-[22px] tabular outline-none focus:border-violet focus:ring-3 focus:ring-violet/15"
        />
      ))}
    </div>
  );
}
