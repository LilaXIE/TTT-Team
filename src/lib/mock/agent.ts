"use client";

// 原型里的 Zev：确定性的「规则演示模式」，不调用任何模型。
// 它只负责起草、搜索、排序、解释；能不能付款永远由 evaluate()（真实引擎）和模拟结算决定。
// 接真实数据时，这里的每一步对应 POST /api/tasks 与 /api/tasks/:id/* 的服务端流程。
import { hkdToMinor } from "@/contracts/money";
import { fmtMoney } from "@/lib/format";
import { catalogToken, isScriptedQuery, merchantOf, productOf, productsMatching } from "./catalog";
import { candidatesFor, evaluate, scoreAll, type Scored } from "./evaluate";
import { actions, getState } from "./store";
import type { Block, Category, Delivery, DraftFields, MockMandate, QueryKind, TimelineStep, Tx } from "./types";

export const AUTO_PAY_MS = 8000;

export interface Intent {
  kind: QueryKind | "unknown";
  /** 目录里的商品词。不是洗衣液 / 纸巾 / 保温杯这三条演示脚本时才有 */
  token: string | null;
  curated: boolean;
  perTxnMinor: string | null;
  minVolumeMl: number | null;
  allowSubstitute: boolean;
}

export interface Filters {
  maxMinor: string;
  delivery: Delivery[];
  brands: string[];
}

const nowIso = () => new Date().toISOString();
const later = (ms: number, fn: () => void) => setTimeout(fn, ms);

export function parseIntent(text: string): Intent {
  const token = catalogToken(text);
  const kind: Intent["kind"] = token && isScriptedQuery(token)
    ? token === "洗衣液"
      ? "detergent"
      : token === "保温杯"
        ? "tumbler"
        : "tissue"
    : token
      ? "unknown"
      : /洗衣液|洗衣|laundry|detergent/i.test(text)
        ? "detergent"
        : /纸巾|纸|tissue/i.test(text)
          ? "tissue"
          : /保温杯|杯|tumbler|cup|bottle/i.test(text)
            ? "tumbler"
            : "unknown";
  const money = text.match(/HK\$\s?(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:港元|港币|块|元|dollars?|HKD)/i);
  const amount = money ? (money[1] ?? money[2]) : null;
  const vol = text.match(/(\d+(?:\.\d+)?)\s*L\b/i);
  return {
    kind,
    token: token && !isScriptedQuery(token) ? token : null,
    curated: /细挑|精选|慢慢挑|carefully|curat/i.test(text) || kind === "tumbler",
    perTxnMinor: amount ? hkdToMinor(amount).toString() : null,
    minVolumeMl: vol ? Math.round(Number.parseFloat(vol[1]) * 1000) : null,
    allowSubstitute: /换牌子|换个牌子|别的牌子|any brand|other brand|different brand|switch brand/i.test(text),
  };
}

const TITLES: Record<QueryKind, { quick: Tx; curated: Tx; query: Tx; categories: Category[] }> = {
  detergent: { quick: { zh: "洗衣液补货", en: "Laundry restock" }, curated: { zh: "精选 · 洗衣液", en: "Curated · Laundry" }, query: { zh: "洗衣液", en: "Laundry liquid" }, categories: ["household"] },
  tissue: { quick: { zh: "纸巾补货", en: "Tissue restock" }, curated: { zh: "精选 · 纸巾", en: "Curated · Tissue" }, query: { zh: "纸巾", en: "Tissue" }, categories: ["household"] },
  tumbler: { quick: { zh: "保温杯", en: "Tumbler" }, curated: { zh: "精选 · 保温杯", en: "Curated · Tumbler" }, query: { zh: "保温杯", en: "Tumbler" }, categories: ["drinkware"] },
};

