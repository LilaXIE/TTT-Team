import { query } from "@/server/db/tx";

export async function getBuyerBalanceMinor(userId: string): Promise<bigint> {
  const r = await query<{ balance_minor: string }>(`SELECT balance_minor FROM accounts WHERE owner_type='buyer' AND owner_id=$1`, [userId]);
  return r.rows[0] ? BigInt(r.rows[0].balance_minor) : 0n;
}
