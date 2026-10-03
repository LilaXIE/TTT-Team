"use client";

// 原型的客户端数据层：localStorage 持久化，同一浏览器的多个标签页通过 storage 事件同步
// （演示「主人在一个标签页冻结，攻击者那页立刻失效」）。
// 接真实数据时，每个 action 对应 docs/MANUAL.md §7.2 的一个接口，页面只换数据来源。
import { useEffect, useState, useSyncExternalStore } from "react";
import type { RuleId } from "@/contracts";
import { merchantOf, productOf } from "./catalog";
import { candidatesFor, evaluate } from "./evaluate";
import { seedState, type MockState } from "./seed";
import type { Block, CoolingChange, DraftFields, MockMandate, MockOrder, MockTask, PendingConfirmation, TimelineStep, Tx } from "./types";

const KEY = "mw-proto-state";
const MODE_KEY = "mw-proto-mode";
/** 演示把 24 小时冷静期压缩成 2 分钟 */
export const COOLING_MS = 2 * 60_000;
export const CONFIRM_TTL_MS = 30 * 60_000;

const SERVER_STATE = seedState(Date.parse("2026-10-03T12:00:00+08:00"));

let state: MockState | null = null;
const listeners = new Set<() => void>();

function load(): MockState {
  if (state) return state;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockState;
      if (parsed.v === 4) state = parsed;
    }
  } catch {
    // 本地存储不可用时退回内存
  }
  state ??= seedState(Date.now());
  return state;
}

function emit() {
  for (const l of listeners) l();
}

function set(fn: (s: MockState) => MockState) {
  state = fn(load());
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = null;
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function getState(): MockState {
  return load();
}

export function useMock(): MockState {
  return useSyncExternalStore(subscribe, load, () => SERVER_STATE);
}

// ---------- 每个标签页自己的会话身份（主人 / 用被盗密码登录的新设备） ----------

const modeListeners = new Set<() => void>();
function readMode(): "owner" | "attacker" {
  try {
    return window.sessionStorage.getItem(MODE_KEY) === "attacker" ? "attacker" : "owner";
  } catch {
    return "owner";
  }
}
export function useSessionMode(): "owner" | "attacker" {
  return useSyncExternalStore(
    (cb) => {
      modeListeners.add(cb);
      return () => modeListeners.delete(cb);
    },
    readMode,
    () => "owner",
  );
}
export function setSessionMode(m: "owner" | "attacker") {
  window.sessionStorage.setItem(MODE_KEY, m);
  for (const l of modeListeners) l();
}

/** 首次渲染为 null（服务端没有「现在」），挂载后每 interval 毫秒刷新 */
export function useNow(interval = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, interval);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [interval]);
  return now;
}

// ---------- 派生值 ----------

export function activeMandates(s: MockState): MockMandate[] {
  return s.mandates.filter((m) => m.status === "active");
}

/** Zev 现在最多能花 = min(零钱包余额, 所有生效授权的剩余额度之和) */
export function maxLossMinor(s: MockState): bigint {
  if (s.session.frozen) return 0n;
  const remaining = activeMandates(s).reduce((a, m) => a + BigInt(m.remainingMinor), 0n);
  const pocket = BigInt(s.pocketMinor);
  return remaining < pocket ? remaining : pocket;
}

export function openPending(s: MockState, now: number): PendingConfirmation[] {
  return s.pending.filter((p) => p.status === "pending" && Date.parse(p.expiresAt) > now);
}

// ---------- actions ----------

const nowIso = () => new Date().toISOString();
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

function addActivity(s: MockState, kind: MockState["activity"][number]["kind"], text: Tx, risky = false): MockState {
  return { ...s, activity: [{ id: uid("ac"), at: nowIso(), kind, text, risky }, ...s.activity].slice(0, 40) };
}

function patchTask(s: MockState, taskId: string, fn: (t: MockTask) => MockTask): MockState {
  return { ...s, tasks: s.tasks.map((t) => (t.id === taskId ? fn(t) : t)) };
}

