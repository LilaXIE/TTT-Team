import type { Decision, RuleHit } from "@/contracts/schemas";
import { OUTCOME_LABEL, OUTCOME_STYLE } from "@/lib/format";
import { cn } from "cn";

export function OutcomeBadge({ outcome, className }: { outcome: Decision["outcome"]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", OUTCOME_STYLE[outcome], className)}>
      {OUTCOME_LABEL[outcome]}
    </span>
  );
}

export function RuleList({ rules, emptyText = "没有命中任何规则。" }: { rules: RuleHit[]; emptyText?: string }) {
  if (!rules.length) return <p className="text-sm text-zinc-500">{emptyText}</p>;
  return (
    <ul className="space-y-1.5">
      {rules.map((r, i) => (
        <li key={`${r.id}-${i}`} className="flex gap-2 text-sm">
          <span
            className={cn(
              "mt-0.5 inline-block h-fit shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold",
              r.severity === "DENY" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700",
            )}
          >
            {r.id}
          </span>
          <span className="text-zinc-700">{r.message}</span>
        </li>
      ))}
    </ul>
  );
}
