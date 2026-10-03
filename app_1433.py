import streamlit as st
import time
import random
import string
import json
from datetime import datetime
from openai import OpenAI

# ==========================================
# 0. DeepSeek API 配置
# ==========================================
DEEPSEEK_API_KEY = "sk-083a47037ec647e1ae09cf4279afd89a"
client = OpenAI(
    api_key=DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com"
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
</style>
""", unsafe_allow_html=True)


# ==========================================
# 2. 初始化 Session State 数据状态
# ==========================================

# 模拟用户数据库 (Key: phone 或 email, Value: 用户信息字典)
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

# 当前选中的导航菜单：'chat', 'profile_home', 'pay_settings', 'wallet', 'address', 'records'
if "nav_location" not in st.session_state:
    st.session_state.nav_location = "chat"

# 免密支付上限及交易限额设置
if "max_limit" not in st.session_state:
    st.session_state.max_limit = 500

if "single_limit" not in st.session_state:
    st.session_state.single_limit = 10000.00

if "daily_limit" not in st.session_state:
    st.session_state.daily_limit = 50000.00

# 钱包与银行账户状态
if "wallet_balance" not in st.session_state:
    st.session_state.wallet_balance = 350.00

if "bank_cards" not in st.session_state:
    st.session_state.bank_cards = [
        {"bank": "招商银行 (尾号 8888)", "type": "储蓄卡", "balance": 50000.00},
        {"bank": "中国工商银行 (尾号 6666)", "type": "信用卡", "balance": 20000.00}
    ]

# 地址簿管理
if "address_list" not in st.session_state:
    st.session_state.address_list = [
        {"id": 1, "name": "张三", "phone": "13800138000", "address": "北京市海淀区中关村南大街 1 号 101 室", "is_default": True},
        {"id": 2, "name": "张三 (公司)", "phone": "13800138000", "address": "北京市朝阳区国贸大厦 A 座 1802", "is_default": False}
    ]

# 聊天记录 与 购买记录
if "chat_sessions" not in st.session_state:
    st.session_state.chat_sessions = [
        {
            "session_id": "CS-001",
            "title": "首次代购咨询",
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "messages": [
                {"role": "assistant", "content": "👋 你好！我是你的 **DeepSeek 全网 AI 智能代购 Agent**。\n\n请告诉你想买什么商品（例如：*“帮我买一个 20000 毫安快充充电宝”*），我会为你全网比价、智能推荐并完成自动下单！"}
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

# 代购交互状态：'none', 'confirm_product', 'select_address', 'payment_auth'
if "buy_stage" not in st.session_state:
    st.session_state.buy_stage = "none"

if "one_time_pwd" not in st.session_state:
    st.session_state.one_time_pwd = None


# ==========================================
# 3. 辅助逻辑函数 与 DeepSeek API 交互
# ==========================================
def generate_12digit_code():
    """生成 12 位数字字母混合一次性动态验证码"""
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(12))


def call_deepseek_llm(user_prompt: str):
    """调用 DeepSeek LLM 模拟代购比价与智能决策"""
    system_prompt = """你是一个智能代购 Agent 助手。请根据用户的购买需求，全网比价后返回一个最值得推荐的商品。
你必须严格以 JSON 格式输出，包含以下字段：
- title: 商品完整标题 (字符串)
- platform: 推荐平台 (如 京东自营 / 淘宝天猫旗舰店 / 拼多多百亿补贴)
- original_price: 原价 (浮点数)
- coupon: 优惠卷金额 (浮点数)
- final_price: 券后价格 (浮点数)
- reason: 推荐该商品的理由 (简短一两句话)

请只输出纯 JSON 数据，不要包含 markdown 标记。"""

    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"帮我找这个商品：{user_prompt}"}
            ],
            stream=False
        )
        content = response.choices[0].message.content.strip()
        if content.startswith("```json"):
            content = content[7:-3].strip()
        data = json.loads(content)
        data["order_id"] = f"AGENT-ORD-{random.randint(100000, 999999)}"
        return data
    except Exception as e:
        base_price = round(random.uniform(100, 1500), 2)
        coupon = round(base_price * 0.1, 2)
        return {
            "order_id": f"AGENT-ORD-{random.randint(100000, 999999)}",
            "title": f"【DeepSeek推荐】{user_prompt}",
            "platform": random.choice(["京东自营", "淘宝天猫旗舰店", "拼多多百亿补贴"]),
            "original_price": base_price,
            "coupon": coupon,
            "final_price": round(base_price - coupon, 2),
            "reason": "综合全网销量、好评率及当前限时优惠补贴，此款为最佳性价比选择。"
        }


# ==========================================
# 4. 真实校验的 登录 / 注册页面 (Welcome Page)
# ==========================================
def render_welcome_page():
    st.markdown("<h1 style='text-align: center;'>🛍️ 欢迎体验 AI 智能代购 Agent</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center; color: #888;'>DeepSeek 驱动 · 全网比价 · 自动领券 · 极速代付款</p>", unsafe_allow_html=True)
    st.divider()

    col_left, col_main, col_right = st.columns([1, 2, 1])

    with col_main:
        auth_mode = st.radio("选择操作方式", ["注册新账户 (Sign Up)", "登录账户 (Log In)"], horizontal=True)

        if auth_mode == "注册新账户 (Sign Up)":
            st.subheader("📝 注册新账户")
            phone_col1, phone_col2 = st.columns([1, 2])
            with phone_col1:
                country_code = st.selectbox("区号", ["+86", "+852"])
            with phone_col2:
                phone_num = st.text_input("手机号码", placeholder="输入手机号 (如 13912345678)")

            email = st.text_input("电子邮箱", placeholder="example@domain.com")
            verify_type = st.radio("验证码接收渠道", ["手机短信验证", "邮箱验证"], horizontal=True)

            code_col1, code_col2 = st.columns([2, 1])
            with code_col1:
                verify_code = st.text_input("验证码", placeholder="输入 6 位验证码", max_chars=6)
            with code_col2:
                st.write("")
                if st.button("发送验证码", use_container_width=True):
                    target = phone_num if verify_type == "手机短信验证" else email
                    if not target:
                        st.error("请先填写对应的手机号或邮箱！")
                    else:
                        st.session_state.simulated_code = str(random.randint(100000, 999999))
                        st.toast(f"📩 【验证码已生成】发送至 {target}：{st.session_state.simulated_code}", icon="💬")

            password = st.text_input("设置登录密码", type="password", placeholder="包含字母和数字，至少 8 位")
            confirm_password = st.text_input("确认登录密码", type="password", placeholder="再次输入密码")

            st.markdown("---")
            agree_terms = st.checkbox("我已阅读并同意 [《AI代购Agent用户服务协议》](#) 与 [《隐私保护政策》](#)")

            if st.button("🚀 注册账户", type="primary", use_container_width=True):
                clean_phone = phone_num.strip()
                clean_email = email.strip().lower()

                if not agree_terms:
                    st.error("❌ 必须勾选同意法律协议方可注册！")
                elif not clean_phone or not clean_email:
                    st.error("❌ 请完整填写手机号和邮箱！")
                elif clean_phone in st.session_state.users_db or clean_email in st.session_state.users_db:
                    st.error("❌ 该手机号或邮箱已被注册，请直接选择【登录账户】！")
                elif not verify_code or verify_code != st.session_state.simulated_code:
                    st.error("❌ 验证码不正确或未获取验证码！")
                elif len(password) < 8:
                    st.error("❌ 登录密码长度不能少于 8 位！")
                elif password != confirm_password:
                    st.error("❌ 两次输入的密码不一致！")
                else:
                    user_data = {
                        "phone": f"{country_code} {clean_phone}",
                        "email": clean_email,
                        "password": password,
                        "login_type": "email" if verify_type == "邮箱验证" else "phone"  # 记录当前注册/登录偏好
                    }
                    st.session_state.users_db[clean_phone] = user_data
                    st.session_state.users_db[clean_email] = user_data

                    st.success("🎉 注册成功！自动为你完成登录...")
                    st.session_state.authenticated = True
                    st.session_state.user_info = user_data
                    time.sleep(1.2)
                    st.rerun()

        else:
            st.subheader("🔑 账户登录")
            st.caption("提示：请输入已注册的手机号/邮箱与对应密码。快捷测试账号：`13800138000` 或 `test@example.com` / 密码：`password123`")

            login_identity = st.text_input("手机号 / 邮箱", placeholder="输入注册时使用的手机号或邮箱").strip()
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
                        # 重点：依据用户登录时输入的是邮箱还是手机号，精准标记登录类型
                        if "@" in login_identity:
                            user_data["login_type"] = "email"
                        else:
                            user_data["login_type"] = "phone"

                        st.success("✅ 登录验证通过！正在跳转...")
                        st.session_state.authenticated = True
                        st.session_state.user_info = user_data
                        time.sleep(1)
                        st.rerun()


# ==========================================
# 5. “我的” 中心各模块渲染
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
                        st.markdown('<span class="custom-badge">✓ 已校验加密</span>', unsafe_allow_html=True)
                    st.divider()

            st.info("💡 银行账户用于**大额代购直扣**及为**我的钱包充值**。")

        with tab_limits:
            st.subheader("⚙ 调整交易限额")
            st.caption("提示：如果不单独自定义设置，系统默认将生效最高的默认限制额度（单笔最高 1 万，单日最高 5 万）。修改设定需验证登录密码。")

            lim_c1, lim_c2 = st.columns(2)
            with lim_c1:
                new_single = st.number_input(
                    "单笔限额 (元)",
                    min_value=100.0,
                    max_value=10000.0,
                    value=float(st.session_state.single_limit),
                    step=500.0
                )
            with lim_c2:
                new_daily = st.number_input(
                    "单日累计支付总额 (元)",
                    min_value=1000.0,
                    max_value=50000.0,
                    value=float(st.session_state.daily_limit),
                    step=1000.0
                )

            st.divider()
            st.markdown("🔒 **验证身份以保存修改**")
            verify_pwd = st.text_input("请输入登录密码以确认修改", type="password", placeholder="输入您的当前账号登录密码")

            if st.button("💾 保存限额设置", type="primary"):
                current_user_pwd = st.session_state.user_info.get("password") if st.session_state.user_info else None

                if not verify_pwd:
                    st.error("❌ 必须输入登录密码方可修改交易限额！")
                elif verify_pwd != current_user_pwd:
                    st.error("❌ 登录密码验证失败，无法修改！")
                elif new_single > new_daily:
                    st.error("❌ 单笔限额不能高于单日支付总额！")
                else:
                    st.session_state.single_limit = new_single
                    st.session_state.daily_limit = new_daily
                    st.success("✅ 交易限额修改成功并已安全保存！")
                    time.sleep(1)
                    st.rerun()

    elif current_loc == "wallet":
        st.markdown(f"""
        <div class="wallet-card">
            <h3>👛 代购专属电子钱包</h3>
            <p style="font-size: 14px; opacity: 0.8;">小额代购自动优先扣款，免去频繁输入密码</p>
            <h1 style="margin: 10px 0;">￥{st.session_state.wallet_balance:,.2f}</h1>
        </div>
        """, unsafe_allow_html=True)

        st.subheader("💵 钱包充值 (从银行账户转入)")
        recharge_col1, recharge_col2 = st.columns([2, 1])

        with recharge_col1:
            select_bank = st.selectbox("选择付款银行卡", [card["bank"] for card in st.session_state.bank_cards])
            recharge_amount = st.number_input("充值金额 (元)", min_value=10, max_value=10000, value=200, step=50)

        with recharge_col2:
            st.write("")
            st.write("")
            if st.button("🚀 立即充值", type="primary", use_container_width=True):
                st.session_state.wallet_balance += recharge_amount
                st.success(f"🎉 成功从【{select_bank}】向钱包充值 ￥{recharge_amount:.2f}！")
                time.sleep(1)
                st.rerun()

        st.divider()
        st.markdown("📌 **扣款规则说明**：\n- **小额支付（≤ 免密上限）**：优先扣除【我的钱包】余额。\n- **大额支付（> 免密上限）**：直接通过【银行账户】并要求二次支付认证。")

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

        with st.expander("➕ 添加新收货地址"):
            new_name = st.text_input("收货人姓名")
            new_phone = st.text_input("联系电话")
            new_address = st.text_area("详细地址 (省市区县/街道/小区/门牌号)")
            set_default = st.checkbox("设为默认地址")

            if st.button("保存地址", type="primary"):
                if new_name and new_phone and new_address:
                    new_id = max([a["id"] for a in st.session_state.address_list], default=0) + 1
                    if set_default:
                        for a in st.session_state.address_list:
                            a["is_default"] = False
                    st.session_state.address_list.append({
                        "id": new_id,
                        "name": new_name,
                        "phone": new_phone,
                        "address": new_address,
                        "is_default": set_default
                    })
                    st.success("收货地址添加成功！")
                    st.rerun()
                else:
                    st.error("请完整填写收货人、电话与详细地址！")

    elif current_loc == "records":
        rec_tab1, rec_tab2 = st.tabs(["💬 聊天记录", "🛍 购买记录"])

        with rec_tab1:
            st.subheader("🗂️ 历史 Chatbot 对话记录")
            if st.button("➕ 开启新对话", type="primary"):
                new_idx = len(st.session_state.chat_sessions) + 1
                new_session = {
                    "session_id": f"CS-00{new_idx}",
                    "title": f"新代购咨询 {new_idx}",
                    "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
                    "messages": [
                        {"role": "assistant", "content": "👋 你好！我是你的 **DeepSeek 全网 AI 智能代购 Agent**。\n\n请告诉你想买什么商品，我会为你全网比价并下单！"}
                    ]
                }
                st.session_state.chat_sessions.append(new_session)
                st.session_state.current_session_index = len(st.session_state.chat_sessions) - 1
                st.session_state.nav_location = "chat"
                st.session_state.buy_stage = "none"
                st.session_state.pending_order = None
                st.success("已创建新对话，并为您切换至 AI 界面！")
                time.sleep(1)
                st.rerun()

            st.divider()
            for s_idx, session in enumerate(st.session_state.chat_sessions):
                with st.expander(f"💬 {session['title']} (创建时间: {session['created_at']})"):
                    for msg in session["messages"]:
                        st.write(f"**{msg['role'].upper()}**: {msg['content']}")
                    if st.button("恢复此对话", key=f"load_chat_{s_idx}"):
                        st.session_state.current_session_index = s_idx
                        st.session_state.nav_location = "chat"
                        st.rerun()

        with rec_tab2:
            st.subheader("✅ 已完成付款订单记录")
            if not st.session_state.orders_history:
                st.info("暂无已付款的代购记录。")
            else:
                for ord_item in st.session_state.orders_history:
                    with st.container():
                        st.markdown(f"""
                        <div class="order-card">
                            <h4>{ord_item['title']}</h4>
                            <p>🏷️ <b>平台</b>：{ord_item['platform']} | 🆔 <b>订单号</b>：<code>{ord_item['order_id']}</code></p>
                            <p>💰 <b>实付金额</b>：<span style="color:#FF4B4B; font-weight:bold;">￥{ord_item['final_price']}</span> | 💳 <b>扣款渠道</b>：{ord_item.get('pay_channel', '自动支付')}</p>
                            <p>📦 <b>配送地址</b>：{ord_item.get('shipping_address', '默认地址')}</p>
                            <p>🚚 <b>物流状态</b>：已通知商家发货 (单号：<code>SF{random.randint(1000000000, 9999999999)}</code>)</p>
                        </div>
                        """, unsafe_allow_html=True)


# ==========================================
# 6. Chatbot 代购 Agent 界面渲染
# ==========================================
def render_chat_agent():
    st.title("🤖 DeepSeek 自动付款 AI 购物 Agent")
    st.caption("DeepSeek 模型全网比价 · 优惠券自动叠加 · 动态验证码自动划扣")

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Agent 状态", "🟢 DeepSeek 在线", "响应极速")
    with col2:
        st.metric("我的钱包余额", f"￥{st.session_state.wallet_balance:.2f}", "可自动小额代扣")
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

    # ---------------- 阶段 1：确认商品 (YES / NO) ----------------
    if st.session_state.buy_stage == "confirm_product" and st.session_state.pending_order:
        order = st.session_state.pending_order
        st.warning("🧐 **DeepSeek 为您智能挑选的最佳商品如下，请确认是否满足要求：**")

        with st.container():
            st.subheader(order["title"])
            st.write(f"🏷️ **推荐平台**：{order['platform']} | 🆔 **订单编号**：`{order['order_id']}`")
            st.write(f"💡 **AI 推荐理由**：{order.get('reason', '全网综合性价比最高')}")
            st.write(f"💰 市场原价：~~￥{order['original_price']}~~ | 🎁 叠加专享券：**-￥{order['coupon']}**")
            st.markdown(f"### 预估券后价：:red[￥{order['final_price']}]")

        btn_c1, btn_c2, _ = st.columns([1, 1, 2])
        with btn_c1:
            if st.button("✅ YES (满足要求)", type="primary", use_container_width=True):
                st.session_state.buy_stage = "select_address"
                current_session["messages"].append({
                    "role": "user", "content": "YES，这个满足我的要求，请继续。"
                })
                current_session["messages"].append({
                    "role": "assistant", "content": "好的！请选择收货地址，或告诉我新地址。"
                })
                st.rerun()

        with btn_c2:
            if st.button("❌ NO (不满意，取消)", use_container_width=True):
                st.session_state.buy_stage = "none"
                st.session_state.pending_order = None
                current_session["messages"].append({
                    "role": "user", "content": "NO，不太满意。"
                })
                current_session["messages"].append({
                    "role": "assistant", "content": "好的，已为你取消本次挑选。你可以重新告诉我你想要什么商品。"
                })
                st.rerun()

    # ---------------- 阶段 2：选择/输入地址 & 智能精准发送验证码 ----------------
    elif st.session_state.buy_stage == "select_address" and st.session_state.pending_order:
        st.info("📍 **请确认本单的收货地址：**")

        addr_options = [f"{a['name']} ({a['phone']}) - {a['address']}" for a in st.session_state.address_list]
        selected_addr_str = st.selectbox("选择已有收货地址：", addr_options)

        st.caption("👉 **没有目标地址？请告诉我新地址：**")

        col_input, col_add_btn = st.columns([3, 1])
        with col_input:
            new_addr_text = st.text_input("直接输入新地址 (如: 张三, 13900001111, 上海市浦东新区...)", label_visibility="collapsed")
        with col_add_btn:
            add_new_trigger = st.button("使用新地址", use_container_width=True)

        final_chosen_address = selected_addr_str

        if add_new_trigger and new_addr_text.strip():
            raw_text = new_addr_text.strip()
            new_id = max([a["id"] for a in st.session_state.address_list], default=0) + 1
            new_entry = {
                "id": new_id,
                "name": st.session_state.user_info.get("phone", "用户"),
                "phone": st.session_state.user_info.get("phone", "13800000000"),
                "address": raw_text,
                "is_default": False
            }
            st.session_state.address_list.append(new_entry)
            final_chosen_address = f"{new_entry['name']} - {raw_text}"
            st.toast("✅ 新地址已成功保存至【我的地址】！", icon="🏠")

        st.divider()

        if st.button("➡️ 确认地址，去支付", type="primary", use_container_width=True):
            st.session_state.pending_order["shipping_address"] = final_chosen_address

            # 生成 12 位数字字母混合密码
            pwd12 = generate_12digit_code()
            st.session_state.one_time_pwd = pwd12

            # ⭐ 核心逻辑：根据用户的登录方式判断发送目标（邮箱 or 手机号） ⭐
            user_info = st.session_state.user_info or {}
            login_type = user_info.get("login_type", "phone")  # 默认为 phone

            if login_type == "email":
                target_dest = user_info.get("email", "未绑定邮箱")
                toast_msg = f"✉️ 【12位动态支付密码已发送至电子邮箱】：{target_dest}\n密码为：{pwd12}"
                notice_text = f"一次性 12 位动态支付密码已发送至你的**邮箱 ({target_dest})**，请输入密码授权扣款。"
            else:
                target_dest = user_info.get("phone", "未绑定手机")
                toast_msg = f"📱 【12位动态支付密码已发送至手机短信】：{target_dest}\n密码为：{pwd12}"
                notice_text = f"一次性 12 位动态支付密码已发送至你的**手机短信 ({target_dest})**，请输入密码授权扣款。"

            st.toast(toast_msg, icon="🔐")

            st.session_state.buy_stage = "payment_auth"
            current_session["messages"].append({
                "role": "assistant", "content": f"地址已确认：`{final_chosen_address}`。\n\n{notice_text}"
            })
            st.rerun()

    # ---------------- 阶段 3：12 位密码验证与扣款支付 ----------------
    elif st.session_state.buy_stage == "payment_auth" and st.session_state.pending_order:
        order = st.session_state.pending_order
        max_limit = st.session_state.max_limit
        final_price = order['final_price']
        wallet_bal = st.session_state.wallet_balance

        is_use_wallet = (wallet_bal >= final_price) and (final_price <= max_limit)

        st.warning("🔐 **一次性支付密码授权确认**")
        st.write(f"📦 商品：**{order['title']}**")
        st.write(f"💵 应付金额：:red[**￥{final_price:.2f}**]")

        if is_use_wallet:
            st.info(f"👛 **扣款渠道**：【我的钱包】直接划扣（当前余额：￥{wallet_bal:.2f}）")
            pay_channel_name = "我的钱包"
        else:
            st.warning(f"🏦 **扣款渠道**：【银行账户】（余额不足或单笔 > ￥{max_limit} 免密上限，需二次支付认证）")
            pay_card = st.selectbox("选择支付银行卡：", [card["bank"] for card in st.session_state.bank_cards])
            pay_channel_name = pay_card

        pwd_input = st.text_input("请输入发送给您的 12 位一次性动态密码：", type="password", max_chars=12, placeholder="区分大小写 12 位字母数字混合")

        bank_pin_input = ""
        if not is_use_wallet:
            bank_pin_input = st.text_input("二次支付认证 - 请输入银行卡 6 位支付 Pin 码：", type="password", max_chars=6, placeholder="演示 Pin 码：123456")

        st.caption(f"💡 快捷提示：当前测试动态密码为 `{st.session_state.one_time_pwd}`")

        pay_c1, pay_c2 = st.columns([2, 1])
        with pay_c1:
            if st.button("🚀 验证并确认支付", type="primary", use_container_width=True):
                if pwd_input != st.session_state.one_time_pwd:
                    st.error("❌ 一次性密码输入错误，请重新检查！")
                elif not is_use_wallet and (bank_pin_input != "123456" and len(bank_pin_input) != 6):
                    st.error("❌ 银行卡二次支付认证失败，Pin 码错误（测试密码：123456）！")
                else:
                    with st.spinner("💳 正在安全校验密码并执行划扣..."):
                        time.sleep(1.2)

                    if is_use_wallet:
                        st.session_state.wallet_balance -= final_price
                    else:
                        for card in st.session_state.bank_cards:
                            if card["bank"] == pay_card:
                                card["balance"] -= final_price

                    order["status"] = "已付款成功"
                    order["pay_channel"] = pay_channel_name
                    st.session_state.orders_history.append(order)

                    st.success("🎉 **代购付款成功！**")
                    st.balloons()

                    current_session["messages"].append({
                        "role": "assistant",
                        "content": f"✅ **代购付款成功！**\n- **商品**：{order['title']}\n- **实付金额**：￥{order['final_price']}\n- **扣款渠道**：{pay_channel_name}\n- **送货地址**：{order['shipping_address']}\n记录已自动存入【我的 -> 购买记录】！"
                    })

                    st.session_state.buy_stage = "none"
                    st.session_state.pending_order = None
                    st.session_state.one_time_pwd = None
                    time.sleep(1.5)
                    st.rerun()

        with pay_c2:
            if st.button("❌ 取消订单", use_container_width=True):
                st.session_state.buy_stage = "none"
                st.session_state.pending_order = None
                st.session_state.one_time_pwd = None
                st.info("已取消当前代购交易。")
                st.rerun()

    # 聊天输入框
    if prompt := st.chat_input("输入你想购买的商品，例如：“给我买一个 20000 毫安快充充电宝”"):
        current_session["messages"].append({"role": "user", "content": prompt})

        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            message_placeholder = st.empty()
            message_placeholder.markdown("🔍 **DeepSeek Agent 正在进行全网比价与智能筛选...**")

            new_order = call_deepseek_llm(prompt)
            st.session_state.pending_order = new_order
            st.session_state.buy_stage = "confirm_product"

            reply_content = f"为你挑选了最佳商品！\n- **商品**：{new_order['title']}\n- **平台**：{new_order['platform']}\n- **券后最低价**：**￥{new_order['final_price']}**\n- **推荐理由**：{new_order.get('reason', '')}\n\n👉 **请问该商品是否满足要求？**"
            message_placeholder.markdown(reply_content)

            current_session["messages"].append({"role": "assistant", "content": reply_content})
            st.rerun()


# ==========================================
# 7. 主架构 (统一导航控制)
# ==========================================
def render_main_app():
    with st.sidebar:
        st.title("🛍️ 代购 Agent 导航")

        if st.session_state.user_info:
            login_type_label = "✉️ 邮箱登录" if st.session_state.user_info.get("login_type") == "email" else "📱 手机号登录"
            st.info(f"👤 **当前登录用户** ({login_type_label})：\n- 📱 {st.session_state.user_info['phone']}\n- ✉️ {st.session_state.user_info['email']}")

        st.subheader("📌 核心导航")

        if st.button("💬 AI 代购助手 (Chatbot)", use_container_width=True, type="primary" if st.session_state.nav_location == "chat" else "secondary"):
            st.session_state.nav_location = "chat"
            st.rerun()

        if st.button("👤 我的 (个人中心)", use_container_width=True, type="primary" if st.session_state.nav_location.startswith("profile") or st.session_state.nav_location in ["pay_settings", "wallet", "address", "records"] else "secondary"):
            st.session_state.nav_location = "profile_home"
            st.rerun()

        st.divider()
        if st.button("🚪 退出登录", use_container_width=True):
            st.session_state.authenticated = False
            st.session_state.user_info = None
            st.rerun()

    if st.session_state.nav_location == "chat":
        render_chat_agent()
    elif st.session_state.nav_location == "profile_home":
        render_profile_navigation_home()
    else:
        render_profile_sub_page()


# ==========================================
# 8. 程序入口控制
# ==========================================
if __name__ == "__main__":
    if not st.session_state.authenticated:
        render_welcome_page()
    else:
        render_main_app()