export type PayResult =
  | { ok: true; orderId: string }
  | { ok: false; code: "DENY" | "REVIEW_REQUIRED" | "ISSUER_DECLINED" | "FROZEN" | "INSUFFICIENT_POCKET" | "EXPIRED"; rules?: RuleId[] };

/**
 * 模拟结算：按当前数据重新判定一次（对应服务端 settle 内的 decide(ctx,"PAY")），
 * DENY 永远不放行；REVIEW 只有确认覆盖全部命中规则才放行。
 */
function settle(
  s: MockState,
  args: { taskId: string; mandateId: string; productId: string; confirmedRules: RuleId[]; cartVersion: number },
): { next: MockState; result: PayResult } {
  if (s.session.frozen) return { next: s, result: { ok: false, code: "FROZEN" } };
  const m = s.mandates.find((x) => x.id === args.mandateId);
  if (!m) return { next: s, result: { ok: false, code: "DENY", rules: ["MANDATE_REVOKED"] } };
  const p = productOf(args.productId);
  const ev = evaluate(m, p, { now: new Date(), revokedMerchants: s.demo.revokedMerchants });
  if (ev.outcome === "DENY") return { next: s, result: { ok: false, code: "DENY", rules: ev.rules.map((r) => r.id) } };
  if (ev.outcome === "REVIEW") {
    const need = ev.rules.filter((r) => r.severity === "REVIEW").map((r) => r.id);
    const covered = need.every((id) => args.confirmedRules.includes(id)) && !need.includes("INFO_MISSING");
    if (!covered) return { next: s, result: { ok: false, code: "REVIEW_REQUIRED", rules: need } };
  }
  if (s.demo.nextIssuerDecline) {
    return { next: { ...s, demo: { ...s.demo, nextIssuerDecline: false } }, result: { ok: false, code: "ISSUER_DECLINED" } };
  }
  if (BigInt(s.pocketMinor) < ev.total) return { next: s, result: { ok: false, code: "INSUFFICIENT_POCKET" } };

  const orderId = uid("ord");
  const order: MockOrder = {
    id: orderId,
    taskId: args.taskId,
    mandateId: m.id,
    mandateVersion: m.version,
    productId: p.id,
    merchantId: p.merchantId,
    qty: 1,
    subtotalMinor: ev.subtotal.toString(),
    shippingMinor: ev.shipping.toString(),
    feeMinor: ev.fee.toString(),
    totalMinor: ev.total.toString(),
    method: "fps",
    status: "paid",
    paidAt: nowIso(),
    cartVersion: args.cartVersion,
    idempotencyKey: uid("idem"),
    confirmedRules: args.confirmedRules,
    support: "none",
    candidates: candidatesFor(m.queryKind).map((c) => {
      const e = c.id === p.id ? ev : evaluate(m, c, { now: new Date(), revokedMerchants: s.demo.revokedMerchants });
      return { productId: c.id, outcome: e.outcome, rules: e.rules };
    }),
  };
  const remaining = BigInt(m.remainingMinor) - ev.total;
  const purchases = m.remainingPurchases - 1;
  const next: MockState = {
    ...s,
    pocketMinor: (BigInt(s.pocketMinor) - ev.total).toString(),
    pocketLog: [{ id: uid("pl"), at: nowIso(), kind: "spend" as const, amountMinor: ev.total.toString(), note: { zh: `${merchantOf(p.merchantId).name.zh} · ${p.name.zh}`, en: `${merchantOf(p.merchantId).name.en} · ${p.name.en}` } }, ...s.pocketLog],
    orders: [order, ...s.orders],
    mandates: s.mandates.map((x) =>
      x.id === m.id ? { ...x, remainingMinor: remaining.toString(), remainingPurchases: purchases, status: purchases <= 0 ? "completed" : x.status } : x,
    ),
  };
  return { next, result: { ok: true, orderId } };
}

