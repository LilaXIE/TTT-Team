# login_saver.py
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

STATE_FILE = Path(os.environ.get("TAOBAO_STATE_FILE", "taobao_state.json"))
PROFILE_DIR = Path(os.environ.get("TAOBAO_PROFILE_DIR", str(Path(os.environ.get("TEMP", ".")) / "mandate-wallet-taobao-profile")))
WAIT_SECONDS = max(30, int(os.environ.get("TAOBAO_LOGIN_WAIT_SECONDS", "180")))


def login_detected(context, page) -> bool:
    """淘宝首页没有统一稳定的登录 DOM，因此同时检查 URL、登录按钮和关键 Cookie。"""
    try:
        url = page.url.lower()
        if "login.taobao.com" in url or "passport.taobao.com" in url:
            return False
        cookies = context.cookies(["https://www.taobao.com", "https://s.taobao.com"])
        cookie_names = {cookie["name"] for cookie in cookies}
        # 淘宝登录后通常会出现这些会话 Cookie；不同地区/版本可能只出现其中一部分。
        if cookie_names.intersection({"_m_h5_tk", "_m_h5_tk_enc", "cookie2", "_tb_token_", "sgcookie"}):
            return True
        # 这些 Cookie 更接近已登录用户态；cookie2 / _tb_token_ 可能匿名访问时也存在，不能单独作为登录依据。
        if cookie_names.intersection({"unb", "cookie17", "tracknick", "lgc", "sn"}):
            return True
        positive_selectors = [
            "a[href*='logout']",
            "a[href*='member']",
            "[class*='avatar']",
            "[class*='user-info']",
        ]
        return any(page.locator(selector).count() > 0 for selector in positive_selectors)
    except Exception:
        return False


def save_login_state():
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            channel="msedge",
            headless=False,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        )
        page = context.pages[0] if context.pages else context.new_page()
        try:
            print("[提示] 正在打开淘宝首页，请在弹出的 Edge 中扫码登录...", flush=True)
            page.goto("https://www.taobao.com", wait_until="domcontentloaded", timeout=60000)
            print(f"[提示] 登录成功后会自动保存，最多等待 {WAIT_SECONDS} 秒。", flush=True)

            deadline = time.monotonic() + WAIT_SECONDS
            logged_in = False
            while time.monotonic() < deadline:
                if login_detected(context, page):
                    logged_in = True
                    break
                time.sleep(2)

            if not logged_in:
                raise RuntimeError("等待淘宝扫码登录超时。请确认已在 Edge 中完成登录后重试。")

            # 访问搜索页，使登录 Cookie 在淘宝搜索域名下生效。
            page.goto("https://s.taobao.com/search?q=%E6%B5%8B%E8%AF%95", wait_until="domcontentloaded", timeout=60000)
            time.sleep(3)
            context.storage_state(path=str(STATE_FILE))
            if not STATE_FILE.exists() or STATE_FILE.stat().st_size == 0:
                raise RuntimeError("淘宝登录状态文件没有生成。")
            print(f"✅ 登录状态已自动保存至: {STATE_FILE.resolve()}", flush=True)
        finally:
            context.close()


if __name__ == "__main__":
    save_login_state()
