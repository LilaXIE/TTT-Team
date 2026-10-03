import streamlit as st
import time
import random
import string
import json
import re
import requests
import smtplib
import ssl
import hashlib
import hmac
import urllib.parse
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
TENCENT_SECRET_ID  = "AKIDv1CIEyb6SdgXDnRyPjuysex9C6qSvGRU"
TENCENT_SECRET_KEY = "ypX7Zs35zlQxMc8e4MTN6f6NTQDoEi8Q"

WSA_SERVICE = "wsa"
WSA_HOST    = "wsa.tencentcloudapi.com"
WSA_ACTION  = "SearchPro"
WSA_VERSION = "2025-05-08"

# ==========================================
# 只允许这 5 个官方平台
# ==========================================
ALLOWED_PLATFORMS = {
    "淘宝":   ["taobao.com", "m.tb.cn", "tb.cn"],
    "天猫":   ["tmall.com"],
    "京东":   ["jd.com", "3.cn", "jd.hk"],
    "拼多多": ["pinduoduo.com", "yangkeduo.com"],
    "唯品会": ["vip.com"],
}


def _detect_platform(url: str):
    """返回 url 属于哪个允许的平台；不属于则返回 None"""
    if not url:
        return None
    url_l = url.lower()
    for name, domains in ALLOWED_PLATFORMS.items():
        for d in domains:
            if d in url_l:
                return name
    return None


def _is_allowed_url(url: str) -> bool:
    return _detect_platform(url) is not None


# ---------- 商品详情页判定 ----------
_PRODUCT_DETAIL_PATTERNS = [
    # 京东商品详情
    re.compile(r"item\.jd\.com/\d+\.html", re.I),
    re.compile(r"item\.m\.jd\.com/product/\d+\.html", re.I),
    re.compile(r"npcitem\.jd\.hk/\d+\.html", re.I),
    # 天猫商品详情
    re.compile(r"detail\.tmall\.com/item\.htm\?.*id=\d+", re.I),
    re.compile(r"detail\.tmall\.hk/item\.htm\?.*id=\d+", re.I),
    # 淘宝商品详情
    re.compile(r"item\.taobao\.com/item\.htm\?.*id=\d+", re.I),
    re.compile(r"detail\.tb\.cn/item\.htm\?.*id=\d+", re.I),
    # 拼多多商品详情
    re.compile(r"mobile\.yangkeduo\.com/goods\.html\?.*goods_id=\d+", re.I),
    re.compile(r"yangkeduo\.com/goods\.html\?.*goods_id=\d+", re.I),
    # 唯品会商品详情
    re.compile(r"detail\.vip\.com/\d+\.html", re.I),
    re.compile(r"m\.vip\.com/detail/\d+", re.I),
]


def _is_product_detail_url(url: str) -> bool:
    """判断 URL 是否为某商品的详情页（而不是搜索页/列表页/首页）"""
    if not url:
        return False
    if not _is_allowed_url(url):
        return False
    for pat in _PRODUCT_DETAIL_PATTERNS:
        if pat.search(url):
            return True
    return False


