"""淘宝商品搜索适配器 (抗反爬修复版)。

交互模式：python taobao_cli_scraper.py
JSON 模式：python taobao_cli_scraper.py --json "洗衣液" 10
"""

import argparse
import io
import json
import os
import re
import sys
import time
from pathlib import Path

const_encoding = "utf-8"
if sys.stdout.encoding.lower() != const_encoding:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding=const_encoding, errors="replace")
if sys.stderr.encoding.lower() != const_encoding:
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding=const_encoding, errors="replace")

from urllib.parse import quote_plus
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
PROFILE_DIR = ROOT / "edge_user_data"
STATE_FILE = ROOT / "taobao_state.json"


def log(message: str) -> None:
    print(message, file=sys.stderr)


def absolute_url(href: str | None) -> str:
    if not href:
        return "https://s.taobao.com"
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        return "https://item.taobao.com" + href
    return href


def first_image(node) -> str | None:
    image = node.query_selector("img")
    if not image:
        return None
    return image.get_attribute("src") or image.get_attribute("data-src") or image.get_attribute("data-lazy-src")


def parse_price(lines: list[str], text_content: str = "") -> str | None:
    # 1. 在整体文本中正则匹配 ¥27.9 / ￥27.9
    m = re.search(r"(?:¥|￥)\s*(\d+(?:\.\d+)?)", text_content)
    if m:
        return f"¥{m.group(1)}"

    # 2. 逐行匹配包含 ¥ 或 ￥ 的价格
    for i, line in enumerate(lines):
        m = re.search(r"(?:¥|￥)\s*(\d+(?:\.\d+)?)", line)
        if m:
            return f"¥{m.group(1)}"
        # 若本行为纯货币符号，则检查下一行是否为纯数字
        if line.strip() in ("¥", "￥") and i + 1 < len(lines):
            nxt = lines[i + 1].strip()
            nm = re.search(r"^(\d+(?:\.\d+)?)$", nxt)
            if nm:
                return f"¥{nm.group(1)}"

    # 3. 匹配独立的纯价格数字
    for line in lines:
        if re.fullmatch(r"\d+(?:\.\d{1,2})?", line) and len(line) < 10:
            return f"¥{line}"

    return None


def challenge_present(page) -> bool:
    """识别明确的验证/惩罚页面"""
    url_markers = ("captcha", "verify", "punish", "sec.taobao.com", "login.taobao.com")
    try:
        current_url = page.url.lower()
        if any(marker in current_url for marker in url_markers):
            return True
    except Exception:
        return True
    return False


def wait_for_manual_verification(page, search_url: str) -> None:
    wait_seconds = max(30, int(os.environ.get("TAOBAO_MANUAL_WAIT_SECONDS", "180")))
    deadline = time.monotonic() + wait_seconds
    log("[人工操作] 淘宝要求登录或安全验证。请在已打开的 Edge 窗口中完成操作。")
    log(f"[人工操作] 最多等待 {wait_seconds} 秒，验证通过后会自动继续。")
    while time.monotonic() < deadline:
        time.sleep(5)
        if not challenge_present(page):
            log("[人工操作] 验证状态已解除，继续加载商品搜索页面。")
            page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
            time.sleep(3)
            if not challenge_present(page):
                return
    raise RuntimeError("等待人工登录或安全验证超时；请重新运行比价。")