export function draftFromIntent(intent: Intent): DraftFields {
  if (intent.token) {
    const per = intent.perTxnMinor ?? "15000";
    return {
      title: { zh: intent.token, en: intent.token },
      mode: "quick",
      queryKind: "detergent",
      query: { zh: intent.token, en: intent.token },
      categories: ["household", "drinkware", "supplement", "electronics"],
      perTxnMinor: per,
      totalMinor: (BigInt(per) * 2n).toString(),
      maxPurchases: 2,
      days: 7,
      preferredBrand: null,
      allowSubstituteBrand: true,
      minVolumeMl: intent.minVolumeMl,
      reviewWhen: {
        nearCapPct: 95,
        substituteBrand: false,
        watchCategories: ["supplement"],
        newMerchantDays: null,
        priceAboveRefPct: null,
      },
      protection: "standard",
      methods: ["fps", "tapngo_mc"],
    };
  }
  const kind = intent.kind === "unknown" ? "detergent" : intent.kind;
  const t = TITLES[kind];
  const per = intent.perTxnMinor ?? (kind === "tumbler" ? "30000" : "10000");
  const curated = intent.curated;
  return {
    title: curated ? t.curated : t.quick,
    mode: curated ? "curated" : "quick",
    queryKind: kind,
    query: t.query,
    categories: t.categories,
    perTxnMinor: per,
    totalMinor: curated ? per : (BigInt(per) * 2n).toString(),
    maxPurchases: curated ? 1 : 2,
    days: curated ? 3 : 7,
    preferredBrand: kind === "detergent" ? "品牌甲" : null,
    allowSubstituteBrand: intent.allowSubstitute,
    minVolumeMl: intent.minVolumeMl,
    reviewWhen: {
      nearCapPct: 95,
      substituteBrand: true,
      // 精选：把这个品类放进「先问我」，每一笔都等你确认（docs/DECISIONS.md）
      watchCategories: curated ? ["supplement", ...t.categories] : ["supplement"],
      newMerchantDays: null,
      priceAboveRefPct: null,
    },
    protection: "standard",
    methods: ["fps", "tapngo_mc"],
  };
}

function task(taskId: string) {
  return getState().tasks.find((t) => t.id === taskId);
}

function mandate(id: string): MockMandate | undefined {
  return getState().mandates.find((m) => m.id === id);
}

function zev(text: Tx): Block {
  return { kind: "zev", text, at: nowIso() };
}

function step(checkpoint: TimelineStep["checkpoint"], title: Tx, detail: Tx, outcome?: TimelineStep["outcome"]): TimelineStep {
  return { checkpoint, title, detail, outcome, at: nowIso() };
}

// ---------- 开始一个任务 ----------

function savedChatReply(): { text: Tx; mode: "llm" | "fallback" } | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem("mw.chatReply");
  sessionStorage.removeItem("mw.chatReply");
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as { reply?: string; mode?: string };
    if (!saved.reply) return null;
    const mode = saved.mode === "llm" ? "llm" : "fallback";
    const via = mode === "llm" ? "DeepSeek" : "关键词";
    return {
      mode,
      text: {
        zh: `${saved.reply}（${via}只负责理解这句话，金额和能不能买仍由规则引擎决定。）`,
        en: `${saved.reply} (${via} only reads the sentence. The rule engine still decides the amount and whether it can be bought.)`,
      },
    };
  } catch {
    return null;
  }
}

export function startTask(text: string): string {
  const intent = parseIntent(text);
  const id = `t_${Date.now().toString(36)}`;
  const kind = intent.kind === "unknown" ? null : intent.kind;
  const reply = savedChatReply();
  actions.createTask({
    id,
    title: intent.token
      ? { zh: intent.token, en: intent.token }
      : kind
        ? intent.curated
          ? TITLES[kind].curated
          : TITLES[kind].quick
        : { zh: "新任务", en: "New task" },
    status: "drafting",
    mode: intent.curated ? "curated" : "quick",
    mandateId: null,
    chatMode: reply?.mode,
    blocks: reply ? [{ kind: "user", text, at: nowIso() }, zev(reply.text)] : [{ kind: "user", text, at: nowIso() }],
    timeline: [],
  });
  later(700, () => respond(id, intent));
  return id;
}