# ==========================================
# 0.1 邮件发送
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
# 1. 页面配置与 CSS
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
    .stButton>button { border-radius: 8px; }
    .wallet-card {
        background: linear-gradient(135deg, #2B32B2 0%, #1488CC 100%);
        color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;
    }
    .custom-badge {
        background-color: #2e7d32; color: white; padding: 3px 8px;
        border-radius: 12px; font-size: 12px; font-weight: bold;
    }
    .nav-card {
        background-color: #1E212A; border: 1px solid #313543;
        border-radius: 12px; padding: 20px; text-align: center;
        transition: transform 0.2s;
    }
    .nav-card:hover { border-color: #4CAF50; }
    .src-link { font-size: 13px; color: #4FC3F7; word-break: break-all; }
    .addr-tip {
        color: #FFA726; font-size: 13px; font-style: italic; margin-top: 4px;
    }
    .no-more-tip {
        background-color: #3E2723;
        border-left: 4px solid #FF9800;
        padding: 12px 16px;
        border-radius: 6px;
        color: #FFE0B2;
        margin: 10px 0;
    }
    .limit-tip {
        background-color: #4A148C;
        border-left: 4px solid #E91E63;
        padding: 12px 16px;
        border-radius: 6px;
        color: #F8BBD0;
        margin: 10px 0;
        font-weight: bold;
    }
    .chat-meta { color: #888; font-size: 12px; }
    .intent-tag {
        background-color: #1B5E20; color: white;
        padding: 3px 10px; border-radius: 10px;
        font-size: 12px; margin-right: 6px; display: inline-block;
    }
    .platform-tag {
        background-color: #B71C1C; color: white;
        padding: 2px 8px; border-radius: 8px;
        font-size: 12px; margin-left: 6px;
    }
</style>
""", unsafe_allow_html=True)


# ==========================================
# 2. Session State 初始化
# ==========================================
if "users_db" not in st.session_state:
    st.session_state.users_db = {
        "test@example.com": {"email": "test@example.com", "password": "password123"}
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

# 首次登录：没有任何默认银行卡
if "bank_cards" not in st.session_state:
    st.session_state.bank_cards = []

# 首次登录：没有任何默认地址
if "address_list" not in st.session_state:
    st.session_state.address_list = []

if "chat_sessions" not in st.session_state:
    st.session_state.chat_sessions = [
        {
            "session_id": "CS-001",
            "title": "首次代购咨询",
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "messages": [
                {"role": "assistant",
                 "content": "👋 你好！我是你的 **DeepSeek 全网 AI 智能代购 Agent**。\n\n请告诉你想买什么商品（例如：*“帮我买一个 20000 毫安快充充电宝”*），我会为你全网比价、智能推荐并完成自动下单！\n\n💡 也可以直接说出更具体的要求，例如：*“我想买一个一千块钱左右的黑色相机”*，我会直接为你精选符合条件的商品。\n\n🛒 目前支持：**淘宝 / 天猫 / 京东 / 拼多多 / 唯品会** 五大平台。"}
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

if "selected_address_for_order" not in st.session_state:
    st.session_state.selected_address_for_order = None
if "payment_code" not in st.session_state:
    st.session_state.payment_code = None
if "payment_code_sent_at" not in st.session_state:
    st.session_state.payment_code_sent_at = None
if "payment_code_order_id" not in st.session_state:
    st.session_state.payment_code_order_id = None

if "stage3_price_range" not in st.session_state:
    st.session_state.stage3_price_range = None

if "stage4_no_match" not in st.session_state:
    st.session_state.stage4_no_match = False

if "limit_exceeded" not in st.session_state:
    st.session_state.limit_exceeded = False
if "limit_exceeded_order" not in st.session_state:
    st.session_state.limit_exceeded_order = None

if "editing_address_id" not in st.session_state:
    st.session_state.editing_address_id = None
if "editing_card_id" not in st.session_state:
    st.session_state.editing_card_id = None

# 当前会话的属性/价格约束缓存
if "current_attributes" not in st.session_state:
    st.session_state.current_attributes = []
if "current_price_range" not in st.session_state:
    st.session_state.current_price_range = (None, None)
if "current_detail_req" not in st.session_state:
    st.session_state.current_detail_req = ""

# SMTP 发件配置
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
# 3. 辅助函数
# ==========================================
def generate_12digit_code():
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(12))


def validate_password(pwd: str):
    if not pwd or len(pwd) < 8:
        return False, "密码长度不能少于 8 位"
    if not re.search(r"[A-Za-z]", pwd):
        return False, "密码必须包含至少一个字母"
    if not re.search(r"\d", pwd):
        return False, "密码必须包含至少一个数字"
    return True, ""


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


# ---------- 联网搜索：只保留 5 大平台 + 商品详情页 ----------
def _search_web_raw(query: str, search_source: str = "standard") -> list:
    cache_key = f"raw::{query}||{search_source}"
    if cache_key in st.session_state.search_cache:
        return st.session_state.search_cache[cache_key]

    # Cnt 提到 50，让更多商品详情页有机会被返回
    payload = {"Query": query, "Mode": 0, "Cnt": 50}

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

        pages_raw = response_body.get("Pages", []) or []
        for page_str in pages_raw:
            try:
                page = json.loads(page_str) if isinstance(page_str, str) else page_str
                url = page.get("url", "") or page.get("Url", "")
                if not url:
                    continue
                # 只保留 5 大平台
                platform = _detect_platform(url)
                if platform is None:
                    continue
                title = page.get("title", "") or page.get("Title", "") or "无标题"
                site  = page.get("site", "") or page.get("Site", "") or platform
                date_ = page.get("date", "") or page.get("Date", "")
                passage = (
                    page.get("passage", "")
                    or page.get("content", "")
                    or page.get("Passage", "")
                )
                results.append({
                    "title":   title,
                    "url":     url,
                    "site":    site,
                    "date":    date_,
                    "passage": passage,
                    "platform": platform,
                    # 是否是商品详情页
                    "is_detail": _is_product_detail_url(url),
                })
            except Exception as e:
                print(f"[WSA 解析单条失败] {e}")
                continue

        # 商品详情页排前面，这样后面 attach url 时优先命中
        results.sort(key=lambda r: (not r["is_detail"],))

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
            f"[{i}] 【{r['title']}】({r['site']} {r['date']}) 平台：{r.get('platform','')}"
            f"{' [商品详情页]' if r.get('is_detail') else ''}\n"
            f"{r['passage']}\n"
            f"URL：{r['url']}"
        )
        summaries.append(block)
    return "\n\n".join(summaries)


# ---------- URL 附加：优先商品详情页，绝不用搜索页兜底 ----------
def _attach_real_urls(data, raw_results: list, item_category: str = ""):
    """
    给 LLM 返回的对象绑定真实商品详情页 URL。
    规则：
      1) search_ref 命中且是商品详情页 -> 用之
      2) 同 title 匹配到的且是商品详情页 -> 用之
      3) 从 raw_results 里优先选"商品详情页"且未被用过的
      4) 若该平台仍无商品详情页可用 -> source_url 留空（前端会提示"未找到商品详情页"）
    """
    used_urls = set()

    def _pick_detail_by_title(title: str):
        title = (title or "").strip()
        if not title:
            return None
        # 1) 直接包含匹配（只看商品详情页）
        for r in raw_results:
            if not r.get("is_detail"):
                continue
            rt = r.get("title", "")
            if rt and (title in rt or rt in title):
                return r
        # 2) 字符重叠度匹配
        best = None
        best_score = 0
        for r in raw_results:
            if not r.get("is_detail"):
                continue
            rt = r.get("title", "")
            if not rt:
                continue
            common = set(title) & set(rt)
            score = len(common)
            if score > best_score:
                best_score = score
                best = r
        if best is not None and best_score >= max(3, len(title) // 3):
            return best
        return None

    def _pick_any_unused_detail():
        for r in raw_results:
            if r.get("is_detail") and r.get("url") not in used_urls:
                return r
        return None

    def _fill(item):
        ref = item.get("search_ref", 0)
        try:
            ref = int(ref)
        except Exception:
            ref = 0

        picked = None
        # 1) search_ref
        if 1 <= ref <= len(raw_results):
            cand = raw_results[ref - 1]
            if cand.get("is_detail"):
                picked = cand

        # 2) title 匹配
        if picked is None:
            picked = _pick_detail_by_title(item.get("title", ""))

        # 3) 任意未使用的详情页
        if picked is None:
            picked = _pick_any_unused_detail()

        if picked is not None:
            item["source_url"]  = picked.get("url", "")
            item["source_site"] = picked.get("site", "") or picked.get("platform", "")
            item["platform"]    = picked.get("platform", "") or item.get("platform", "")
            used_urls.add(picked.get("url", ""))
        else:
            # 找不到任何商品详情页 -> 留空，由前端明确提示
            item["source_url"]  = ""
            item["source_site"] = item.get("platform", "")

    if isinstance(data, dict):
        _fill(data)
    elif isinstance(data, list):
        for it in data:
            _fill(it)
    return data


# ---------- 价格估算（步长 10） ----------
def estimate_price_range(item_category: str) -> tuple:
    raw_results = _search_web_raw(f"{item_category} 价格 多少钱 市场价", "standard")

    prices = []
    if raw_results:
        text_blob = " ".join(
            (r.get("passage", "") or "") + " " + (r.get("title", "") or "")
            for r in raw_results
        )
        for m in re.findall(
            r"(?:¥|￥|价格[：: ]*)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*元?",
            text_blob,
        ):
            try:
                v = float(m.replace(",", ""))
                if 1 <= v <= 100000:
                    prices.append(v)
            except Exception:
                continue

    if prices:
        lo = max(0, int(min(prices) * 0.6))
        hi = int(max(prices) * 1.5) + 10
        lo = (lo // 10) * 10
        hi = ((hi + 9) // 10) * 10
        if hi - lo < 100:
            hi = lo + 500
        return lo, hi

    try:
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system",
                 "content": f"用户想买【{item_category}】。请只输出一行 JSON："
                            f'{{"min": 最低合理价格, "max": 最高合理价格}}，单位元。只输出 JSON。'},
                {"role": "user", "content": f"请给出【{item_category}】的合理价格区间。"}
            ],
            stream=False
        )
        content = resp.choices[0].message.content.strip()
        content = re.sub(r"^```json|```$", "", content).strip()
        obj = json.loads(content)
        lo = max(0, int(obj.get("min", 0)))
        hi = max(lo + 500, int(obj.get("max", 10000)))
        lo = (lo // 10) * 10
        hi = ((hi + 9) // 10) * 10
        return lo, hi
    except Exception:
        return 0, 10000


# ---------- 意图解析 ----------
def parse_user_intent(user_input: str, current_category: str = "") -> dict:
    prompt = f"""你是一个电商购物意图解析器。请从用户输入中提取以下信息，并以纯 JSON 返回：
{{
  "category": "商品品类（简短，如：相机、充电宝、笔记本电脑）",
  "min_price": 数字或 null,
  "max_price": 数字或 null,
  "attributes": ["颜色/品牌/容量等具体属性"],
  "changed": true/false
}}

规则：
- 如果用户说"一千块钱左右"，min_price=800, max_price=1200（±20%）。
- 如果用户说"1000元以内"，min_price=null, max_price=1000。
- 如果用户说"至少2000"，min_price=2000, max_price=null。
- 如果用户说"1000到2000元"，min_price=1000, max_price=2000。
- 如果用户没说价格，min_price 和 max_price 都为 null。
- attributes 是用户明确要求的属性（如"黑色"、"华为"、"20000毫安"、"快充"）。
- changed 表示用户这次说的品类是否与当前品类不同。
- 当前品类是：【{current_category or "（无）"}】
- 如果用户只是在确认/拒绝/继续（如"满意"、"换一批"），category 留空字符串。

用户输入："{user_input}"

只输出 JSON，不要 markdown。"""

    try:
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            stream=False
        )
        content = resp.choices[0].message.content.strip()
        content = re.sub(r"^```json|```$", "", content).strip()
        obj = json.loads(content)
        obj.setdefault("category", "")
        obj.setdefault("min_price", None)
        obj.setdefault("max_price", None)
        obj.setdefault("attributes", [])
        obj.setdefault("changed", False)
        if not isinstance(obj.get("attributes"), list):
            obj["attributes"] = []
        return obj
    except Exception as e:
        print(f"[意图解析失败] {e}")
        return {
            "category": user_input,
            "min_price": None,
            "max_price": None,
            "attributes": [],
            "changed": bool(current_category and user_input.strip() != current_category),
        }


# ==========================================
# 通用：构造"精确商品名"的 system prompt 头部
# ==========================================
_TITLE_RULES = """【商品标题要求 — 极其重要】
- "title" 必须是该商品的**完整具体名称**，直接抄录电商平台商品页上的标题，包含品牌、型号、容量、颜色、卖点等全部信息。
- 示例（正确）：
  "小米自带线充电宝10000 口袋版小巧便携 移动电源随身充 双向快充安卓苹果通用 安全耐用 浅咖色"
  "啄木鸟帽子女士秋冬季八角帽中老年妈妈时尚百搭帽秋冬季保暖贝雷帽"
  "Apple iPhone 16 Pro 256GB 原色钛金属 5G双卡双待"
- 反例（错误，绝对禁止）：
  "小米充电宝"  "充电宝推荐"  "高性价比充电宝"  "【定制精选1】相机特别款"
