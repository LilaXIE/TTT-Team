// 一次只买一件时，付款对象必须唯一且已经点名。多件都符合就不能悄悄扣其中一件。

export type ChoiceOutcome = "ALLOW" | "REVIEW" | "DENY";

export interface ChoiceItem {
  productId: string;
  outcome: ChoiceOutcome;
}

/** 拒绝的不能买。其余都算「可以成为这一单」，多于一件就必须由用户点选。 */
export function payTarget<T extends ChoiceItem>(candidates: T[], chosenId: string | null): T | null {
  const payable = candidates.filter((c) => c.outcome !== "DENY");
  if (payable.length === 0) return null;
  if (payable.length === 1) return payable[0];
  if (!chosenId) return null;
  return payable.find((c) => c.productId === chosenId) ?? null;
}

export function needsExplicitChoice(candidates: ChoiceItem[]): boolean {
  return candidates.filter((c) => c.outcome !== "DENY").length > 1;
}