def scrape_taobao(keyword: str, count: int = 10) -> list[dict]:
    log(f"[Agent Worker] 正在启动 Edge 浏览器搜索商品: '{keyword}' ...")
    products: list[dict] = []
    
    # 检查状态文件是否存在
    if not STATE_FILE.exists():
        print("[错误] 未找到登录凭证 taobao_state.json，请先运行登录脚本生成此文件！")
        return []

    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            channel="msedge",
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox"
            ]
        )
        
        # 从 json 注入凭证 Cookie
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                state_data = json.load(f)
                if "cookies" in state_data:
                    context.add_cookies(state_data["cookies"])
        except Exception as err:
            log(f"[警告] 加载登录凭证文件失败: {err}")

        page = context.pages[0] if context.pages else context.new_page()
        
        try:
            search_url = f"https://s.taobao.com/search?q={quote_plus(keyword)}"
            page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
            
            # 检测是否被踢回登录页（Cookie 过期）
            if "login.taobao.com" in page.url or "sec.taobao.com" in page.url:
                print("⚠️ Cookie 已过期或触发验证，请重新扫码登录并更新 taobao_state.json 文件。")
                return []

            # 正常执行解析与抓取
            page.mouse.wheel(0, 800)
            time.sleep(2)

            selectors = [
                "[class*='Card--doubleCard']",
                "[class*='Content--content'] > a",
                "[class*='item--']",
                "div[data-category='auctions']",
                "a[href*='item.htm']",
            ]
            nodes = []
            for selector in selectors:
                try:
                    page.wait_for_selector(selector, timeout=3000)
                    nodes = page.query_selector_all(selector)
                    if nodes:
                        log(f"[调试] 成功匹配到选择器: {selector}")
                        break
                except Exception:
                    continue
            if not nodes:
                log("[提示] 未匹配到商品卡片，改用 item.htm 链接容器继续提取。")
                try:
                    nodes = page.query_selector_all("a[href*='item.htm']")
                except Exception:
                    nodes = []

            for node in nodes:
                if len(products) >= count:
                    break
                try:
                    text_content = node.inner_text().strip() if hasattr(node, "inner_text") else ""
                    if not text_content:
                        continue
                    lines = [line.strip() for line in text_content.splitlines() if line.strip()]
                    price = parse_price(lines, text_content)
                    if not price or price.strip() in ("¥", "￥"):
                        continue
                    title = next((line for line in lines if len(line) > 5 and "¥" not in line and "￥" not in line), keyword)
                    
                    link = None
                    if hasattr(node, "get_attribute"):
                        link = node.get_attribute("href")
                    if not link and hasattr(node, "query_selector"):
                        link_node = node.query_selector("a[href*='item.htm']")
                        link = link_node.get_attribute("href") if link_node else None
                    
                    image = first_image(node)
                    products.append({
                        "index": len(products) + 1,
                        "title": title[:120],
                        "price": price,
                        "shop": "淘宝商家",
                        "url": absolute_url(link),
                        "image": image,
                        "description": "；".join(lines[:3])[:240],
                    })
                except Exception as error:
                    log(f"[警告] 提取商品属性跳过: {error}")
                    continue
        finally:
            context.close()
    return products


def main() -> None:
    parser = argparse.ArgumentParser(description="Taobao product scraper")
    parser.add_argument("--json", action="store_true", help="输出纯 JSON 数组，供 Next.js 调用")
    parser.add_argument("keyword", nargs="?", help="商品关键词")
    parser.add_argument("count", nargs="?", type=int, default=10)
    args = parser.parse_args()

    if args.json:
        if not args.keyword:
            print(json.dumps([], ensure_ascii=False))
            raise SystemExit(2)
        try:
            print(json.dumps(scrape_taobao(args.keyword, max(1, min(args.count, 20))), ensure_ascii=False))
        except Exception as error:
            log(f"[错误] {error}")
            print(json.dumps([], ensure_ascii=False))
            raise SystemExit(1)
        return

    print("=" * 50)
    print("      HacKU 2026 - Agentic Commerce CLI Scraper (Edge)")
    print("=" * 50)
    while True:
        keyword = input("\n请输入想要搜索的商品名称 (输入 'exit' 或 'q' 退出): ").strip()
        if not keyword:
            continue
        if keyword.lower() in {"exit", "q"}:
            print("退出爬虫程序。")
            break
        try:
            results = scrape_taobao(keyword, count=10)
            print(f"\n[结果] 成功抓取到 {len(results)} 条相关商品信息:\n")
            print(json.dumps(results, ensure_ascii=False, indent=2))
        except Exception as error:
            print(f"[错误] {error}")


if __name__ == "__main__":
    main()