function respond(taskId: string, intent: Intent) {
  const s = getState();
  actions.addTimeline(taskId, [
    step(
      "INTENT",
      { zh: "理解需求", en: "Understood the request" },
      intent.token
        ? { zh: `要买：${intent.token}。演示目录里按这个词来找。`, en: `To buy: ${intent.token}. Searching the demo catalogue for that.` }
        : intent.kind === "unknown"
        ? { zh: "没认出要买什么。", en: "Could not tell what to buy." }
        : {
            zh: `要买：${TITLES[intent.kind].query.zh}${intent.minVolumeMl ? `，至少 ${intent.minVolumeMl / 1000}L` : ""}${intent.perTxnMinor ? `，单笔 ${fmtMoney(intent.perTxnMinor, "zh")} 以内` : ""}${intent.allowSubstitute ? "，可以换牌子" : ""}。`,
            en: `To buy: ${TITLES[intent.kind].query.en}${intent.minVolumeMl ? `, at least ${intent.minVolumeMl / 1000}L` : ""}${intent.perTxnMinor ? `, under ${fmtMoney(intent.perTxnMinor, "en")} per order` : ""}${intent.allowSubstitute ? ", other brands OK" : ""}.`,
          },
    ),
  ]);

  if (s.session.frozen) {
    actions.appendBlocks(taskId, [zev({ zh: "账号已冻结，我现在不能买任何东西。到「我的 › 安全」用通行密钥解除冻结后再试。", en: "Your account is frozen, so I can't buy anything. Unfreeze it with your passkey under Me › Security, then try again." })]);
    actions.updateTask(taskId, { status: "failed" });
    return;
  }
  if (intent.kind === "unknown" && !intent.token) {
    actions.appendBlocks(taskId, [
      zev({
        zh: "演示目录里有日用品、杯具和保健品。可以说「洗洁精」「水杯」或「牙膏」，也可以继续买洗衣液、纸巾、保温杯。",
        en: "The demo catalogue has household goods, cups and supplements. Try “dish soap”, “a cup” or “toothpaste”, or the laundry, tissue and tumbler demos.",
      }),
      { kind: "hint", at: nowIso() },
    ]);
    actions.updateTask(taskId, { status: "failed" });
    return;
  }

  const kind = intent.kind === "unknown" ? "detergent" : intent.kind;
  const want = intent.token ?? TITLES[kind].query.zh;
  // 没提新预算，且已有覆盖这件事的授权 → 直接在授权范围内做
  const covering =
    intent.perTxnMinor === null
      ? s.mandates.find((m) => m.status === "active" && m.query.zh === want && m.remainingPurchases > 0 && (!intent.curated || m.mode === "curated"))
      : undefined;

  if (covering) {
    actions.appendBlocks(taskId, [{ kind: "in_scope", mandateId: covering.id, at: nowIso() }]);
    actions.updateTask(taskId, { mandateId: covering.id, status: "running", mode: covering.mode, title: covering.title });
    if (covering.mode === "curated") startCurated(taskId, covering.id, kind);
    else runSearch(taskId, covering.id);
    return;
  }

  actions.appendBlocks(taskId, [{ kind: "draft", fields: draftFromIntent(intent), signedMandateId: null, at: nowIso() }]);
}

/** 用户在草稿卡里改完、用通行密钥签发之后调用 */
export function signDraft(taskId: string, blockIndex: number, fields: DraftFields) {
  const t = task(taskId);
  const b = t?.blocks[blockIndex];
  if (!t || !b || b.kind !== "draft") return;
  const first = t.blocks.find((x) => x.kind === "user");
  const text = first && first.kind === "user" ? (typeof first.text === "string" ? first.text : first.text.zh) : "";
  const mandateId = actions.signMandate(fields, text);
  actions.updateBlock(taskId, blockIndex, { ...b, fields, signedMandateId: mandateId });
  actions.updateTask(taskId, { mandateId, status: "running", title: fields.title, mode: fields.mode });
  if (fields.mode === "curated") startCurated(taskId, mandateId, fields.queryKind);
  else runSearch(taskId, mandateId);
}

// ---------- 极速版 ----------

function rank(m: MockMandate, kind: QueryKind, filters?: Filters, exclude: Set<string> = new Set()): Scored[] {
  const s = getState();
  const now = new Date();
  const scripted = m.query.zh === "洗衣液" || m.query.zh === "纸巾" || m.query.zh === "保温杯" || m.query.zh === "Laundry liquid" || m.query.zh === "Tissue" || m.query.zh === "Tumbler";
  const list = (scripted ? candidatesFor(kind, exclude) : productsMatching(m.query.zh).filter((p) => !exclude.has(p.id)))
    .filter((p) => {
      if (!filters) return true;
      const mer = merchantOf(p.merchantId);
      if (filters.delivery.length && !filters.delivery.some((d) => covers(d, mer.delivery))) return false;
      if (filters.brands.length && !filters.brands.includes(p.brand.zh)) return false;
      return true;
    })
    .map((p) => ({ product: p, evaluation: evaluate(m, p, { now, revokedMerchants: s.demo.revokedMerchants, frozen: s.session.frozen }) }))
    .filter((x) => !filters || x.evaluation.total <= BigInt(filters.maxMinor));
  return scoreAll(list);
}

