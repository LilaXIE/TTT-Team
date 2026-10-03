import { describe, expect, it } from "vitest";
import { draftFromIntent, parseIntent } from "@/lib/mock/agent";
import { catalogToken } from "@/lib/mock/catalog";
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

  it("does not treat a delivery follow-up as a new product", () => {
    expect(spokenProduct("要今天到").phrase).toBeNull();
    expect(namesSameItem("洗衣液", "要今天到")).toBe(true);
    expect(namesSameItem("camera", "I want to buy a laptop")).toBe(false);
    expect(namesSameItem("水杯", "buy a cup")).toBe(true);
  });
});
