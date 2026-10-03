import { z } from "zod";
import { createCipheriv, randomBytes } from "node:crypto";
import { requireSession } from "@/server/auth/session";
import { query } from "@/server/db/tx";
import { json, readJson, route } from "@/server/http";

const Body = z.object({ senderEmail: z.string().email(), host: z.string().min(1), port: z.number().int().min(1).max(65535), useSsl: z.boolean(), password: z.string().min(1) });
function encrypt(value: string) { const secret = process.env.SMTP_STATE_KEY || process.env.TAOBAO_STATE_KEY; if (!secret) throw new Error("SMTP_STATE_KEY is not configured"); const key = Buffer.from(secret, "base64"); const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, iv); const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); return JSON.stringify({ iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") }); }
export const GET = route(async (req: Request) => { const user = await requireSession(req); const result = await query("SELECT sender_email, host, port, use_ssl FROM user_smtp_settings WHERE user_id=$1", [user.id]); return json({ configured: Boolean(result.rows[0]), settings: result.rows[0] ?? null }); });
export const POST = route(async (req: Request) => { const user = await requireSession(req); const data = Body.parse(await readJson(req)); await query(`INSERT INTO user_smtp_settings (user_id, sender_email, host, port, use_ssl, password_ciphertext) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id) DO UPDATE SET sender_email=EXCLUDED.sender_email, host=EXCLUDED.host, port=EXCLUDED.port, use_ssl=EXCLUDED.use_ssl, password_ciphertext=EXCLUDED.password_ciphertext, updated_at=now()`, [user.id, data.senderEmail, data.host, data.port, data.useSsl, encrypt(data.password)]); return json({ configured: true }); });