/** 「7 日内」包含今日达和次日达 */
function covers(want: Delivery, has: Delivery): boolean {
  const order: Delivery[] = ["today", "tomorrow", "week"];
  return order.indexOf(has) <= order.indexOf(want);
}

export function rankedFor(mandateId: string, kind: QueryKind): Scored[] {
  const m = mandate(mandateId);
  return m ? rank(m, kind) : [];
}

const DELIVERY_TX: Record<Delivery, Tx> = {
  today: { zh: "今日达", en: "arrives today" },
  tomorrow: { zh: "明天到", en: "arrives tomorrow" },
  week: { zh: "3 天内到", en: "arrives in 3 days" },
};

/** 推荐理由。原型用模板代替模型生成；真实版本里这段由模型写，但金额与结果不取模型的输出 */
function reasonFor(x: Scored, all: Scored[]): Tx {
  const p = x.product;
  const mer = merchantOf(p.merchantId);
  const cheapest = all.every((y) => y.evaluation.total >= x.evaluation.total);
  const rating = (p.rating10 / 10).toFixed(1);
  return {
    zh: `${p.brand.zh} ${p.specLabel.zh}，${mer.name.zh}，含运费 ${fmtMoney(x.evaluation.total, "zh")}。评分 ${rating}，已售 ${p.sales}，${DELIVERY_TX[mer.delivery].zh}。${cheapest ? "这几件里含运费最便宜。" : ""}`,
    en: `${p.brand.en} ${p.specLabel.en} from ${mer.name.en}, ${fmtMoney(x.evaluation.total, "en")} with shipping. Rated ${rating}, ${p.sales} sold, ${DELIVERY_TX[mer.delivery].en}.${cheapest ? " Cheapest of the lot, shipping included." : ""}`,
  };
}

export function runSearch(taskId: string, mandateId: string) {
  const m = mandate(mandateId);
  if (!m) return;
  actions.appendBlocks(taskId, [{ kind: "working", mandateId, at: nowIso() }]);
  const kind = m.queryKind;
  later(700, () =>
    actions.addTimeline(taskId, [
      step("SEARCH", { zh: "搜索两家模拟商家", en: "Searched two simulated shops" }, { zh: "日日鲜百货、快快屋。康康保健的商家凭证已撤销，不搜。", en: "RiRiXian and KuaiKuai. KangKang's merchant credential is revoked, so it was skipped." }),
    ]),
  );
  later(1500, () => {
    const ranked = rank(m, kind);
    const injected = ranked.find((x) => x.product.injected);
    const allowed = ranked.filter((x) => x.evaluation.outcome !== "DENY").length;
    actions.addTimeline(taskId, [
      step(
        "CANDIDATES",
        { zh: `找到 ${ranked.length} 件候选`, en: `Found ${ranked.length} candidates` },
        { zh: `逐件按授权判定：${allowed} 件可以买，${ranked.length - allowed} 件被规则排除。`, en: `Each was checked against your mandate: ${allowed} eligible, ${ranked.length - allowed} ruled out.` },
      ),
      ...(injected
        ? [
            step(
              "CANDIDATES",
              { zh: "忽略了一段可疑的商品描述", en: "Ignored a suspicious product description" },
              {
                zh: `${injected.product.name.zh}的描述里写着「忽略预算」之类的指令。商品描述只当数据读，不会改变规则。`,
                en: `${injected.product.name.en}'s description contains instructions like "ignore the budget". Descriptions are read as data and never change the rules.`,
              },
            ),
          ]
        : []),
    ]);
  });
  later(2300, () => {
    actions.addTimeline(taskId, [
      step("QUOTE", { zh: "按含运费总价报价", en: "Quoted with shipping included" }, { zh: "上限和剩余额度都按实际扣款判断：商品 + 运费 + 手续费。", en: "Caps and budget use what you'd actually pay: item + shipping + fees." }),
    ]);
    present(taskId, mandateId, 1, rank(m, kind));
  });
}

