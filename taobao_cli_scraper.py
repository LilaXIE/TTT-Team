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


def parse_price(lines: list[str]) -> str | None:
    for line in lines:
        if "¥" in line or "￥" in line:
            return line.replace("￥", "¥")
        if re.fullmatch(r"\d+(?:\.\d{1,2})?", line) and len(line) < 10:
            return "¥" + line
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

    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            channel="msedge",
            headless=False,
            # 使用官方标记去除自动化特征，避免自行注入有缺陷的 JS 造成反效果
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-infobars",
            ],
        )
        page = context.pages[0] if context.pages else context.new_page()

        try:
            # 直接通过完整 Search URL 访问，依靠 Cookie 保持登录态
            search_url = f"https://s.taobao.com/search?q={quote_plus(keyword)}"
            log(f"[调试] 正在访问搜索页面: {search_url}")
            page.goto(search_url, wait_until="domcontentloaded", timeout=30000)

            time.sleep(2)
            if challenge_present(page):
                wait_for_manual_verification(page, search_url)

            # 模拟滚屏触发图片与卡片懒加载
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
                    price = parse_price(lines)
                    if not price:
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