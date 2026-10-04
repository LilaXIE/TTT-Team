import { describe, expect, it } from "vitest";
import { draftFromIntent, parseIntent, readAmendment } from "@/lib/mock/agent";
import { catalogToken, productOf } from "@/lib/mock/catalog";
import { evaluate } from "@/lib/mock/evaluate";
import { extractIntentFallback } from "@/server/agent/fallback";
import { groundedQuery, namesSameItem, spokenProduct } from "@/lib/spoken-product";

describe("spoken product stays on the user's words", () => {
  it("does not turn camera into a cup", () => {
    const spoken = spokenProduct("I want to buy a camera");
    expect(spoken.phrase).toBe("camera");
    expect(spoken.catalog).toBeNull();
    expect(spoken.zh).toBe("camera");
    expect(catalogToken("I want to buy a camera")).toBe("camera");
    const intent = parseIntent("I want to buy a camera");
    expect(intent.kind).toBe("unknown");
    expect(intent.token).toBe("camera");
    expect(draftFromIntent(intent).title).toEqual({ zh: "camera", en: "camera" });
    expect(draftFromIntent(intent).query.en).toBe("camera");
    expect(extractIntentFallback("I want to buy a camera").query).toBe("camera");
    expect(groundedQuery("I want to buy a camera", "水杯")).toBe("camera");
  });

  it("keeps other English items on their own names", () => {
    for (const word of ["laptop", "headphones", "keyboard", "backpack"]) {
      const text = `I want to buy a ${word}`;
      expect(spokenProduct(text).phrase).toBe(word);
      expect(spokenProduct(text).catalog).toBeNull();
      expect(parseIntent(text).token).toBe(word);
      expect(groundedQuery(text, "水杯")).toBe(word);
    }
  });

  it("maps an actual cup, and not words that merely contain those letters", () => {
    expect(spokenProduct("buy a cup").catalog).toBe("水杯");
    expect(spokenProduct("buy a cup").en).toBe("cup");
    expect(spokenProduct("帮我买水杯").zh).toBe("水杯");
    expect(spokenProduct("帮我买一个杯子").catalog).toBe("水杯");
    expect(spokenProduct("I want a cupboard").phrase).toBe("cupboard");
    expect(spokenProduct("I want a cupboard").catalog).toBeNull();
    expect(spokenProduct("camera").catalog).toBeNull();
  });

  it("keeps the scripted demos and dish soap", () => {
    expect(parseIntent("帮我补一瓶洗衣液，2L 以上，HK$150 以内").kind).toBe("detergent");
    expect(parseIntent("Buy another pack of tissue.").kind).toBe("tissue");
    expect(parseIntent("Help me carefully pick a black, minimal tumbler.").kind).toBe("tumbler");
    expect(parseIntent("Help me carefully pick a black, minimal tumbler.").curated).toBe(true);
    expect(parseIntent("帮我买一瓶洗洁精").token).toBe("洗洁精");
    expect(parseIntent("Buy a bottle of dish soap.").label).toEqual({ zh: "洗洁精", en: "dish soap" });
    expect(extractIntentFallback("帮我补一瓶洗衣液，2L 以上，150 以内").query).toBe("洗衣液");
  });

  it("keeps shipping out of an item-price cap", () => {
    const text = "帮我买一瓶至少2L的洗衣液，商品价格118港元以内就行，运费另算，直接买。";
    const intent = parseIntent(text);
    expect(intent.kind).toBe("detergent");
    expect(intent.minVolumeMl).toBe(2000);
    expect(intent.itemPriceCapMinor).toBe("11800");
    expect(intent.perTxnMinor).toBe("14800");
    const draft = draftFromIntent(intent);
    expect(draft.itemPriceCapMinor).toBe("11800");
    expect(draft.perTxnMinor).toBe("14800");
    expect(BigInt(draft.totalMinor)).toBe(29600n);
    const priced = evaluate(
      {
        id: "draft",
        version: 1,
        status: "active",
        expiresAt: "2026-12-01T00:00:00+08:00",
        revokedAt: null,
        categories: ["household"],
        perTxnMinor: draft.perTxnMinor,
        totalMinor: draft.totalMinor,
        remainingMinor: draft.totalMinor,
        maxPurchases: draft.maxPurchases,
        remainingPurchases: draft.maxPurchases,
        reviewWhen: draft.reviewWhen,
        methods: draft.methods,
        preferredBrand: draft.preferredBrand,
        allowSubstituteBrand: draft.allowSubstituteBrand,
        minVolumeMl: draft.minVolumeMl,
      },
      productOf("p_a_jia_2l"),
      { now: new Date("2026-10-04T01:00:00+08:00") },
    );
    expect(priced.subtotal).toBe(11800n);
    expect(priced.shipping).toBe(2000n);
    expect(priced.outcome).not.toBe("DENY");
  });

  it("reads a purchase-count change as an amendment", () => {
    expect(readAmendment("改成最多可以买3次")).toEqual({ maxPurchases: 3 });
    expect(readAmendment("帮我买一瓶洗衣液")).toBeNull();
  });

  it("does not treat a delivery follow-up as a new product", () => {
    expect(spokenProduct("要今天到").phrase).toBeNull();
    expect(namesSameItem("洗衣液", "要今天到")).toBe(true);
    expect(namesSameItem("camera", "I want to buy a laptop")).toBe(false);
    expect(namesSameItem("水杯", "buy a cup")).toBe(true);
  });
});
