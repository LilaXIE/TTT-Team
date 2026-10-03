import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { query } from "@/server/db/tx";
import { AppError } from "@/contracts/errors";

const ALGORITHM = "aes-256-gcm";
const RUNTIME_DIR = path.join(os.tmpdir(), "mandate-wallet-taobao");

type StoredState = { iv: string; tag: string; data: string };

function key(): Buffer {
  const value = process.env.TAOBAO_STATE_KEY;
  if (!value) throw new AppError("INTERNAL", "未配置淘宝登录态加密密钥。请在 .env.local 配置 TAOBAO_STATE_KEY，然后重启 Next.js。", { status: 503 });
  const buffer = Buffer.from(value, "base64");
  if (buffer.length !== 32) throw new AppError("INTERNAL", "TAOBAO_STATE_KEY 格式错误：必须是 32 字节随机值的 Base64。", { status: 503 });
  return buffer;
}

export function assertTaobaoStateKey(): void {
  key();
}


function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return JSON.stringify({ iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") } satisfies StoredState);
}

function decrypt(value: string): string {
  const stored = JSON.parse(value) as StoredState;
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(stored.iv, "base64"));
  decipher.setAuthTag(Buffer.from(stored.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(stored.data, "base64")), decipher.final()]).toString("utf8");
}

async function runtimeState(userId: string): Promise<string | null> {
  const row = await query<{ state_ciphertext: string }>("SELECT state_ciphertext FROM taobao_accounts WHERE user_id=$1", [userId]);
  if (!row.rows[0]) return null;
  await fs.mkdir(RUNTIME_DIR, { recursive: true });
  const filename = path.join(RUNTIME_DIR, `${userId}.json`);
  await fs.writeFile(filename, decrypt(row.rows[0].state_ciphertext), { mode: 0o600 });
  return filename;
}

export async function hasTaobaoLogin(userId: string): Promise<boolean> {
  const result = await query("SELECT 1 FROM taobao_accounts WHERE user_id=$1", [userId]);
  return Boolean(result.rowCount);
}

export async function saveTaobaoState(userId: string, state: string): Promise<void> {
  JSON.parse(state);
  await query(
    `INSERT INTO taobao_accounts (user_id, state_ciphertext, last_login_at, updated_at)
     VALUES ($1, $2, now(), now())
     ON CONFLICT (user_id) DO UPDATE SET state_ciphertext=EXCLUDED.state_ciphertext, last_login_at=now(), updated_at=now()`,
    [userId, encrypt(state)],
  );
}

function runLoginScript(stateFile: string, profileDir: string): Promise<void> {
  const script = process.env.TAOBAO_LOGIN_SAVER_PATH || path.resolve(process.cwd(), "login_saver.py");
  const python = process.env.TAOBAO_PYTHON || "python";
  return new Promise((resolve, reject) => {
    const child = spawn(python, [script], {
      cwd: path.dirname(script),
      windowsHide: true,
      env: { ...process.env, TAOBAO_STATE_FILE: stateFile, TAOBAO_PROFILE_DIR: profileDir, TAOBAO_LOGIN_WAIT_SECONDS: process.env.TAOBAO_LOGIN_WAIT_SECONDS || "180", PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });
    let stderr = "";
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr || stdout || "淘宝登录脚本执行失败。")));
  });
}

let activeLogin: Promise<void> | null = null;

export async function startTaobaoLogin(userId: string): Promise<void> {
  assertTaobaoStateKey();
  if (activeLogin) return activeLogin;
  activeLogin = (async () => {
    await fs.mkdir(RUNTIME_DIR, { recursive: true });
    const stateFile = path.join(RUNTIME_DIR, `${userId}-login.json`);
    const profileDir = path.join(RUNTIME_DIR, `${userId}-profile`);
    await fs.rm(stateFile, { force: true });
    await fs.mkdir(profileDir, { recursive: true });
    await runLoginScript(stateFile, profileDir);
    const state = await fs.readFile(stateFile, "utf8");
    await saveTaobaoState(userId, state);
    await fs.rm(stateFile, { force: true });
  })();
  try { await activeLogin; } finally { activeLogin = null; }
}

export async function stateFileForUser(userId: string): Promise<string | null> {
  return runtimeState(userId);
}
