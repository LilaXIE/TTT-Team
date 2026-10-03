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

function scraperPath() { return process.env.TAOBAO_SCRAPER_PATH || path.resolve(process.cwd(), "..", "taobao_cli_scraper.py.py"); }

/** 调用本机 Playwright/Edge 爬虫。淘宝的登录、验证码或浏览器缺失不会阻塞应用主流程。 */
export async function searchTaobao(keyword: string, count = 10): Promise<TaobaoSearchResult> {
  const script = scraperPath();
  const python = process.env.TAOBAO_PYTHON || "python";
  return new Promise((resolve) => {
    const child = spawn(python, [script, "--json", keyword, String(count)], { cwd: path.dirname(script), windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => { child.kill(); resolve({ keyword, items: [], source: "unavailable", message: "淘宝搜索超时，可能需要完成登录或验证码验证。" }); }, 35_000);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", () => { clearTimeout(timer); resolve({ keyword, items: [], source: "unavailable", message: "未找到可用的淘宝爬虫运行环境。" }); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) { resolve({ keyword, items: [], source: "unavailable", message: stderr.trim() || "淘宝搜索未返回结果。" }); return; }
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
