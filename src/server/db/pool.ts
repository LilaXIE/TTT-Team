import { Pool, types } from "pg";

// BIGINT (oid 20) 默认返回字符串；我们在读取处显式 BigInt()，这里保持字符串以免精度丢失。
types.setTypeParser(20, (v) => v);

declare global {
  // eslint-disable-next-line no-var
  var __mwPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!globalThis.__mwPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalThis.__mwPool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalThis.__mwPool;
}

export async function closePool() {
  if (globalThis.__mwPool) {
    await globalThis.__mwPool.end();
    globalThis.__mwPool = undefined;
  }
}
