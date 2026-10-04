import { describe, expect, it } from "vitest";
import catalog from "../../fixtures/catalog.json";
import { productsMatching } from "@/lib/mock/catalog";

describe("bilingual catalog names", () => {
  it("keeps Chinese before the slash and English after it", () => {
    expect(catalog.products.every((p) => /^[^/]+ \/ [A-Za-z]/.test(p.name))).toBe(true);
  });

  it("finds a fixture product from the English half", () => {
    const hit = productsMatching("gloves");
    expect(hit.length).toBeGreaterThan(0);
    expect(hit[0].name.zh).toContain("手套");
    expect(hit[0].name.en.toLowerCase()).toContain("gloves");
  });
});