- 不允许用任何占位符或自造标题。
"""

_URL_RULES = """【链接要求 — 极其重要】
- 你**只通过 search_ref**引用搜索结果，不要自己编造任何 URL。
- 程序会从联网搜索结果里挑选"商品详情页 URL"（如 https://item.jd.com/10076490523190.html）。
- 如果搜索结果里**没有**该商品的详情页，程序会把它标为无链接，你不要勉强凑一个搜索页。
"""


# ---------- 推荐引擎 ----------
def call_deepseek_recommend_engine(step: int, item_category: str,
                                   user_history: list,
                                   extra_constraints: dict = None):
    extra_constraints = extra_constraints or {}
    search_context = ""
    raw_results = []

    attrs = extra_constraints.get("attributes", []) or []
    min_price_c = extra_constraints.get("min_price", None)
    max_price_c = extra_constraints.get("max_price", None)
    attr_q = " ".join(attrs) if attrs else ""

    price_q = ""
    if min_price_c is not None and max_price_c is not None:
        price_q = f"{int(min_price_c)}到{int(max_price_c)}元"
    elif min_price_c is not None:
        price_q = f"{int(min_price_c)}元以上"
    elif max_price_c is not None:
        price_q = f"{int(max_price_c)}元以内"

    # 搜索 query：显式限定 5 大平台 + 商品详情页关键词
    platform_q = "淘宝 天猫 京东 拼多多 唯品会"

    if step in [1, 2, 3, 4]:
        if step == 1:
            search_query = f"{item_category} {attr_q} 最新价格 用户评价 推荐 {platform_q}"
        elif step == 2:
            search_query = f"{item_category} {attr_q} 价格 评价 销量 {platform_q}"
        elif step == 3:
            p_min = extra_constraints.get("min_price", 0) or 0
            p_max = extra_constraints.get("max_price", 10000) or 10000
            search_query = f"{item_category} {attr_q} {p_min}到{p_max}元 {platform_q}"
        else:
            user_detail = extra_constraints.get("detail_req", "")
            search_query = f"{item_category} {attr_q} {price_q} {user_detail} {platform_q}"

        raw_results = _search_web_raw(search_query, search_source="standard")
        if raw_results:
            summaries = []
            for i, r in enumerate(raw_results, 1):
                flag = " [商品详情页]" if r.get("is_detail") else ""
                block = (
                    f"[{i}] 【{r['title']}】({r['site']} {r['date']}) 平台：{r.get('platform','')}{flag}\n"
                    f"{r['passage']}\n"
                    f"URL：{r['url']}"
                )
                summaries.append(block)
            search_context = "\n\n".join(summaries)
        else:
            search_context = "[搜索服务暂时不可用，将基于模型知识生成推荐]"

    base_instructions = (
        f"用户想要购买的核心商品品类是：【{item_category}】。"
        f"你必须 STRICTLY 推荐该品类下的商品，绝对不能更换为其他物品类型！\n"
        f"【平台限制】只能推荐来自 淘宝、天猫、京东、拼多多、唯品会 这五个平台的商品，"
        f"不能推荐其他任何平台（如亚马逊、苏宁、抖音、小红书等一律禁止）。\n"
        + _TITLE_RULES
        + _URL_RULES
    )

    constraint_lines = []
    if attrs:
        constraint_lines.append(f"用户明确要求的属性：{'、'.join(attrs)}（所有推荐必须满足）。")
    if min_price_c is not None or max_price_c is not None:
        if min_price_c is not None and max_price_c is not None:
            constraint_lines.append(f"用户要求价格区间：{int(min_price_c)} ~ {int(max_price_c)} 元（所有推荐必须落在此区间）。")
        elif min_price_c is not None:
            constraint_lines.append(f"用户要求价格不低于 {int(min_price_c)} 元。")
        else:
            constraint_lines.append(f"用户要求价格不超过 {int(max_price_c)} 元。")
    if constraint_lines:
        base_instructions += "\n" + "\n".join(constraint_lines)

    if search_context and "[搜索服务暂时不可用" not in search_context:
        base_instructions += f"""

以下是来自联网搜索的最新商品信息（**只包含淘宝/天猫/京东/拼多多/唯品会**）：
--- 联网搜索结果开始 ---
{search_context}
--- 联网搜索结果结束 ---

特别重要：
- 不允许你自己编造任何 URL！
- 你只需在返回 JSON 的 "search_ref" 字段里填你参考的搜索结果序号。
- 程序会自动根据 search_ref 把真实的电商 URL 补充到返回结果里。
- "platform" 字段请填【淘宝/天猫/京东/拼多多/唯品会】之一。
- 如果没有任何搜索结果可参考，search_ref 填 0。
- "title" 请直接抄录搜索结果里的商品标题，不要自己改写或缩写。"""

    if step == 1:
        system_prompt = f"""{base_instructions}
