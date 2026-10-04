import { describe, expect, it } from "vitest";
import { needsExplicitChoice, payTarget, type ChoiceItem } from "@/lib/purchase-choice";

const detergent: ChoiceItem = { productId: "A-LD-001", outcome: "ALLOW" };
const express: ChoiceItem = { productId: "B-LD-001", outcome: "ALLOW" };
const blocked: ChoiceItem = { productId: "C-LD-001", outcome: "DENY" };
const ask: ChoiceItem = { productId: "D-LD-001", outcome: "REVIEW" };

describe("一次只买一件", () => {
  it("只有一件能买时，付款对象就是这一件", () => {
    expect(payTarget([detergent, blocked], null)?.productId).toBe("A-LD-001");
    expect(needsExplicitChoice([detergent, blocked])).toBe(false);
  });

  it("两件都能买时，不点选就没有付款对象", () => {
    const list = [detergent, express];
    expect(needsExplicitChoice(list)).toBe(true);
    expect(payTarget(list, null)).toBeNull();
  });

  it("点选之后只付那一件，拒绝的选不中", () => {
    const list = [detergent, express, blocked];
    expect(payTarget(list, "B-LD-001")?.productId).toBe("B-LD-001");
    expect(payTarget(list, "C-LD-001")).toBeNull();
    expect(payTarget(list, "missing")).toBeNull();
  });

  it("先问你的也要先点名，不能和另一件一起变成默认付款", () => {
    expect(payTarget([detergent, ask], null)).toBeNull();
    expect(payTarget([detergent, ask], "D-LD-001")?.productId).toBe("D-LD-001");
  });

  it("全部拒绝时不能付款", () => {
    expect(payTarget([blocked], null)).toBeNull();
    expect(needsExplicitChoice([blocked])).toBe(false);
  });
});
