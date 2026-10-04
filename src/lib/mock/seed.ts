// 演示初始数据：Alex，港大学生。已经用「日用品补货」授权自动买过一瓶洗衣液（S1），
// 有一笔换牌子待确认（S2）、一笔超上限被拒（S3）、一个精选任务待确认。
import type {
  ActivityEvent,
  CoolingChange,
  Device,
  MockMandate,
  MockOrder,
  MockTask,
  PendingConfirmation,
  PrefTag,
} from "./types";

export interface MockState {
  v: 4;
  user: { name: string; phone: string; age18: boolean; passkey: boolean; pin: boolean; walletKyc: "basic" | "upgraded" };
  session: { mode: "owner" | "attacker"; frozen: boolean; frozenAt: string | null };
  pocketMinor: string;
  pocketLog: { id: string; at: string; kind: "topup" | "spend" | "refund"; amountMinor: string; note: { zh: string; en: string } }[];
  mandates: MockMandate[];
  orders: MockOrder[];
  pending: PendingConfirmation[];
  cooling: CoolingChange[];
  tasks: MockTask[];
  devices: Device[];
  prefs: PrefTag[];
  connections: { tapngo: boolean; kuaikuaiFavorites: boolean };
  address: { zh: string; en: string };
  activity: ActivityEvent[];
  demo: { revokedMerchants: string[]; nextIssuerDecline: boolean; agentMode: "llm" | "fallback"; injectionShown: boolean };
}

const DAY = 86_400_000;

const STD_REVIEW = { nearCapPct: 95, substituteBrand: true, watchCategories: ["supplement"], newMerchantDays: null, priceAboveRefPct: null };

