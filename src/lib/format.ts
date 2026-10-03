// 客户端/服务端共用的展示格式化（不含金额计算；金额计算在 contracts/money）。
import type { Lang } from "./i18n";

function splitMinor(minor: string | bigint): { neg: boolean; whole: string; cents: string } {
  const n = BigInt(minor);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  return {
    neg,
    whole: (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","),
    cents: (abs % 100n).toString().padStart(2, "0"),
  };
}

export function fmtHKD(minor: string | bigint): string {
  const { neg, whole, cents } = splitMinor(minor);
  return `${neg ? "-" : ""}HK$${whole}.${cents}`;
}

/** 中文界面写「162.00 港元」，英文界面写「HK$162.00」 */
export function fmtMoney(minor: string | bigint, lang: Lang): string {
  const { neg, whole, cents } = splitMinor(minor);
  return lang === "zh" ? `${neg ? "-" : ""}${whole}.${cents} 港元` : `${neg ? "-" : ""}HK$${whole}.${cents}`;
}

/** 不带小数的短写，用于滑块刻度等 */
export function fmtMoneyShort(minor: string | bigint, lang: Lang): string {
  const { neg, whole } = splitMinor(minor);
  return lang === "zh" ? `${neg ? "-" : ""}${whole} 港元` : `${neg ? "-" : ""}HK$${whole}`;
}

const TZ = "Asia/Hong_Kong";

export function fmtDateTime(iso: string | Date, lang: Lang = "zh"): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString(lang === "zh" ? "zh-CN" : "en-GB", {
    timeZone: TZ,
    hour12: false,
    month: lang === "zh" ? "numeric" : "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDate(iso: string | Date, lang: Lang = "zh"): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: lang === "zh" ? "numeric" : "short",
    day: "numeric",
  });
}

/** mm:ss；ms ≤ 0 返回 00:00 */
export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  return h > 0 ? `${h}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}` : `${p(Math.floor(s / 60))}:${p(s % 60)}`;
}
