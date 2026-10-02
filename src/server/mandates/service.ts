// 授权书：草稿编译、预览、创建、读取、撤销。规格：docs/MANUAL.md §4、§6.4。
import { AppError } from "@/contracts/errors";
import { hkdToMinor } from "@/contracts/money";
import {
  MandateDraft,
  type Decision,
  type EngineContext,
  type MandateJson,
  type MandateSnapshot,
  type MandateStatus,
  type PreviewScenario,
} from "@/contracts/schemas";
import { query, withTransaction, type Tx } from "@/server/db/tx";
import { getScenarios } from "@/server/fixtures";
import { decideCandidate } from "@/server/rules/engine";

// ---------- 编译 ----------

/** 加强模式只增加两条 REVIEW 条件，不改任何 DENY 规则。 */
export function compileDraft(draftInput: unknown): MandateJson {
  const d = MandateDraft.parse(draftInput);
  const perTxn = hkdToMinor(d.perTxnHKD);
  const total = hkdToMinor(d.totalHKD);
  if (perTxn <= 0n) throw new AppError("VALIDATION_ERROR", "单笔上限必须大于 0。");
  if (total < perTxn) throw new AppError("VALIDATION_ERROR", "授权总额不能小于单笔上限。");
  if (new Date(d.expiresAt).getTime() <= Date.now()) throw new AppError("VALIDATION_ERROR", "有效期必须晚于现在。");

  const reviewWhen = { ...d.reviewWhen };
  if (d.protectionLevel === "enhanced") {
    reviewWhen.newMerchantDays = reviewWhen.newMerchantDays ?? 30;
    reviewWhen.priceAboveRefPct = reviewWhen.priceAboveRefPct ?? 20;
  }

  return {
    task: d.task,
    scope: { categories: d.categories, merchantDeny: d.merchantDeny },
    caps: { perTxnMinor: perTxn.toString(), totalMinor: total.toString(), maxPurchases: d.maxPurchases },
    reviewWhen,
    protectionLevel: d.protectionLevel,
    allowedMethods: d.allowedMethods,
    expiresAt: new Date(d.expiresAt).toISOString(),
  };
}

/** 从编译后的 JSON 构造一个"全新"快照（预览用：剩余=总额，次数=max）。 */
export function snapshotFromJson(json: MandateJson, id = "preview", version = 1): MandateSnapshot {
  return {
    id,
    version,
    status: "active",
    expiresAt: new Date(json.expiresAt),
    revokedAt: null,
    task: json.task,
    scope: json.scope,
    caps: { perTxnMinor: BigInt(json.caps.perTxnMinor), totalMinor: BigInt(json.caps.totalMinor), maxPurchases: json.caps.maxPurchases },
    reviewWhen: json.reviewWhen,
    allowedMethods: json.allowedMethods,
    remainingMinor: BigInt(json.caps.totalMinor),
    remainingPurchases: json.caps.maxPurchases,
  };
}

// ---------- 预览 ----------

export interface PreviewCard {
  scenarioId: string;
  title: string;
  description: string;
  totalMinor: string;
  decision: Decision;
}

function scenarioContext(s: PreviewScenario, mandate: MandateSnapshot, now: Date): EngineContext {
  const unit = BigInt(s.product.priceMinor);
  const subtotal = unit * BigInt(s.qty);
  const shipping = BigInt(s.shippingMinor);
  const product = {
    id: s.product.id,
    category: s.product.category,
    brand: s.product.brand,
    spec: s.product.spec,
    priceMinor: unit,
    refPriceMinor: BigInt(s.product.refPriceMinor),
    riskTags: s.product.riskTags,
  };
  return {
    now,
    mandate,
    buyerCredential: { status: "valid" },
    merchant: { id: s.merchant.id, name: s.merchant.name, credentialStatus: s.merchant.credentialStatus, registeredAt: new Date(s.merchant.registeredAt) },
    product,
    cart: {
      version: 1,
      items: [{ ...product, qty: s.qty }],
      subtotalMinor: subtotal,
      shippingMinor: shipping,
      consumerFeeMinor: 0n,
      totalMinor: subtotal + shipping,
      quoteExpiresAt: new Date(now.getTime() + 10 * 60_000),
    },
    paymentMethod: {
      id: s.methodId,
      label: s.methodId,
      merchantAccepts: s.merchant.acceptsMethods.includes(s.methodId),
      userEnabled: true,
    },
  };
}

/**
 * 预览检验的是授权书的"边界"（品类、上限、先问我条件、商家凭证），不是本次任务的具体规格。
 * 因此快照里去掉 minSpec / preferredBrand，否则"维他命 C"会因为"不满足 2L"被拒，误导用户。
 */
export function preview(draftInput: unknown, now = new Date()): PreviewCard[] {
  const json = compileDraft(draftInput);
  const mandate = snapshotFromJson({ ...json, task: { ...json.task, minSpec: {}, preferredBrand: null } });
  return getScenarios().scenarios.map((s) => {
    const ctx = scenarioContext(s, mandate, now);
    return {
      scenarioId: s.id,
      title: s.title,
      description: s.description,
      totalMinor: ctx.cart!.totalMinor.toString(),
      decision: decideCandidate(ctx),
    };
  });
}

// ---------- 持久化 ----------

export interface MandateRecord extends MandateJson {
  id: string;
  userId: string;
  version: number;
  status: MandateStatus;
  remainingMinor: string;
  remainingPurchases: number;
  createdAt: string;
  revokedAt: string | null;
  taskText: string;
}

