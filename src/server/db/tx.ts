// 事务封装：一个事务一个 client；SET LOCAL 超时；序列化/死锁错误重试 2 次。
import type { PoolClient } from "pg";
import { AppError } from "@/contracts/errors";
import { getPool } from "./pool";

export type Tx = PoolClient;

const RETRYABLE = new Set(["40001", "40P01"]);
const LOCK_TIMEOUT = "55P03";

export interface TxOptions {
  retries?: number;
  lockTimeoutMs?: number;
  statementTimeoutMs?: number;
}

export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>, opts: TxOptions = {}): Promise<T> {
  const retries = opts.retries ?? 2;
  let attempt = 0;
  for (;;) {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL lock_timeout = '${opts.lockTimeoutMs ?? 3000}ms'`);
      await client.query(`SET LOCAL statement_timeout = '${opts.statementTimeoutMs ?? 10000}ms'`);
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      const code = (e as { code?: string })?.code;
      if (code && RETRYABLE.has(code) && attempt < retries) {
        attempt++;
        continue;
      }
      if (code === LOCK_TIMEOUT) {
        throw new AppError("PAYMENT_BUSY", "系统正在处理另一笔相关交易，请稍后重试。", { retryable: true });
      }
      throw e;
    } finally {
      client.release();
    }
  }
}

/** 单条查询（非事务） */
export async function query<R extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
) {
  return getPool().query<R>(text, params);
}
