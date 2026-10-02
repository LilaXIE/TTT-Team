// 每条规则一句给用户看的人话。{var} 来自 RuleHit.data。
// 这个文件只含字符串与 render()，便于非开发队友（邹思远）修改文案。
import type { RuleId } from "@/contracts/rules";
import type { RuleHit } from "@/contracts/schemas";

export const RULE_MESSAGES: Record<RuleId, string> = {
  // ---- DENY：不能通过确认绕过 ----
  MANDATE_REVOKED: "你已于 {time} 撤销这份授权，Agent 不再付款。",
  MANDATE_EXPIRED: "这份授权已于 {time} 过期。",
  MANDATE_COMPLETED: "本次任务已完成，没有剩余购买次数。",
  BUYER_CREDENTIAL_INVALID: "你的身份凭证状态为「{status}」，暂时不能由 Agent 代付。",
  MERCHANT_CREDENTIAL_INVALID: "商家「{merchant}」的凭证状态为「{status}」，不能向它下单。",
  CATEGORY_NOT_ALLOWED: "「{category}」不在你允许 Agent 购买的品类里。",
  MERCHANT_DENIED: "商家「{merchant}」在你的拒绝名单里。",
  SPEC_NOT_MET: "商品 {reason}，不满足你的要求（{required}）。",
  CAP_PER_TXN: "这笔含运费 {total}，超过你设的单笔上限 {cap}。",
  CAP_TOTAL: "本次授权只剩 {remaining}，不够支付 {total}。",
  USES_EXHAUSTED: "本次授权的购买次数已用完。",
  PAYMENT_METHOD_NOT_ALLOWED: "支付方式「{method}」{reason}。",
  QUOTE_EXPIRED: "报价已于 {time} 过期，需要重新获取价格。",

  // ---- REVIEW：暂停，等你确认 ----
  NEAR_CAP: "这笔 {total} 已达到单笔上限 {cap} 的 {pct}%。",
  SUBSTITUTE_BRAND: "候选是「{brand}」，和你常买的「{preferred}」不是同一个牌子。",
  WATCH_CATEGORY: "「{category}」是你要求先确认的类别{tags}。",
  NEW_MERCHANT: "商家「{merchant}」注册仅 {days} 天。",
  PRICE_ABOVE_REF: "价格 {price} 高于参考价 {ref} 约 {pct}%。",
  INFO_MISSING: "缺少 {fields}，无法自动执行；需要补齐后重新评估。",
};

/** 规则的一句话解释（展示在决策卡、预览卡、记录页） */
export const RULE_TITLES: Record<RuleId, string> = {
  MANDATE_REVOKED: "授权已撤销",
  MANDATE_EXPIRED: "授权已过期",
  MANDATE_COMPLETED: "任务已完成",
  BUYER_CREDENTIAL_INVALID: "买家凭证无效",
  MERCHANT_CREDENTIAL_INVALID: "商家凭证无效",
  CATEGORY_NOT_ALLOWED: "品类不在授权内",
  MERCHANT_DENIED: "商家在拒绝名单",
  SPEC_NOT_MET: "规格不符",
  CAP_PER_TXN: "超过单笔上限",
  CAP_TOTAL: "超过授权总额",
  USES_EXHAUSTED: "次数已用完",
  PAYMENT_METHOD_NOT_ALLOWED: "支付方式不可用",
  QUOTE_EXPIRED: "报价过期",
  NEAR_CAP: "接近单笔上限",
  SUBSTITUTE_BRAND: "换了品牌",
  WATCH_CATEGORY: "高关注类别",
  NEW_MERCHANT: "新商家",
  PRICE_ABOVE_REF: "价格偏高",
  INFO_MISSING: "信息不足",
};

export function render(hit: Pick<RuleHit, "id" | "data">): string {
  const tpl = RULE_MESSAGES[hit.id];
  return tpl.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = hit.data?.[key];
    return v === undefined || v === null ? "" : String(v);
  });
}
