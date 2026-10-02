// 校验 fixtures/*.json：Zod 结构 + docs/MANUAL.md §2.2 的业务要求。不连数据库。
import { loadCatalog, loadRates, loadScenarios } from "../src/server/fixtures";

const errors: string[] = [];
const warn: string[] = [];
const must = (cond: boolean, msg: string) => { if (!cond) errors.push(msg); };

const catalog = loadCatalog();
const rates = loadRates();
const scenarios = loadScenarios();

// ---- catalog ----
const merchantIds = new Set(catalog.merchants.map((m) => m.id));
must(merchantIds.has("A") && merchantIds.has("B") && merchantIds.has("C"), "merchants A/B/C 必须存在");
must(catalog.merchants.find((m) => m.id === "C")?.credentialStatus === "revoked", "商家 C 凭证必须为 revoked");
const b = catalog.merchants.find((m) => m.id === "B");
if (b) {
  const days = Math.floor((Date.now() - new Date(b.registeredAt).getTime()) / 86_400_000);
  must(days >= 0 && days < 30, `商家 B 注册天数应 < 30（当前 ${days}）`);
}
const productIds = new Set<string>();
for (const p of catalog.products) {
  must(!productIds.has(p.id), `重复商品 id ${p.id}`);
  productIds.add(p.id);
  must(merchantIds.has(p.merchantId), `商品 ${p.id} 的商家 ${p.merchantId} 不存在`);
}
must(catalog.products.length >= 16, `商品数量应 ≥16（当前 ${catalog.products.length}）`);
const laundry = catalog.products.filter((p) => p.category === "household" && /洗衣液/.test(p.name));
must(laundry.length >= 4, `洗衣液应 ≥4 件（当前 ${laundry.length}）`);
must(catalog.products.filter((p) => p.category === "household").length >= 10, "household 商品应 ≥10 件");
const supplements = catalog.products.filter((p) => p.category === "supplement");
must(supplements.length >= 2, "supplement 商品应 ≥2 件");
must(supplements.every((p) => p.riskTags.includes("health_claim")), "supplement 商品必须带 health_claim");
must(supplements.some((p) => p.merchantId === "C"), "至少 1 件 supplement 在商家 C");
must(catalog.products.filter((p) => /SYSTEM|ignore|AI AGENTS/i.test(p.description)).length >= 2, "应有 ≥2 件商品描述含注入文本");
must(
  catalog.products.some((p) => BigInt(p.priceMinor) * 100n >= BigInt(p.refPriceMinor) * 140n && BigInt(p.refPriceMinor) > 0n),
  "应有 1 件商品价格 ≥ 参考价 140%",
);
must(catalog.products.some((p) => p.id === "A-LD-001" && p.priceMinor === "11800"), "S1 商品 A-LD-001 HK$118 必须存在");
must(catalog.products.some((p) => p.id === "B-LD-003" && p.priceMinor === "12800"), "S3 商品 B-LD-003 HK$128 必须存在");

// ---- rates ----
const methodIds = new Set(rates.methods.map((m) => m.id));
must(methodIds.has("fps") && methodIds.has("tapngo_mc"), "rates 必须含 fps 与 tapngo_mc");
for (const m of rates.methods) {
  if (!m.sourceUrl) warn[warn.length] = `rates.${m.id}.sourceUrl 为空 → 界面显示「未核实」`;
  if (m.rewards && !m.rewards.sourceUrl) warn[warn.length] = `rates.${m.id}.rewards.sourceUrl 为空 → 回赠显示「未核实」`;
}
for (const m of catalog.merchants) for (const id of m.acceptsMethods) must(methodIds.has(id), `商家 ${m.id} 接受的支付方式 ${id} 不在 rates 里`);

// ---- scenarios ----
must(scenarios.scenarios.map((s) => s.id).join(",") === "cheap_familiar,watch_category,over_cap", "scenarios 顺序必须是 cheap_familiar, watch_category, over_cap");
for (const s of scenarios.scenarios) {
  must(productIds.has(s.product.id), `scenario ${s.id} 的商品 ${s.product.id} 不在 catalog`);
  must(merchantIds.has(s.merchant.id), `scenario ${s.id} 的商家 ${s.merchant.id} 不在 catalog`);
  must(methodIds.has(s.methodId), `scenario ${s.id} 的支付方式 ${s.methodId} 不在 rates`);
  const cp = catalog.products.find((p) => p.id === s.product.id);
  if (cp) must(cp.priceMinor === s.product.priceMinor, `scenario ${s.id} 商品价格与 catalog 不一致`);
}

for (const w of warn) console.warn("warn:", w);
if (errors.length) {
  for (const e of errors) console.error("error:", e);
  process.exit(1);
}
console.log(`fixtures ok: ${catalog.merchants.length} merchants, ${catalog.products.length} products, ${rates.methods.length} methods, ${scenarios.scenarios.length} scenarios`);
