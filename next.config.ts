import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 开发时允许局域网内队友用 IP 访问（next dev -H 0.0.0.0）。仅对 dev server 生效，生产构建忽略。
  allowedDevOrigins: ["172.16.*.*", "192.168.*.*", "10.*.*.*", "*.local"],
  // Docker 镜像用 standalone 输出（阶段 4）
  output: process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
};

export default nextConfig;
