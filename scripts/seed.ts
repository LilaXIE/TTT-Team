// 读取 fixtures/*.json，写入商家、商品、支付方式、演示买家、凭证与初始资金（FUNDING journal）。幂等。
import { config } from "dotenv";
config({ path: ".env.local", override: false });

import { closePool } from "../src/server/db/pool";
import { withTransaction } from "../src/server/db/tx";
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoUser, seedReference } from "../src/server/seed";

async function main() {
  const r = await withTransaction(async (tx) => {
    const ref = await seedReference(tx);
    const userId = await seedDemoUser(tx);
    return { ...ref, userId };
  });
  console.log(`seeded: ${r.merchants} merchants, ${r.products} products, ${r.methods} payment methods`);
  console.log(`demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (id ${r.userId})`);
  await closePool();
}

main().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => {});
  process.exit(1);
});