function present(taskId: string, mandateId: string, round: number, ranked: Scored[], chosenByUser = false) {
  const m = mandate(mandateId);
  if (!m) return;
  const pickable = ranked.filter((x) => x.evaluation.outcome !== "DENY");
  if (pickable.length === 0) {
    const top = ranked[0];
    if (!top) {
      actions.appendBlocks(taskId, [zev({ zh: "按这些条件没有找到商品。放宽一点试试？", en: "Nothing matched those filters. Try loosening them?" }), { kind: "hint", at: nowIso() }]);
      return;
    }
    actions.appendBlocks(taskId, [{ kind: "denied", productId: top.product.id, mandateId, rules: top.evaluation.rules.filter((r) => r.severity === "DENY"), at: nowIso() }]);
    actions.addTimeline(taskId, [step("ROUTE", { zh: "没有可以买的候选", en: "No eligible candidate" }, { zh: "所有候选都被规则拒绝，这笔不能买。", en: "Every candidate was declined by the rules." }, "DENY")]);
    actions.updateTask(taskId, { status: "failed" });
    return;
  }
  const top = pickable[0];
  offer(taskId, mandateId, round, top, reasonFor(top, ranked), chosenByUser);
}

function offer(taskId: string, mandateId: string, round: number, x: Scored, reason: Tx, chosenByUser: boolean) {
  const t = task(taskId);
  if (!t) return;
  const index = t.blocks.length;
  if (x.evaluation.outcome === "ALLOW") {
    const autoPayAt = chosenByUser ? null : new Date(Date.now() + AUTO_PAY_MS).toISOString();
    actions.appendBlocks(taskId, [{ kind: "pick", round, productId: x.product.id, mandateId, state: "offered", at: nowIso(), reason, autoPayAt, chosenByUser }]);
    actions.addTimeline(taskId, [
      step("ROUTE", { zh: `推荐 ${x.product.name.zh}`, en: `Picked ${x.product.name.en}` }, { zh: `推荐分 ${x.score}（评分 ${x.parts.rating} + 销量 ${x.parts.sales} + 价格 ${x.parts.price}）。在授权范围内。`, en: `Score ${x.score} (rating ${x.parts.rating} + sales ${x.parts.sales} + price ${x.parts.price}). Within your mandate.` }, "ALLOW"),
    ]);
    actions.updateTask(taskId, { status: "running" });
    if (chosenByUser) payPick(taskId, index);
    else scheduleAutoPay(taskId, index);
    return;
  }
  // REVIEW：生成绑定购物车版本的待确认，30 分钟内有效
  const pendingId = actions.addPending({
    taskId,
    mandateId,
    productId: x.product.id,
    cartVersion: round,
    totalMinor: x.evaluation.total.toString(),
    rules: x.evaluation.rules.filter((r) => r.severity === "REVIEW"),
  });
  actions.appendBlocks(taskId, [
    { kind: "pick", round, productId: x.product.id, mandateId, state: "awaiting", at: nowIso(), reason, autoPayAt: null, chosenByUser },
    { kind: "awaiting", pendingId, at: nowIso() },
  ]);
  actions.addTimeline(taskId, [
    step("ROUTE", { zh: `推荐 ${x.product.name.zh}，需要你确认`, en: `Picked ${x.product.name.en}, needs your OK` }, { zh: "命中了你设的「先问我」条件，Zev 不会自己付款。", en: "It hits one of your ask-first conditions, so Zev won't pay on its own." }, "REVIEW"),
  ]);
  actions.updateTask(taskId, { status: "awaiting_confirmation" });
}

// ---------- 自动付款倒计时 ----------

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const key = (taskId: string, index: number) => `${taskId}:${index}`;

function scheduleAutoPay(taskId: string, index: number) {
  const k = key(taskId, index);
  clearTimeout(timers.get(k));
  timers.set(
    k,
    setTimeout(() => {
      timers.delete(k);
      const b = task(taskId)?.blocks[index];
      if (b?.kind === "pick" && b.state === "offered" && b.autoPayAt) payPick(taskId, index);
    }, AUTO_PAY_MS),
  );
}

/** 用户展开「看看别的」、筛选或点「先别买」时暂停自动付款 */
export function pausePick(taskId: string, index: number) {
  const k = key(taskId, index);
  clearTimeout(timers.get(k));
  timers.delete(k);
  const b = task(taskId)?.blocks[index];
  if (b?.kind === "pick" && b.state === "offered" && b.autoPayAt) actions.updateBlock(taskId, index, { ...b, autoPayAt: null });
}

