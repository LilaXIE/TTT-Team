/** 从用户原话里认商品。只认原话里的词和下面这张对照表，不接受模型另起的商品名。 */

export type ScriptedKind = "detergent" | "tissue" | "tumbler";

export type SpokenProduct = {
  /** 用户说出的商品，找不到则为 null */
  phrase: string | null;
  zh: string;
  en: string;
  /** 演示目录里的检索词。没有对照、目录里也没有时为 null */
  catalog: string | null;
  scripted: ScriptedKind | null;
};

const ALIASES: Array<{ re: RegExp; zh: string; en: string; catalog: string; scripted: ScriptedKind | null }> = [
  { re: /洗衣液|laundry(?:\s+liquid)?|\bdetergents?\b/i, zh: "洗衣液", en: "laundry liquid", catalog: "洗衣液", scripted: "detergent" },
  { re: /抽纸|纸巾|\btissues?\b|\bpaper\s+towels?\b/i, zh: "纸巾", en: "tissue", catalog: "纸巾", scripted: "tissue" },
  { re: /保温杯|\btumblers?\b|\bthermos\b/i, zh: "保温杯", en: "tumbler", catalog: "保温杯", scripted: "tumbler" },
  { re: /洗洁精|dish\s*soaps?/i, zh: "洗洁精", en: "dish soap", catalog: "洗洁精", scripted: null },
  { re: /牙膏|\btoothpastes?\b/i, zh: "牙膏", en: "toothpaste", catalog: "牙膏", scripted: null },
  { re: /牙刷|\btoothbrushes?\b/i, zh: "牙刷", en: "toothbrush", catalog: "牙刷", scripted: null },
  { re: /维生素|维他命|\bvitamins?\b/i, zh: "维生素", en: "vitamin", catalog: "维他命", scripted: null },
  { re: /垃圾袋|trash\s*bags?|garbage\s*bags?/i, zh: "垃圾袋", en: "trash bag", catalog: "垃圾袋", scripted: null },
  { re: /洗发水|洗发露|\bshampoos?\b/i, zh: "洗发水", en: "shampoo", catalog: "洗发水", scripted: null },
  { re: /沐浴露|\bbody\s*wash\b/i, zh: "沐浴露", en: "body wash", catalog: "沐浴露", scripted: null },
  { re: /水杯|杯子|(?<![a-z])cups?(?![a-z])/i, zh: "水杯", en: "cup", catalog: "水杯", scripted: null },
];

const EN_STOP = new Set([
  "the", "and", "for", "with", "under", "within", "this", "that", "week", "today", "tomorrow",
  "want", "need", "buy", "get", "order", "please", "help", "some", "more", "than", "from",
  "black", "white", "cheap", "carefully", "restock", "another", "bottle", "pack", "arrive",
  "arrives", "arrival", "hkd", "dollar", "dollars", "cap", "each", "any", "brand", "other",
  "fine", "above", "least",
]);

function englishNoun(text: string): string | null {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !EN_STOP.has(w));
  return words.at(-1) ?? null;
}

function chineseNoun(text: string): string | null {
  const han = text.replace(/[^\u4e00-\u9fff]/g, "");
  const core = han
    .replace(/^(请|帮我|给我|我想|想要|要|买|补|再买|再|一瓶|一件|一个|一盒|一包|一箱)+/, "")
    .replace(/今天|今日|明天|次日|这周|以内|以上|便宜|细挑|精选|可以|换牌子|换个牌子|别的牌子|一点|一些|一下|黑色|白色|极简|大瓶|小瓶|吗|吧|的话|到货|送到|买到|到/g, "");
  if (core.length < 2) return null;
  return core.slice(0, 12);
}

export function spokenProduct(text: string): SpokenProduct {
  const alias = ALIASES.find((item) => item.re.test(text));
  if (alias) {
    return { phrase: alias.zh, zh: alias.zh, en: alias.en, catalog: alias.catalog, scripted: alias.scripted };
  }
  const en = englishNoun(text);
  if (en) return { phrase: en, zh: en, en, catalog: null, scripted: null };
  const zh = chineseNoun(text);
  if (zh) return { phrase: zh, zh, en: zh, catalog: null, scripted: null };
  return { phrase: null, zh: "", en: "", catalog: null, scripted: null };
}

/** 模型给出的 query 必须是用户原话里的连续片段，否则丢掉。 */
export function groundedQuery(message: string, query: string): string {
  const q = query.trim();
  if (q && message.toLowerCase().includes(q.toLowerCase())) return q;
  return spokenProduct(message).catalog ?? spokenProduct(message).phrase ?? "";
}

/** 这句话没有点名另一件商品，追问就留在当前这单。 */
export function namesSameItem(item: string, text: string): boolean {
  const spoken = spokenProduct(text);
  if (!spoken.phrase) return true;
  const keys = [spoken.phrase, spoken.zh, spoken.en, spoken.catalog ?? ""].filter(Boolean);
  if (keys.includes(item)) return true;
  if (spoken.scripted === "detergent" && (item === "洗衣液" || item === "Laundry liquid")) return true;
  if (spoken.scripted === "tissue" && (item === "纸巾" || item === "Tissue" || item === "抽纸")) return true;
  if (spoken.scripted === "tumbler" && (item === "保温杯" || item === "Tumbler")) return true;
  return false;
}

export function replyMentionsProduct(message: string, reply: string): boolean {
  const spoken = spokenProduct(message);
  if (!spoken.phrase) return true;
  const folded = reply.toLowerCase();
  return folded.includes(spoken.phrase.toLowerCase()) || reply.includes(spoken.zh) || folded.includes(spoken.en.toLowerCase());
}

/** 模型回复换了商品时，改回用户原话。 */
export function productReply(message: string): string {
  const spoken = spokenProduct(message);
  const english = /[a-z]/i.test(message);
  const name = (english ? spoken.en : spoken.zh) || spoken.phrase || message.trim();
  return english
    ? `You asked for ${name}. I'll search only for that, and I won't switch it to another product.`
    : `要买的是「${name}」。只按这个词找，不会换成别的商品。`;
}
