import { z } from "zod";
import { hkdToMinor } from "@/contracts/money";
import { query, withTransaction, type Tx } from "@/server/db/tx";

const ReviewWhen = z.object({
  nearCapPct: z.number().int().min(50).max(100).nullable(),
  substituteBrand: z.boolean(),
  watchCategories: z.array(z.string()),
  newMerchantDays: z.number().int().min(1).max(365).nullable(),
  priceAboveRefPct: z.number().int().min(1).max(200).nullable(),
});

export const PreferenceInput = z.object({
  perTxnHKD: z.string().regex(/^\d+(\.\d{1,2})?$/),
  totalHKD: z.string().regex(/^\d+(\.\d{1,2})?$/),
  maxPurchases: z.number().int().min(1).max(20),
  reviewWhen: ReviewWhen,
  protectionLevel: z.enum(["standard", "enhanced"]),
  allowedMethods: z.array(z.string()).min(1),
});
export type PreferenceInput = z.infer<typeof PreferenceInput>;

export interface UserPreferences {
  perTxnHKD: string;
  totalHKD: string;
  maxPurchases: number;
  reviewWhen: z.infer<typeof ReviewWhen>;
  protectionLevel: "standard" | "enhanced";
  allowedMethods: string[];
}

const DEFAULTS: UserPreferences = {
  perTxnHKD: "150",
  totalHKD: "300",
  maxPurchases: 2,
  reviewWhen: { nearCapPct: 95, substituteBrand: true, watchCategories: ["supplement"], newMerchantDays: null, priceAboveRefPct: null },
  protectionLevel: "standard",
  allowedMethods: ["fps", "tapngo_mc"],
};

function minorToHkd(minor: string): string {
  const v = BigInt(minor);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  return `${neg ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

function toPreferences(row: { per_txn_cap_minor: string; total_cap_minor: string; max_purchases: number; review_when: unknown; protection_level: "standard" | "enhanced"; allowed_methods: string[] }): UserPreferences {
  return {
    perTxnHKD: minorToHkd(String(row.per_txn_cap_minor)),
    totalHKD: minorToHkd(String(row.total_cap_minor)),
    maxPurchases: row.max_purchases,
    reviewWhen: ReviewWhen.parse(row.review_when),
    protectionLevel: row.protection_level,
    allowedMethods: row.allowed_methods,
  };
}

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  const result = await query(`SELECT per_txn_cap_minor, total_cap_minor, max_purchases, review_when, protection_level, allowed_methods FROM user_preferences WHERE user_id=$1`, [userId]);
  if (!result.rows[0]) return DEFAULTS;
  return toPreferences(result.rows[0] as never);
}

export async function upsertUserPreferences(userId: string, input: unknown): Promise<UserPreferences> {
  const data = PreferenceInput.parse(input);
  const perTxn = hkdToMinor(data.perTxnHKD);
  const total = hkdToMinor(data.totalHKD);
  if (total < perTxn) throw new Error("授权总额不能小于单笔上限。");
  return withTransaction(async (tx) => savePreferences(tx, userId, data, perTxn.toString(), total.toString()));
}

async function savePreferences(tx: Tx, userId: string, data: PreferenceInput, perTxn: string, total: string) {
  const result = await tx.query(`
    INSERT INTO user_preferences (user_id, per_txn_cap_minor, total_cap_minor, max_purchases, review_when, protection_level, allowed_methods)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (user_id) DO UPDATE SET per_txn_cap_minor=EXCLUDED.per_txn_cap_minor, total_cap_minor=EXCLUDED.total_cap_minor,
      max_purchases=EXCLUDED.max_purchases, review_when=EXCLUDED.review_when, protection_level=EXCLUDED.protection_level,
      allowed_methods=EXCLUDED.allowed_methods, updated_at=now()
    RETURNING per_txn_cap_minor, total_cap_minor, max_purchases, review_when, protection_level, allowed_methods
  `, [userId, perTxn, total, data.maxPurchases, JSON.stringify(data.reviewWhen), data.protectionLevel, data.allowedMethods]);
  return toPreferences(result.rows[0] as never);
}

export { DEFAULTS };