export function skipPick(taskId: string, index: number) {
  pausePick(taskId, index);
  const b = task(taskId)?.blocks[index];
  if (b?.kind !== "pick" || b.state !== "offered") return;
  actions.updateBlock(taskId, index, { ...b, state: "skipped", autoPayAt: null });
  actions.appendBlocks(taskId, [zev({ zh: "好，这件先不买。可以看看别的，或者告诉我更具体的要求。", en: "OK, not this one. Have a look at the others, or tell me more about what you want." }), { kind: "hint", at: nowIso() }]);
}

export function payPick(taskId: string, index: number) {
  pausePick(taskId, index);
  const b = task(taskId)?.blocks[index];
  if (b?.kind !== "pick" || b.state !== "offered") return;
  const r = actions.pay({ taskId, mandateId: b.mandateId, productId: b.productId, cartVersion: b.round });
  if (r.ok) {
    actions.updateBlock(taskId, index, { ...b, state: "paid", autoPayAt: null });
    actions.appendBlocks(taskId, [{ kind: "receipt", orderId: r.orderId, at: nowIso() }]);
    actions.addTimeline(taskId, [
      step("PAY", { zh: "结算时重新判定后付款", en: "Re-checked at settlement, then paid" }, { zh: "结算不信任推荐结果，用当前数据重新判定一次，额度、次数、余额在同一步扣减。", en: "Settlement ignores the recommendation and re-checks with fresh data; budget, uses and balance move together." }, "ALLOW"),
    ]);
    actions.updateTask(taskId, { status: "completed" });
    return;
  }
  actions.updateBlock(taskId, index, { ...b, state: "declined", autoPayAt: null });
  const msg: Record<typeof r.code, Tx> = {
    ISSUER_DECLINED: { zh: "发卡方拒绝了这笔付款（演示设置）。没有扣款，额度也没动。你可以再试一次。", en: "The issuer declined this payment (demo setting). Nothing was charged and your budget is untouched. You can try again." },
    INSUFFICIENT_POCKET: { zh: "Agent 零钱包余额不够。到「钱包」充值后再试。", en: "The Agent pocket doesn't have enough. Top up under Wallet and try again." },
    FROZEN: { zh: "账号已冻结，付款被拦下。", en: "Your account is frozen, so the payment was stopped." },
    DENY: { zh: "结算时重新判定，这笔已经不在授权范围内了，没有付款。", en: "Settlement re-checked and this order is no longer within your mandate. Nothing was paid." },
    REVIEW_REQUIRED: { zh: "结算时发现需要你确认，已转为待确认。", en: "Settlement found it needs your approval; it's now waiting for you." },
    EXPIRED: { zh: "确认已过期。", en: "The approval expired." },
  };
  actions.appendBlocks(taskId, [zev(msg[r.code])]);
  actions.addTimeline(taskId, [step("PAY", { zh: "付款没有完成", en: "Payment did not go through" }, msg[r.code], "DENY")]);
}

/** 用户在「看看别的」里亲自选了一件 */
export function choose(taskId: string, mandateId: string, productId: string) {
  const m = mandate(mandateId);
  const t = task(taskId);
  if (!m || !t) return;
  const ranked = rank(m, m.queryKind);
  const x = ranked.find((y) => y.product.id === productId);
  if (!x || x.evaluation.outcome === "DENY") return;
  const round = Math.max(0, ...t.blocks.filter((b) => b.kind === "pick").map((b) => (b.kind === "pick" ? b.round : 0))) + 1;
  t.blocks.forEach((b, i) => {
    if (b.kind === "pick" && b.state === "offered") {
      pausePick(taskId, i);
      actions.updateBlock(taskId, i, { ...b, state: "skipped", autoPayAt: null });
    }
  });
  actions.appendBlocks(taskId, [{ kind: "user", text: { zh: `就这件：${x.product.name.zh}`, en: `This one: ${x.product.name.en}` }, at: nowIso() }]);
  offer(taskId, mandateId, round, x, reasonFor(x, ranked), true);
}

