import streamlit as st
import time
import random
import string
import json
import requests
import smtplib
import ssl
import hashlib
import hmac
from email.mime.text import MIMEText
from email.header import Header
from email.utils import formataddr
from datetime import datetime, timezone
from openai import OpenAI

# ==========================================
# 0. API 配置
# ==========================================
DEEPSEEK_API_KEY = "sk-083a47037ec647e1ae09cf4279afd89a"
client = OpenAI(
    api_key=DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com"
)

# ==========================================
# 0.0 腾讯云联网搜索 API（WSA）配置
# ==========================================
TENCENT_SECRET_ID  = "AKIDv1CIEyb6SdgXDnRyPjuysex9C6qSvGRU"       # ⚠️ 请换成新密钥
TENCENT_SECRET_KEY = "ypX7Zs35zlQxMc8e4MTN6f6NTQDoEi8Q"          # ⚠️ 请换成新密钥

WSA_SERVICE = "wsa"
WSA_HOST    = "wsa.tencentcloudapi.com"
WSA_ACTION  = "SearchPro"
WSA_VERSION = "2025-05-08"


# ==========================================
# 0.1 邮件发送：通用 SMTP 方案
# ==========================================
SMTP_PRESETS = {
    "gmail.com":      ("smtp.gmail.com",        465, True),
    "googlemail.com": ("smtp.gmail.com",        465, True),
    "outlook.com":    ("smtp-mail.outlook.com", 587, False),
    "hotmail.com":    ("smtp-mail.outlook.com", 587, False),
    "live.com":       ("smtp-mail.outlook.com", 587, False),
    "msn.com":        ("smtp-mail.outlook.com", 587, False),
    "office365.com":  ("smtp.office365.com",    587, False),
    "yahoo.com":      ("smtp.mail.yahoo.com",   465, True),
    "ymail.com":      ("smtp.mail.yahoo.com",   465, True),
    "icloud.com":     ("smtp.mail.me.com",      587, False),
    "me.com":         ("smtp.mail.me.com",      587, False),
    "mac.com":        ("smtp.mail.me.com",      587, False),
    "aol.com":        ("smtp.aol.com",          465, True),
    "zoho.com":       ("smtp.zoho.com",         465, True),
    "protonmail.com": ("smtp.protonmail.ch",    587, False),
    "qq.com":         ("smtp.qq.com",           465, True),
    "vip.qq.com":     ("smtp.vip.qq.com",       465, True),
    "foxmail.com":    ("smtp.qq.com",           465, True),
    "163.com":        ("smtp.163.com",          465, True),
    "126.com":        ("smtp.126.com",          465, True),
    "yeah.net":       ("smtp.yeah.net",         465, True),
    "sina.com":       ("smtp.sina.com",         465, True),
    "sina.cn":        ("smtp.sina.com",         465, True),
    "sohu.com":       ("smtp.sohu.com",         465, True),
    "aliyun.com":     ("smtp.aliyun.com",       465, True),
    "139.com":        ("smtp.139.com",          465, True),
    "189.cn":         ("smtp.189.cn",           465, True),
    "21cn.com":       ("smtp.21cn.com",         465, True),
    "tom.com":        ("smtp.tom.com",          465, True),
    "exmail.qq.com":   ("smtp.exmail.qq.com",    465, True),
    "qiye.aliyun.com": ("smtp.qiye.aliyun.com",  465, True),
}


def resolve_smtp_config(sender_email: str, override: dict | None = None):
    if override and override.get("host"):
        return (
            override["host"],
            int(override.get("port", 465)),
            bool(override.get("use_ssl", True)),
        )
    domain = sender_email.split("@")[-1].lower().strip()
    if domain in SMTP_PRESETS:
        return SMTP_PRESETS[domain]
    for key, cfg in SMTP_PRESETS.items():
        if domain.endswith("." + key) or domain == key:
            return cfg
    return None


def send_email_code(
    to_email: str,
    code: str,
    smtp_host: str,
    smtp_port: int,
    smtp_user: str,
    smtp_pass: str,
    use_ssl: bool = True,
    sender_name: str = "AI 智能代购 Agent",
    subject: str = "【AI 智能代购 Agent】注册验证码",
    body_html: str = None,
):
    if body_html is None:
        body_html = f"""
        <div style="font-family: Arial, 'Microsoft YaHei', sans-serif; padding: 20px;">
            <h2 style="color:#1488CC;">🛍️ AI 智能代购 Agent</h2>
            <p>您正在注册账户，本次验证码为：</p>
            <h1 style="color:#FF4B4B; letter-spacing: 5px;">{code}</h1>
            <p>验证码 <b>5 分钟内有效</b>，请勿泄露给他人。</p>
            <hr>
            <p style="color:#888; font-size:12px;">
                若您本人未进行此操作，请忽略本邮件。<br>
                本邮件由系统自动发送，请勿回复。
            </p>
        </div>
        """

    msg = MIMEText(body_html, "html", "utf-8")
    msg["From"] = formataddr((str(Header(sender_name, "utf-8")), smtp_user))
    msg["To"] = formataddr(("", to_email))
    msg["Subject"] = Header(subject, "utf-8")

    try:
        if use_ssl:
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20, context=ctx) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [to_email], msg.as_string())
        return True, ""
    except smtplib.SMTPAuthenticationError as e:
        return False, f"SMTP 认证失败：请检查发件邮箱与授权码/应用专用密码。（{e.smtp_code}）"
    except smtplib.SMTPConnectError:
        return False, f"无法连接 {smtp_host}:{smtp_port}，请检查网络或端口是否被拦截。"
    except Exception as e:
        return False, f"发送失败：{type(e).__name__} - {e}"


def send_payment_code_email(to_email: str, code: str, order: dict):
    """发送一次性支付密码邮件。"""
    body = f"""
    <div style="font-family: Arial, 'Microsoft YaHei', sans-serif; padding: 20px;">
        <h2 style="color:#1488CC;">🛍️ AI 智能代购 Agent · 支付确认</h2>
        <p>您正在为以下订单付款，请使用下方一次性密码完成验证：</p>
        <table style="border-collapse:collapse; margin: 10px 0;">
            <tr><td style="padding:4px 8px;"><b>订单号</b></td><td style="padding:4px 8px;">{order.get('order_id','')}</td></tr>
            <tr><td style="padding:4px 8px;"><b>商品</b></td><td style="padding:4px 8px;">{order.get('title','')}</td></tr>
            <tr><td style="padding:4px 8px;"><b>金额</b></td><td style="padding:4px 8px; color:#FF4B4B;"><b>￥{order.get('final_price', 0)}</b></td></tr>
        </table>
        <p>本次一次性支付密码：</p>
        <h1 style="color:#FF4B4B; letter-spacing: 4px; font-family: monospace;">{code}</h1>
        <p>密码 <b>10 分钟内有效</b>，且仅可使用一次。请勿泄露给他人。</p>
        <hr>
        <p style="color:#888; font-size:12px;">
            若您本人未进行此操作，请忽略本邮件。<br>
            本邮件由系统自动发送，请勿回复。
        </p>
    </div>
    """
    return send_email_code(
        to_email=to_email,
        code=code,
        smtp_host=st.session_state.smtp_host,
        smtp_port=st.session_state.smtp_port,
        smtp_user=st.session_state.smtp_user,
        smtp_pass=st.session_state.smtp_pass,
        use_ssl=st.session_state.smtp_use_ssl,
        subject="【AI 智能代购 Agent】一次性支付密码",
        body_html=body,
    )


