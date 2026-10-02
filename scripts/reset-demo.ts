// 演示重置：清空交易数据，重置库存/凭证/余额。参考数据与用户保留。
import { config } from "dotenv";
config({ path: ".env.local", override: false });

import { closePool } from "../src/server/db/pool";
import { withTransaction } from "../src/server/db/tx";
import { resetDemo } from "../src/server/seed";

async function main() {
  const userId = await withTransaction((tx) => resetDemo(tx), { statementTimeoutMs: 60_000 });
  console.log(`demo reset done (user ${userId})`);
  await closePool();
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => {});
  process.exit(1);
});