/** 筛选层「确认」：按筛选重新推荐一件，并提示可以详细描述 */
export function refine(taskId: string, mandateId: string, filters: Filters) {
  const m = mandate(mandateId);
  const t = task(taskId);
  if (!m || !t) return;
  t.blocks.forEach((b, i) => {
    if (b.kind === "pick" && b.state === "offered") {
      pausePick(taskId, i);
      actions.updateBlock(taskId, i, { ...b, state: "skipped", autoPayAt: null });
    }
  });
  const round = Math.max(0, ...t.blocks.map((b) => (b.kind === "pick" ? b.round : 0))) + 1;
  const parts: string[] = [];
  const partsEn: string[] = [];
  parts.push(`含运费 ${fmtMoney(filters.maxMinor, "zh")} 以内`);
  partsEn.push(`under ${fmtMoney(filters.maxMinor, "en")} with shipping`);
  if (filters.delivery.length) {
    parts.push(filters.delivery.map((d) => ({ today: "今日达", tomorrow: "次日达", week: "7 日内" })[d]).join("/"));
    partsEn.push(filters.delivery.map((d) => ({ today: "today", tomorrow: "next day", week: "within 7 days" })[d]).join("/"));
  }
  if (filters.brands.length) {
    parts.push(filters.brands.join("、"));
    partsEn.push(filters.brands.length + " brand(s)");
  }
  actions.appendBlocks(taskId, [{ kind: "user", text: { zh: `筛选：${parts.join("，")}`, en: `Filter: ${partsEn.join(", ")}` }, at: nowIso() }]);
  const ranked = rank(m, m.queryKind, filters);
  later(500, () => {
    present(taskId, mandateId, round, ranked);
    actions.appendBlocks(taskId, [{ kind: "hint", at: nowIso() }]);
  });
}

// ---------- 精选版 ----------

const PREF_TAG: Record<string, string> = { 极简风: "minimal", 黑色: "black", "收藏里多是 不锈钢": "steel", 哑光: "matte" };

export function startCurated(taskId: string, mandateId: string, kind: QueryKind) {
  actions.appendBlocks(taskId, [
    zev({
      zh: "好，这次慢慢挑。精选模式下每一笔都先问你，不会自动付款。我会参考你的偏好，你也可以发文字、图片或链接给我。",
      en: "Sure, let's take our time. In curated mode every purchase waits for your OK. I'll use your preferences, and you can send me text, an image or a link.",
    }),
    { kind: "curated", mandateId, query: kind, at: nowIso() },
  ]);
  actions.updateTask(taskId, { mode: "curated", status: "running" });
}

/** 「帮我细挑」：从极速版结果切到精选 */
export function enterCurated(taskId: string, mandateId: string) {
  const t = task(taskId);
  const m = mandate(mandateId);
  if (!t || !m) return;
  t.blocks.forEach((b, i) => {
    if (b.kind === "pick" && b.state === "offered") {
      pausePick(taskId, i);
      actions.updateBlock(taskId, i, { ...b, state: "skipped", autoPayAt: null });
    }
  });
  actions.appendBlocks(taskId, [{ kind: "user", text: { zh: "帮我细挑", en: "Help me choose carefully" }, at: nowIso() }]);
  later(400, () => startCurated(taskId, mandateId, m.queryKind));
}

export function curatedShortlist(taskId: string, mandateId: string, kind: QueryKind, extraTags: string[] = []) {
  const m = mandate(mandateId);
  if (!m) return;
  const s = getState();
  const tags = new Set([...s.prefs.map((p) => PREF_TAG[p.label.zh]).filter(Boolean), ...extraTags]);
  const ranked = rank(m, kind)
    .filter((x) => x.evaluation.outcome !== "DENY")
    .map((x) => ({ x, fit: (x.product.styleTags ?? []).filter((tag) => tags.has(tag)).length }))
    .sort((a, b) => b.fit - a.fit || b.x.score - a.x.score)
    .slice(0, 3);
  actions.appendBlocks(taskId, [
    zev({ zh: `按你的偏好挑了 ${ranked.length} 件。选一件我就生成待确认，你用通行密钥确认后才付款。`, en: `Here are ${ranked.length} picks based on your preferences. Choose one and I'll prepare it for your passkey approval.` }),
    { kind: "shortlist", mandateId, productIds: ranked.map((r) => r.x.product.id), at: nowIso() },
  ]);
}

export function preferenceFit(productId: string, extraTags: string[] = []): string[] {
  const s = getState();
  const tags = new Set([...s.prefs.map((p) => PREF_TAG[p.label.zh]).filter(Boolean), ...extraTags]);
  return (productOf(productId).styleTags ?? []).filter((t) => tags.has(t));
}