type Row = {
  id: string;
  user_id: string;
  version: number;
  status: MandateStatus;
  task: MandateJson["task"];
  scope: MandateJson["scope"];
  caps: MandateJson["caps"];
  review_when: MandateJson["reviewWhen"];
  protection_level: "standard" | "enhanced";
  allowed_methods: string[];
  remaining_minor: string;
  remaining_purchases: number;
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
  task_text: string;
};

const COLS = `id, user_id, version, status, task, scope, caps, review_when, protection_level, allowed_methods,
  remaining_minor, remaining_purchases, expires_at, created_at, revoked_at, task->>'taskText' AS task_text`;

function toRecord(r: Row): MandateRecord {
  return {
    id: r.id,
    userId: r.user_id,
    version: r.version,
    status: r.status,
    task: r.task,
    scope: r.scope,
    caps: r.caps,
    reviewWhen: r.review_when,
    protectionLevel: r.protection_level,
    allowedMethods: r.allowed_methods,
    remainingMinor: String(r.remaining_minor),
    remainingPurchases: r.remaining_purchases,
    expiresAt: r.expires_at.toISOString(),
    createdAt: r.created_at.toISOString(),
    revokedAt: r.revoked_at?.toISOString() ?? null,
    taskText: r.task_text ?? "",
  };
}

export async function createMandate(userId: string, draftInput: unknown): Promise<MandateRecord> {
  const draft = MandateDraft.parse(draftInput);
  const json = compileDraft(draft);
  const task = { ...json.task, taskText: draft.taskText };
  return withTransaction(async (tx) => {
    const r = await tx.query<Row>(
      `INSERT INTO mandates (user_id, task, scope, caps, review_when, protection_level, allowed_methods,
         per_txn_cap_minor, total_cap_minor, remaining_minor, max_purchases, remaining_purchases, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,$10,$11)
       RETURNING ${COLS}`,
      [
        userId,
        JSON.stringify(task),
        JSON.stringify(json.scope),
        JSON.stringify(json.caps),
        JSON.stringify(json.reviewWhen),
        json.protectionLevel,
        json.allowedMethods,
        json.caps.perTxnMinor,
        json.caps.totalMinor,
        json.caps.maxPurchases,
        json.expiresAt,
      ],
    );
    const rec = toRecord(r.rows[0]);
    await tx.query(`INSERT INTO mandate_events (mandate_id, type, payload) VALUES ($1, 'created', $2)`, [rec.id, JSON.stringify({ version: 1, protectionLevel: json.protectionLevel })]);
    await tx.query(`INSERT INTO audit_events (actor, action, entity, entity_id, payload) VALUES ($1, 'mandate.create', 'mandate', $2, $3)`, [`user:${userId}`, rec.id, JSON.stringify({ caps: json.caps })]);
    return rec;
  });
}

export async function getMandate(userId: string, id: string): Promise<MandateRecord> {
  const r = await query<Row>(`SELECT ${COLS} FROM mandates WHERE id = $1 AND user_id = $2`, [id, userId]);
  if (!r.rows[0]) throw new AppError("NOT_FOUND", "授权书不存在。");
  return toRecord(r.rows[0]);
}

export async function listMandates(userId: string): Promise<MandateRecord[]> {
  const r = await query<Row>(`SELECT ${COLS} FROM mandates WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`, [userId]);
  return r.rows.map(toRecord);
}

/** 撤销：status=revoked + 事件。之后任何 pay 都 DENY MANDATE_REVOKED（结算事务内重读）。幂等。 */
export async function revokeMandate(userId: string, id: string): Promise<MandateRecord> {
  return withTransaction(async (tx) => {
    const r = await tx.query<Row>(
      `UPDATE mandates SET status = 'revoked', revoked_at = COALESCE(revoked_at, now())
       WHERE id = $1 AND user_id = $2 AND status IN ('active','revoked')
       RETURNING ${COLS}`,
      [id, userId],
    );
    if (!r.rows[0]) {
      const exists = await tx.query(`SELECT status FROM mandates WHERE id = $1 AND user_id = $2`, [id, userId]);
      if (!exists.rowCount) throw new AppError("NOT_FOUND", "授权书不存在。");
      throw new AppError("VALIDATION_ERROR", `授权书状态为 ${exists.rows[0].status}，无需撤销。`);
    }
    await tx.query(`INSERT INTO mandate_events (mandate_id, type, payload) VALUES ($1, 'revoked', '{}')`, [id]);
    await tx.query(`INSERT INTO audit_events (actor, action, entity, entity_id) VALUES ($1, 'mandate.revoke', 'mandate', $2)`, [`user:${userId}`, id]);
    return toRecord(r.rows[0]);
  });
}

/** 事务内读取并锁定授权书（结算用）。返回引擎快照。 */
export async function lockMandateSnapshot(tx: Tx, id: string): Promise<MandateSnapshot | null> {
  const r = await tx.query<Row>(`SELECT ${COLS} FROM mandates WHERE id = $1 FOR UPDATE`, [id]);
  const row = r.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    task: row.task,
    scope: row.scope,
    caps: { perTxnMinor: BigInt(row.caps.perTxnMinor), totalMinor: BigInt(row.caps.totalMinor), maxPurchases: row.caps.maxPurchases },
    reviewWhen: row.review_when,
    allowedMethods: row.allowed_methods,
    remainingMinor: BigInt(row.remaining_minor),
    remainingPurchases: row.remaining_purchases,
  };
}
