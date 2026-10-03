# login_saver.py
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

STATE_FILE = Path("taobao_state.json")

def save_login_state():
    with sync_playwright() as p:
        # 启动浏览器
        context = p.chromium.launch_persistent_context(
            user_data_dir="./edge_user_data",
            channel="msedge",
            headless=False,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"]
        )
        page = context.pages[0] if context.pages else context.new_page()
        
        print("[提示] 正在打开淘宝首页，请在弹出的浏览器中手动扫码登录...")
        page.goto("https://www.taobao.com", wait_until="domcontentloaded")
        
        # 给予足够的时间供用户手动扫码登录（最多等待 120 秒）
        print("[提示] 登录完成后，请在命令行按回车继续，或等待页面跳转完毕...")
        input("👉 扫码并登录成功后，请在此处按 Enter 键保存 Cookie...")
        
        # 访问一下搜索页，确保 Session Cookie 正式生效并写入
        page.goto("https://s.taobao.com/search?q=测试", wait_until="domcontentloaded")
        time.sleep(3)
        
        # 导出状态（包括 Cookies 和 LocalStorage）
        context.storage_state(path=str(STATE_FILE))
        print(f"✅ 登录状态已成功保存至: {STATE_FILE.resolve()}")
        
        context.close()

if __name__ == "__main__":
    save_login_state()