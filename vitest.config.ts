import { defineConfig } from "vitest/config";
import path from "node:path";
import { config as loadEnv } from "dotenv";

// Vitest 不会像 Next.js 一样自动加载 .env.local。
// 集成测试优先使用独立 TEST_DATABASE_URL；本地未配置时回退到 DATABASE_URL。
loadEnv({ path: ".env.local", override: false, quiet: true });
if (process.env.TEST_DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL.trim();
}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
  },
});
