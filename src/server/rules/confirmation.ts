// 人工确认是否覆盖一次 REVIEW 决策。规格：docs/MANUAL.md §5.2、§6.2。
import { BLOCKING_REVIEW_RULES } from "@/contracts/rules";
import type { ConfirmationRecord, Decision } from "@/contracts/schemas";

export const CONFIRMATION_TTL_MS = 30 * 60 * 1000;

export type CoverageResult =
  | { covered: true }
  | { covered: false; reason: "NO_CONFIRMATION" | "VERSION_MISMATCH" | "EXPIRED" | "RULES_NOT_COVERED" | "BLOCKING_RULE" | "DENY" };

export function isCovered(
  decision: Decision,
  confirmation: ConfirmationRecord | null | undefined,
  cartVersion: number,
  now: Date,
): CoverageResult {
  if (decision.outcome === "DENY") return { covered: false, reason: "DENY" };
  if (decision.outcome === "ALLOW") return { covered: true };

  const reviewHits = decision.rules.filter((r) => r.severity === "REVIEW");
  if (reviewHits.some((r) => (BLOCKING_REVIEW_RULES as readonly string[]).includes(r.id) || r.data?.blocking === true))
    return { covered: false, reason: "BLOCKING_RULE" };
  if (!confirmation) return { covered: false, reason: "NO_CONFIRMATION" };
  if (confirmation.cartVersion !== cartVersion) return { covered: false, reason: "VERSION_MISMATCH" };
  if (now.getTime() >= confirmation.expiresAt.getTime()) return { covered: false, reason: "EXPIRED" };

  const confirmed = new Set(confirmation.ruleIds);
  if (!reviewHits.every((r) => confirmed.has(r.id))) return { covered: false, reason: "RULES_NOT_COVERED" };
  return { covered: true };
}
