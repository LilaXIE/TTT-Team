// 凭证（Trust）读取。买家 agentic_id、商家 merchant_license。状态只来自数据库。
import type { CredentialStatus } from "@/contracts/schemas";
import { query, type Tx } from "@/server/db/tx";

export interface CredentialView {
  subjectType: "buyer" | "merchant";
  subjectId: string;
  type: string;
  issuer: string;
  status: CredentialStatus;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

type Row = {
  subject_type: "buyer" | "merchant";
  subject_id: string;
  type: string;
  issuer: string;
  status: "valid" | "revoked" | "expired";
  issued_at: Date;
  expires_at: Date | null;
  revoked_at: Date | null;
};

function toView(r: Row): CredentialView {
  const expiredByTime = r.expires_at ? r.expires_at.getTime() <= Date.now() : false;
  return {
    subjectType: r.subject_type,
    subjectId: r.subject_id,
    type: r.type,
    issuer: r.issuer,
    status: r.status === "valid" && expiredByTime ? "expired" : r.status,
    issuedAt: r.issued_at.toISOString(),
    expiresAt: r.expires_at?.toISOString() ?? null,
    revokedAt: r.revoked_at?.toISOString() ?? null,
  };
}

const SQL = `SELECT subject_type, subject_id, type, issuer, status, issued_at, expires_at, revoked_at
             FROM credentials WHERE subject_type = $1 AND subject_id = $2`;

export async function getBuyerCredential(userId: string, tx?: Tx): Promise<CredentialView | null> {
  const r = tx ? await tx.query<Row>(SQL, ["buyer", userId]) : await query<Row>(SQL, ["buyer", userId]);
  return r.rows[0] ? toView(r.rows[0]) : null;
}

export async function getMerchantCredential(merchantId: string, tx?: Tx): Promise<CredentialView | null> {
  const r = tx ? await tx.query<Row>(SQL, ["merchant", merchantId]) : await query<Row>(SQL, ["merchant", merchantId]);
  return r.rows[0] ? toView(r.rows[0]) : null;
}

export function credentialStatusOf(c: CredentialView | null): CredentialStatus {
  return c ? c.status : "missing";
}
