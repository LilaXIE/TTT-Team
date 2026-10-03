import { z } from "zod";
import { cookies } from "next/headers";
import { hashPassword } from "@/server/auth/password";
import { login, sessionCookieOptions } from "@/server/auth/session";
import { query, withTransaction } from "@/server/db/tx";
import { json, readJson, route } from "@/server/http";
import { consumeVerificationCode } from "@/server/smtp";

const Body = z.object({ email: z.string().email(), password: z.string().min(8).regex(/[A-Za-z]/).regex(/\d/), displayName: z.string().min(1).max(80), code: z.string().length(6) });
export const POST = route(async (req: Request) => { const data = Body.parse(await readJson(req)); const email = data.email.toLowerCase(); const verified = await consumeVerificationCode(email, "registration", data.code); if (!verified) return json({ error: { message: "验证码错误或已过期。" } }, { status: 400 }); const exists = await query("SELECT 1 FROM users WHERE email=$1", [email]); if (exists.rowCount) return json({ error: { message: "邮箱已注册。" } }, { status: 409 }); await withTransaction(async (tx) => { await tx.query("INSERT INTO users (email, password_hash, display_name) VALUES ($1,$2,$3)", [email, await hashPassword(data.password), data.displayName]); }); const result = await login(email, data.password); const jar = await cookies(); jar.set({ ...sessionCookieOptions(result.expiresAt), value: result.token }); return json({ user: result.user }); });
