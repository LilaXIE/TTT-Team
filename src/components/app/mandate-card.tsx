"use client";

import { cn } from "cn";
import Link from "next/link";
import { fmtDate, fmtMoney } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import type { MockMandate } from "@/lib/mock/types";
import { CATEGORY_LABEL } from "@/lib/rule-text";
import { Dot } from "./primitives";

export function useMandateStatusLabel() {
  const { t } = useLang();
  return (s: MockMandate["status"]) =>
    ({ active: t("生效中", "Active"), revoked: t("已撤销", "Revoked"), completed: t("已用完", "Used up"), expired: t("已过期", "Expired") })[s];
}

/** 授权书 = 黑卡。像一张虚拟卡，但写的是边界 */
export function MandateCard({ m, href, compact, className }: { m: MockMandate; href?: string; compact?: boolean; className?: string }) {
  const { t, lang } = useLang();
  const statusLabel = useMandateStatusLabel();
  const inactive = m.status !== "active";
  const body = (
    <div
      className={cn(
        "relative flex flex-col justify-between overflow-hidden rounded-[22px] bg-noir p-5 text-white transition-transform",
        compact ? "min-h-[150px]" : "aspect-[1.62] min-h-[190px]",
        href && "hover:-translate-y-0.5",
        inactive && "opacity-60",
        className,
      )}
    >
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-violet/25 blur-3xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] tracking-[0.18em] text-white/50 uppercase">
            {m.mode === "curated" ? t("精选 · 每笔先问", "Curated · asks every time") : t("授权书", "Mandate")} · v{m.version}
          </div>
          <div className="mt-1.5 truncate font-heading text-xl">{m.title[lang]}</div>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-[11px]", inactive ? "bg-white/10 text-white/70" : "bg-white text-noir")}>{statusLabel(m.status)}</span>
      </div>
      <div className="relative mt-5">
        <div className="text-[11px] text-white/50">{t("剩余额度", "Remaining")}</div>
        <div className="tabular font-heading text-[26px] leading-tight">{fmtMoney(m.remainingMinor, lang)}</div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-white/65">
          <span>
            {t("单笔", "Per order")} ≤ {fmtMoney(m.perTxnMinor, lang)}
          </span>
          <span>
            {t("还可买", "Purchases left")} {m.remainingPurchases}/{m.maxPurchases}
          </span>
          <span>{m.categories.map((c) => CATEGORY_LABEL[c][lang]).join(" · ")}</span>
          {!compact && (
            <span>
              {t("至", "Until")} {fmtDate(m.expiresAt, lang)}
            </span>
          )}
        </div>
      </div>
      <Dot className="absolute right-5 bottom-5 size-3" />
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-[22px] focus-visible:ring-3 focus-visible:ring-violet/30 focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}

/** 剩余额度环：剩余 / 总额 */
export function QuotaRing({ remaining, total, size = 132, children }: { remaining: string; total: string; size?: number; children?: React.ReactNode }) {
  const r = BigInt(remaining);
  const tt = BigInt(total);
  const pct = tt > 0n ? Number((r * 1000n) / tt) / 10 : 0;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const c = 2 * Math.PI * radius;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#ECEBFF" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#5C4DFF"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
