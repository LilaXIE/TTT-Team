// Agent fallback：规则意图抽取与解释。不使用 LLM。规格：docs/MANUAL.md §6.1。
import { spokenProduct } from "@/lib/spoken-product";
export interface ExtractedIntent {
  query: string;
  qty: number;
  minSpec: Record<string, number>;
  maxPriceMinor: bigint | null;
}

const STOP_WORDS = new Set([
  "帮我",
  "请",
  "给我",
  "买",
  "补",
  "一瓶",
  "一件",
  "一个",
  "一盒",
  "一包",
  "一箱",
]);

/**
 * fallback 意图提取：关键词 + 数量 + 规格 + 价格上限。
 * 示例："帮我补一瓶洗衣液，2L 以上，150 以内"
 * → { query: "洗衣液", qty: 1, minSpec: { volumeMl: 2000 }, maxPriceMinor: 15000n }
 */
export function extractIntentFallback(text: string): ExtractedIntent {
  const cleaned = text.trim();
  let query = cleaned;
  let qty = 1;
  const minSpec: Record<string, number> = {};
  let maxPriceMinor: bigint | null = null;

  // 只认用户原话里的商品。对不上目录时保留原词，不换成水杯或其他商品。
  const spoken = spokenProduct(cleaned);
  if (spoken.catalog || spoken.phrase) {
    query = spoken.catalog ?? spoken.phrase ?? cleaned;
  } else {
    const normalized = cleaned
      .replace(/帮我|请|给我|补|购买|买|一瓶|一件|一个|一盒|一包|一箱/g, " ")
      .trim();
    const englishStop = new Set(["a", "an", "the", "buy", "get", "me", "my", "another", "pack", "bottle", "of", "under", "within", "this", "week", "help", "carefully", "pick"]);
    const words = normalized.split(/[\s,，、.]+/).filter((word) => word && !STOP_WORDS.has(word) && !englishStop.has(word.toLowerCase()) && word.length > 1);
    if (words.length > 0) query = words[0];
  }

  // 数量："2 瓶"、"三个"
  const qtyMatch = cleaned.match(/(\d+|一|二|三|四|五|六|七|八|九|十)\s*(瓶|件|个|盒|包|箱)/);
  if (qtyMatch) {
    const numStr = qtyMatch[1];
    if (/^\d+$/.test(numStr)) {
      qty = parseInt(numStr, 10);
    } else {
      const cn: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
      qty = cn[numStr] ?? 1;
    }
  }

  // 规格："2L 以上"、"2000ml"、"≥2L"
  const volumeMatch =
    cleaned.match(/(\d+(?:\.\d+)?)\s*[Ll]\s*以上/) ||
    cleaned.match(/≥\s*(\d+(?:\.\d+)?)\s*[Ll]/) ||
    cleaned.match(/(\d+(?:\.\d+)?)\s*[Ll](?![以上])/);
  if (volumeMatch) {
    const liters = parseFloat(volumeMatch[1]);
    minSpec.volumeMl = Math.floor(liters * 1000);
  }

  const mlMatch =
    cleaned.match(/(\d+)\s*ml\s*以上/) ||
    cleaned.match(/≥\s*(\d+)\s*ml/) ||
    cleaned.match(/(\d+)\s*ml(?![以上])/);
  if (mlMatch) {
    minSpec.volumeMl = parseInt(mlMatch[1], 10);
  }

  // 价格上限："150 以内"、"≤150"
  const priceMatch = cleaned.match(/(\d+)\s*以内/) || cleaned.match(/≤\s*(\d+)/) || cleaned.match(/(?:under|below|cap(?:ped)? at)\s*(?:hk\$)?\s*(\d+)/i) || cleaned.match(/hk\$\s*(\d+)/i);
  if (priceMatch) {
    maxPriceMinor = BigInt(parseInt(priceMatch[1], 10)) * 100n;
  }

  return { query, qty, minSpec, maxPriceMinor };
}

/**
 * fallback 候选解释：模板。
 */
export function explainFallback(
  candidate: {
    name: string;
    brand: string;
    priceMinor: bigint;
    shippingMinor: bigint;
    totalMinor: bigint;
    deliveryDays: number;
    merchantName: string;
  },
): string {
  const totalHKD = (candidate.totalMinor / 100n).toString();
  return `推荐 ${candidate.merchantName} 的 ${candidate.brand} ${candidate.name}，含运费 HK$${totalHKD}，${candidate.deliveryDays} 天送达。`;
}
