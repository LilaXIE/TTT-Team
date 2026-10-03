import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";

export const TaobaoItem = z.object({
  index: z.number().optional(),
  title: z.string(),
  price: z.string(),
  shop: z.string().default("淘宝商家"),
  url: z.string().url().optional(),
  image: z.string().url().optional(),
  description: z.string().optional(),
});
export type TaobaoItem = z.infer<typeof TaobaoItem>;

export interface TaobaoSearchResult { keyword: string; items: TaobaoItem[]; source: "taobao" | "unavailable"; message?: string }

function scraperPath() { return process.env.TAOBAO_SCRAPER_PATH || path.resolve(process.cwd(), "taobao_cli_scraper.py"); }

let activeSearch: Promise<TaobaoSearchResult> | null = null;
let lastSearchAt = 0;
const MIN_REQUEST_INTERVAL_MS = 12_000;
const SCRAPER_TIMEOUT_MS = 190_000;

/**
 * 调用本机 Playwright/Edge 爬虫。
 * 只允许单请求、低频查询，并复用人工登录态；不绕过验证码或平台限制。
 */
export async function searchTaobao(keyword: string, count = 10): Promise<TaobaoSearchResult> {
  if (activeSearch) return activeSearch;
  const waitMs = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastSearchAt));
  activeSearch = (async () => {
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastSearchAt = Date.now();
    return runTaobaoSearch(keyword, count);
  })();
  try {
    return await activeSearch;
  } finally {
    activeSearch = null;
  }
}

async function runTaobaoSearch(keyword: string, count: number): Promise<TaobaoSearchResult> {
  const script = scraperPath();
  const python = process.env.TAOBAO_PYTHON || "python";
  return new Promise((resolve) => {
    const child = spawn(python, [script, "--json", keyword, String(count)], { cwd: path.dirname(script), windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => { child.kill(); resolve({ keyword, items: [], source: "unavailable", message: "等待人工登录或安全验证超时，请重新发起比价。" }); }, SCRAPER_TIMEOUT_MS);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", () => { clearTimeout(timer); resolve({ keyword, items: [], source: "unavailable", message: "未找到可用的淘宝爬虫运行环境。" }); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) { resolve({ keyword, items: [], source: "unavailable", message: stderr.trim() || "淘宝搜索未返回结果。请先在本机完成淘宝登录或验证码验证。" }); return; }
      try {
        const parsed = JSON.parse(stdout.trim()) as unknown;
        const items = z.array(TaobaoItem).parse(parsed);
        resolve({ keyword, items, source: "taobao" });
      } catch {
        resolve({ keyword, items: [], source: "unavailable", message: "淘宝爬虫输出格式不可识别。" });
      }
    });
  });
}