export const actions = {
  reset() {
    set(() => seedState(Date.now()));
    try {
      window.sessionStorage.removeItem(MODE_KEY);
    } catch {
      // ignore
    }
    for (const l of modeListeners) l();
  },

  tick() {
    const now = Date.now();
    const s = load();
    const due = s.cooling.filter((c) => c.status === "waiting" && Date.parse(c.effectiveAt) <= now);
    const expired = s.pending.filter((p) => p.status === "pending" && Date.parse(p.expiresAt) <= now);
    if (due.length === 0 && expired.length === 0) return;
    set((s0) => {
      let s1: MockState = {
        ...s0,
        pending: s0.pending.map((p) => (expired.some((e) => e.id === p.id) ? { ...p, status: "expired" as const } : p)),
      };
      for (const c of due) {
        s1 = { ...s1, cooling: s1.cooling.map((x) => (x.id === c.id ? { ...x, status: "applied" as const } : x)) };
        if (c.kind === "raise_cap" && c.mandateId && c.toMinor) {
          s1 = {
            ...s1,
            mandates: s1.mandates.map((m) =>
              m.id === c.mandateId && m.status === "active"
                ? {
                    ...m,
                    perTxnMinor: c.toMinor!,
                    version: m.version + 1,
                    versions: [...m.versions, { v: m.version + 1, at: nowIso(), note: { zh: "冷静期结束，单笔上限已提高", en: "Cooling-off ended, per-order cap raised" } }],
                  }
                : m,
            ),
          };
        }
        if (c.kind === "address" && c.address) s1 = { ...s1, address: { zh: c.address, en: c.address } };
        s1 = addActivity(s1, "cooling", c.kind === "address" ? { zh: "新地址已生效", en: "New address is now active" } : { zh: "提高上限已生效", en: "Raised cap is now active" });
      }
      return s1;
    });
  },

  freeze() {
    set((s) =>
      addActivity(
        {
          ...s,
          session: { ...s.session, frozen: true, frozenAt: nowIso() },
          mandates: s.mandates.map((m) => (m.status === "active" ? { ...m, status: "revoked" as const, revokedAt: nowIso() } : m)),
          pending: s.pending.map((p) => (p.status === "pending" ? { ...p, status: "cancelled" as const } : p)),
          cooling: s.cooling.map((c) => (c.status === "waiting" ? { ...c, status: "cancelled" as const } : c)),
          devices: s.devices.map((d) => (d.isNew ? { ...d, readOnly: true } : d)),
        },
        "freeze",
        { zh: "一键冻结：撤销全部授权，Zev 停止付款", en: "Frozen: all mandates revoked, Zev stopped paying" },
      ),
    );
  },

  unfreeze() {
    set((s) => addActivity({ ...s, session: { ...s.session, frozen: false, frozenAt: null } }, "step_up", { zh: "用通行密钥解除冻结", en: "Unfrozen with passkey" }));
  },

  revokeMandate(id: string) {
    set((s) => {
      const m = s.mandates.find((x) => x.id === id);
      return addActivity(
        {
          ...s,
          mandates: s.mandates.map((x) => (x.id === id && x.status === "active" ? { ...x, status: "revoked" as const, revokedAt: nowIso() } : x)),
          pending: s.pending.map((p) => (p.mandateId === id && p.status === "pending" ? { ...p, status: "cancelled" as const } : p)),
        },
        "revoke",
        { zh: `撤销「${m?.title.zh ?? id}」`, en: `Revoked “${m?.title.en ?? id}”` },
      );
    });
  },

  signMandate(fields: DraftFields, taskText: string): string {
    const id = uid("md");
    const at = nowIso();
    const mandate: MockMandate = {
      id,
      title: fields.title,
      version: 1,
      status: "active",
      mode: fields.mode,
      queryKind: fields.queryKind,
      taskText,
      query: fields.query,
      preferredBrand: fields.preferredBrand,
      allowSubstituteBrand: fields.allowSubstituteBrand,
      minVolumeMl: fields.minVolumeMl,
      categories: fields.categories,
      perTxnMinor: fields.perTxnMinor,
      totalMinor: fields.totalMinor,
      remainingMinor: fields.totalMinor,
      maxPurchases: fields.maxPurchases,
      remainingPurchases: fields.maxPurchases,
      expiresAt: new Date(Date.now() + fields.days * 86_400_000).toISOString(),
      reviewWhen: fields.reviewWhen,
      protection: fields.protection,
      methods: fields.methods,
      createdAt: at,
      revokedAt: null,
      versions: [{ v: 1, at, note: { zh: "用通行密钥签发", en: "Signed with passkey" } }],
    };
    set((s) => addActivity({ ...s, mandates: [mandate, ...s.mandates] }, "step_up", { zh: `用通行密钥签发「${fields.title.zh}」`, en: `Signed “${fields.title.en}” with passkey` }));
    return id;
  },

  /** 收紧权限立即生效、不需要通行密钥：降低上限、减少次数、多加「先问我」 */
  tightenMandate(id: string, patch: Partial<Pick<MockMandate, "perTxnMinor" | "remainingPurchases" | "reviewWhen">>, note: Tx) {
    set((s) =>
      addActivity(
        {
          ...s,
          mandates: s.mandates.map((m) =>
            m.id === id && m.status === "active" ? { ...m, ...patch, version: m.version + 1, versions: [...m.versions, { v: m.version + 1, at: nowIso(), note }] } : m,
          ),
        },
        "revoke",
        note,
      ),
    );
  },

  requestRaiseCap(mandateId: string, toMinor: string, byAttacker = false) {
    set((s) => {
      const m = s.mandates.find((x) => x.id === mandateId);
      if (!m) return s;
      const c: CoolingChange = {
        id: uid("cool"),
        kind: "raise_cap",
        mandateId,
        fromMinor: m.perTxnMinor,
        toMinor,
        requestedAt: nowIso(),
        effectiveAt: new Date(Date.now() + COOLING_MS).toISOString(),
        status: "waiting",
        byAttacker,
      };
      const s1 = addActivity({ ...s, cooling: [c, ...s.cooling] }, "cooling", { zh: `申请提高「${m.title.zh}」单笔上限，24 小时后生效`, en: `Requested a higher cap on “${m.title.en}”, effective in 24 hours` });
      return addActivity(s1, "notice", { zh: `已短信通知 ${s.user.phone}`, en: `SMS sent to ${s.user.phone}` });
    });
  },

  requestAddressChange(address: string, byAttacker = false) {
    set((s) => {
      const c: CoolingChange = {
        id: uid("cool"),
        kind: "address",
        address,
        requestedAt: nowIso(),
        effectiveAt: new Date(Date.now() + COOLING_MS).toISOString(),
        status: "waiting",
        byAttacker,
      };
      const s1 = addActivity({ ...s, cooling: [c, ...s.cooling] }, "cooling", { zh: "申请修改收货地址，24 小时后生效", en: "Requested an address change, effective in 24 hours" }, byAttacker);
      return addActivity(s1, "notice", { zh: `已短信通知 ${s.user.phone}`, en: `SMS sent to ${s.user.phone}` });
    });
  },

  cancelCooling(id: string) {
    set((s) => addActivity({ ...s, cooling: s.cooling.map((c) => (c.id === id ? { ...c, status: "cancelled" as const } : c)) }, "cooling", { zh: "取消了一项待生效的修改", en: "Cancelled a pending change" }));
  },

  topUp(amountMinor: string) {
    set((s) => ({
      ...s,
      pocketMinor: (BigInt(s.pocketMinor) + BigInt(amountMinor)).toString(),
      pocketLog: [{ id: uid("pl"), at: nowIso(), kind: "topup" as const, amountMinor, note: { zh: "从 Tap & Go 充值（模拟）", en: "Top-up from Tap & Go (simulated)" } }, ...s.pocketLog],
    }));
  },

  // ---- 任务 ----
  createTask(task: Omit<MockTask, "createdAt" | "agentMode">): string {
    set((s) => ({ ...s, tasks: [{ ...task, createdAt: nowIso(), agentMode: s.demo.agentMode }, ...s.tasks] }));
    return task.id;
  },

  appendBlocks(taskId: string, blocks: Block[]) {
    set((s) => patchTask(s, taskId, (t) => ({ ...t, blocks: [...t.blocks, ...blocks] })));
  },

  updateBlock(taskId: string, index: number, block: Block) {
    set((s) => patchTask(s, taskId, (t) => ({ ...t, blocks: t.blocks.map((b, i) => (i === index ? block : b)) })));
  },

  updateTask(taskId: string, patch: Partial<Pick<MockTask, "status" | "mandateId" | "title" | "mode">>) {
    set((s) => patchTask(s, taskId, (t) => ({ ...t, ...patch })));
  },

  addTimeline(taskId: string, steps: TimelineStep[]) {
    set((s) => patchTask(s, taskId, (t) => ({ ...t, timeline: [...t.timeline, ...steps] })));
  },

  addPending(p: Omit<PendingConfirmation, "id" | "createdAt" | "expiresAt" | "status">): string {
    const id = uid("pc");
    set((s) => ({
      ...s,
      pending: [{ ...p, id, createdAt: nowIso(), expiresAt: new Date(Date.now() + CONFIRM_TTL_MS).toISOString(), status: "pending" as const }, ...s.pending],
    }));
    return id;
  },

  /** 范围内自动付款（ALLOW）或用户主动点「确认购买」 */
  pay(args: { taskId: string; mandateId: string; productId: string; confirmedRules?: RuleId[]; cartVersion?: number }): PayResult {
    let result: PayResult = { ok: false, code: "DENY" };
    set((s) => {
      const r = settle(s, { ...args, confirmedRules: args.confirmedRules ?? [], cartVersion: args.cartVersion ?? 1 });
      result = r.result;
      return r.next;
    });
    return result;
  },

  /** 确认 REVIEW：绑定购物车版本与命中的规则，30 分钟内有效 */
  confirmPending(id: string): PayResult {
    const s = load();
    const p = s.pending.find((x) => x.id === id);
    if (!p || p.status !== "pending" || Date.parse(p.expiresAt) <= Date.now()) return { ok: false, code: "EXPIRED" };
    const r = actions.pay({ taskId: p.taskId, mandateId: p.mandateId, productId: p.productId, confirmedRules: p.rules.map((x) => x.id), cartVersion: p.cartVersion });
    set((s1) => {
      let s2: MockState = { ...s1, pending: s1.pending.map((x) => (x.id === id ? { ...x, status: r.ok ? ("confirmed" as const) : x.status } : x)) };
      if (r.ok) {
        s2 = patchTask(s2, p.taskId, (t) => ({
          ...t,
          status: "completed",
          blocks: [...t.blocks, { kind: "receipt", orderId: r.orderId, at: nowIso() }],
          timeline: [
            ...t.timeline,
            { checkpoint: "PAY", title: { zh: "确认后结算", en: "Settled after approval" }, detail: { zh: "确认覆盖了全部命中的规则，购物车版本一致，结算时重新判定后放行。", en: "Your approval covered every rule hit and the cart version matched; settlement re-checked and passed." }, outcome: "ALLOW", at: nowIso() },
          ],
        }));
        s2 = addActivity(s2, "step_up", { zh: "用通行密钥确认一笔待确认订单", en: "Approved a pending order with passkey" });
      }
      return s2;
    });
    return r;
  },

  cancelPending(id: string) {
    set((s) => {
      const p = s.pending.find((x) => x.id === id);
      let s1: MockState = { ...s, pending: s.pending.map((x) => (x.id === id ? { ...x, status: "cancelled" as const } : x)) };
      if (p) s1 = patchTask(s1, p.taskId, (t) => ({ ...t, status: "failed" }));
      return s1;
    });
  },

  requestSupport(orderId: string, note?: string) {
    set((s) => ({ ...s, orders: s.orders.map((o) => (o.id === orderId ? { ...o, support: "manual_review" as const, supportNote: note } : o)) }));
  },

  // ---- 偏好与连接 ----
  removePref(id: string) {
    set((s) => ({ ...s, prefs: s.prefs.filter((p) => p.id !== id) }));
  },
  addPref(label: Tx, group: MockState["prefs"][number]["group"] = "style", source: MockState["prefs"][number]["source"] = "chat") {
    set((s) => ({ ...s, prefs: [...s.prefs, { id: uid("pf"), group, label, source }] }));
  },
  clearPrefs() {
    set((s) => ({ ...s, prefs: [] }));
  },
  setConnection(key: keyof MockState["connections"], on: boolean) {
    set((s) => {
      const s1 = { ...s, connections: { ...s.connections, [key]: on } };
      const name = key === "tapngo" ? { zh: "Tap & Go", en: "Tap & Go" } : { zh: "快快屋收藏夹", en: "KuaiKuai favourites" };
      return addActivity(s1, "consent", on ? { zh: `授权 ${name.zh}`, en: `Connected ${name.en}` } : { zh: `撤销 ${name.zh} 的授权`, en: `Disconnected ${name.en}` });
    });
    if (key === "kuaikuaiFavorites" && on) {
      const s = load();
      if (!s.prefs.some((p) => p.source === "favorites")) {
        actions.addPref({ zh: "收藏里多是 不锈钢", en: "Favourites lean steel" }, "material", "favorites");
      }
    }
  },
  completeKyc() {
    set((s) => ({ ...s, user: { ...s.user, walletKyc: "upgraded" as const } }));
  },

  // ---- 安全 ----
  stepUpFailed(text: Tx) {
    set((s) => addActivity(s, "step_up_failed", text, true));
  },
  attackerLogin() {
    set((s) => {
      if (s.devices.some((d) => d.isNew)) return s;
      const s1: MockState = {
        ...s,
        devices: [
          { id: "dev_new", name: { zh: "Edge · Windows（新设备）", en: "Edge · Windows (new device)" }, place: { zh: "香港 旺角", en: "Mong Kok, HK" }, lastSeen: nowIso(), passkey: false, readOnly: true, isNew: true },
          ...s.devices,
        ],
      };
      const s2 = addActivity(s1, "login", { zh: "新设备 Edge · Windows 用密码登录，只能查看", en: "New device Edge · Windows signed in with password, read-only" }, true);
      return addActivity(s2, "notice", { zh: `已短信通知 ${s.user.phone}：有新设备登录`, en: `SMS sent to ${s.user.phone}: new device sign-in` });
    });
  },
  signOutDevice(id: string) {
    set((s) => addActivity({ ...s, devices: s.devices.filter((d) => d.id !== id) }, "login", { zh: "让一台设备退出登录", en: "Signed a device out" }));
  },

  // ---- 演示控制 ----
  toggleMerchantRevoked(id: string) {
    set((s) => ({
      ...s,
      demo: { ...s.demo, revokedMerchants: s.demo.revokedMerchants.includes(id) ? s.demo.revokedMerchants.filter((x) => x !== id) : [...s.demo.revokedMerchants, id] },
    }));
  },
  setNextIssuerDecline(on: boolean) {
    set((s) => ({ ...s, demo: { ...s.demo, nextIssuerDecline: on } }));
  },
  setAgentMode(mode: "llm" | "fallback") {
    set((s) => ({ ...s, demo: { ...s.demo, agentMode: mode } }));
  },
  /** S2：确认前商品涨价 → 购物车变成新版本，旧确认失效，重新进入「先问你」 */
  bumpPendingPrice(id: string) {
    set((s) => {
      const p = s.pending.find((x) => x.id === id);
      if (!p || p.status !== "pending") return s;
      const fresh: PendingConfirmation = {
        ...p,
        id: uid("pc"),
        cartVersion: p.cartVersion + 1,
        totalMinor: (BigInt(p.totalMinor) + 500n).toString(),
        createdAt: nowIso(),
        expiresAt: new Date(Date.now() + CONFIRM_TTL_MS).toISOString(),
        status: "pending",
      };
      const s1: MockState = { ...s, pending: [fresh, ...s.pending.map((x) => (x.id === id ? { ...x, status: "invalidated" as const } : x))] };
      return patchTask(s1, p.taskId, (t) => ({
        ...t,
        blocks: [...t.blocks, { kind: "zev", text: { zh: `价格变了，购物车更新为 v${fresh.cartVersion}。之前的确认已失效，需要你重新确认。`, en: `The price changed and the cart is now v${fresh.cartVersion}. Your earlier approval no longer applies.` }, at: nowIso() }, { kind: "awaiting", pendingId: fresh.id, at: nowIso() }],
      }));
    });
  },
};
