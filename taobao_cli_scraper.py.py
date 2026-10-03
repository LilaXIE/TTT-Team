import time
import json
from playwright.sync_api import sync_playwright

def scrape_taobao(keyword: str, count: int = 10):
    print(f"\n[Agent Worker] 正在启动 Edge 浏览器搜索商品: '{keyword}' ...")
    products = []
    
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir="./edge_user_data",  # 指向 Edge 保存登录凭证的目录
            channel="msedge",                   # 调用 Edge 浏览器
            headless=False,                     # 显示浏览器界面，方便观察是否触发验证码
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox"
            ]
        )
        
        page = context.pages[0] if context.pages else context.new_page()
        
        try:
            search_url = f"https://s.taobao.com/search?q={keyword}"
            page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
            
            # 给出 2 秒缓冲时间，并向下滑动页面触发懒加载
            time.sleep(2)
            page.mouse.wheel(0, 800)
            time.sleep(2)
            
            # 组合多个可能的商品卡片 CSS 选择器（兼容淘宝不同排版和动态类名）
            possible_selectors = [
                "[class*='Card--doubleCard']",
                "[class*='Content--content'] > a",
                "[class*='item--']",
                "div[data-category='auctions']",
                "a[href*='item.htm']"
            ]
            
            target_selector = None
            for selector in possible_selectors:
                try:
                    # 快速检测哪个选择器能在 3 秒内匹配到节点
                    page.wait_for_selector(selector, timeout=3000)
                    target_selector = selector
                    print(f"[调试] 成功匹配到选择器: {selector}")
                    break
                except Exception:
                    continue
                    
            if not target_selector:
                print("[警告] 未能匹配到标准商品卡片选择器，尝试直接提取页面所有商品链接...")
                # 备用方案：寻找所有包含 item.htm 详情页链接的父级容器
                items = page.locator("a[href*='item.htm']").all()
            else:
                items = page.query_selector_all(target_selector)
                
            for item in items:
                if len(products) >= count:
                    break
                
                try:
                    # 获取该节点及其子节点的文本内容
                    text_content = item.inner_text().strip() if hasattr(item, 'inner_text') else item.inner_text()
                    if not text_content:
                        continue
                        
                    lines = [line.strip() for line in text_content.split("\n") if line.strip()]
                    
                    # 从文本中提取价格（匹配包含 ¥ 或纯数字的行）
                    price = "暂无价格"
                    title = ""
                    
                    for line in lines:
                        if "¥" in line or (line.replace('.', '', 1).isdigit() and len(line) < 8):
                            price = line if "¥" in line else f"¥{line}"
                        elif len(line) > 5 and not title:
                            title = line
                            
                    # 尝试提取商品链接
                    if hasattr(item, 'get_attribute'):
                        href = item.get_attribute("href")
                    else:
                        href = item.get_attribute("href")
                        
                    if not href:
                        # 尝试向上一级查找 a 标签
                        link_elem = item.query_selector("a[href*='item.htm']")
                        href = link_elem.get_attribute("href") if link_elem else ""
                        
                    if href:
                        if href.startswith("//"):
                            link = "https:" + href
                        elif href.startswith("/"):
                            link = "https://item.taobao.com" + href
                        else:
                            link = href
                    else:
                        link = "https://s.taobao.com"
                        
                    if title and price != "暂无价格":
                        products.append({
                            "index": len(products) + 1,
                            "title": title[:60], # 截取前60字符
                            "price": price,
                            "shop": "淘宝商家",
                            "url": link
                        })
                except Exception:
                    continue
                    
        except Exception as err:
            print(f"[错误] 爬取过程中触发异常: {err}")
        finally:
            context.close()
            
    return products

def main():
    print("=" * 50)
    print("      HacKU 2026 - Agentic Commerce CLI Scraper (Edge)")
    print("=" * 50)
    
    while True:
        keyword = input("\n请输入想要搜索的商品名称 (输入 'exit' 或 'q' 退出): ").strip()
        if not keyword:
            continue
        if keyword.lower() in ['exit', 'q']:
            print("退出爬虫程序。")
            break
            
        results = scrape_taobao(keyword, count=10)
        
        print(f"\n[结果] 成功抓取到 {len(results)} 条相关商品信息:\n")
        print(json.dumps(results, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()