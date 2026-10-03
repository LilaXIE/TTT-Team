"use client";

import { cn } from "cn";
import type { Outcome } from "@/contracts";
import { fmtCountdown, fmtMoney } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { useNow } from "@/lib/mock/store";
import type { MockProduct, Tx } from "@/lib/mock/types";

/** 实心紫色圆点：品牌与 Zev 的唯一图形 */
export function Dot({ className, working }: { className?: string; working?: boolean }) {
  return <span aria-hidden className={cn("inline-block shrink-0 rounded-full bg-violet", working && "animate-pulse-dot", className ?? "size-2.5")} />;
}

export function Logo({ className }: { className?: string }) {
  const { t } = useLang();
  return (
    <span className={cn("inline-flex items-center gap-2 font-heading text-[17px] leading-none tracking-tight", className)}>
      <Dot className="size-3" />
      {t("授权钱包", "Mandate Wallet")}
    </span>
  );
}

export function ZevAvatar({ working, className }: { working?: boolean; className?: string }) {
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-violet-soft", className)}>
      <Dot className="size-3" working={working} />
    </span>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-[11px] font-medium tracking-[0.18em] text-soft uppercase", className)}>{children}</div>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h1 className="font-heading text-[28px] leading-tight sm:text-[34px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ className, children, ...rest }: React.ComponentProps<"section">) {
  return (
    <section className={cn("rounded-[20px] border border-line bg-white p-5 sm:p-6", className)} {...rest}>
      {children}
    </section>
  );
}

export function PanelTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      <h2 className="font-heading text-[19px] leading-snug">{children}</h2>
      {action}
    </div>
  );
}

const OUTCOME_STYLE: Record<Outcome, string> = {
  ALLOW: "bg-ok-soft text-ok",
  REVIEW: "bg-ask-soft text-ask",
  DENY: "bg-no-soft text-no",
};

/** 三种结果只用小标签，不铺大色块 */
export function OutcomeChip({ outcome, mode = "result", className }: { outcome: Outcome; mode?: "result" | "preview"; className?: string }) {
  const { t } = useLang();
  const label =
    mode === "preview"
      ? { ALLOW: t("会自动买", "Will buy"), REVIEW: t("会先问你", "Will ask you"), DENY: t("会被拒绝", "Will decline") }[outcome]
      : { ALLOW: t("直接完成", "Auto-paid"), REVIEW: t("先问你", "Asks you"), DENY: t("拒绝", "Declined") }[outcome];
  return <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium", OUTCOME_STYLE[outcome], className)}>{label}</span>;
}

export function Chip({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "violet" | "ok" | "ask" | "no" | "dark"; className?: string }) {
  const tones = {
    neutral: "bg-canvas text-ink",
    violet: "bg-violet-soft text-violet",
    ok: "bg-ok-soft text-ok",
    ask: "bg-ask-soft text-ask",
    no: "bg-no-soft text-no",
    dark: "bg-white/10 text-white",
  };
  return <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export function Money({ minor, className }: { minor: string | bigint; className?: string }) {
  const { lang } = useLang();
  return <span className={cn("tabular", className)}>{fmtMoney(minor, lang)}</span>;
}

export function Tr({ tx }: { tx: Tx }) {
  return <>{tx[useLang().lang]}</>;
}

/** 剩余时间。服务端不渲染数字，避免水合不一致 */
export function Countdown({ until, className, expiredText }: { until: string; className?: string; expiredText?: string }) {
  const now = useNow(1000);
  const { t } = useLang();
  if (now === null) return <span className={cn("tabular", className)}>--:--</span>;
  const ms = Date.parse(until) - now;
  if (ms <= 0) return <span className={className}>{expiredText ?? t("已过期", "Expired")}</span>;
  return <span className={cn("tabular", className)}>{fmtCountdown(ms)}</span>;
}

/** 原型用色块代替商品图 */
export function ProductThumb({ product, className }: { product: MockProduct; className?: string }) {
  const dark = product.tone.startsWith("#2") || product.tone.startsWith("#3");
  return (
    <div className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-2xl", className ?? "size-16")} style={{ background: product.tone }}>
      <div className={cn("h-[58%] w-[34%] rounded-[10px] border", dark ? "border-white/15 bg-white/10" : "border-black/5 bg-white/70")} />
      <div className={cn("absolute top-[30%] h-[8%] w-[16%] rounded-sm", dark ? "bg-white/20" : "bg-black/10")} />
    </div>
  );
}

export function KeyValue({ k, v, className }: { k: React.ReactNode; v: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-2 text-sm", className)}>
      <span className="text-soft">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}

export function SimNote({ className, children }: { className?: string; children?: React.ReactNode }) {
  const { t } = useLang();
  return <span className={cn("inline-flex items-center rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] text-soft", className)}>{children ?? t("模拟", "Simulated")}</span>;
}