/** 精选模式：无论规则结果是 ALLOW 还是 REVIEW，都生成待确认 */
export function chooseCurated(taskId: string, mandateId: string, productId: string) {
  const m = mandate(mandateId);
  if (!m) return;
  const x = rank(m, m.queryKind).find((y) => y.product.id === productId);
  if (!x || x.evaluation.outcome === "DENY") return;
  const t = task(taskId);
  const round = (t?.blocks.filter((b) => b.kind === "awaiting").length ?? 0) + 1;
  const pendingId = actions.addPending({
    taskId,
    mandateId,
    productId,
    cartVersion: round,
    totalMinor: x.evaluation.total.toString(),
    rules: x.evaluation.rules.filter((r) => r.severity === "REVIEW"),
  });
  actions.appendBlocks(taskId, [
    { kind: "user", text: { zh: `选这件：${x.product.name.zh}`, en: `I'll take: ${x.product.name.en}` }, at: nowIso() },
    { kind: "awaiting", pendingId, at: nowIso() },
  ]);
  actions.addTimeline(taskId, [step("ROUTE", { zh: "你选了一件，等你确认", en: "You chose one; waiting for approval" }, { zh: "精选模式下每一笔都需要通行密钥确认。", en: "Every curated purchase needs passkey approval." }, "REVIEW")]);
  actions.updateTask(taskId, { status: "awaiting_confirmation" });
}

/**
 * 任务里的追问。超出当前授权（换了东西或提了新预算）→ 返回新任务 id，由页面跳转；
 * 否则把描述翻译成筛选条件重新推荐。
 */
export function followUp(taskId: string, text: string): string | null {
  const t = task(taskId);
  const m = t?.mandateId ? mandate(t.mandateId) : undefined;
  const intent = parseIntent(text);
  const changedItem = m ? (intent.token ? intent.token !== m.query.zh : intent.kind !== "unknown" && intent.kind !== m.queryKind) : false;
  if (!t || !m || m.status !== "active" || changedItem || intent.perTxnMinor !== null) {
    return startTask(text);
  }
  if (/细挑|精选|慢慢|carefully|curat/i.test(text)) {
    enterCurated(taskId, m.id);
    return null;
  }
  const delivery: Delivery[] = /今天|今日|today/i.test(text) ? ["today"] : /明天|次日|tomorrow/i.test(text) ? ["tomorrow"] : [];
  const brands = ["品牌甲", "品牌乙", "品牌丙", "品牌丁"].filter((b) => text.includes(b) || text.toLowerCase().includes(`brand ${BRAND_KEY[b]}`));
  actions.appendBlocks(taskId, [{ kind: "user", text, at: nowIso() }]);
  t.blocks.forEach((b, i) => {
    if (b.kind === "pick" && b.state === "offered") {
      pausePick(taskId, i);
      actions.updateBlock(taskId, i, { ...b, state: "skipped", autoPayAt: null });
    }
  });
  const round = Math.max(0, ...t.blocks.map((b) => (b.kind === "pick" ? b.round : 0))) + 1;
  const ranked = rank(m, m.queryKind, { maxMinor: m.perTxnMinor, delivery, brands });
  if (/便宜|最低价|cheap/i.test(text)) ranked.sort((a, b) => (a.evaluation.total < b.evaluation.total ? -1 : a.evaluation.total > b.evaluation.total ? 1 : 0));
  later(600, () => present(taskId, m.id, round, ranked));
  return null;
}

const BRAND_KEY: Record<string, string> = { 品牌甲: "jia", 品牌乙: "yi", 品牌丙: "bing", 品牌丁: "ding" };

/** 被拒后申请提高单笔上限：需要通行密钥 + 冷静期 */
export function requestHigherCap(taskId: string, mandateId: string, toMinor: string) {
  actions.requestRaiseCap(mandateId, toMinor);
  actions.appendBlocks(taskId, [
    zev({
      zh: `已申请把单笔上限提高到 ${fmtMoney(toMinor, "zh")}。放宽权限要等冷静期（演示里压缩成 2 分钟），期间你随时可以在「钱包」取消。生效后再让我试一次。`,
      en: `Requested a per-order cap of ${fmtMoney(toMinor, "en")}. Loosening a limit has a cooling-off period (2 minutes in this demo); you can cancel it under Wallet. Ask me again once it's active.`,
    }),
  ]);
}
