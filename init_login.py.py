from playwright.sync_api import sync_playwright

def save_login_session():
    with sync_playwright() as p:
        # 指定 channel="msedge" 来打开系统预装的 Edge 浏览器
        context = p.chromium.launch_persistent_context(
            user_data_dir="./edge_user_data",  # Edge 专用配置文件目录
            channel="msedge",                   # 强制调用本地默认 Edge 浏览器
            headless=False,
            args=[]
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.goto("https://www.taobao.com")
        print("请在打开的 Edge 浏览器中完成淘宝登录，登录成功后按回车继续...")
        input("按下 Enter 键保存登录状态并退出...")
        context.close()

if __name__ == "__main__":
    save_login_session()