export type WorkStep = { tool: string; outputSummary?: string };

const LABELS: Record<string, { zh: string; en: string }> = {
  extract_intent: { zh: "听懂你的要求", en: "Read your request" },
  engine_INTENT: { zh: "先看授权还在不在", en: "Check the mandate" },
  search_catalog: { zh: "在演示目录里找", en: "Search the demo catalogue" },
  evaluate_candidates: { zh: "按规则逐件判断", en: "Judge each item by the rules" },
  create_cart_version: { zh: "定下这一版购物车", en: "Lock this cart version" },
  switched_candidate: { zh: "换了一件候选", en: "Switched candidate" },
};

export function workStepTitle(tool: string, lang: "zh" | "en"): string {
  return LABELS[tool]?.[lang] ?? tool;
}
