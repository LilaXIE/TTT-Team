// 稳定 rule_id。严格对应 docs/MANUAL.md §5.2，不增不减。

export const DENY_RULES = [
  "MANDATE_REVOKED",
  "MANDATE_EXPIRED",
  "MANDATE_COMPLETED",
  "BUYER_CREDENTIAL_INVALID",
  "MERCHANT_CREDENTIAL_INVALID",
  "CATEGORY_NOT_ALLOWED",
  "MERCHANT_DENIED",
  "SPEC_NOT_MET",
  "CAP_PER_TXN",
  "CAP_TOTAL",
  "USES_EXHAUSTED",
  "PAYMENT_METHOD_NOT_ALLOWED",
  "QUOTE_EXPIRED",
] as const;

export const REVIEW_RULES = [
  "NEAR_CAP",
  "SUBSTITUTE_BRAND",
  "WATCH_CATEGORY",
  "NEW_MERCHANT",
  "PRICE_ABOVE_REF",
  "INFO_MISSING",
] as const;

export type DenyRuleId = (typeof DENY_RULES)[number];
export type ReviewRuleId = (typeof REVIEW_RULES)[number];
export type RuleId = DenyRuleId | ReviewRuleId;

export const ALL_RULES: readonly RuleId[] = [...DENY_RULES, ...REVIEW_RULES];

export function isDenyRule(id: RuleId): id is DenyRuleId {
  return (DENY_RULES as readonly string[]).includes(id);
}

/** 命中后即使用户确认也不能放行的 REVIEW 规则 */
export const BLOCKING_REVIEW_RULES: readonly ReviewRuleId[] = ["INFO_MISSING"];