export function seedState(now: number): MockState {
  const iso = (ms: number) => new Date(ms).toISOString();
  const mandates: MockMandate[] = [
    {
      id: "md_daily",
      title: { zh: "日用品补货", en: "Household restock" },
      version: 1,
      status: "active",
      mode: "quick",
      queryKind: "detergent",
      taskText: "帮我补一瓶洗衣液，2L 以上，$150 以内，可以换牌子，这周内买到。",
      query: { zh: "洗衣液", en: "Laundry liquid" },
      preferredBrand: "品牌甲",
      allowSubstituteBrand: true,
      minVolumeMl: 2000,
      categories: ["household"],
      perTxnMinor: "15000",
      totalMinor: "30000",
      remainingMinor: "16200",
      maxPurchases: 2,
      remainingPurchases: 1,
      expiresAt: "2026-10-09T23:59:59+08:00",
      reviewWhen: STD_REVIEW,
      protection: "standard",
      methods: ["fps", "tapngo_mc"],
      createdAt: "2026-10-03T10:05:00+08:00",
      revokedAt: null,
      versions: [{ v: 1, at: "2026-10-03T10:05:00+08:00", note: { zh: "在对话里起草，用通行密钥签发", en: "Drafted in chat, signed with passkey" } }],
    },
    {
      id: "md_curated",
      title: { zh: "精选 · 保温杯", en: "Curated · Tumbler" },
      version: 1,
      status: "active",
      mode: "curated",
      queryKind: "tumbler",
      taskText: "帮我细挑一个黑色、极简的保温杯，500ml 左右。",
      query: { zh: "保温杯", en: "Tumbler" },
      preferredBrand: null,
      allowSubstituteBrand: true,
      minVolumeMl: null,
      categories: ["drinkware"],
      perTxnMinor: "30000",
      totalMinor: "30000",
      remainingMinor: "30000",
      maxPurchases: 1,
      remainingPurchases: 1,
      expiresAt: "2026-10-06T23:59:59+08:00",
      reviewWhen: { ...STD_REVIEW, watchCategories: ["supplement", "drinkware"] },
      protection: "standard",
      methods: ["fps"],
      createdAt: "2026-10-03T11:20:00+08:00",
      revokedAt: null,
      versions: [{ v: 1, at: "2026-10-03T11:20:00+08:00", note: { zh: "精选：这个品类每一笔都先问你", en: "Curated: every purchase in this category asks you first" } }],
    },
    {
      id: "md_tissue",
      title: { zh: "纸巾补货", en: "Tissue restock" },
      version: 2,
      status: "completed",
      mode: "quick",
      queryKind: "tissue",
      taskText: "买几包纸巾，100 块以内。",
      query: { zh: "纸巾", en: "Tissue" },
      preferredBrand: null,
      allowSubstituteBrand: true,
      minVolumeMl: null,
      categories: ["household"],
      perTxnMinor: "10000",
      totalMinor: "10000",
      remainingMinor: "3800",
      maxPurchases: 1,
      remainingPurchases: 0,
      expiresAt: "2026-10-04T23:59:59+08:00",
      reviewWhen: STD_REVIEW,
      protection: "standard",
      methods: ["fps"],
      createdAt: "2026-10-01T19:32:00+08:00",
      revokedAt: null,
      versions: [
        { v: 1, at: "2026-10-01T19:32:00+08:00", note: { zh: "签发：单笔 $80.00", en: "Signed: 80.00 per order" } },
        { v: 2, at: "2026-10-01T19:35:00+08:00", note: { zh: "收紧为只能用 FPS；放宽单笔到 $100.00 已过冷静期", en: "FPS only; raising the cap to 100.00 passed cooling-off" } },
      ],
    },
  ];

  const orders: MockOrder[] = [
    {
      id: "ord_1001",
      taskId: "s1",
      mandateId: "md_daily",
      mandateVersion: 1,
      productId: "p_b_jia_2l",
      merchantId: "m_kuaikuai",
      qty: 1,
      subtotalMinor: "10800",
      shippingMinor: "3000",
      feeMinor: "0",
      totalMinor: "13800",
      method: "fps",
      status: "paid",
      paidAt: "2026-10-03T10:07:12+08:00",
      cartVersion: 1,
      idempotencyKey: "idem_7f3a9c",
      confirmedRules: [],
      support: "none",
      candidates: [
        { productId: "p_b_jia_2l", outcome: "ALLOW", rules: [] },
        { productId: "p_a_jia_2l", outcome: "ALLOW", rules: [] },
        { productId: "p_a_bing_2l", outcome: "REVIEW", rules: [{ id: "SUBSTITUTE_BRAND", severity: "REVIEW" }] },
        { productId: "p_b_ding_2l", outcome: "REVIEW", rules: [{ id: "SUBSTITUTE_BRAND", severity: "REVIEW" }] },
        { productId: "p_b_bing_25l", outcome: "DENY", rules: [{ id: "CAP_PER_TXN", severity: "DENY" }] },
        { productId: "p_a_yi_3l", outcome: "DENY", rules: [{ id: "CAP_PER_TXN", severity: "DENY" }] },
      ],
    },
    {
      id: "ord_0998",
      taskId: "t0",
      mandateId: "md_tissue",
      mandateVersion: 2,
      productId: "p_a_tissue_3",
      merchantId: "m_ririxian",
      qty: 1,
      subtotalMinor: "4200",
      shippingMinor: "2000",
      feeMinor: "0",
      totalMinor: "6200",
      method: "fps",
      status: "paid",
      paidAt: "2026-10-01T19:40:31+08:00",
      cartVersion: 1,
      idempotencyKey: "idem_2b81d0",
      confirmedRules: [],
      support: "none",
      candidates: [
        { productId: "p_a_tissue_3", outcome: "ALLOW", rules: [] },
        { productId: "p_b_tissue_10", outcome: "ALLOW", rules: [] },
      ],
    },
  ];

  const pending: PendingConfirmation[] = [
    {
      id: "pc_s2",
      taskId: "s2",
      mandateId: "md_daily",
      productId: "p_a_bing_2l",
      cartVersion: 2,
      totalMinor: "13500",
      rules: [{ id: "SUBSTITUTE_BRAND", severity: "REVIEW" }],
      createdAt: iso(now - 4 * 60_000),
      expiresAt: iso(now + 26 * 60_000),
      status: "pending",
    },
    {
      id: "pc_c1",
      taskId: "c1",
      mandateId: "md_curated",
      productId: "p_b_tumbler_black",
      cartVersion: 1,
      totalMinor: "19800",
      rules: [{ id: "WATCH_CATEGORY", severity: "REVIEW" }],
      createdAt: iso(now - 11 * 60_000),
      expiresAt: iso(now + 19 * 60_000),
      status: "pending",
    },
  ];

  return {
    v: 4,
    user: { name: "Alex", phone: "+852 •••• 5678", age18: true, passkey: true, pin: true, walletKyc: "basic" },
    session: { mode: "owner", frozen: false, frozenAt: null },
    pocketMinor: "30000",
    pocketLog: [
      { id: "pl3", at: "2026-10-03T10:07:12+08:00", kind: "spend", amountMinor: "13800", note: { zh: "快快屋 · 品牌甲 洗衣液 2L", en: "KuaiKuai House · Brand Jia Laundry Liquid 2L" } },
      { id: "pl2", at: "2026-10-01T19:40:31+08:00", kind: "spend", amountMinor: "6200", note: { zh: "日日鲜百货 · 抽取式纸巾", en: "Riri Fresh Mart · Facial Tissue" } },
      { id: "pl1", at: "2026-10-01T19:30:05+08:00", kind: "topup", amountMinor: "50000", note: { zh: "从 Tap & Go 充值（模拟）", en: "Top-up from Tap & Go (simulated)" } },
    ],
    mandates,
    orders,
    pending,
    cooling: [],
    tasks: seedTasks(),
    devices: [
      { id: "dev_win", name: { zh: "Chrome · Windows", en: "Chrome · Windows" }, place: { zh: "香港 薄扶林", en: "Pok Fu Lam, HK" }, lastSeen: iso(now), current: true, passkey: true, readOnly: false },
      { id: "dev_iphone", name: { zh: "Safari · iPhone", en: "Safari · iPhone" }, place: { zh: "香港 中环", en: "Central, HK" }, lastSeen: iso(now - DAY), passkey: true, readOnly: false },
    ],
    prefs: [
      { id: "pf1", group: "style", label: { zh: "极简风", en: "Minimal" }, source: "chat" },
      { id: "pf2", group: "color", label: { zh: "黑色", en: "Black" }, source: "chat" },
      { id: "pf3", group: "price", label: { zh: "常买价位 100–$300", en: "Usually $100–300" }, source: "orders" },
      { id: "pf4", group: "brand", label: { zh: "常买 品牌甲", en: "Usually Brand Jia" }, source: "orders" },
    ],
    connections: { tapngo: true, kuaikuaiFavorites: false },
    address: { zh: "香港岛 薄扶林道 港大何东夫人纪念堂 3 楼", en: "3/F, Lady Ho Tung Hall, HKU, Pok Fu Lam Road" },
    activity: [
      { id: "ac3", at: "2026-10-03T11:20:00+08:00", kind: "step_up", text: { zh: "用通行密钥签发「精选 · 保温杯」", en: "Signed “Curated · Tumbler” with passkey" } },
      { id: "ac2", at: "2026-10-03T10:05:00+08:00", kind: "step_up", text: { zh: "用通行密钥签发「日用品补货」", en: "Signed “Household restock” with passkey" } },
      { id: "ac1", at: "2026-10-03T09:58:00+08:00", kind: "login", text: { zh: "Chrome · Windows 用密码登录", en: "Password sign-in on Chrome · Windows" } },
    ],
    demo: { revokedMerchants: [], nextIssuerDecline: false, agentMode: "fallback", injectionShown: true },
  };
}

