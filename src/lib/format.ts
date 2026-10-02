// 客户端/服务端共用的展示格式化（不含金额计算；金额计算在 contracts/money）。
export function fmtHKD(minor: string | number | bigint): string {
  const n = BigInt(minor);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = (abs % 100n).toString().padStart(2, "0");
  return `${neg ? "-" : ""}HK$${whole}.${cents}`;
}

export function fmtDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function fmtDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("zh-HK", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" });
}

export const OUTCOME_LABEL = { ALLOW: "会直接买", REVIEW: "会先问你", DENY: "会被拒绝" } as const;
export const OUTCOME_STYLE = {
  ALLOW: "border-emerald-200 bg-emerald-50 text-emerald-800",
  REVIEW: "border-amber-200 bg-amber-50 text-amber-800",
  DENY: "border-red-200 bg-red-50 text-red-800",
} as const;
