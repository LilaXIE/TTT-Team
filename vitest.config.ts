import { defineConfig } from "vitest/config";
import path from "node:path";
import { config as loadEnv } from "dotenv";

// Vitest 不会像 Next.js 一样自动加载 .env.local。
// 集成测试会重置数据，必须显式设置独立 TEST_DATABASE_URL。
loadEnv({ path: ".env.local", override: false, quiet: true });
const integrationRun = process.argv.some((arg) => /tests[\\/]integration|tests[\\/]scenarios/.test(arg));
if (integrationRun && !process.env.TEST_DATABASE_URL?.trim()) {
  throw new Error("Integration tests require an isolated TEST_DATABASE_URL; production DATABASE_URL is never a fallback.");
}
if (process.env.TEST_DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL.trim();
}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    fileParallelism: !integrationRun,
  },
});