请全网比价并推荐 1 个综合排名最高的选择。
必须以 JSON 输出，格式如下：
{{
  "title": "该商品在电商平台上的完整具体标题",
  "platform": "淘宝/天猫/京东/拼多多/唯品会 之一",
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
    "title": "该商品在电商平台上的完整具体标题",
    "platform": "淘宝/天猫/京东/拼多多/唯品会 之一",
    "original_price": 150.0,
    "coupon": 10.0,
    "final_price": 140.0,
    "search_ref": 1,
    "reason": "极具性价比，价格全网最低"
  }},
  {{
    "dimension": "用户评价最高",
    "title": "该商品在电商平台上的完整具体标题",
    "platform": "淘宝/天猫/京东/拼多多/唯品会 之一",
    "original_price": 250.0,
    "coupon": 20.0,
    "final_price": 230.0,
    "search_ref": 2,
    "reason": "好评率 99.8%，口碑极佳"
  }},
  {{
    "dimension": "销量最高推荐",
    "title": "该商品在电商平台上的完整具体标题",
    "platform": "淘宝/天猫/京东/拼多多/唯品会 之一",
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
        system_prompt = f"""{base_instructions}
用户筛选条件：价格范围为 {p_min} 元至 {p_max} 元之间。
请结合上述价格约束，推荐 1 个最符合要求的商品。
必须以 JSON 输出，格式如下：
{{
  "title": "该商品在电商平台上的完整具体标题",
  "platform": "淘宝/天猫/京东/拼多多/唯品会 之一",
  "original_price": 190.0,
  "coupon": 10.0,
  "final_price": 180.0,
  "search_ref": 1,
  "reason": "精准满足预算区间"
}}
仅返回纯 JSON 代码，不要带 markdown。"""
    elif step == 4:
        user_detail = extra_constraints.get("detail_req", "")
        system_prompt = f"""{base_instructions}
用户补充的详细要求为：“{user_detail}”。
请根据该品类及历史要求，精选 5 个符合条件的具体商品供用户挑选。
**所有推荐必须严格满足上述属性与价格约束（如果有的话）。**
**"title" 必须是每个商品在电商平台上真实存在的完整标题。**
必须以 JSON 数组形式输出（含 5 个对象）：
[
  {{
    "option_id": 1,
    "title": "该商品在电商平台上的完整具体标题",
    "platform": "淘宝/天猫/京东/拼多多/唯品会 之一",
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
        elif content.startswith("```"):
            content = content[3:-3].strip()
        data = json.loads(content)

        data = _attach_real_urls(data, raw_results, item_category=item_category)

        if isinstance(data, dict):
            data["order_id"] = f"AGENT-ORD-{random.randint(100000, 999999)}"
        elif isinstance(data, list):
            for item in data:
                item["order_id"] = f"AGENT-ORD-{random.randint(100000, 999999)}"
        return data
    except Exception as e:
        print(f"[推荐引擎失败] step={step}, {type(e).__name__}: {e}")
        if step in [1, 3]:
            base_p = round(random.uniform(100, 500), 2)
            plat = "京东"
            # fallback 也没链接
            return {
                "order_id": f"AGENT-ORD-{random.randint(100000, 999999)}",
                "title": f"{item_category} 精选方案",
                "platform": plat,
                "original_price": base_p,
                "coupon": 10.0,
                "final_price": base_p - 10.0,
                "search_ref": 0,
                "source_url": "",
                "source_site": plat,
                "reason": f"符合对【{item_category}】特定要求的精选方案（未找到商品详情页）。"
            }
        elif step == 2:
            res = []
            plats = ["拼多多", "天猫", "京东"]
            for i in range(3):
                p = plats[i]
                res.append({
                    "dimension": ["价格最佳选择", "用户评价最高", "销量最高推荐"][i],
                    "order_id": f"ORD-S2-{i+1}",
                    "title": f"{item_category} 精选方案 {i+1}",
                    "platform": p,
                    "original_price": 199.0, "coupon": 20.0, "final_price": 179.0,
                    "search_ref": 0,
                    "source_url": "",
                    "source_site": p,
                    "reason": "由搜索结果精选（未找到商品详情页）"
                })
            return res
        elif step == 4:
            res = []
            plats = ["京东", "天猫", "淘宝", "拼多多", "唯品会"]
            for i in range(1, 6):
                bp = 100 + i * 30
                p = plats[(i - 1) % len(plats)]
                res.append({
                    "option_id": i,
                    "order_id": f"ORD-S4-{i}",
                    "title": f"{item_category} 精选款 {i}",
                    "platform": p,
                    "original_price": bp,
                    "coupon": 10.0,
                    "final_price": bp - 10.0,
                    "search_ref": 0,
                    "source_url": "",
                    "source_site": p,
                    "reason": f"根据您的详细定制要求而甄选的第 {i} 种款式（未找到商品详情页）"
                })
            return res


# ---------- 限额计算与校验 ----------
def _today_order_total() -> float:
    today_str = datetime.now().strftime("%Y-%m-%d")
    total = 0.0
    for o in st.session_state.orders_history:
        ts = o.get("paid_at", "")
        if ts.startswith(today_str):
            try:
                total += float(o.get("final_price", 0))
            except Exception:
                pass
    return total


def check_order_limits(order: dict) -> tuple:
    try:
        price = float(order.get("final_price", 0))
    except Exception:
        price = 0.0

    single_limit = float(st.session_state.single_limit)
    daily_limit = float(st.session_state.daily_limit)
    today_used = _today_order_total()
    today_after = today_used + price

    if price > single_limit:
        return True, (
            f"对不起，您选择的商品（￥{price:.2f}）超过了您规定的**单笔付款限额**（￥{single_limit:.2f}），"
            f"请在个人中心修改限额或另外选择限额内的商品进行购买。"
        )
    if today_after > daily_limit:
        return True, (
            f"对不起，您选择的商品（￥{price:.2f}）加上今日已用（￥{today_used:.2f}）"
            f"将超过您规定的**单日累计付款限额**（￥{daily_limit:.2f}），"
            f"请在个人中心修改限额或另外选择限额内的商品进行购买。"
        )
    return False, ""


# ==========================================
# 3.1 SMTP 侧边栏
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
# 4. 登录 / 注册
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

            email = st.text_input("电子邮箱", placeholder="example@domain.com")

            code_col1, code_col2 = st.columns([2, 1])
            with code_col1:
                verify_code = st.text_input("验证码", placeholder="输入 6 位验证码", max_chars=6)
            with code_col2:
                st.write("")
                if st.button("发送验证码", use_container_width=True):
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

            password = st.text_input("设置登录密码", type="password",
                                     placeholder="至少 8 位，必须同时包含字母和数字")
            confirm_password = st.text_input("确认登录密码", type="password",
                                             placeholder="再次输入密码")

            st.markdown("---")
            agree_terms = st.checkbox(
                "我已阅读并同意 [《AI代购Agent用户服务协议》](#) 与 [《隐私保护政策》](#)"
            )

            if st.button("🚀 注册账户", type="primary", use_container_width=True):
                clean_email = email.strip().lower()
                pwd_ok, pwd_err = validate_password(password)

                if not agree_terms:
                    st.error("❌ 必须勾选同意法律协议方可注册！")
                elif not clean_email:
                    st.error("❌ 请填写邮箱！")
                elif clean_email in st.session_state.users_db:
                    st.error("❌ 该邮箱已被注册，请直接选择【登录账户】！")
                elif not st.session_state.simulated_code:
                    st.error("❌ 请先点击【发送验证码】！")
                elif (st.session_state.code_sent_at is None
                      or time.time() - st.session_state.code_sent_at > 300):
                    st.error("❌ 验证码已过期（超过 5 分钟），请重新发送！")
                elif not verify_code or verify_code != st.session_state.simulated_code:
                    st.error("❌ 验证码不正确！")
                elif not pwd_ok:
                    st.error(f"❌ {pwd_err}")
                elif password != confirm_password:
                    st.error("❌ 两次输入的密码不一致！")
                else:
                    user_data = {
                        "email": clean_email,
                        "password": password,
                        "login_type": "email"
                    }
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
            st.caption("提示：快捷测试账号：`test@example.com` / 密码：`password123`")

            login_email = st.text_input("邮箱",
                                        placeholder="输入注册时使用的邮箱").strip().lower()
            login_password = st.text_input("密码", type="password", placeholder="输入登录密码")

            if st.button("🔓 登录系统", type="primary", use_container_width=True):
                if not login_email or not login_password:
                    st.error("❌ 请输入邮箱与密码！")
                elif login_email not in st.session_state.users_db:
                    st.error("❌ 该邮箱未注册，请先选择【注册新账户】！")
                else:
                    user_data = st.session_state.users_db[login_email].copy()
                    if user_data["password"] != login_password:
                        st.error("❌ 登录密码错误，请重新输入！")
                    else:
                        user_data["login_type"] = "email"
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


# ---------- 银行账户：支持编辑 / 删除 ----------
def render_bank_cards_section():
    st.subheader("💳 已绑定的银行账户 / 快捷卡")

    # 无银行卡
    if not st.session_state.bank_cards:
        st.info("📭 您还没有绑定任何银行账户，请在下方添加您的第一张银行卡。")

    for card in list(st.session_state.bank_cards):
        editing = (st.session_state.editing_card_id == card["id"])

        with st.container():
            # 删掉 "可用额度/余额" 列后，重新分配列宽
            c1, c2, c3, c4 = st.columns([4, 1, 1, 1])
            with c1:
                st.write(f"🏦 **{card['bank']}** ({card['type']})")
            with c2:
                st.markdown('<span class="custom-badge">✓ 已校验</span>',
                            unsafe_allow_html=True)
            with c3:
                if st.button("✏️ 编辑", key=f"edit_card_{card['id']}",
                             use_container_width=True):
                    st.session_state.editing_card_id = card["id"]
                    st.rerun()
            with c4:
                if st.button("🗑️ 删除", key=f"del_card_{card['id']}",
                             use_container_width=True):
                    st.session_state.bank_cards = [
                        x for x in st.session_state.bank_cards if x["id"] != card["id"]
                    ]
                    if st.session_state.editing_card_id == card["id"]:
                        st.session_state.editing_card_id = None
                    st.success("已删除该银行卡")
                    time.sleep(0.5)
                    st.rerun()

            if editing:
                st.markdown("**✏️ 编辑此银行卡**")
                with st.form(key=f"edit_card_form_{card['id']}"):
                    new_bank = st.text_input("银行名称", value=card["bank"])
                    new_type = st.selectbox(
                        "卡类型", ["储蓄卡", "信用卡"],
                        index=0 if card["type"] == "储蓄卡" else 1
                    )
                    sub_c1, sub_c2 = st.columns(2)
                    with sub_c1:
                        save = st.form_submit_button("💾 保存", type="primary",
                                                     use_container_width=True)
                    with sub_c2:
                        cancel = st.form_submit_button("✖️ 取消",
                                                       use_container_width=True)
                    if save:
                        if not new_bank.strip():
                            st.error("银行名称不能为空")
                        else:
                            for x in st.session_state.bank_cards:
                                if x["id"] == card["id"]:
                                    x["bank"] = new_bank.strip()
                                    x["type"] = new_type
                            st.session_state.editing_card_id = None
                            st.success("✅ 修改成功")
                            time.sleep(0.6)
                            st.rerun()
                    if cancel:
                        st.session_state.editing_card_id = None
                        st.rerun()

            st.divider()

    with st.expander("➕ 新增一张银行卡", expanded=not st.session_state.bank_cards):
        with st.form("add_card_form"):
            nb = st.text_input("银行名称", placeholder="如：中国银行 (尾号 1234)")
            nt = st.selectbox("卡类型", ["储蓄卡", "信用卡"])
            submit_add = st.form_submit_button("➕ 添加", type="primary",
                                               use_container_width=True)
            if submit_add:
                if not nb.strip():
                    st.error("银行名称不能为空")
                else:
                    new_id = max([c["id"] for c in st.session_state.bank_cards], default=0) + 1
                    st.session_state.bank_cards.append({
                        "id": new_id,
                        "bank": nb.strip(),
                        "type": nt,
                    })
                    st.success("✅ 已添加")
                    time.sleep(0.6)
                    st.rerun()

    st.info("💡 银行账户用于**大额代购直扣**及为**我的钱包充值**。")


# ---------- 地址：支持编辑 / 删除 ----------
def render_addresses_section():
    st.subheader("📦 代购收货地址管理")

    if not st.session_state.address_list:
        st.info("📭 您还没有添加任何收货地址，请在下方添加您的第一个地址。")

    for addr in list(st.session_state.address_list):
        editing = (st.session_state.editing_address_id == addr["id"])

        with st.container():
            col_a, col_b, col_c, col_d = st.columns([4, 1, 1, 1])
            with col_a:
                default_tag = " :red[[默认地址]]" if addr["is_default"] else ""
                st.write(f"👤 **{addr['name']}** ({addr['phone']}){default_tag}")
                st.write(f"🏠 {addr['address']}")
            with col_b:
                if not addr["is_default"]:
                    if st.button("设默认", key=f"def_{addr['id']}",
                                 use_container_width=True):
                        for a in st.session_state.address_list:
                            a["is_default"] = (a["id"] == addr["id"])
                        st.rerun()
            with col_c:
                if st.button("✏️ 编辑", key=f"edit_addr_{addr['id']}",
                             use_container_width=True):
                    st.session_state.editing_address_id = addr["id"]
                    st.rerun()
            with col_d:
                if st.button("🗑️ 删除", key=f"del_addr_{addr['id']}",
                             use_container_width=True):
                    st.session_state.address_list = [
                        a for a in st.session_state.address_list if a["id"] != addr["id"]
                    ]
                    if st.session_state.editing_address_id == addr["id"]:
                        st.session_state.editing_address_id = None
                    st.success("已删除该地址")
                    time.sleep(0.5)
                    st.rerun()

            if editing:
                st.markdown("**✏️ 编辑此地址**")
                with st.form(key=f"edit_addr_form_{addr['id']}"):
                    n_name = st.text_input("收货人姓名", value=addr["name"])
                    n_phone = st.text_input("手机号", value=addr["phone"])
                    n_addr = st.text_area("详细地址", value=addr["address"])
                    n_def = st.checkbox("设为默认地址", value=addr["is_default"])
                    sc1, sc2 = st.columns(2)
                    with sc1:
                        save = st.form_submit_button("💾 保存", type="primary",
                                                     use_container_width=True)
                    with sc2:
                        cancel = st.form_submit_button("✖️ 取消",
                                                       use_container_width=True)
                    if save:
                        if not n_name.strip() or not n_phone.strip() or not n_addr.strip():
                            st.error("姓名、手机号、地址均不能为空")
                        else:
                            for a in st.session_state.address_list:
                                if a["id"] == addr["id"]:
                                    a["name"] = n_name.strip()
                                    a["phone"] = n_phone.strip()
                                    a["address"] = n_addr.strip()
                                    a["is_default"] = bool(n_def)
                            if n_def:
                                for a in st.session_state.address_list:
                                    if a["id"] != addr["id"]:
                                        a["is_default"] = False
                            st.session_state.editing_address_id = None
                            st.success("✅ 修改成功")
                            time.sleep(0.6)
                            st.rerun()
                    if cancel:
                        st.session_state.editing_address_id = None
                        st.rerun()

            st.divider()

    with st.expander("➕ 新增收货地址", expanded=not st.session_state.address_list):
        with st.form("add_addr_form"):
            n_name = st.text_input("收货人姓名")
            n_phone = st.text_input("手机号")
            n_addr = st.text_area("详细地址")
            n_def = st.checkbox("设为默认地址", value=not st.session_state.address_list)
            sub = st.form_submit_button("➕ 添加", type="primary",
                                        use_container_width=True)
            if sub:
                if not n_name.strip() or not n_phone.strip() or not n_addr.strip():
                    st.error("姓名、手机号、地址均不能为空")
                else:
                    new_id = max([a["id"] for a in st.session_state.address_list],
                                 default=0) + 1
                    if n_def or not st.session_state.address_list:
                        for a in st.session_state.address_list:
                            a["is_default"] = False
                        n_def = True
                    st.session_state.address_list.append({
                        "id": new_id,
                        "name": n_name.strip(),
                        "phone": n_phone.strip(),
                        "address": n_addr.strip(),
                        "is_default": bool(n_def),
                    })
                    st.success("✅ 已添加")
                    time.sleep(0.6)
                    st.rerun()


def render_profile_sub_page():
    current_loc = st.session_state.nav_location

    nav_cols = st.columns([1, 5])
    with nav_cols[0]:
        if st.button("⬅️ 返回个人中心"):
            st.session_state.nav_location = "profile_home"
            st.session_state.editing_address_id = None
            st.session_state.editing_card_id = None
            st.rerun()

    st.divider()

    if current_loc == "pay_settings":
        st.title("💳 支付设置")
        st.caption("在此统一管理银行账户以及代购交易限额配置")

        tab_bank, tab_limits = st.tabs(["🏦 银行账户", "⚙ 交易限额设置"])

        with tab_bank:
            render_bank_cards_section()

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
        if not st.session_state.bank_cards:
            st.info("📭 您还没有绑定任何银行账户，请先前往【支付设置 → 银行账户】添加银行卡后再充值。")
        else:
            recharge_col1, recharge_col2 = st.columns([2, 1])
            with recharge_col1:
                select_bank = st.selectbox(
                    "选择付款银行卡",
                    [f"{card['bank']} ({card['type']})" for card in st.session_state.bank_cards]
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
        render_addresses_section()

    elif current_loc == "records":
        rec_tab1, rec_tab2 = st.tabs(["💬 聊天记录", "🛍 购买记录"])
        with rec_tab1:
            if st.button("➕ 开启新对话", type="primary"):
                new_idx = len(st.session_state.chat_sessions) + 1
                st.session_state.chat_sessions.append({
                    "session_id": f"CS-{new_idx:03d}",
                    "title": "新代购咨询",
                    "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "messages": [
                        {"role": "assistant",
                         "content": "👋 你好！我是你的 **DeepSeek 全网 AI 智能代购 Agent**。\n\n请告诉我想买什么商品，我会为你全网比价并下单！"}
                    ]
                })
                st.session_state.current_session_index = len(st.session_state.chat_sessions) - 1
                st.session_state.nav_location = "chat"
                st.session_state.buy_stage = "none"
                st.session_state.recommend_step = 1
                st.session_state.target_product_category = ""
                st.session_state.pending_order = None
                st.session_state.candidate_options = []
                st.session_state.stage3_price_range = None
                st.session_state.stage4_no_match = False
                st.session_state.limit_exceeded = False
                st.session_state.limit_exceeded_order = None
                st.session_state.current_attributes = []
                st.session_state.current_price_range = (None, None)
                st.session_state.current_detail_req = ""
                st.rerun()

            st.markdown("##### 💬 历史对话")
            for s_idx, session in enumerate(st.session_state.chat_sessions):
                title = session.get("title", "未命名对话")
                created_at = session.get("created_at", "")
                head_c1, head_c2 = st.columns([5, 2])
                with head_c1:
                    st.markdown(f"**{s_idx+1}. {title}**")
                with head_c2:
                    st.markdown(
                        f'<div class="chat-meta" style="text-align:right;">🕒 {created_at}</div>',
                        unsafe_allow_html=True
                    )
                with st.expander(f"展开查看对话内容（{session['session_id']}）", expanded=False):
                    for msg in session["messages"]:
                        st.write(f"**{msg['role'].upper()}**: {msg['content']}")
                st.divider()

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
                        <p>🕒 <b>支付时间</b>：{ord_item.get('paid_at', '未知')}</p>
                    </div>
                    """, unsafe_allow_html=True)
                    if ord_item.get("source_url"):
                        st.markdown(f"🔗 [查看原商品页面]({ord_item['source_url']})")


# ==========================================
# 6. 主聊天界面
# ==========================================
def render_order_card(order: dict, key_prefix: str = ""):
    st.subheader(order.get("title", "未命名商品"))
    st.write(f"🏷️ **推荐平台**：{order.get('platform', '未知')}")
    st.write(f"🆔 **订单编号**：`{order.get('order_id', '')}`")
    if order.get("reason"):
        st.write(f"💡 **推荐理由**：{order['reason']}")
    st.markdown(f"### 券后价格：:red[￥{order.get('final_price', 0)}]")

    src = order.get("source_url", "")
    site = order.get("source_site", "")
    platform = order.get("platform", "")

    # 只展示"商品详情页"链接
    if src and _is_product_detail_url(src):
        st.markdown(f"🔗 **来源站点**：{site or platform or '官方平台'}")
        st.markdown(f"👉 [点击跳转商品详情页]({src})")
        st.text_input(
            "📋 复制链接（点右侧图标或全选复制）",
            value=src,
            key=f"copy_{key_prefix}_{order.get('order_id', random.random())}",
        )
    else:
        # 没有商品详情页 -> 明确告知用户
        st.warning("🔗 未能在电商平台搜索到该商品的具体详情页，建议您根据上方商品名称在对应平台搜索。")


def render_address_selection():
    st.divider()
    st.subheader("📍 选择收货地址")

    # 没有任何地址 -> 强制让用户新增
    if not st.session_state.address_list:
        st.info("📭 您还没有收货地址，请先填写一个新的收货地址：")
        new_name = st.text_input("收货人姓名", key="only_new_addr_name")
        new_phone = st.text_input("收货人手机号", key="only_new_addr_phone")
        new_addr = st.text_area(
            "详细收货地址",
            key="only_new_addr_detail",
            placeholder="例如：上海市浦东新区世纪大道 100 号 xx 小区 5 号楼 302 室",
        )
        if st.button("➡️ 保存地址并进入支付", type="primary",
                     use_container_width=True, key="only_new_addr_confirm"):
            if not new_name.strip() or not new_phone.strip() or not new_addr.strip():
                st.error("❌ 请完整填写姓名、手机号和详细地址！")
            else:
                addr_obj = {
                    "id": 1,
                    "name": new_name.strip(),
                    "phone": new_phone.strip(),
                    "address": new_addr.strip(),
                    "is_default": True,
                }
                st.session_state.address_list.append(addr_obj)
                st.session_state.selected_address_for_order = addr_obj
                st.session_state.buy_stage = "payment"
                st.session_state.payment_code = None
                st.session_state.payment_code_sent_at = None
                st.rerun()
        return

    # 有地址 -> 列表选择 + 新增
    addr_options = []
    for a in st.session_state.address_list:
        tag = " [默认]" if a["is_default"] else ""
        addr_options.append(f"{a['name']} - {a['phone']} - {a['address']}{tag}")
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


# ---------- 支付时新增银行卡（当 bank_cards 为空时使用） ----------
def _render_inline_add_bank_form(form_key: str = "inline_add_bank") -> dict | None:
    """
    在支付环节内联新增银行卡。返回新卡片 dict（若本次提交成功），否则返回 None。
    """
    st.markdown("**➕ 新增一张银行卡**")
    with st.form(key=form_key):
        nb = st.text_input("银行名称", placeholder="如：中国银行 (尾号 1234)")
        nt = st.selectbox("卡类型", ["储蓄卡", "信用卡"])
        sub = st.form_submit_button("➕ 添加并使用这张卡", type="primary",
                                    use_container_width=True)
        if sub:
            if not nb.strip():
                st.error("银行名称不能为空")
                return None
            new_id = max([c["id"] for c in st.session_state.bank_cards], default=0) + 1
            new_card = {"id": new_id, "bank": nb.strip(), "type": nt}
            st.session_state.bank_cards.append(new_card)
            st.success("✅ 已添加银行卡")
            return new_card
    return None


def render_payment_section():
    order = st.session_state.pending_order
    final_price = float(order["final_price"])

    st.subheader("💳 订单支付")
    render_order_card(order, key_prefix="pay")
    st.markdown(f"### 应付金额：:red[￥{final_price:.2f}]")

    addr = st.session_state.selected_address_for_order
    if addr:
        st.info(f"📦 收货地址：**{addr['name']}** · {addr['phone']} · {addr['address']}")

    wallet_balance = st.session_state.wallet_balance
    if wallet_balance >= final_price:
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

    if pay_method == "👛 钱包余额（优先）" and wallet_balance < final_price:
        st.error("❌ 钱包余额不足，请改选银行卡直扣。")
        return

    selected_card = None
    if pay_method == "🏦 银行卡直扣":
        # 无银行卡 -> 强制新增
        if not st.session_state.bank_cards:
            st.info("📭 您还没有绑定任何银行账户，请先添加一张银行卡用于本次扣款：")
            new_card = _render_inline_add_bank_form("pay_inline_add_bank")
            if new_card is not None:
                # 新增成功，自动选中该卡
                selected_card = f"{new_card['bank']} ({new_card['type']})"
                st.rerun()
            else:
                st.stop()
        else:
            # 有银行卡 -> 选择扣款账户
            options = [f"{c['bank']} ({c['type']})" for c in st.session_state.bank_cards]
            selected_card = st.selectbox(
                "选择扣款的银行账户",
                options,
                key="pay_bank_select",
            )

    st.divider()
    st.markdown("### 🔐 一次性支付密码验证")

    order_id = order["order_id"]
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
        else:
            st.warning("⚠️ 未配置发件邮箱或未获取到用户邮箱，无法发送。")

    user_pay_code = st.text_input(
        "请输入邮箱里收到的一次性支付密码（12 位字母数字）",
        type="password",
        max_chars=12,
        key="user_pay_code_input",
    )

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

    if st.button("✅ 确认支付", type="primary", use_container_width=True,
                 key="final_pay_confirm"):
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
            # 再校验一次是否真的有可用的银行卡
            if not st.session_state.bank_cards:
                st.error("❌ 请先添加一张银行卡再支付！")
                st.stop()

        payment_method_text = ""
        if pay_method == "👛 钱包余额（优先）":
            st.session_state.wallet_balance -= final_price
            payment_method_text = "👛 钱包余额"
        else:
            payment_method_text = f"🏦 {selected_card or (st.session_state.bank_cards[0]['bank'] + ' (' + st.session_state.bank_cards[0]['type'] + ')')}"

        addr = st.session_state.selected_address_for_order
        st.session_state.orders_history.append({
            "order_id": order["order_id"],
            "title": order["title"],
            "platform": order["platform"],
            "final_price": final_price,
            "shipping_address": f"{addr['name']} · {addr['phone']} · {addr['address']}" if addr else "默认地址",
            "payment_method": payment_method_text,
            "source_url": order.get("source_url", ""),
            "paid_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        })

        end_conversation(reason=f"🎉 支付成功！方式：{payment_method_text}，金额：￥{final_price:.2f}")


def end_conversation(reason: str = ""):
    current_session = st.session_state.chat_sessions[st.session_state.current_session_index]
    current_session["messages"].append({
        "role": "assistant",
        "content": (reason + "\n\n" if reason else "") +
                   "本次购物流程已结束，为您开启新的对话窗口。"
    })

    new_idx = len(st.session_state.chat_sessions) + 1
    st.session_state.chat_sessions.append({
        "session_id": f"CS-{new_idx:03d}",
        "title": "新代购咨询",
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "messages": [
            {"role": "assistant",
             "content": "👋 新的对话开始啦！请告诉我想购买的商品，我会为你联网比价、智能推荐并完成代购。"}
        ]
    })
    st.session_state.current_session_index = len(st.session_state.chat_sessions) - 1

    st.session_state.pending_order = None
    st.session_state.buy_stage = "none"
    st.session_state.recommend_step = 1
    st.session_state.target_product_category = ""
    st.session_state.candidate_options = []
    st.session_state.stage3_price_range = None
    st.session_state.stage4_no_match = False
    st.session_state.limit_exceeded = False
    st.session_state.limit_exceeded_order = None
    st.session_state.selected_address_for_order = None
    st.session_state.payment_code = None
    st.session_state.payment_code_sent_at = None
    st.session_state.payment_code_order_id = None
    st.session_state.current_attributes = []
    st.session_state.current_price_range = (None, None)
    st.session_state.current_detail_req = ""

    time.sleep(1)
    st.rerun()


def reset_current_conversation(new_product: str = None):
    st.session_state.pending_order = None
    st.session_state.buy_stage = "none"
    st.session_state.recommend_step = 1
    st.session_state.candidate_options = []
    st.session_state.stage3_price_range = None
    st.session_state.stage4_no_match = False
    st.session_state.limit_exceeded = False
    st.session_state.limit_exceeded_order = None
    st.session_state.selected_address_for_order = None
    st.session_state.payment_code = None
    st.session_state.payment_code_sent_at = None
    st.session_state.payment_code_order_id = None
    st.session_state.current_attributes = []
    st.session_state.current_price_range = (None, None)
    st.session_state.current_detail_req = ""

    if new_product:
        st.session_state.target_product_category = new_product


def _update_current_session_title(product_category: str):
    if not product_category:
        return
    current_session = st.session_state.chat_sessions[st.session_state.current_session_index]
    if current_session.get("title") in ("首次代购咨询", "新代购咨询", "", None):
        title = product_category.strip()
        if len(title) > 12:
            title = title[:12] + "..."
        current_session["title"] = title


# ---------- 用约束直接生成 5 款精选（阶段 4 逻辑复用） ----------
def _generate_constrained_options(item_category, detail_req, attributes, min_price, max_price, history):
    return call_deepseek_recommend_engine(
        step=4,
        item_category=item_category,
        user_history=history,
        extra_constraints={
            "detail_req": detail_req,
            "attributes": attributes,
            "min_price": min_price,
            "max_price": max_price,
        }
    )


def render_chat_agent():
    st.title("🤖 自动付款 AI 购物 Agent")
    st.caption("DeepSeek 驱动 · 腾讯云联网实时比价 · 锁定需求品类 · 智能识别价格与属性 · 仅限淘宝/天猫/京东/拼多多/唯品会")

    # 只保留：钱包余额 / 已成功代购
    col1, col2 = st.columns(2)
    with col1:
        st.metric("我的钱包余额", f"￥{st.session_state.wallet_balance:.2f}")
    with col2:
        st.metric("已成功代购", f"{len(st.session_state.orders_history)} 笔")

    st.divider()

    current_session = st.session_state.chat_sessions[st.session_state.current_session_index]
    for message in current_session["messages"]:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    # ---------- 当前约束展示 ----------
    if st.session_state.buy_stage in ("confirm_product", "select_address", "payment"):
        tags = []
        if st.session_state.target_product_category:
            tags.append(f"🎯 品类：{st.session_state.target_product_category}")
        for a in st.session_state.current_attributes:
            tags.append(f"🎨 {a}")
        pmin, pmax = st.session_state.current_price_range
        if pmin is not None or pmax is not None:
            if pmin is not None and pmax is not None:
                tags.append(f"💰 ￥{pmin}~￥{pmax}")
            elif pmin is not None:
                tags.append(f"💰 ≥￥{pmin}")
            else:
                tags.append(f"💰 ≤￥{pmax}")
        tags.append("🛒 平台：淘宝/天猫/京东/拼多多/唯品会")
        if tags:
            st.markdown(
                "".join(f'<span class="intent-tag">{t}</span>' for t in tags),
                unsafe_allow_html=True
            )
            st.write("")

    # ---------- 限额拦截分支 ----------
    if st.session_state.limit_exceeded and st.session_state.limit_exceeded_order:
        st.markdown(
            '<div class="limit-tip">'
            '对不起，您选择的商品超过了您规定的付款限额，'
            '请在个人中心修改限额或另外选择限额内的商品进行购买。'
            '</div>',
            unsafe_allow_html=True
        )
        order = st.session_state.limit_exceeded_order
        render_order_card(order, key_prefix="limit")

        lc1, lc2 = st.columns(2)
        with lc1:
            if st.button("⚙️ 去个人中心修改限额", type="primary",
                         use_container_width=True, key="limit_go_settings"):
                end_conversation(reason="已为您结束本次对话，请前往个人中心修改限额。")
                st.session_state.nav_location = "pay_settings"
                st.rerun()
        with lc2:
            if st.button("🔁 另外选择限额内的商品", use_container_width=True,
                         key="limit_reselect"):
                st.session_state.limit_exceeded = False
                st.session_state.limit_exceeded_order = None
                st.session_state.pending_order = None
                st.session_state.buy_stage = "confirm_product"
                st.session_state.recommend_step = 1
                st.session_state.candidate_options = []

                with st.spinner("正在为您重新联网比价..."):
                    result = call_deepseek_recommend_engine(
                        step=1,
                        item_category=st.session_state.target_product_category,
                        user_history=current_session["messages"]
                    )
                    st.session_state.pending_order = result
                st.rerun()

    # ---------- 阶段 1 ----------
    elif st.session_state.buy_stage == "confirm_product" and st.session_state.recommend_step == 1:
        order = st.session_state.pending_order
        st.warning("已为您匹配到综合排名最高的选择：")
        render_order_card(order, key_prefix="s1")

        btn_c1, btn_c2, _ = st.columns([1, 1, 2])
        with btn_c1:
            if st.button("✅ 满意 (选定此商品)", type="primary", use_container_width=True,
                         key="s1_ok"):
                exceeded, msg = check_order_limits(order)
                if exceeded:
                    st.session_state.limit_exceeded = True
                    st.session_state.limit_exceeded_order = order
                    st.session_state.pending_order = None
                    current_session["messages"].append({
                        "role": "assistant", "content": msg
                    })
                    st.rerun()
                else:
                    st.session_state.buy_stage = "select_address"
                    st.session_state.selected_address_for_order = None
                    current_session["messages"].append({"role": "user", "content": "满意，就选这个。"})
                    st.rerun()
        with btn_c2:
            if st.button("❌ 不满意 (换一批)", use_container_width=True, key="s1_no"):
                st.session_state.recommend_step = 2
                st.session_state.candidate_options = []
                with st.spinner("正在分别从【价格】、【评价】、【销量】三个维度搜寻最佳选择..."):
                    c_options = call_deepseek_recommend_engine(
                        step=2,
                        item_category=st.session_state.target_product_category,
                        user_history=current_session["messages"],
                        extra_constraints={
                            "attributes": st.session_state.current_attributes,
                            "min_price": st.session_state.current_price_range[0],
                            "max_price": st.session_state.current_price_range[1],
                        }
                    )
                    st.session_state.candidate_options = c_options
                st.rerun()

    # ---------- 阶段 2 ----------
    elif st.session_state.buy_stage == "confirm_product" and st.session_state.recommend_step == 2:
        st.info("以下是从三个不同维度为您精选的方案")
        options = st.session_state.candidate_options
        for idx, opt in enumerate(options):
            with st.container():
                st.markdown(f"### 🔹 {opt.get('dimension', f'选项 {idx+1}')}")
                render_order_card(opt, key_prefix=f"s2_{idx}")
                if st.button(f"选择此方案 ({idx+1})", key=f"pick_s2_{idx}",
                             type="primary", use_container_width=True):
                    exceeded, msg = check_order_limits(opt)
                    if exceeded:
                        st.session_state.limit_exceeded = True
                        st.session_state.limit_exceeded_order = opt
                        current_session["messages"].append({
                            "role": "assistant", "content": msg
                        })
                        st.rerun()
                    else:
                        st.session_state.pending_order = opt
                        st.session_state.buy_stage = "select_address"
                        st.session_state.selected_address_for_order = None
                        current_session["messages"].append({
                            "role": "user", "content": f"我选择方案：{opt['title']}"
                        })
                        st.rerun()
                st.divider()

        if st.button("🔍 都不满意，按预算筛选", key="s2_go3"):
            st.session_state.recommend_step = 3
            st.session_state.candidate_options = []
            with st.spinner("正在根据联网市场价为该商品估算合理价格区间..."):
                lo, hi = estimate_price_range(st.session_state.target_product_category)
            st.session_state.stage3_price_range = (lo, hi)
            st.rerun()

    # ---------- 阶段 3 ----------
    elif st.session_state.buy_stage == "confirm_product" and st.session_state.recommend_step == 3:
        st.info("请设置您的预算区间，Agent 将精准匹配：")

        if st.session_state.stage3_price_range is None:
            with st.spinner("正在根据联网市场价为该商品估算合理价格区间..."):
                lo, hi = estimate_price_range(st.session_state.target_product_category)
            st.session_state.stage3_price_range = (lo, hi)

        lo, hi = st.session_state.stage3_price_range
        st.caption(f"💡 根据全网市场价，【{st.session_state.target_product_category}】的合理价格约为 ￥{lo} ~ ￥{hi}")

        price_range = st.slider(
            "预算区间（元）",
            min_value=int(lo),
            max_value=int(hi),
            value=(int(lo), int(hi)),
            step=10,
            format="￥%d"
        )

        if st.button("🎯 开始精准匹配", type="primary", use_container_width=True,
                     key="s3_match"):
            with st.spinner("正在按您的预算筛选..."):
                result = call_deepseek_recommend_engine(
                    step=3,
                    item_category=st.session_state.target_product_category,
                    user_history=current_session["messages"],
                    extra_constraints={
                        "min_price": price_range[0],
                        "max_price": price_range[1],
                        "attributes": st.session_state.current_attributes,
                    }
                )
                st.session_state.pending_order = result
                st.session_state.current_price_range = (price_range[0], price_range[1])

        if st.session_state.pending_order and st.session_state.recommend_step == 3:
            order = st.session_state.pending_order
            st.success("✅ **精准匹配完成**")
            render_order_card(order, key_prefix="s3")

            if st.button("✅ 选定此商品", type="primary", use_container_width=True,
                         key="s3_ok"):
                exceeded, msg = check_order_limits(order)
                if exceeded:
                    st.session_state.limit_exceeded = True
                    st.session_state.limit_exceeded_order = order
                    st.session_state.pending_order = None
                    current_session["messages"].append({
                        "role": "assistant", "content": msg                    })
                    st.rerun()
                else:
                    st.session_state.buy_stage = "select_address"
                    st.session_state.selected_address_for_order = None
                    st.rerun()

            if st.button("🔍 仍不满意，补充详细要求", key="s3_go4"):
                st.session_state.recommend_step = 4
                st.session_state.candidate_options = []
                st.session_state.pending_order = None
                st.session_state.stage4_no_match = False
                st.rerun()

    # ---------- 阶段 4 ----------
    elif st.session_state.buy_stage == "confirm_product" and st.session_state.recommend_step == 4:
        if st.session_state.stage4_no_match:
            st.markdown(
                '<div class="no-more-tip">'
                '😔 不好意思，更精确的产品购买渠道请浏览电商平台。'
                '</div>',
                unsafe_allow_html=True
            )
            st.markdown("请选择接下来的操作：")
            c1, c2, c3 = st.columns(3)
            with c1:
                if st.button("🔚 结束本次对话", type="primary", use_container_width=True,
                             key="s4_end"):
                    end_conversation(reason="感谢您的使用！")
            with c2:
                if st.button("🔙 回到前面选过的商品", use_container_width=True,
                             key="s4_back"):
                    st.session_state.stage4_no_match = False
                    st.session_state.recommend_step = 2
                    with st.spinner("正在为您重新展示前面推荐过的商品..."):
                        c_options = call_deepseek_recommend_engine(
                            step=2,
                            item_category=st.session_state.target_product_category,
                            user_history=current_session["messages"],
                            extra_constraints={
                                "attributes": st.session_state.current_attributes,
                                "min_price": st.session_state.current_price_range[0],
                                "max_price": st.session_state.current_price_range[1],
                            }
                        )
                        st.session_state.candidate_options = c_options
                    st.rerun()
            with c3:
                if st.button("🆕 另外购买别的产品", use_container_width=True,
                             key="s4_new"):
                    reset_current_conversation()
                    current_session["messages"].append({
                        "role": "assistant",
                        "content": "好的！请告诉我您这次想买什么商品，我会为您重新联网比价。"
                    })
                    st.rerun()
        else:
            st.info("请补充您的详细要求，Agent 将为您精挑细选 5 款商品：")
            detail_req = st.text_area(
                "详细要求",
                value=st.session_state.current_detail_req,
                placeholder="例如：要黑色、支持快充、有品牌售后、需要发票、容量不低于 20000mAh..."
            )

            col_a, col_b = st.columns([1, 1])
            with col_a:
                if st.button("🔎 生成 5 款精选商品", type="primary",
                             use_container_width=True, key="s4_gen"):
                    if not detail_req.strip():
                        st.error("请填写详细要求！")
                    else:
                        st.session_state.current_detail_req = detail_req
                        with st.spinner("正在为您精选 5 款最符合要求的商品..."):
                            options = _generate_constrained_options(
                                item_category=st.session_state.target_product_category,
                                detail_req=detail_req,
                                attributes=st.session_state.current_attributes,
                                min_price=st.session_state.current_price_range[0],
                                max_price=st.session_state.current_price_range[1],
                                history=current_session["messages"],
                            )
                            st.session_state.candidate_options = options
                            if not options:
                                st.session_state.stage4_no_match = True
                                st.session_state.candidate_options = []
            with col_b:
                if st.button("🙅 还是不满意，我要再想想", use_container_width=True,
                             key="s4_reject"):
                    st.session_state.stage4_no_match = True
                    st.session_state.candidate_options = []
                    st.rerun()

            if st.session_state.candidate_options:
                for idx, opt in enumerate(st.session_state.candidate_options):
                    opt_uid = opt.get("option_id", idx)
                    with st.container():
                        render_order_card(opt, key_prefix=f"s4_{opt_uid}")
                        if st.button("选定这款", key=f"pick_s4_{opt_uid}",
                                     type="primary", use_container_width=True):
                            exceeded, msg = check_order_limits(opt)
                            if exceeded:
                                st.session_state.limit_exceeded = True
                                st.session_state.limit_exceeded_order = opt
                                current_session["messages"].append({
                                    "role": "assistant", "content": msg
                                })
                                st.rerun()
                            else:
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

    # ---------- 用户输入 ----------
    user_input = st.chat_input("请告诉我你想购买的商品，例如：帮我买一个 20000 毫安快充充电宝 / 一千块钱左右的黑色相机")

    if user_input:
        current_session["messages"].append({"role": "user", "content": user_input})

        with st.spinner("正在理解您的需求..."):
            intent = parse_user_intent(
                user_input, st.session_state.target_product_category
            )

        new_category = (intent.get("category") or "").strip()
        min_price = intent.get("min_price")
        max_price = intent.get("max_price")
        attributes = intent.get("attributes") or []
        has_price_constraint = (min_price is not None) or (max_price is not None)
        has_any_constraint = has_price_constraint or bool(attributes)

        already_in_flow = st.session_state.buy_stage in (
            "confirm_product", "select_address", "payment"
        )

        if not new_category:
            new_category = user_input.strip()

        category_changed = False
        if already_in_flow:
            current_cat = st.session_state.target_product_category or ""
            if intent.get("changed"):
                category_changed = True
            elif new_category and new_category != current_cat and len(new_category) >= 2:
                category_changed = True
        else:
            category_changed = True

        if category_changed:
            reset_current_conversation(new_product=new_category)
            st.session_state.target_product_category = new_category
            st.session_state.current_attributes = attributes
            st.session_state.current_price_range = (min_price, max_price)
            st.session_state.current_detail_req = user_input
            _update_current_session_title(new_category)

            if has_any_constraint:
                with st.spinner("正在按您的具体要求精选商品..."):
                    options = _generate_constrained_options(
                        item_category=new_category,
                        detail_req=user_input,
                        attributes=attributes,
                        min_price=min_price,
                        max_price=max_price,
                        history=current_session["messages"],
                    )
                    st.session_state.candidate_options = options
                    st.session_state.buy_stage = "confirm_product"
                    st.session_state.recommend_step = 4
                    st.session_state.stage4_no_match = not options
                current_session["messages"].append({
                    "role": "assistant",
                    "content": f"好的！已按您的要求（{user_input}）为您精选商品 →"
                })
            else:
                with st.spinner("正在为您联网比价..."):
                    result = call_deepseek_recommend_engine(
                        step=1,
                        item_category=new_category,
                        user_history=current_session["messages"]
                    )
                    st.session_state.pending_order = result
                    st.session_state.buy_stage = "confirm_product"
                    st.session_state.recommend_step = 1
                current_session["messages"].append({
                    "role": "assistant",
                    "content": f"我已为【{new_category}】进行全网比价，请看下方推荐卡片 →"
                })
            st.rerun()

        elif already_in_flow and has_any_constraint:
            merged_attrs = list(set(st.session_state.current_attributes + attributes))
            cur_min, cur_max = st.session_state.current_price_range
            merged_min = min_price if min_price is not None else cur_min
            merged_max = max_price if max_price is not None else cur_max

            st.session_state.current_attributes = merged_attrs
            st.session_state.current_price_range = (merged_min, merged_max)
            st.session_state.current_detail_req = user_input

            with st.spinner("正在根据您补充的条件重新精选..."):
                options = _generate_constrained_options(
                    item_category=st.session_state.target_product_category,
                    detail_req=user_input,
                    attributes=merged_attrs,
                    min_price=merged_min,
                    max_price=merged_max,
                    history=current_session["messages"],
                )
                st.session_state.candidate_options = options
                st.session_state.buy_stage = "confirm_product"
                st.session_state.recommend_step = 4
                st.session_state.stage4_no_match = not options
                st.session_state.pending_order = None
            current_session["messages"].append({
                "role": "assistant",
                "content": "已根据您补充的条件重新为您精选 →"
            })
            st.rerun()

        else:
            st.rerun()


# ==========================================
# 7. 主入口
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