# ==========================================
# 1. 页面基本配置与 CSS 样式
# ==========================================
st.set_page_config(
    page_title="AI 智能代购与自动付款 Agent",
    page_icon="🛍",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
    .order-card {
        background-color: #1E212A;
        border: 1px solid #313543;
        border-radius: 10px;
        padding: 15px;
        margin-bottom: 10px;
    }
    .stButton>button {
        border-radius: 8px;
    }
    .wallet-card {
        background: linear-gradient(135deg, #2B32B2 0%, #1488CC 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
        margin-bottom: 20px;
    }
    .custom-badge {
        background-color: #2e7d32;
        color: white;
        padding: 3px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: bold;
    }
    .nav-card {
        background-color: #1E212A;
        border: 1px solid #313543;
        border-radius: 12px;
        padding: 20px;
        text-align: center;
        transition: transform 0.2s;
    }
    .nav-card:hover {
        border-color: #4CAF50;
    }
    .product-option-box {
        background-color: #262936;
        border: 1px solid #3d4256;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 10px;
    }
    .search-badge {
        background-color: #1565c0;
        color: white;
        padding: 3px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: bold;
    }
    .img-frame {
        border-radius: 10px;
        border: 1px solid #313543;
        overflow: hidden;
    }
    .src-link {
        font-size: 13px;
        color: #4FC3F7;
        word-break: break-all;
    }
    .addr-tip {
        color: #FFA726;
        font-size: 13px;
        font-style: italic;
        margin-top: 4px;
    }
    .pwd-box {
        background-color: #263238;
        border-left: 4px solid #FF4B4B;
        padding: 10px 14px;
        border-radius: 6px;
        color: #FFEB3B;
        font-family: monospace;
        letter-spacing: 3px;
        font-size: 18px;
        margin: 10px 0;
    }
</style>
""", unsafe_allow_html=True)


# ==========================================
# 2. 初始化 Session State
# ==========================================
if "users_db" not in st.session_state:
    st.session_state.users_db = {
        "13800138000": {
            "phone": "+86 13800138000",
            "email": "test@example.com",
            "password": "password123"
        },
        "test@example.com": {
            "phone": "+86 13800138000",
            "email": "test@example.com",
            "password": "password123"
        }
    }

if "authenticated" not in st.session_state:
    st.session_state.authenticated = False
if "user_info" not in st.session_state:
    st.session_state.user_info = None
if "nav_location" not in st.session_state:
    st.session_state.nav_location = "chat"
if "max_limit" not in st.session_state:
    st.session_state.max_limit = 500
if "single_limit" not in st.session_state:
    st.session_state.single_limit = 10000.00
if "daily_limit" not in st.session_state:
    st.session_state.daily_limit = 50000.00
if "wallet_balance" not in st.session_state:
    st.session_state.wallet_balance = 350.00
if "bank_cards" not in st.session_state:
    st.session_state.bank_cards = [
        {"bank": "招商银行 (尾号 8888)", "type": "储蓄卡", "balance": 50000.00},
        {"bank": "中国工商银行 (尾号 6666)", "type": "信用卡", "balance": 20000.00}
    ]
if "address_list" not in st.session_state:
    st.session_state.address_list = [
        {"id": 1, "name": "张三", "phone": "13800138000",
         "address": "北京市海淀区中关村南大街 1 号 101 室", "is_default": True},
        {"id": 2, "name": "张三 (公司)", "phone": "13800138000",
         "address": "北京市朝阳区国贸大厦 A 座 1802", "is_default": False}
    ]
if "chat_sessions" not in st.session_state:
    st.session_state.chat_sessions = [
        {
            "session_id": "CS-001",
            "title": "首次代购咨询",
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "messages": [
                {"role": "assistant",
                 "content": "👋 你好！我是你的 **DeepSeek 全网 AI 智能代购 Agent**。\n\n请告诉你想买什么商品（例如：*“帮我买一个 20000 毫安快充充电宝”*），我会为你全网比价、智能推荐并完成自动下单！"}
            ]
        }
    ]
if "current_session_index" not in st.session_state:
    st.session_state.current_session_index = 0
if "pending_order" not in st.session_state:
    st.session_state.pending_order = None
if "orders_history" not in st.session_state:
    st.session_state.orders_history = []
if "simulated_code" not in st.session_state:
    st.session_state.simulated_code = None
if "code_sent_at" not in st.session_state:
    st.session_state.code_sent_at = None
if "buy_stage" not in st.session_state:
    st.session_state.buy_stage = "none"
if "recommend_step" not in st.session_state:
    st.session_state.recommend_step = 1
if "target_product_category" not in st.session_state:
    st.session_state.target_product_category = ""
if "candidate_options" not in st.session_state:
    st.session_state.candidate_options = []
if "search_cache" not in st.session_state:
    st.session_state.search_cache = {}

# 新增：支付相关状态
if "selected_address_for_order" not in st.session_state:
    st.session_state.selected_address_for_order = None
if "payment_code" not in st.session_state:
    st.session_state.payment_code = None
if "payment_code_sent_at" not in st.session_state:
    st.session_state.payment_code_sent_at = None
if "payment_code_order_id" not in st.session_state:
    st.session_state.payment_code_order_id = None

# SMTP 发件配置（内存级）
if "smtp_user" not in st.session_state:
    st.session_state.smtp_user = ""
if "smtp_host" not in st.session_state:
    st.session_state.smtp_host = ""
if "smtp_port" not in st.session_state:
    st.session_state.smtp_port = 465
if "smtp_use_ssl" not in st.session_state:
    st.session_state.smtp_use_ssl = True
if "smtp_pass" not in st.session_state:
    st.session_state.smtp_pass = ""


# ==========================================
# 3. 辅助逻辑函数
# ==========================================
def generate_12digit_code():
    """生成 12 位字母数字混合一次性密码。"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(12))


# ---------- 腾讯云 API 3.0 签名 ----------
def _hmac_sha256(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _sign_tencent_cloud(secret_id: str, secret_key: str, payload: dict):
    if not secret_id or not secret_key:
        raise ValueError("腾讯云 SecretId / SecretKey 未配置！")
    try:
        secret_id.encode("ascii")
        secret_key.encode("ascii")
    except UnicodeEncodeError:
        raise ValueError(
            f"⚠️ 腾讯云密钥包含非 ASCII 字符（如中文），请检查是否仍是占位符！\n"
            f"SecretId = {secret_id!r}"
        )

    timestamp = int(time.time())
    date = datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%Y-%m-%d")

    method = "POST"
    canonical_uri = "/"
    canonical_querystring = ""
    canonical_headers = (
        "content-type:application/json; charset=utf-8\n"
        f"host:{WSA_HOST}\n"
    )
    signed_headers = "content-type;host"

    payload_str = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    payload_bytes = payload_str.encode("utf-8")
    hashed_payload = hashlib.sha256(payload_bytes).hexdigest()

    canonical_request = "\n".join([
        method, canonical_uri, canonical_querystring,
        canonical_headers, signed_headers, hashed_payload
    ])

    algorithm = "TC3-HMAC-SHA256"
    credential_scope = f"{date}/{WSA_SERVICE}/tc3_request"
    hashed_canonical = hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
    string_to_sign = "\n".join([
        algorithm, str(timestamp), credential_scope, hashed_canonical
    ])

    secret_date    = _hmac_sha256(("TC3" + secret_key).encode("utf-8"), date)
    secret_service = _hmac_sha256(secret_date, WSA_SERVICE)
    secret_signing = _hmac_sha256(secret_service, "tc3_request")
    signature = hmac.new(
        secret_signing, string_to_sign.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    authorization = (
        f"{algorithm} "
        f"Credential={secret_id}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, "
        f"Signature={signature}"
    )

    headers = {
        "Authorization": str(authorization),
        "Content-Type": "application/json; charset=utf-8",
        "Host": str(WSA_HOST),
        "X-TC-Action": str(WSA_ACTION),
        "X-TC-Timestamp": str(timestamp),
        "X-TC-Version": str(WSA_VERSION),
    }
    return headers, payload_bytes


def _search_web_raw(query: str, search_source: str = "standard") -> list:
    cache_key = f"raw::{query}||{search_source}"
    if cache_key in st.session_state.search_cache:
        return st.session_state.search_cache[cache_key]

    payload = {"Query": query, "Mode": 0, "Cnt": 10}

    results = []
    try:
        headers, body_bytes = _sign_tencent_cloud(
            TENCENT_SECRET_ID, TENCENT_SECRET_KEY, payload
        )
        resp = requests.post(
            f"https://{WSA_HOST}/",
            headers=headers,
            data=body_bytes,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        response_body = data.get("Response", {})
        if "Error" in response_body:
            err = response_body["Error"]
            print(f"[WSA 错误] {err.get('Code')}: {err.get('Message')}")
            return []

        pages_raw = response_body.get("Pages", [])
        for page_str in pages_raw:
            try:
                page = json.loads(page_str) if isinstance(page_str, str) else page_str
                images = []
                for img in (page.get("images") or page.get("pics") or []):
                    if isinstance(img, dict):
                        images.append({
                            "caption": img.get("caption", ""),
                            "origin_url": img.get("origin_url", ""),
                        })
                    else:
                        images.append({"caption": "", "origin_url": str(img)})

                results.append({
                    "title":   page.get("title", "无标题"),
                    "url":     page.get("url", ""),
                    "site":    page.get("site", "未知站点"),
                    "date":    page.get("date", ""),
                    "passage": page.get("passage", "") or page.get("content", ""),
                    "images":  images,
                })
            except Exception:
                continue
    except Exception as e:
        print(f"[WSA 调用失败] {type(e).__name__}: {e}")

    st.session_state.search_cache[cache_key] = results
    return results


def search_web(query: str, search_source: str = "standard") -> str:
    results = _search_web_raw(query, search_source)
    if not results:
        return "[搜索服务暂时不可用，将基于模型知识生成推荐]"

    summaries = []
    for i, r in enumerate(results, 1):
        block = (
            f"[{i}] 【{r['title']}】({r['site']} {r['date']})\n"
            f"{r['passage']}\n"
            f"URL：{r['url']}"
        )
        if r["images"]:
            img_lines = [
                f"  - {im.get('caption', '无描述')}：{im.get('origin_url', '')}"
                for im in r["images"][:3] if im.get("origin_url")
            ]
            if img_lines:
                block += "\n图片：\n" + "\n".join(img_lines)
        summaries.append(block)
    return "\n\n".join(summaries)


def _attach_real_urls(data, raw_results: list):
    if not raw_results:
        def _fill_empty(item):
            item.setdefault("source_url", "")
            item.setdefault("image_url", "")
            item.setdefault("source_site", "")
        if isinstance(data, dict):
            _fill_empty(data)
        elif isinstance(data, list):
            for it in data:
                _fill_empty(it)
        return data

    def _fill(item):
        ref = item.get("search_ref", 0)
        try:
            ref = int(ref)
        except Exception:
            ref = 0

        picked = None
        if 1 <= ref <= len(raw_results):
            picked = raw_results[ref - 1]
        else:
            title = (item.get("title") or "").strip()
            for r in raw_results:
                if title and (title in r["title"] or r["title"] in title):
                    picked = r
                    break
            if picked is None:
                picked = raw_results[0]

        item["source_url"]  = picked.get("url", "")
        item["source_site"] = picked.get("site", "")
        imgs = picked.get("images") or []
        item["image_url"] = imgs[0]["origin_url"] if imgs else ""

    if isinstance(data, dict):
        _fill(data)
    elif isinstance(data, list):
        for it in data:
            _fill(it)
    return data


def call_deepseek_recommend_engine(step: int, item_category: str,
                                   user_history: list,
                                   extra_constraints: dict = None):
    search_context = ""
    raw_results = []

    if step in [1, 3]:
        search_query = f"{item_category} 最新价格 用户评价 推荐 图片"
        if step == 3 and extra_constraints:
            p_min = extra_constraints.get("min_price", 0)
            p_max = extra_constraints.get("max_price", 10000)
            search_query += f" {p_min}到{p_max}元"

        raw_results = _search_web_raw(search_query, search_source="standard")
        if raw_results:
            summaries = []
            for i, r in enumerate(raw_results, 1):
                block = (
                    f"[{i}] 【{r['title']}】({r['site']} {r['date']})\n"
                    f"{r['passage']}\n"
                    f"URL：{r['url']}"
                )
                summaries.append(block)
            search_context = "\n\n".join(summaries)
        else:
            search_context = "[搜索服务暂时不可用，将基于模型知识生成推荐]"

    base_instructions = (
        f"用户想要购买的核心商品品类是：【{item_category}】。"
        f"你必须 STRICTLY 推荐该品类下的商品，绝对不能更换为其他物品类型！"
    )

    if search_context and "[搜索服务暂时不可用" not in search_context:
        base_instructions += f"""

以下是来自联网搜索的最新商品信息：
--- 联网搜索结果开始 ---
{search_context}
--- 联网搜索结果结束 ---

特别重要：
- 不允许你自己编造任何 URL 或图片链接！
- 你只需在返回 JSON 的 "search_ref" 字段里填你参考的搜索结果序号（对应上面 [1]、[2]… 的编号）。
- 程序会自动根据 search_ref 把真实的 URL 和图片链接补充到返回结果里。
- 如果没有任何搜索结果可参考，search_ref 填 0。"""

    if step == 1:
        system_prompt = f"""{base_instructions}
请全网比价并推荐 1 个综合排名最高的选择。
必须以 JSON 输出，格式如下：
{{
  "title": "商品完整名称",
  "platform": "推荐平台",
  "original_price": 200.0,
  "coupon": 20.0,
  "final_price": 180.0,
  "search_ref": 1,
  "reason": "综合排名最高的推荐理由"
}}
仅返回纯 JSON 代码，不要带 markdown。"""
    elif step == 2:
        system_prompt = f"""{base_instructions}
请针对该品类分别从【价格最低】、【用户评价最高】、【销量最高】三个维度推荐 3 个不同优势的选项。
必须以 JSON 数组形式输出（含 3 个对象）：
[
  {{
    "dimension": "价格最佳选择",
    "title": "商品名称",
    "platform": "推荐平台",
    "original_price": 150.0,
    "coupon": 10.0,
    "final_price": 140.0,
    "search_ref": 1,
    "reason": "极具性价比，价格全网最低"
  }},
  {{
    "dimension": "用户评价最高",
    "title": "商品名称",
    "platform": "推荐平台",
    "original_price": 250.0,
    "coupon": 20.0,
    "final_price": 230.0,
    "search_ref": 2,
    "reason": "好评率 99.8%，口碑极佳"
  }},
  {{
    "dimension": "销量最高推荐",
    "title": "商品名称",
    "platform": "推荐平台",
    "original_price": 200.0,
    "coupon": 15.0,
    "final_price": 185.0,
    "search_ref": 3,
    "reason": "全网爆款，月销 10万+"
  }}
]
仅返回纯 JSON 代码，不要带 markdown。"""
    elif step == 3:
        p_min = extra_constraints.get("min_price", 0)
        p_max = extra_constraints.get("max_price", 10000)
        delivery = extra_constraints.get("delivery_time", "三日内")
        system_prompt = f"""{base_instructions}
用户筛选条件：价格范围为 {p_min} 元至 {p_max} 元之间，要求的配送时效为：{delivery}。
请结合上述价格和时效约束，推荐 1 个最符合要求的商品。
必须以 JSON 输出，格式如下：
{{
  "title": "商品完整名称",
  "platform": "推荐平台",
  "original_price": 190.0,
  "coupon": 10.0,
  "final_price": 180.0,
  "search_ref": 1,
  "reason": "精准满足预算区间与{delivery}送达的期望"
}}
仅返回纯 JSON 代码，不要带 markdown。"""
    elif step == 4:
        user_detail = extra_constraints.get("detail_req", "")
        system_prompt = f"""{base_instructions}
用户补充的详细要求为：“{user_detail}”。
请根据该品类及历史要求，精选 5 个符合条件的具体商品供用户挑选。
必须以 JSON 数组形式输出（含 5 个对象）：
[
  {{
    "option_id": 1,
    "title": "选项1商品名称",
    "platform": "推荐平台",
    "original_price": 200.0,
    "coupon": 20.0,
    "final_price": 180.0,
    "search_ref": 1,
    "reason": "推荐特点说明"
  }},
  ...共5个
]
仅返回纯 JSON 代码，不要带 markdown。"""

    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"请结合历史对话为我生成符合第 {step} 阶段的商品方案。"}
            ],
            stream=False
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```json"):
            content = content[7:-3].strip()
        data = json.loads(content)

        data = _attach_real_urls(data, raw_results)

        if isinstance(data, dict):
            data["order_id"] = f"AGENT-ORD-{random.randint(100000, 999999)}"
        elif isinstance(data, list):
            for item in data:
                item["order_id"] = f"AGENT-ORD-{random.randint(100000, 999999)}"
        return data
    except Exception:
        if step in [1, 3]:
            base_p = round(random.uniform(100, 500), 2)
            fb_src = raw_results[0] if raw_results else {"url": "", "site": "", "images": []}
            fb_img = fb_src["images"][0]["origin_url"] if fb_src.get("images") else ""
            return {
                "order_id": f"AGENT-ORD-{random.randint(100000, 999999)}",
                "title": f"【DeepSeek推荐】{item_category} (阶段{step}方案)",
                "platform": "京东自营",
                "original_price": base_p,
                "coupon": 10.0,
                "final_price": base_p - 10.0,
                "search_ref": 1 if raw_results else 0,
                "source_url": fb_src.get("url", ""),
                "source_site": fb_src.get("site", ""),
                "image_url": fb_img,
                "reason": f"符合对【{item_category}】特定要求的精选方案。"
            }
        elif step == 2:
            res = []
            for i in range(3):
                fb = raw_results[i] if i < len(raw_results) else {"url": "", "site": "", "images": []}
                res.append({
                    "dimension": ["价格最佳选择", "用户评价最高", "销量最高推荐"][i],
                    "order_id": f"ORD-S2-{i+1}",
                    "title": f"【{['性价比超高','高口碑旗舰','热销爆款'][i]}】{item_category}",
                    "platform": ["拼多多百亿补贴", "天猫旗舰店", "京东自营"][i],
                    "original_price": 199.0, "coupon": 20.0, "final_price": 179.0,
                    "search_ref": i + 1 if i < len(raw_results) else 0,
                    "source_url": fb.get("url", ""),
                    "source_site": fb.get("site", ""),
                    "image_url": fb["images"][0]["origin_url"] if fb.get("images") else "",
                    "reason": "由搜索结果精选"
                })
            return res
        elif step == 4:
            res = []
            for i in range(1, 6):
                bp = 100 + i * 30
                fb = raw_results[i-1] if i-1 < len(raw_results) else {"url": "", "site": "", "images": []}
                res.append({
                    "option_id": i,
                    "order_id": f"ORD-S4-{i}",
                    "title": f"【定制精选 {i}】{item_category} 特别款",
                    "platform": random.choice(["京东自营", "天猫旗舰店", "抖音商城"]),
                    "original_price": bp,
                    "coupon": 10.0,
                    "final_price": bp - 10.0,
                    "search_ref": i if i <= len(raw_results) else 0,
                    "source_url": fb.get("url", ""),
                    "source_site": fb.get("site", ""),
                    "image_url": fb["images"][0]["origin_url"] if fb.get("images") else "",
                    "reason": f"根据您的详细定制要求而甄选的第 {i} 种款式"
                })
            return res


# ==========================================
# 3.1 侧边栏：SMTP 发件配置
# ==========================================
def render_smtp_sidebar():
    with st.sidebar:
        st.markdown("## 📧 邮件发件配置")
        st.caption("用于向注册用户发送真实验证码邮件")

        default_user = st.session_state.get("smtp_user", "")
        default_host = st.session_state.get("smtp_host", "")
        default_port = st.session_state.get("smtp_port", 465)
        default_ssl = st.session_state.get("smtp_use_ssl", True)

        smtp_user = st.text_input(
            "发件邮箱地址",
            value=default_user,
            placeholder="you@gmail.com / you@qq.com / you@company.com"
        )

        auto_cfg = resolve_smtp_config(smtp_user) if smtp_user and "@" in smtp_user else None

        with st.expander("⚙️ SMTP 服务器设置（默认自动匹配）", expanded=not auto_cfg):
            if auto_cfg:
                auto_host, auto_port, auto_ssl = auto_cfg
                st.caption(
                    f"✅ 已自动识别：`{auto_host}:{auto_port}` "
                    f"({'SSL' if auto_ssl else 'STARTTLS'})"
                )
                smtp_host = st.text_input("SMTP 主机", value=default_host or auto_host)
                smtp_port = st.number_input(
                    "端口", value=int(default_port or auto_port), step=1
                )
                smtp_use_ssl = st.checkbox(
                    "使用 SSL（465 勾选；587 不勾）",
                    value=default_ssl if default_host else auto_ssl
                )
            else:
                st.caption("⚠️ 未自动识别，请手动填写 SMTP 主机和端口")
                smtp_host = st.text_input("SMTP 主机", value=default_host,
                                          placeholder="smtp.example.com")
                smtp_port = st.number_input("端口", value=int(default_port or 465), step=1)
                smtp_use_ssl = st.checkbox("使用 SSL", value=default_ssl)

        smtp_pass = st.text_input(
            "SMTP 授权码 / 应用专用密码",
            type="password",
            help="Gmail/Outlook 需用「应用专用密码」，QQ/163 使用「授权码」，非登录密码。"
        )

        if st.button("💾 保存发件配置", use_container_width=True):
            if not smtp_user or "@" not in smtp_user:
                st.error("发件邮箱格式不正确")
            elif not smtp_host or not smtp_pass:
                st.error("SMTP 主机和授权码不能为空")
            else:
                st.session_state.smtp_user = smtp_user.strip()
                st.session_state.smtp_host = smtp_host.strip()
                st.session_state.smtp_port = int(smtp_port)
                st.session_state.smtp_use_ssl = bool(smtp_use_ssl)
                st.session_state.smtp_pass = smtp_pass
                st.success("✅ 已保存")

        if st.button("🧪 发送测试邮件到本机发件箱", use_container_width=True):
            if not st.session_state.get("smtp_user"):
                st.warning("请先保存配置")
            else:
                ok, err = send_email_code(
                    to_email=st.session_state.smtp_user,
                    code="000000",
                    smtp_host=st.session_state.smtp_host,
                    smtp_port=st.session_state.smtp_port,
                    smtp_user=st.session_state.smtp_user,
                    smtp_pass=st.session_state.smtp_pass,
                    use_ssl=st.session_state.smtp_use_ssl,
                )
                if ok:
                    st.success("🎉 测试邮件已发送，请查收发件箱")
                else:
                    st.error(err)


# ==========================================
# 4. 登录 / 注册页面
# ==========================================
def render_welcome_page():
    render_smtp_sidebar()

    st.markdown("<h1 style='text-align: center;'>🛍️ 欢迎体验 AI 智能代购 Agent</h1>",
                unsafe_allow_html=True)
    st.markdown(
        "<p style='text-align: center; color: #888;'>DeepSeek 驱动 · 联网实时比价 · 四阶精准推荐 · 自动领券 · 极速代付款</p>",
        unsafe_allow_html=True
    )
    st.divider()

    col_left, col_main, col_right = st.columns([1, 2, 1])

    with col_main:
        auth_mode = st.radio("选择操作方式",
                             ["注册新账户 (Sign Up)", "登录账户 (Log In)"],
                             horizontal=True)

        if auth_mode == "注册新账户 (Sign Up)":
            st.subheader("📝 注册新账户")
            phone_col1, phone_col2 = st.columns([1, 2])
            with phone_col1:
                country_code = st.selectbox("区号", ["+86", "+852"])
            with phone_col2:
                phone_num = st.text_input("手机号码", placeholder="输入手机号 (如 13912345678)")

            email = st.text_input("电子邮箱", placeholder="example@domain.com")
            verify_type = st.radio("验证码接收渠道",
                                   ["手机短信验证", "邮箱验证"], horizontal=True)

            code_col1, code_col2 = st.columns([2, 1])
            with code_col1:
                verify_code = st.text_input("验证码", placeholder="输入 6 位验证码", max_chars=6)
            with code_col2:
                st.write("")
                if st.button("发送验证码", use_container_width=True):
                    if verify_type == "邮箱验证":
                        if not email or "@" not in email:
                            st.error("❌ 请先填写正确的邮箱地址！")
                        elif not st.session_state.get("smtp_user"):
                            st.error("❌ 管理员尚未在侧边栏配置发件邮箱，无法发送邮件。")
                        else:
                            code = str(random.randint(100000, 999999))
                            with st.spinner("正在发送验证码邮件..."):
                                ok, err = send_email_code(
                                    to_email=email.strip().lower(),
                                    code=code,
                                    smtp_host=st.session_state.smtp_host,
                                    smtp_port=st.session_state.smtp_port,
                                    smtp_user=st.session_state.smtp_user,
                                    smtp_pass=st.session_state.smtp_pass,
                                    use_ssl=st.session_state.smtp_use_ssl,
                                )
                            if ok:
                                st.session_state.simulated_code = code
                                st.session_state.code_sent_at = time.time()
                                st.success(f"📩 验证码已发送至 {email}，5 分钟内有效")
                            else:
                                st.error(f"❌ 邮件发送失败：{err}")
                    else:
                        target = phone_num.strip()
                        if not target:
                            st.error("❌ 请先填写手机号码！")
                        else:
                            st.session_state.simulated_code = str(random.randint(100000, 999999))
                            st.session_state.code_sent_at = time.time()
                            st.toast(
                                f"📩 【模拟短信】发送至 {target}：{st.session_state.simulated_code}",
                                icon="💬"
                            )

            password = st.text_input("设置登录密码", type="password",
                                     placeholder="包含字母和数字，至少 8 位")
            confirm_password = st.text_input("确认登录密码", type="password",
                                             placeholder="再次输入密码")

            st.markdown("---")
            agree_terms = st.checkbox(
                "我已阅读并同意 [《AI代购Agent用户服务协议》](#) 与 [《隐私保护政策》](#)"
            )

            if st.button("🚀 注册账户", type="primary", use_container_width=True):
                clean_phone = phone_num.strip()
                clean_email = email.strip().lower()

                if not agree_terms:
                    st.error("❌ 必须勾选同意法律协议方可注册！")
                elif not clean_phone or not clean_email:
                    st.error("❌ 请完整填写手机号和邮箱！")
                elif clean_phone in st.session_state.users_db or clean_email in st.session_state.users_db:
                    st.error("❌ 该手机号或邮箱已被注册，请直接选择【登录账户】！")
                elif not st.session_state.simulated_code:
                    st.error("❌ 请先点击【发送验证码】！")
                elif (st.session_state.code_sent_at is None
                      or time.time() - st.session_state.code_sent_at > 300):
                    st.error("❌ 验证码已过期（超过 5 分钟），请重新发送！")
                elif not verify_code or verify_code != st.session_state.simulated_code:
                    st.error("❌ 验证码不正确！")
                elif len(password) < 8:
                    st.error("❌ 登录密码长度不能少于 8 位！")
                elif password != confirm_password:
                    st.error("❌ 两次输入的密码不一致！")
                else:
                    user_data = {
                        "phone": f"{country_code} {clean_phone}",
                        "email": clean_email,
                        "password": password,
                        "login_type": "email" if verify_type == "邮箱验证" else "phone"
                    }
                    st.session_state.users_db[clean_phone] = user_data
                    st.session_state.users_db[clean_email] = user_data

                    st.session_state.simulated_code = None
                    st.session_state.code_sent_at = None

                    st.success("🎉 注册成功！自动为你完成登录...")
                    st.session_state.authenticated = True
                    st.session_state.user_info = user_data
                    time.sleep(1.2)
                    st.rerun()

        else:
            st.subheader("🔑 账户登录")
            st.caption("提示：快捷测试账号：`13800138000` 或 `test@example.com` / 密码：`password123`")

            login_identity = st.text_input("手机号 / 邮箱",
                                           placeholder="输入注册时使用的手机号或邮箱").strip()
            login_password = st.text_input("密码", type="password", placeholder="输入登录密码")

            if st.button("🔓 登录系统", type="primary", use_container_width=True):
                login_key = login_identity.lower()

                if not login_identity or not login_password:
                    st.error("❌ 请输入账号与密码！")
                elif login_key not in st.session_state.users_db:
                    st.error("❌ 该账号未注册，请先选择【注册新账户】！")
                else:
                    user_data = st.session_state.users_db[login_key].copy()
                    if user_data["password"] != login_password:
                        st.error("❌ 登录密码错误，请重新输入！")
                    else:
                        user_data["login_type"] = "email" if "@" in login_identity else "phone"
                        st.success("✅ 登录验证通过！正在跳转...")
                        st.session_state.authenticated = True
                        st.session_state.user_info = user_data
                        time.sleep(1)
                        st.rerun()


# ==========================================
# 5. “我的” 中心
# ==========================================
def render_profile_navigation_home():
    st.title("👤 个人中心")
    st.caption("请选择您要管理的项目")
    st.divider()

    c1, c2 = st.columns(2)
    with c1:
        st.markdown("""
        <div class="nav-card">
            <h3>💳 支付设置</h3>
            <p style="color:#aaa;">管理绑定的银行账户与交易限额额度</p>
        </div>
        """, unsafe_allow_html=True)
        if st.button("进入支付设置 ➔", key="btn_go_pay_settings", use_container_width=True):
            st.session_state.nav_location = "pay_settings"
            st.rerun()

        st.write("")
        st.markdown("""
        <div class="nav-card">
            <h3>📍 我的地址</h3>
            <p style="color:#aaa;">管理代购商品默认收货地址</p>
        </div>
        """, unsafe_allow_html=True)
        if st.button("进入地址管理 ➔", key="btn_go_address", use_container_width=True):
            st.session_state.nav_location = "address"
            st.rerun()

    with c2:
        st.markdown("""
        <div class="nav-card">
            <h3>👛 我的钱包</h3>
            <p style="color:#aaa;">余额充值与小额免密代扣管理</p>
        </div>
        """, unsafe_allow_html=True)
        if st.button("进入我的钱包 ➔", key="btn_go_wallet", use_container_width=True):
            st.session_state.nav_location = "wallet"
            st.rerun()

        st.write("")
        st.markdown("""
        <div class="nav-card">
            <h3>📜 我的记录</h3>
            <p style="color:#aaa;">查看历史对话与已完成代购订单</p>
        </div>
        """, unsafe_allow_html=True)
        if st.button("进入我的记录 ➔", key="btn_go_records", use_container_width=True):
            st.session_state.nav_location = "records"
            st.rerun()


def render_profile_sub_page():
    current_loc = st.session_state.nav_location

    nav_cols = st.columns([1, 5])
    with nav_cols[0]:
        if st.button("⬅️ 返回个人中心"):
            st.session_state.nav_location = "profile_home"
            st.rerun()

    st.divider()

    if current_loc == "pay_settings":
        st.title("💳 支付设置")
        st.caption("在此统一管理银行账户以及代购交易限额配置")

        tab_bank, tab_limits = st.tabs(["🏦 银行账户", "⚙ 交易限额设置"])

        with tab_bank:
            st.subheader("💳 已绑定的银行账户 / 快捷卡")
            for card in st.session_state.bank_cards:
                with st.container():
                    c1, c2, c3 = st.columns([3, 2, 1])
                    with c1:
                        st.write(f"🏦 **{card['bank']}** ({card['type']})")
                    with c2:
                        st.write(f"💰 可用额度/余额：**￥{card['balance']:,.2f}**")
                    with c3:
                        st.markdown('<span class="custom-badge">✓ 已校验加密</span>',
                                    unsafe_allow_html=True)
                    st.divider()

            st.info("💡 银行账户用于**大额代购直扣**及为**我的钱包充值**。")

        with tab_limits:
            st.subheader("⚙ 调整交易限额")
            lim_c1, lim_c2 = st.columns(2)
            with lim_c1:
                new_single = st.number_input(
                    "单笔限额 (元)", min_value=100.0, max_value=10000.0,
                    value=float(st.session_state.single_limit), step=500.0
                )
            with lim_c2:
                new_daily = st.number_input(
                    "单日累计支付总额 (元)", min_value=1000.0, max_value=50000.0,
                    value=float(st.session_state.daily_limit), step=1000.0
                )

            st.divider()
            verify_pwd = st.text_input("请输入登录密码以确认修改", type="password")

            if st.button("💾 保存限额设置", type="primary"):
                current_user_pwd = (
                    st.session_state.user_info.get("password")
                    if st.session_state.user_info else None
                )
                if not verify_pwd or verify_pwd != current_user_pwd:
                    st.error("❌ 登录密码验证失败，无法修改！")
                elif new_single > new_daily:
                    st.error("❌ 单笔限额不能高于单日总额！")
                else:
                    st.session_state.single_limit = new_single
                    st.session_state.daily_limit = new_daily
                    st.success("✅ 修改成功！")
                    time.sleep(1)
                    st.rerun()

    elif current_loc == "wallet":
        st.markdown(f"""
        <div class="wallet-card">
            <h3>👛 代购专属电子钱包</h3>
            <h1 style="margin: 10px 0;">￥{st.session_state.wallet_balance:,.2f}</h1>
        </div>
        """, unsafe_allow_html=True)

        st.subheader("💵 钱包充值")
        recharge_col1, recharge_col2 = st.columns([2, 1])
        with recharge_col1:
            select_bank = st.selectbox(
                "选择付款银行卡",
                [card["bank"] for card in st.session_state.bank_cards]
            )
            recharge_amount = st.number_input(
                "充值金额 (元)", min_value=10, max_value=10000, value=200, step=50
            )
        with recharge_col2:
            st.write("")
            st.write("")
            if st.button("🚀 立即充值", type="primary", use_container_width=True):
                st.session_state.wallet_balance += recharge_amount
                st.success(f"🎉 从【{select_bank}】向钱包充值 ￥{recharge_amount:.2f}！")
                time.sleep(1)
                st.rerun()

    elif current_loc == "address":
        st.subheader("📦 代购收货地址管理")
        for addr in st.session_state.address_list:
            with st.container():
                col_a, col_b = st.columns([4, 1])
                with col_a:
                    default_tag = " [默认地址]" if addr["is_default"] else ""
                    st.write(f"👤 **{addr['name']}** ({addr['phone']}) :red[{default_tag}]")
                    st.write(f"🏠 {addr['address']}")
                with col_b:
                    if not addr["is_default"]:
                        if st.button("设为默认", key=f"def_{addr['id']}"):
                            for a in st.session_state.address_list:
                                a["is_default"] = (a["id"] == addr["id"])
                            st.rerun()
                st.divider()

    elif current_loc == "records":
        rec_tab1, rec_tab2 = st.tabs(["💬 聊天记录", "🛍 购买记录"])
        with rec_tab1:
            if st.button("➕ 开启新对话", type="primary"):
                new_idx = len(st.session_state.chat_sessions) + 1
                st.session_state.chat_sessions.append({
                    "session_id": f"CS-00{new_idx}",
                    "title": f"新代购咨询 {new_idx}",
                    "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "messages": [
                        {"role": "assistant",
                         "content": "👋 你好！我是你的 **DeepSeek 全网 AI 智能代购 Agent**。\n\n请告诉你想买什么商品，我会为你全网比价并下单！"}
                    ]
                })
                st.session_state.current_session_index = len(st.session_state.chat_sessions) - 1
                st.session_state.nav_location = "chat"
                st.session_state.buy_stage = "none"
                st.session_state.recommend_step = 1
                st.session_state.target_product_category = ""
                st.session_state.pending_order = None
                st.rerun()

            for s_idx, session in enumerate(st.session_state.chat_sessions):
                with st.expander(f"💬 {session['title']} ({session['created_at']})"):
                    for msg in session["messages"]:
                        st.write(f"**{msg['role'].upper()}**: {msg['content']}")

        with rec_tab2:
            if not st.session_state.orders_history:
                st.info("暂无已付款的代购记录。")
            else:
                for ord_item in st.session_state.orders_history:
                    st.markdown(f"""
                    <div class="order-card">
                        <h4>{ord_item['title']}</h4>
                        <p>🏷️ <b>平台</b>：{ord_item['platform']} | 🆔 <b>订单号</b>：<code>{ord_item['order_id']}</code></p>
                        <p>💰 <b>实付金额</b>：<span style="color:#FF4B4B; font-weight:bold;">￥{ord_item['final_price']}</span></p>
                        <p>📦 <b>配送地址</b>：{ord_item.get('shipping_address', '默认地址')}</p>
                        <p>💳 <b>支付方式</b>：{ord_item.get('payment_method', '未知')}</p>
                    </div>
                    """, unsafe_allow_html=True)
                    if ord_item.get("source_url"):
                        st.markdown(f"🔗 [查看原商品页面]({ord_item['source_url']})")


# ==========================================
# 6. Chatbot 4 阶段递进推荐与代购 Agent 界面
# ==========================================
def render_order_card(order: dict, key_prefix: str = ""):
    """统一的商品卡片渲染：图片 + 标题 + 价格 + 来源链接（可跳转 + 可复制）。"""
    img_col, info_col = st.columns([1, 2])

    with img_col:
        img_url = order.get("image_url", "")
        if img_url:
            try:
                st.markdown('<div class="img-frame">', unsafe_allow_html=True)
                st.image(img_url, use_container_width=True)
                st.markdown('</div>', unsafe_allow_html=True)
            except Exception:
                st.info("📷 图片加载失败")
        else:
            st.info("📷 暂无图片")

    with info_col:
        st.subheader(order.get("title", "未命名商品"))
        st.write(f"🏷️ **推荐平台**：{order.get('platform', '未知')}")
        st.write(f"🆔 **订单编号**：`{order.get('order_id', '')}`")
        if order.get("reason"):
            st.write(f"💡 **推荐理由**：{order['reason']}")
        st.markdown(f"### 券后价格：:red[￥{order.get('final_price', 0)}]")

        src = order.get("source_url", "")
        site = order.get("source_site", "")
        if src:
            st.markdown(f"🔗 **来源站点**：{site or '原文'}")
            st.markdown(f"👉 [点击跳转商品页面]({src})")
            st.text_input(
                "📋 复制链接（点右侧图标或全选复制）",
                value=src,
                key=f"copy_{key_prefix}_{order.get('order_id', random.random())}",
            )
        else:
            st.caption("🔗 暂无来源链接")


def render_address_selection():
    """渲染收货地址选择区域，支持选已有地址或新增地址。"""
    st.divider()
    st.subheader("📍 选择收货地址")

    # 构造地址展示字符串
    addr_options = []
    for a in st.session_state.address_list:
        tag = " [默认]" if a["is_default"] else ""
        addr_options.append(
            f"{a['name']} - {a['phone']} - {a['address']}{tag}"
        )
    addr_options.append("➕ 输入一个新地址作为本次收货地址")

    default_idx = next(
        (i for i, a in enumerate(st.session_state.address_list) if a["is_default"]), 0
    )

    selected_idx = st.radio(
        "请选择收货地址",
        range(len(addr_options)),
        format_func=lambda i: addr_options[i],
        index=default_idx,
        key="addr_radio",
    )

    st.markdown('<div class="addr-tip">没有目标地址？请告诉我新地址</div>',
                unsafe_allow_html=True)

    is_new_address = (selected_idx == len(st.session_state.address_list))

    if is_new_address:
        new_name = st.text_input("收货人姓名", key="new_addr_name")
        new_phone = st.text_input("收货人手机号", key="new_addr_phone")
        new_addr = st.text_area("详细收货地址", key="new_addr_detail",
                                placeholder="例如：上海市浦东新区世纪大道 100 号 xx 小区 5 号楼 302 室")

        if st.button("➡️ 保存并使用这个新地址，进入支付", type="primary",
                     use_container_width=True, key="new_addr_confirm"):
            if not new_name.strip() or not new_phone.strip() or not new_addr.strip():
                st.error("❌ 请完整填写姓名、手机号和详细地址！")
            else:
                new_id = max([a["id"] for a in st.session_state.address_list], default=0) + 1
                addr_obj = {
                    "id": new_id,
                    "name": new_name.strip(),
                    "phone": new_phone.strip(),
                    "address": new_addr.strip(),
                    "is_default": False,
                }
                st.session_state.address_list.append(addr_obj)
                st.session_state.selected_address_for_order = addr_obj
                st.session_state.buy_stage = "payment"
                # 到支付环节时自动发密码
                st.session_state.payment_code = None
                st.session_state.payment_code_sent_at = None
                st.rerun()
    else:
        chosen = st.session_state.address_list[selected_idx]
        st.caption(f"已选择：{chosen['name']} · {chosen['phone']} · {chosen['address']}")

        if st.button("➡️ 确认地址，进入支付", type="primary",
                     use_container_width=True, key="addr_confirm"):
            st.session_state.selected_address_for_order = chosen
            st.session_state.buy_stage = "payment"
            st.session_state.payment_code = None
            st.session_state.payment_code_sent_at = None
            st.rerun()


def render_payment_section():
    """渲染支付环节，包括一次性密码验证、钱包优先逻辑、登录密码二次认证。"""
    order = st.session_state.pending_order
    final_price = float(order["final_price"])

    st.subheader("💳 订单支付")
    render_order_card(order, key_prefix="pay")
    st.markdown(f"### 应付金额：:red[￥{final_price:.2f}]")

    # 显示收货地址
    addr = st.session_state.selected_address_for_order
    if addr:
        st.info(f"📦 收货地址：**{addr['name']}** · {addr['phone']} · {addr['address']}")

    # ============ 支付方式判定 ============
    wallet_balance = st.session_state.wallet_balance
    if wallet_balance >= final_price:
        # 钱包够 → 默认走钱包
        default_method = "👛 钱包余额（优先）"
        st.success(f"✅ 当前钱包余额 ￥{wallet_balance:.2f} 足够支付本单，将**优先从钱包扣款**。")
    else:
        default_method = "🏦 银行卡直扣"
        st.warning(
            f"⚠️ 钱包余额 ￥{wallet_balance:.2f} 不足支付 ￥{final_price:.2f}，"
            f"将使用**银行卡直扣**（需登录密码二次认证）。"
        )

    pay_method = st.radio(
        "选择支付方式",
        ["👛 钱包余额（优先）", "🏦 银行卡直扣"],
        index=0 if "👛 钱包余额（优先）" == default_method else 1,
        horizontal=True,
        key="pay_method_radio",
    )

    # 如果选钱包但余额不足，强制切换到银行卡
    if pay_method == "👛 钱包余额（优先）" and wallet_balance < final_price:
        st.error("❌ 钱包余额不足，请改选银行卡直扣。")
        return

    selected_card = None
    if pay_method == "🏦 银行卡直扣":
        selected_card = st.selectbox(
            "选择付款银行卡",
            [c["bank"] for c in st.session_state.bank_cards],
            key="pay_bank_select",
        )

    # ============ 一次性支付密码 ============
    st.divider()
    st.markdown("### 🔐 一次性支付密码验证")

    order_id = order["order_id"]
    # 换订单 / 未发送 → 发密码
    if (
        st.session_state.payment_code is None
        or st.session_state.payment_code_order_id != order_id
    ):
        code = generate_12digit_code()
        st.session_state.payment_code = code
        st.session_state.payment_code_sent_at = time.time()
        st.session_state.payment_code_order_id = order_id

        user_email = st.session_state.user_info.get("email") if st.session_state.user_info else ""
        if user_email and st.session_state.get("smtp_user"):
            with st.spinner("正在发送一次性支付密码到您的邮箱..."):
                ok, err = send_payment_code_email(user_email, code, order)
            if ok:
                st.success(f"📩 一次性支付密码已发送至 {user_email}，10 分钟内有效")
            else:
                st.error(f"❌ 邮件发送失败：{err}")
                st.caption("（开发模式：请使用下方测试按钮直接查看密码）")
        else:
            st.warning("⚠️ 未配置发件邮箱或未获取到用户邮箱，无法发送。")
            st.caption("（开发模式：请使用下方测试按钮直接查看密码）")

    # 开发模式：手动显示密码（方便调试）
    with st.expander("🛠 调试用：查看/重发密码", expanded=False):
        if st.button("🔁 重新生成并发送密码", key="resend_pay_code"):
            code = generate_12digit_code()
            st.session_state.payment_code = code
            st.session_state.payment_code_sent_at = time.time()
            st.session_state.payment_code_order_id = order_id
            user_email = st.session_state.user_info.get("email") if st.session_state.user_info else ""
            if user_email and st.session_state.get("smtp_user"):
                with st.spinner("正在发送..."):
                    ok, err = send_payment_code_email(user_email, code, order)
                if ok:
                    st.success(f"📩 已重发至 {user_email}")
                else:
                    st.error(f"❌ 发送失败：{err}")
            else:
                st.warning("未配置发件邮箱或用户邮箱")
        if st.session_state.payment_code:
            st.caption(f"当前密码（仅调试）：`{st.session_state.payment_code}`")
        if st.session_state.payment_code_sent_at:
            remaining = max(0, int(600 - (time.time() - st.session_state.payment_code_sent_at)))
            st.caption(f"剩余有效期：{remaining} 秒")

    user_pay_code = st.text_input(
        "请输入邮箱里收到的一次性支付密码（12 位字母数字）",
        type="password",
        max_chars=12,
        key="user_pay_code_input",
    )

    # 银行卡二次验证：登录密码
    need_login_pwd_verify = (pay_method == "🏦 银行卡直扣")
    user_login_pwd = None
    if need_login_pwd_verify:
        if final_price > st.session_state.max_limit:
            st.warning(
                f"🔐 银行卡大额交易 ￥{final_price:.2f} 超过免密额度 "
                f"￥{st.session_state.max_limit:.2f}，需输入**登录密码**二次认证。"
            )
        else:
            st.info("🔐 使用银行卡支付，需输入**登录密码**进行二次认证。")
        user_login_pwd = st.text_input(
            "请输入登录密码以完成银行卡认证",
            type="password",
            key="bank_login_pwd",
        )

    # ============ 确认支付按钮 ============
    if st.button("✅ 确认支付", type="primary", use_container_width=True,
                 key="final_pay_confirm"):
        # 1. 校验一次性密码
        if not user_pay_code:
            st.error("❌ 请输入邮箱里收到的一次性支付密码！")
            st.stop()
        if user_pay_code != st.session_state.payment_code:
            st.error("❌ 一次性支付密码错误！")
            st.stop()
        if (st.session_state.payment_code_sent_at is None
                or time.time() - st.session_state.payment_code_sent_at > 600):
            st.error("❌ 一次性支付密码已过期（超过 10 分钟），请重新发送！")
            st.stop()

        # 2. 校验登录密码（仅银行卡需要）
        if need_login_pwd_verify:
            current_pwd = (
                st.session_state.user_info.get("password")
                if st.session_state.user_info else None
            )
            if not user_login_pwd:
                st.error("❌ 请输入登录密码！")
                st.stop()
            if user_login_pwd != current_pwd:
                st.error("❌ 登录密码错误，认证未通过！")
                st.stop()

        # 3. 扣款
        payment_method_text = ""
        if pay_method == "👛 钱包余额（优先）":
            st.session_state.wallet_balance -= final_price
            payment_method_text = "👛 钱包余额"
        else:
            payment_method_text = f"🏦 {selected_card}"

        # 4. 写入订单
        addr = st.session_state.selected_address_for_order
        st.session_state.orders_history.append({
            "order_id": order["order_id"],
            "title": order["title"],
            "platform": order["platform"],
            "final_price": final_price,
            "shipping_address": f"{addr['name']} · {addr['phone']} · {addr['address']}" if addr else "默认地址",
            "payment_method": payment_method_text,
            "image_url": order.get("image_url", ""),
            "source_url": order.get("source_url", ""),
        })

        # 5. 清理状态
        st.session_state.pending_order = None
        st.session_state.buy_stage = "none"
        st.session_state.payment_code = None
        st.session_state.payment_code_sent_at = None
        st.session_state.payment_code_order_id = None
        st.session_state.selected_address_for_order = None

        st.success(f"🎉 支付成功！方式：{payment_method_text}，金额：￥{final_price:.2f}")
        time.sleep(1)
        st.rerun()


def render_chat_agent():
    st.title("🤖 DeepSeek 自动付款 AI 购物 Agent")
    st.caption("DeepSeek 驱动 · 腾讯云联网实时比价 · 锁定需求品类 · 四阶段精细化推荐")

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Agent 状态", "🟢 DeepSeek 在线")
    with col2:
        st.metric("我的钱包余额", f"￥{st.session_state.wallet_balance:.2f}")
    with col3:
        st.metric("已成功代购", f"{len(st.session_state.orders_history)} 笔")
    with col4:
        default_addr = next((a for a in st.session_state.address_list if a["is_default"]), None)
        st.metric("默认收货人", default_addr["name"] if default_addr else "未设置")

    st.divider()

    current_session = st.session_state.chat_sessions[st.session_state.current_session_index]
    for message in current_session["messages"]:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    # ---------- 阶段 1 ----------
    if st.session_state.buy_stage == "confirm_product" and st.session_state.recommend_step == 1:
        order = st.session_state.pending_order
        st.warning(
            f"🧐 **【阶段 1推荐】针对商品“{st.session_state.target_product_category}”，"
            f"DeepSeek 已联网搜索并为您匹配了全网综合排名最高的选择：**"
        )

        render_order_card(order, key_prefix="s1")

        btn_c1, btn_c2, _ = st.columns([1, 1, 2])
        with btn_c1:
            if st.button("✅ 满意 (选定此商品)", type="primary", use_container_width=True,
                         key="s1_ok"):
                st.session_state.buy_stage = "select_address"
                st.session_state.selected_address_for_order = None
                current_session["messages"].append({"role": "user", "content": "满意，就选这个。"})
                st.rerun()

        with btn_c2:
            if st.button("❌ 不满意 (换一批)", use_container_width=True, key="s1_no"):
                st.session_state.recommend_step = 2
                st.session_state.candidate_options = []
                with st.spinner("正在进入第二阶段：分别从【价格】、【评价】、【销量】三个维度搜寻最佳选择..."):
                    c_options = call_deepseek_recommend_engine(
                        step=2,
                        item_category=st.session_state.target_product_category,
                        user_history=current_session["messages"]
                    )
                    st.session_state.candidate_options = c_options
                current_session["messages"].append({
                    "role": "assistant",
                    "content": "对综合首选不满意？没问题！我已为您分别从【价格】、【用户评价】和【销量】三个维度重新挑选了商品。"
                })
                st.rerun()

    # ---------- 阶段 2 ----------
    elif st.session_state.buy_stage == "confirm_product" and st.session_state.recommend_step == 2:
        st.info(
            f"📊 **【阶段 2推荐】针对“{st.session_state.target_product_category}”，"
            f"以下从三个不同维度为您精选的方案：**"
        )

        options = st.session_state.candidate_options

        for idx, opt in enumerate(options):
            with st.container():
                st.markdown(f"### 🔹 {opt.get('dimension', f'选项 {idx+1}')}")
                render_order_card(opt, key_prefix=f"s2_{idx}")
                if st.button(f"选择此方案 ({idx+1})", key=f"pick_s2_{idx}",
                             type="primary", use_container_width=True):
                    st.session_state.pending_order = opt
                    st.session_state.buy_stage = "select_address"
                    st.session_state.selected_address_for_order = None
                    current_session["messages"].append({
                        "role": "user",
                        "content": f"我选择方案：{opt['title']}"
                    })
                    st.rerun()
                st.divider()

        if st.button("🔍 都不满意，进入阶段 3（按预算+配送时效筛选）", key="s2_go3"):
            st.session_state.recommend_step = 3
            st.session_state.candidate_options = []
            st.rerun()

    # ---------- 阶段 3 ----------
    elif st.session_state.buy_stage == "confirm_product" and st.session_state.recommend_step == 3:
        st.info("🎯 **【阶段 3推荐】请设置您的预算区间与配送时效，Agent 将精准匹配：**")

        price_range = st.slider(
            "预算区间（元）",
            min_value=0,
            max_value=10000,
            value=(0, 10000),
            step=50,
            format="￥%d"
        )
        delivery_time = st.selectbox(
            "配送时效要求",
            ["当日达", "次日达", "三日内", "一周内", "不限"]
        )

        if st.button("🎯 开始精准匹配", type="primary", use_container_width=True,
                     key="s3_match"):
            with st.spinner("正在按您的预算与时效筛选..."):
                result = call_deepseek_recommend_engine(
                    step=3,
                    item_category=st.session_state.target_product_category,
                    user_history=current_session["messages"],
                    extra_constraints={
                        "min_price": price_range[0],
                        "max_price": price_range[1],
                        "delivery_time": delivery_time,
                    }
                )
                st.session_state.pending_order = result

        if st.session_state.pending_order and st.session_state.recommend_step == 3:
            order = st.session_state.pending_order
            st.success("✅ **阶段 3 精准匹配完成**")
            render_order_card(order, key_prefix="s3")

            if st.button("✅ 选定此商品", type="primary", use_container_width=True,
                         key="s3_ok"):
                st.session_state.buy_stage = "select_address"
                st.session_state.selected_address_for_order = None
                st.rerun()

            if st.button("🔍 仍不满意，进入阶段 4（补充详细要求）", key="s3_go4"):
                st.session_state.recommend_step = 4
                st.session_state.candidate_options = []
                st.session_state.pending_order = None
                st.rerun()

    # ---------- 阶段 4 ----------
    elif st.session_state.buy_stage == "confirm_product" and st.session_state.recommend_step == 4:
        st.info("📝 **【阶段 4推荐】请补充您的详细要求，Agent 将为您精挑细选 5 款商品：**")

        detail_req = st.text_area(
            "详细要求",
            placeholder="例如：要黑色、支持快充、有品牌售后、需要发票、容量不低于 20000mAh..."
        )

        if st.button("🔎 生成 5 款精选商品", type="primary", use_container_width=True,
                     key="s4_gen"):
            if not detail_req.strip():
                st.error("请填写详细要求！")
            else:
                with st.spinner("正在为您精选 5 款最符合要求的商品..."):
                    options = call_deepseek_recommend_engine(
                        step=4,
                        item_category=st.session_state.target_product_category,
                        user_history=current_session["messages"],
                        extra_constraints={"detail_req": detail_req}
                    )
                    st.session_state.candidate_options = options

        if st.session_state.candidate_options:
            for idx, opt in enumerate(st.session_state.candidate_options):
                opt_uid = opt.get("option_id", idx)
                with st.container():
                    render_order_card(opt, key_prefix=f"s4_{opt_uid}")
                    if st.button("选定这款", key=f"pick_s4_{opt_uid}",
                                 type="primary", use_container_width=True):
                        st.session_state.pending_order = opt
                        st.session_state.buy_stage = "select_address"
                        st.session_state.selected_address_for_order = None
                        st.rerun()
                    st.divider()

    # ---------- 选择收货地址 ----------
    elif st.session_state.buy_stage == "select_address":
        st.success("🎉 **已选定商品！请确认收货地址：**")
        order = st.session_state.pending_order
        render_order_card(order, key_prefix="addr")
        render_address_selection()

    # ---------- 支付环节 ----------
    elif st.session_state.buy_stage == "payment":
        render_payment_section()

    # ---------- 用户输入框 ----------
    user_input = st.chat_input("请告诉我你想购买的商品，例如：帮我买一个 20000 毫安快充充电宝")

    if user_input:
        current_session["messages"].append({"role": "user", "content": user_input})

        if st.session_state.buy_stage == "none":
            st.session_state.target_product_category = user_input
            st.session_state.recommend_step = 1

            with st.spinner("正在联网比价并为您挑选最优方案..."):
                result = call_deepseek_recommend_engine(
                    step=1,
                    item_category=user_input,
                    user_history=current_session["messages"]
                )
                st.session_state.pending_order = result
                st.session_state.buy_stage = "confirm_product"

            current_session["messages"].append({
                "role": "assistant",
                "content": f"我已为您在【{user_input}】品类下进行了全网比价，请看下方推荐卡片 →"
            })
        st.rerun()


# ==========================================
# 7. 主入口路由
# ==========================================
def main():
    if not st.session_state.authenticated:
        render_welcome_page()
        return

    with st.sidebar:
        st.markdown("## 🧭 导航")
        if st.button("🤖 智能代购", use_container_width=True):
            st.session_state.nav_location = "chat"
            st.rerun()
        if st.button("👤 个人中心", use_container_width=True):
            st.session_state.nav_location = "profile_home"
            st.rerun()
        st.divider()
        if st.button("🚪 退出登录", use_container_width=True):
            st.session_state.authenticated = False
            st.session_state.user_info = None
            st.session_state.nav_location = "chat"
            st.rerun()

    loc = st.session_state.nav_location
    if loc == "chat":
        render_chat_agent()
    elif loc == "profile_home":
        render_profile_navigation_home()
    elif loc in ["pay_settings", "wallet", "address", "records"]:
        render_profile_sub_page()
    else:
        render_chat_agent()


if __name__ == "__main__":
    main()