import { describe, expect, it } from "vitest";
import { compileDraft, preview } from "@/server/mandates/service";

const NOW = new Date("2026-10-03T10:00:00+08:00");

const baseDraft = {
  taskText: "帮我补一瓶洗衣液，2L 以上，HK$150 以内，可以换牌子，这周内买到。",
  task: { query: "洗衣液", qty: 1, minSpec: { volumeMl: 2000 }, allowSubstituteBrand: true, preferredBrand: "品牌甲" },
  categories: ["household"],
  merchantDeny: [],
  perTxnHKD: "150",
  totalHKD: "300",
  maxPurchases: 2,
  expiresAt: "2026-10-09T23:59:59+08:00",
  reviewWhen: { nearCapPct: 95, substituteBrand: true, watchCategories: ["supplement"], newMerchantDays: null, priceAboveRefPct: null },
  protectionLevel: "standard",
  allowedMethods: ["fps", "tapngo_mc"],
};

describe("compileDraft", () => {
  it("标准模式：金额转分，加强项为 null", () => {
    const j = compileDraft(baseDraft);
    expect(j.caps).toEqual({ perTxnMinor: "15000", totalMinor: "30000", maxPurchases: 2 });
    expect(j.reviewWhen.newMerchantDays).toBeNull();
    expect(j.reviewWhen.priceAboveRefPct).toBeNull();
  });
  it("加强模式只补两条 REVIEW 条件", () => {
    const j = compileDraft({ ...baseDraft, protectionLevel: "enhanced" });
    expect(j.reviewWhen.newMerchantDays).toBe(30);
    expect(j.reviewWhen.priceAboveRefPct).toBe(20);
    expect(j.caps.perTxnMinor).toBe("15000");
  });
  it("总额小于单笔 → VALIDATION_ERROR", () => {
    expect(() => compileDraft({ ...baseDraft, totalHKD: "100" })).toThrow(/总额/);
  });
});

describe("preview（三张卡）", () => {
  it("默认表单：直接买 / 先问你 / 被拒绝", () => {
    const cards = preview(baseDraft, NOW);
    expect(cards.map((c) => c.scenarioId)).toEqual(["cheap_familiar", "watch_category", "over_cap"]);
    expect(cards[0].decision.outcome).toBe("ALLOW");
    expect(cards[0].totalMinor).toBe("13800");
    expect(cards[1].decision.outcome).toBe("DENY"); // supplement 不在允许品类 household 内 → CATEGORY_NOT_ALLOWED
    expect(cards[2].decision.outcome).toBe("DENY");
    expect(cards[2].decision.rules.map((r) => r.id)).toContain("CAP_PER_TXN");
  });
  it("允许 supplement 品类后，第二张卡变为 REVIEW WATCH_CATEGORY", () => {
    const cards = preview({ ...baseDraft, categories: ["household", "supplement"] }, NOW);
    expect(cards[1].decision.outcome).toBe("REVIEW");
    expect(cards[1].decision.rules.map((r) => r.id)).toEqual(["WATCH_CATEGORY"]);
  });
  it("单笔上限 150 → 160：第三张卡从 DENY 变为 REVIEW（158 是 160 的 98%，接近上限）", () => {
    const cards = preview({ ...baseDraft, perTxnHKD: "160" }, NOW);
    expect(cards[2].decision.outcome).toBe("REVIEW");
    expect(cards[2].decision.rules.map((r) => r.id)).toEqual(["NEAR_CAP"]);
  });
  it("单笔上限 → 170：第三张卡变为直接买", () => {
    const cards = preview({ ...baseDraft, perTxnHKD: "170" }, NOW);
    expect(cards[2].decision.outcome).toBe("ALLOW");
  });
  it("加强模式：第三张卡（新商家 25 天）额外命中 NEW_MERCHANT", () => {
    const cards = preview({ ...baseDraft, perTxnHKD: "170", protectionLevel: "enhanced" }, NOW);
    expect(cards[2].decision.outcome).toBe("REVIEW");
    expect(cards[2].decision.rules.map((r) => r.id)).toEqual(["NEW_MERCHANT"]);
  });
  it("预览不受任务规格影响：维他命 C 不会因为「不满足 2L」被拒", () => {
    const cards = preview({ ...baseDraft, categories: ["household", "supplement"] }, NOW);
    expect(cards[1].decision.rules.map((r) => r.id)).not.toContain("SPEC_NOT_MET");
  });
});
