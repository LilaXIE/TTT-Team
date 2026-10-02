// 会话：32 字节随机 token，数据库只存 sha256；Cookie HttpOnly + SameSite=Lax，8 小时。
// 每个受保护的 Route Handler 第一行调用 requireSession(req)。不用 middleware。
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { AppError } from "@/contracts/errors";
import { query } from "@/server/db/tx";
import { verifyPassword } from "./password";

export const SESSION_COOKIE = "mw_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function login(email: string, password: string): Promise<{ user: SessionUser; token: string; expiresAt: Date }> {
  const r = await query<{ id: string; email: string; display_name: string; password_hash: string }>(
    `SELECT id, email, display_name, password_hash FROM users WHERE email = $1`,
    [email.trim().toLowerCase()],
  );
  const row = r.rows[0];
  // 用户不存在时也跑一次 compare，避免时间侧信道暴露账号存在性
  const ok = row ? await verifyPassword(password, row.password_hash) : await verifyPassword(password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinval");
  if (!row || !ok) throw new AppError("AUTH_REQUIRED", "邮箱或密码不正确。", { status: 401 });

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query(`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`, [row.id, sha256(token), expiresAt]);
  await query(`DELETE FROM sessions WHERE expires_at < now()`);
  return { user: { id: row.id, email: row.email, displayName: row.display_name }, token, expiresAt };
}

export async function logout(token: string | undefined) {
  if (!token) return;
  await query(`DELETE FROM sessions WHERE token_hash = $1`, [sha256(token)]);
}

export async function getSessionFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length < 32) return null;
  const r = await query<{ id: string; email: string; display_name: string; token_hash: string }>(
    `SELECT u.id, u.email, u.display_name, s.token_hash
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [sha256(token)],
  );
  const row = r.rows[0];
  if (!row) return null;
  // 常数时间比较（防御性；索引查询已匹配）
  const a = Buffer.from(row.token_hash);
  const b = Buffer.from(sha256(token));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { id: row.id, email: row.email, displayName: row.display_name };
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  return getSessionFromToken(jar.get(SESSION_COOKIE)?.value);
}

/** Route Handler 第一行调用。未登录抛 AUTH_REQUIRED(401)。 */
export async function requireSession(req: Request): Promise<SessionUser> {
  const token = readCookie(req.headers.get("cookie"), SESSION_COOKIE);
  const user = await getSessionFromToken(token);
  if (!user) throw new AppError("AUTH_REQUIRED", "请先登录。", { status: 401 });
  return user;
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}
