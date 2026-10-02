// 阶段 1 实现：读取 fixtures/*.json，写入商家、商品、支付方式、演示买家、凭证与初始资金（FUNDING journal）。幂等。
import { config } from "dotenv";
config({ path: ".env.local", override: false });

async function main() {
  console.log("seed: not implemented yet (stage 1)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