function seedTasks(): MockTask[] {
  const S1_TEXT = { zh: "帮我补一瓶洗衣液，2L 以上，$150 以内，可以换牌子，这周内买到。", en: "Restock laundry liquid for me: 2L or more, under $150, any brand is fine, within this week." };
  return [
    {
      id: "s1",
      title: { zh: "补一瓶洗衣液", en: "Restock laundry liquid" },
      status: "completed",
      mode: "quick",
      mandateId: "md_daily",
      createdAt: "2026-10-03T10:04:10+08:00",
      agentMode: "fallback",
      blocks: [
        { kind: "user", text: S1_TEXT, at: "2026-10-03T10:04:10+08:00" },
        {
          kind: "draft",
          signedMandateId: "md_daily",
          at: "2026-10-03T10:04:12+08:00",
          fields: {
            title: { zh: "日用品补货", en: "Household restock" },
            mode: "quick",
            queryKind: "detergent",
            query: { zh: "洗衣液", en: "Laundry liquid" },
            categories: ["household"],
            perTxnMinor: "15000",
            totalMinor: "30000",
            maxPurchases: 2,
            days: 7,
            preferredBrand: "品牌甲",
            allowSubstituteBrand: true,
            minVolumeMl: 2000,
            reviewWhen: STD_REVIEW,
            protection: "standard",
            methods: ["fps", "tapngo_mc"],
          },
        },
        { kind: "working", mandateId: "md_daily", at: "2026-10-03T10:05:02+08:00" },
        {
          kind: "pick",
          round: 1,
          productId: "p_b_jia_2l",
          mandateId: "md_daily",
          state: "paid",
          at: "2026-10-03T10:07:00+08:00",
          reason: {
            zh: "还是你常买的品牌甲。含运费 $138.00，和日日鲜一样便宜，但明天就到。",
            en: "Your usual Brand Jia. $138.00 with shipping, same as Riri Fresh, but it arrives tomorrow.",
          },
        },
        { kind: "receipt", orderId: "ord_1001", at: "2026-10-03T10:07:12+08:00" },
      ],
      timeline: [
        { checkpoint: "INTENT", title: { zh: "理解任务", en: "Understand the task" }, detail: { zh: "洗衣液 · 至少 2L · 可以换牌子 · 品类「家居日用」在授权内", en: "Laundry liquid · 2L+ · any brand · Household is in scope" }, outcome: "ALLOW", at: "2026-10-03T10:05:02+08:00" },
        { checkpoint: "SEARCH", title: { zh: "搜索两家商家", en: "Search two stores" }, detail: { zh: "日日鲜百货 3 件，快快屋 3 件。康康保健凭证已撤销，没有搜索。", en: "3 items at Riri Fresh, 3 at KuaiKuai. KangKang Health's credential is revoked, so it was skipped." }, at: "2026-10-03T10:05:04+08:00" },
        { checkpoint: "CANDIDATES", title: { zh: "筛选候选", en: "Filter candidates" }, detail: { zh: "6 件里 2 件含运费超过单笔上限。1 件商品描述里夹着一段指令，Zev 只把它当描述，没有照做。", en: "2 of 6 exceed the per-order cap with shipping. One description hides an instruction; Zev treats it as text and ignores it." }, outcome: "REVIEW", at: "2026-10-03T10:05:06+08:00" },
        { checkpoint: "QUOTE", title: { zh: "报价", en: "Quote" }, detail: { zh: "首选：快快屋 品牌甲 2L，108.00 + 运费 30.00 = $138.00，是单笔上限的 92%。", en: "Top pick: KuaiKuai Brand Jia 2L, 108.00 + 30.00 shipping = $138.00, 92% of the cap." }, outcome: "ALLOW", at: "2026-10-03T10:05:07+08:00" },
        { checkpoint: "ROUTE", title: { zh: "选择支付方式", en: "Choose payment" }, detail: { zh: "FPS：授权允许、商家接受、你已启用，手续费 0。", en: "FPS: allowed by the mandate, accepted by the store, enabled by you, no fee." }, outcome: "ALLOW", at: "2026-10-03T10:05:08+08:00" },
        { checkpoint: "PAY", title: { zh: "结算", en: "Settle" }, detail: { zh: "一次事务里扣额度、扣库存、记账。剩余 $162.00，还能买 1 次。", en: "Budget, stock and ledger updated in one transaction. $162.00 and 1 purchase left." }, outcome: "ALLOW", at: "2026-10-03T10:07:12+08:00" },
      ],
    },
    {
      id: "s2",
      title: { zh: "再补一瓶洗衣液", en: "Another laundry liquid" },
      status: "awaiting_confirmation",
      mode: "quick",
      mandateId: "md_daily",
      createdAt: "2026-10-03T11:02:00+08:00",
      agentMode: "fallback",
      blocks: [
        { kind: "user", text: { zh: "再补一瓶洗衣液，换个牌子也行。", en: "Get me another laundry liquid, a different brand is fine." }, at: "2026-10-03T11:02:00+08:00" },
        { kind: "in_scope", mandateId: "md_daily", at: "2026-10-03T11:02:02+08:00" },
        { kind: "working", mandateId: "md_daily", at: "2026-10-03T11:02:03+08:00" },
        {
          kind: "pick",
          round: 1,
          productId: "p_a_bing_2l",
          mandateId: "md_daily",
          state: "awaiting",
          at: "2026-10-03T11:02:08+08:00",
          reason: { zh: "品牌甲两家都卖完了。品牌丙 2L 含运费 $135.00，评分 4.4。", en: "Brand Jia is sold out at both stores. Brand Bing 2L is $135.00 with shipping, rated 4.4." },
        },
        { kind: "awaiting", pendingId: "pc_s2", at: "2026-10-03T11:02:08+08:00" },
        { kind: "hint", at: "2026-10-03T11:02:09+08:00" },
      ],
      timeline: [
        { checkpoint: "INTENT", title: { zh: "理解任务", en: "Understand the task" }, detail: { zh: "在「日用品补货」范围内，还剩 1 次、$162.00。", en: "Within “Household restock”: 1 purchase and $162.00 left." }, outcome: "ALLOW", at: "2026-10-03T11:02:02+08:00" },
        { checkpoint: "SEARCH", title: { zh: "搜索两家商家", en: "Search two stores" }, detail: { zh: "品牌甲两家都已售罄。", en: "Brand Jia is sold out at both stores." }, at: "2026-10-03T11:02:04+08:00" },
        { checkpoint: "CANDIDATES", title: { zh: "筛选候选", en: "Filter candidates" }, detail: { zh: "品牌丙 2L 命中「换了牌子」，需要先问你。", en: "Brand Bing 2L hits “different brand”, so Zev asks first." }, outcome: "REVIEW", at: "2026-10-03T11:02:06+08:00" },
        { checkpoint: "QUOTE", title: { zh: "报价", en: "Quote" }, detail: { zh: "日日鲜百货：115.00 + 运费 20.00 = $135.00。购物车 v2。", en: "Riri Fresh: 115.00 + 20.00 shipping = $135.00. Cart v2." }, outcome: "REVIEW", at: "2026-10-03T11:02:08+08:00" },
      ],
    },
    {
      id: "s3",
      title: { zh: "大瓶洗衣液", en: "Large laundry liquid" },
      status: "failed",
      mode: "quick",
      mandateId: "md_daily",
      createdAt: "2026-10-03T11:10:00+08:00",
      agentMode: "fallback",
      blocks: [
        { kind: "user", text: { zh: "要一瓶 2.5L 以上的洗衣液。", en: "I want a laundry liquid of 2.5L or more." }, at: "2026-10-03T11:10:00+08:00" },
        { kind: "in_scope", mandateId: "md_daily", at: "2026-10-03T11:10:02+08:00" },
        { kind: "working", mandateId: "md_daily", at: "2026-10-03T11:10:03+08:00" },
        { kind: "denied", productId: "p_b_bing_25l", mandateId: "md_daily", rules: [{ id: "CAP_PER_TXN", severity: "DENY" }], at: "2026-10-03T11:10:07+08:00" },
      ],
      timeline: [
        { checkpoint: "INTENT", title: { zh: "理解任务", en: "Understand the task" }, detail: { zh: "洗衣液 · 至少 2.5L。", en: "Laundry liquid · 2.5L+." }, outcome: "ALLOW", at: "2026-10-03T11:10:02+08:00" },
        { checkpoint: "SEARCH", title: { zh: "搜索两家商家", en: "Search two stores" }, detail: { zh: "符合容量的有 2 件。", en: "2 items meet the size." }, at: "2026-10-03T11:10:04+08:00" },
        { checkpoint: "QUOTE", title: { zh: "报价", en: "Quote" }, detail: { zh: "快快屋 品牌丙 2.5L 含运费 $158.00；日日鲜 品牌乙 3L 含运费 $159.00。都超过单笔上限 $150.00。", en: "KuaiKuai Brand Bing 2.5L is $158.00 and Riri Fresh Brand Yi 3L is $159.00 with shipping. Both exceed the $150.00 cap." }, outcome: "DENY", at: "2026-10-03T11:10:07+08:00" },
      ],
    },
    {
      id: "c1",
      title: { zh: "细挑保温杯", en: "Pick a tumbler" },
      status: "awaiting_confirmation",
      mode: "curated",
      mandateId: "md_curated",
      createdAt: "2026-10-03T11:18:00+08:00",
      agentMode: "fallback",
      blocks: [
        { kind: "user", text: { zh: "帮我细挑一个黑色、极简的保温杯，500ml 左右。", en: "Help me carefully pick a black, minimal tumbler, about 500ml." }, at: "2026-10-03T11:18:00+08:00" },
        { kind: "curated", mandateId: "md_curated", query: "tumbler", at: "2026-10-03T11:18:03+08:00" },
        { kind: "shortlist", mandateId: "md_curated", productIds: ["p_b_tumbler_black", "p_a_tumbler_matte", "p_b_tumbler_steel"], at: "2026-10-03T11:20:30+08:00" },
        { kind: "awaiting", pendingId: "pc_c1", at: "2026-10-03T11:21:00+08:00" },
      ],
      timeline: [
        { checkpoint: "INTENT", title: { zh: "理解任务", en: "Understand the task" }, detail: { zh: "保温杯 · 黑色 · 极简 · 约 500ml。精选模式：每一笔都先问你。", en: "Tumbler · black · minimal · ~500ml. Curated: every purchase asks you first." }, outcome: "REVIEW", at: "2026-10-03T11:18:03+08:00" },
        { checkpoint: "SEARCH", title: { zh: "搜索两家商家", en: "Search two stores" }, detail: { zh: "3 件符合。偏好只用于排序，不参与放行判断。", en: "3 items match. Preferences only affect ranking, never approval." }, at: "2026-10-03T11:20:00+08:00" },
        { checkpoint: "QUOTE", title: { zh: "报价", en: "Quote" }, detail: { zh: "你选了 快快屋 极简黑 500ml：168.00 + 运费 30.00 = $198.00。", en: "You chose KuaiKuai Minimal Black 500ml: 168.00 + 30.00 shipping = $198.00." }, outcome: "REVIEW", at: "2026-10-03T11:21:00+08:00" },
      ],
    },
    {
      id: "t0",
      title: { zh: "买纸巾", en: "Buy tissue" },
      status: "completed",
      mode: "quick",
      mandateId: "md_tissue",
      createdAt: "2026-10-01T19:31:00+08:00",
      agentMode: "fallback",
      blocks: [
        { kind: "user", text: { zh: "买几包纸巾，100 块以内。", en: "Buy some tissue, under 100 dollars." }, at: "2026-10-01T19:31:00+08:00" },
        { kind: "working", mandateId: "md_tissue", at: "2026-10-01T19:36:00+08:00" },
        {
          kind: "pick",
          round: 1,
          productId: "p_a_tissue_3",
          mandateId: "md_tissue",
          state: "paid",
          at: "2026-10-01T19:40:00+08:00",
          reason: { zh: "评分最高，含运费 $62.00。", en: "Best rated, $62.00 with shipping." },
        },
        { kind: "receipt", orderId: "ord_0998", at: "2026-10-01T19:40:31+08:00" },
      ],
      timeline: [
        { checkpoint: "INTENT", title: { zh: "理解任务", en: "Understand the task" }, detail: { zh: "纸巾 · $100.00 以内。", en: "Tissue · under $100.00." }, outcome: "ALLOW", at: "2026-10-01T19:36:00+08:00" },
        { checkpoint: "PAY", title: { zh: "结算", en: "Settle" }, detail: { zh: "$62.00，FPS。", en: "$62.00 via FPS." }, outcome: "ALLOW", at: "2026-10-01T19:40:31+08:00" },
      ],
    },
  ];
}
