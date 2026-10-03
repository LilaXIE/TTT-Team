"""淘宝商品搜索适配器。

交互模式：python taobao_cli_scraper.py
JSON 模式：python taobao_cli_scraper.py --json "洗衣液" 10

JSON 模式的 stdout 只输出商品数组，诊断日志输出 stderr，供 Next.js 服务端调用。
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path
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


def scrape_taobao(keyword: str, count: int = 10) -> list[dict]:
    log(f"[Agent Worker] 正在启动 Edge 浏览器搜索商品: '{keyword}' ...")
    products: list[dict] = []

    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            channel="msedge",
            headless=False,
            args=["--no-sandbox"],
        )
        page = context.pages[0] if context.pages else context.new_page()
        try:
            page.goto(f"https://s.taobao.com/search?q={quote_plus(keyword)}", wait_until="domcontentloaded", timeout=30000)
            time.sleep(3)
            current_url = page.url.lower()
            page_text = page.locator("body").inner_text(timeout=5000).lower()
            challenge_markers = ("验证码", "安全验证", "滑动验证", "请登录", "登录后查看", "访问受限", "robot check", "captcha")
            if any(marker.lower() in current_url or marker.lower() in page_text for marker in challenge_markers):
                raise RuntimeError("淘宝要求登录或人工验证；未尝试绕过该限制。请运行 init_login.py.py 完成登录后重试。")
            page.mouse.wheel(0, 500)
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

            for node in nodes:
                if len(products) >= count:
                    break
                try:
                    text = node.inner_text().strip()
                    lines = [line.strip() for line in text.splitlines() if line.strip()]
                    price = parse_price(lines)
                    if not price:
                        continue
                    title = next((line for line in lines if len(line) > 5 and "¥" not in line and "￥" not in line), keyword)
                    link = node.get_attribute("href")
                    if not link:
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
                    log(f"[警告] 跳过商品卡片: {error}")
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
