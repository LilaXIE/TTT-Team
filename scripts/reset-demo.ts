// 阶段 1 实现：清空交易类表，恢复库存、余额、凭证到种子值。
import { config } from "dotenv";
config({ path: ".env.local", override: false });

async function main() {
  console.log("reset-demo: not implemented yet (stage 1)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
