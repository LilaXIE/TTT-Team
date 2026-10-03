import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import { stateFileForUser } from "@/server/taobao-account";

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
export async function searchTaobao(keyword: string, count = 10, userId?: string): Promise<TaobaoSearchResult> {
  if (activeSearch) return activeSearch;
  const waitMs = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastSearchAt));
  activeSearch = (async () => {
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastSearchAt = Date.now();
    return runTaobaoSearch(keyword, count, userId);
  })();
  try {
    return await activeSearch;
  } finally {
    activeSearch = null;
  }
}

async function runTaobaoSearch(keyword: string, count: number, userId?: string): Promise<TaobaoSearchResult> {
  const script = scraperPath();
  const python = process.env.TAOBAO_PYTHON || "python";
  const stateFile = userId ? await stateFileForUser(userId) : null;
  if (userId && !stateFile) return { keyword, items: [], source: "unavailable", message: "请先完成淘宝登录。" };
  return new Promise((resolve) => {
    const child = spawn(python, [script, "--json", keyword, String(count)], {
      cwd: path.dirname(script),
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
        ...(stateFile ? { TAOBAO_STATE_FILE: stateFile, TAOBAO_PROFILE_DIR: path.join(path.dirname(stateFile), `${userId}-profile`) } : {}),
      },
    });
    let stdoutBuffer = Buffer.alloc(0);
    let stderrBuffer = Buffer.alloc(0);

    const timer = setTimeout(() => {
      child.kill();
      resolve({ keyword, items: [], source: "unavailable", message: "等待人工登录或安全验证超时，请重新发起比价。" });
    }, SCRAPER_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuffer = Buffer.concat([stderrBuffer, chunk]);
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ keyword, items: [], source: "unavailable", message: "未找到可用的淘宝爬虫运行环境。" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const stdout = stdoutBuffer.toString("utf-8").trim();
      const stderr = stderrBuffer.toString("utf-8").trim();

      if (code !== 0) {
        resolve({
          keyword,
          items: [],
          source: "unavailable",
          message: stderr || "淘宝搜索未返回结果。若 Edge 显示登录或安全验证，请在窗口中手动完成后重试。",
        });
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as unknown;
        const items = z.array(TaobaoItem).parse(parsed);
        resolve({ keyword, items, source: "taobao" });
      } catch {
        resolve({
          keyword,
          items: [],
          source: "unavailable",
          message: stderr || "淘宝爬虫输出格式不可识别。",
        });
      }
    });
  });
}
