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
    .product-option-box {
        background-color: #262936;
        border: 1px solid #3d4256;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 10px;
    }
</style>
""", unsafe_allow_html=True)


# ==========================================
# 2. 初始化 Session State 数据状态
# ==========================================

# 模拟用户数据库
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

# 代购交互主状态：'none', 'confirm_product', 'select_address', 'payment_auth'
if "buy_stage" not in st.session_state:
    st.session_state.buy_stage = "none"

# 推荐四阶段子状态：1 (综合首选), 2 (三维度推荐), 3 (价格时效筛选), 4 (详细要求5选1)
if "recommend_step" not in st.session_state:
    st.session_state.recommend_step = 1

# 上下文记忆：核心品类名称与累积需求
if "target_product_category" not in st.session_state:
    st.session_state.target_product_category = ""

# 存放多选项列表（第2步3个，第4步5个）
if "candidate_options" not in st.session_state:
    st.session_state.candidate_options = []

if "one_time_pwd" not in st.session_state:
    st.session_state.one_time_pwd = None


# ==========================================
# 3. 辅助逻辑函数 与 DeepSeek API 交互
# ==========================================
def generate_12digit_code():
    """生成 12 位数字字母混合一次性动态验证码"""
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(12))


def call_deepseek_recommend_engine(step: int, item_category: str, user_history: list, extra_constraints: dict = None):
    """
    根据四阶段推荐机制调用 DeepSeek 产生严格的 JSON 商品方案
    确保品类 100% 连贯，不发生物品飘移
    """
    base_instructions = f"用户想要购买的核心商品品类是：【{item_category}】。你必须 STRICTLY 推荐该品类下的商品，绝对不能更换为其他物品类型！"
    
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
    "reason": "极具性价比，价格全网最低"
  }},
  {{
    "dimension": "用户评价最高",
    "title": "商品名称",
    "platform": "推荐平台",
    "original_price": 250.0,
    "coupon": 20.0,
    "final_price": 230.0,
    "reason": "好评率 99.8%，口碑极佳"
  }},
  {{
    "dimension": "销量最高推荐",
    "title": "商品名称",
    "platform": "推荐平台",
    "original_price": 200.0,
    "coupon": 15.0,
    "final_price": 185.0,
    "reason": "全网爆款，月销 10万+"
  }}
]
仅返回纯 JSON 代码，不要带 markdown。"""

    elif step == 3:
        p_min = extra_constraints.get("min_price", 0)
        p_max = extra_constraints.get("max_price", 1000)
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
        
        # 补全统一的 order_id 结构
        if isinstance(data, dict):
            data["order_id"] = f"AGENT-ORD-{random.randint(100000, 999999)}"
        elif isinstance(data, list):
            for item in data:
                item["order_id"] = f"AGENT-ORD-{random.randint(100000, 999999)}"
        return data
    except Exception as e:
        # 后备降级 Mock 数据
        if step in [1, 3]:
            base_p = round(random.uniform(100, 500), 2)
            return {
                "order_id": f"AGENT-ORD-{random.randint(100000, 999999)}",
                "title": f"【DeepSeek推荐】{item_category} (阶段{step}方案)",
                "platform": "京东自营",
                "original_price": base_p,
                "coupon": 10.0,
                "final_price": base_p - 10.0,
                "reason": f"符合对【{item_category}】特定要求的精选方案。"
            }
        elif step == 2:
            return [
                {"dimension": "价格最佳选择", "order_id": f"ORD-S2-1", "title": f"【性价比超高】{item_category} 基础版", "platform": "拼多多百亿补贴", "original_price": 99.0, "coupon": 10.0, "final_price": 89.0, "reason": "价格最实惠"},
                {"dimension": "用户评价最高", "order_id": f"ORD-S2-2", "title": f"【高口碑旗舰】{item_category} 尊享版", "platform": "天猫旗舰店", "original_price": 299.0, "coupon": 30.0, "final_price": 269.0, "reason": "评价最好，好评率 99.9%"},
                {"dimension": "销量最高推荐", "order_id": f"ORD-S2-3", "title": f"【热销爆款】{item_category} 标准版", "platform": "京东自营", "original_price": 199.0, "coupon": 20.0, "final_price": 179.0, "reason": "全网月销量超 10万件"}
            ]
        elif step == 4:
            res = []
            for i in range(1, 6):
                bp = 100 + i * 30
                res.append({
                    "option_id": i,
                    "order_id": f"ORD-S4-{i}",
                    "title": f"【定制精选 {i}】{item_category} 特别款",
                    "platform": random.choice(["京东自营", "天猫旗舰店", "抖音商城"]),
                    "original_price": bp,
                    "coupon": 10.0,
                    "final_price": bp - 10.0,
                    "reason": f"根据您的详细定制要求而甄选的第 {i} 种款式"
                })
            return res


# ==========================================
# 4. 真实校验的 登录 / 注册页面 (Welcome Page)
# ==========================================
def render_welcome_page():
    st.markdown("<h1 style='text-align: center;'>🛍️ 欢迎体验 AI 智能代购 Agent</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center; color: #888;'>DeepSeek 驱动 · 四阶精准比价 · 自动领券 · 极速代付款</p>", unsafe_allow_html=True)
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
                        "login_type": "email" if verify_type == "邮箱验证" else "phone"
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
            st.caption("提示：快捷测试账号：`13800138000` 或 `test@example.com` / 密码：`password123`")

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
            lim_c1, lim_c2 = st.columns(2)
            with lim_c1:
                new_single = st.number_input("单笔限额 (元)", min_value=100.0, max_value=10000.0, value=float(st.session_state.single_limit), step=500.0)
            with lim_c2:
                new_daily = st.number_input("单日累计支付总额 (元)", min_value=1000.0, max_value=50000.0, value=float(st.session_state.daily_limit), step=1000.0)

            st.divider()
            verify_pwd = st.text_input("请输入登录密码以确认修改", type="password")

            if st.button("💾 保存限额设置", type="primary"):
                current_user_pwd = st.session_state.user_info.get("password") if st.session_state.user_info else None
                if not verify_pwd or verify_pwd != current_user_pwd:
                    st.error("❌ 密码验证失败，无法修改！")
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
            select_bank = st.selectbox("选择付款银行卡", [card["bank"] for card in st.session_state.bank_cards])
            recharge_amount = st.number_input("充值金额 (元)", min_value=10, max_value=10000, value=200, step=50)
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
                        {"role": "assistant", "content": "👋 你好！我是你的 **DeepSeek 全网 AI 智能代购 Agent**。\n\n请告诉你想买什么商品，我会为你全网比价并下单！"}
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
                    </div>
                    """, unsafe_allow_html=True)


# ==========================================
# 6. Chatbot 4 阶段递进推荐与代购 Agent 界面
# ==========================================
def render_chat_agent():
    st.title("🤖 DeepSeek 自动付款 AI 购物 Agent")
    st.caption(" DeepSeek 驱动 · 锁定需求品类 · 四阶段精细化推荐 ")

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

    # =========================================================
    # 阶段 1：综合排名最高的选择 (只有 1 个)
    # =========================================================
    if st.session_state.buy_stage == "confirm_product" and st.session_state.recommend_step == 1:
        order = st.session_state.pending_order
        st.warning(f"🧐 **【阶段 1推荐】针对商品“{st.session_state.target_product_category}”，DeepSeek 为您匹配了全网综合排名最高的选择：**")

        with st.container():
            st.subheader(order["title"])
            st.write(f"🏷️ **推荐平台**：{order['platform']} | 🆔 **订单编号**：`{order['order_id']}`")
            st.write(f"💡 **推荐理由**：{order.get('reason', '')}")
            st.markdown(f"### 券后价格：:red[￥{order['final_price']}]")

        btn_c1, btn_c2, _ = st.columns([1, 1, 2])
        with btn_c1:
            if st.button("✅ 满意 (选定此商品)", type="primary", use_container_width=True):
                st.session_state.buy_stage = "select_address"
                current_session["messages"].append({"role": "user", "content": "满意，就选这个。" if "user" in locals() else "满意"})
                st.rerun()

        with btn_c2:
            if st.button("❌ 不满意 (换一批)", use_container_width=True):
                st.session_state.recommend_step = 2
                with st.spinner("正在进入第二阶段：分别从【价格】、【评价】、【销量】三个维度搜寻最佳选择..."):
                    c_options = call_deepseek_recommend_engine(
                        step=2,
                        item_category=st.session_state.target_product_category,
                        user_history=current_session["messages"]
                    )
                    st.session_state.candidate_options = c_options
                current_session["messages"].append({
                    "role": "assistant", "content": f"对综合首选不满意？没问题！我已为您分别从【价格】、【用户评价】和【销量】三个维度重新挑选了商品。"
                })
                st.rerun()

    # =========================================================
    # 阶段 2：价格、评价、销量三个维度的推荐 (3 个选项)
    # =========================================================
    elif st.session_state.buy_stage == "confirm_product" and st.session_state.recommend_step == 2:
        st.info(f"📊 **【阶段 2推荐】针对“{st.session_state.target_product_category}”，以下从三个不同维度为您精选的方案：**")

        options = st.session_state.candidate_options
        selected_index = None

        for idx, opt in enumerate(options):
            st.markdown(f"""
            <div class="product-option-box">
                <h4>🏅 [{opt.get('dimension', '特色选择')}] {opt['title']}</h4>
                <p>🏷️ <b>平台</b>：{opt['platform']} | 💡 <b>推荐理由</b>：{opt['reason']}</p>
                <p>💰 <b>券后实付</b>：<span style="color:#FF4B4B; font-weight:bold; font-size:18px;">￥{opt['final_price']}</span></p>
            </div>
            """, unsafe_allow_html=True)

            if st.button(f"👉 选定该维度的商品 (选项 {idx+1})", key=f"select_step2_{idx}"):
                selected_index = idx

        st.divider()

        if selected_index is not None:
            st.session_state.pending_order = options[selected_index]
            st.session_state.buy_stage = "select_address"
            current_session["messages"].append({"role": "user", "content": f"我选择了第 {selected_index+1} 个选项：{options[selected_index]['title']}"})
            st.rerun()

        if st.button("❌ 对以上三个维度的选择都不满意", type="secondary"):
            st.session_state.recommend_step = 3
            current_session["messages"].append({
                "role": "assistant", "content": "收到！进入第 3 阶段，请设置您期望的价格范围和收货时间时效。"
            })
            st.rerun()

    # =========================================================
    # 阶段 3：价格滑动条 + 收货时间筛选
    # =========================================================
    elif st.session_state.buy_stage == "confirm_product" and st.session_state.recommend_step == 3:
        st.warning(f"🎛️ **【阶段 3筛选】请选择您对于“{st.session_state.target_product_category}”期待的价格范围和收货时间：**")

        # （1）价格滑动器
        price_range = st.slider(" (1) 确定价格区间 (元)", min_value=0, max_value=2000, value=(50, 500), step=10)

        # （2）不同的收货时间选项
        delivery_choice = st.radio(
            " (2) 收货时间选项：",
            ["今日", "明日", "三日内", "七日内"],
            horizontal=True
        )
        st.caption("*(收货时间越快选择范围越窄)*")

        if st.button("🔎 根据上述筛选要求重新推荐最佳商品", type="primary", use_container_width=True):
            with st.spinner("正在根据您的价格区间与收货时间重新进行全网比价..."):
                filtered_order = call_deepseek_recommend_engine(
                    step=3,
                    item_category=st.session_state.target_product_category,
                    user_history=current_session["messages"],
                    extra_constraints={
                        "min_price": price_range[0],
                        "max_price": price_range[1],
                        "delivery_time": delivery_choice
                    }
                )
                st.session_state.pending_order = filtered_order

            # 展示出的结果问询
            st.rerun()

        # 如果已经生成了过滤后的 order
        if st.session_state.pending_order:
            order = st.session_state.pending_order
            st.success("✅ **为您找到的最符合筛选条件的商品：**")
            st.markdown(f"### {order['title']}")
            st.write(f"🏷️ **平台**：{order['platform']} | 💰 **券后价**：:red[￥{order['final_price']}]")
            st.write(f"💡 **匹配理由**：{order.get('reason', '')}")

            btn_s3_yes, btn_s3_no = st.columns(2)
            with btn_s3_yes:
                if st.button("✅ 满意 (去下单)", type="primary", use_container_width=True):
                    st.session_state.buy_stage = "select_address"
                    current_session["messages"].append({"role": "user", "content": "满意，这个符合我的价格和时间要求。"})
                    st.rerun()
            with btn_s3_no:
                if st.button("❌ 依旧不满意 (进入详细需求定制)", use_container_width=True):
                    st.session_state.recommend_step = 4
                    current_session["messages"].append({
                        "role": "assistant", "content": "好的，请告诉我您的详细要求。若依旧无法找到心仪商品，您也可以使用第三方平台进行浏览。"
                    })
                    st.rerun()

    # =========================================================
    # 阶段 4：补充详细要求 & 5 个强制选择方案 (无不满意选项)
    # =========================================================
    elif st.session_state.buy_stage == "confirm_product" and st.session_state.recommend_step == 4:
        st.error(f"📝 **【阶段 4终极推荐】请告诉我关于“{st.session_state.target_product_category}”的详细要求：**")
        st.caption("（若依旧无法为您找到最心仪的商品，请使用第三方平台进行浏览）")

        detail_req = st.text_area("请输入您的详细补充要求 (如: 品牌的偏好、颜色、特殊功能、型号规格等):", placeholder="例：必须是黑色，自带线，支持20W快充...")

        if st.button("🔍 生成最终 5 个精选候选商品", type="primary", use_container_width=True):
            if not detail_req.strip():
                st.error("请填写您的详细要求！")
            else:
                with st.spinner("DeepSeek 正在根据所有历史对话和详细要求提取 5 个匹配度最高的产品..."):
                    options5 = call_deepseek_recommend_engine(
                        step=4,
                        item_category=st.session_state.target_product_category,
                        user_history=current_session["messages"],
                        extra_constraints={"detail_req": detail_req.strip()}
                    )
                    st.session_state.candidate_options = options5
                st.rerun()

        # 展现 5 个强制选项，用户必须选一个
        if st.session_state.candidate_options and len(st.session_state.candidate_options) == 5:
            st.markdown("---")
            st.subheader("🛍️ 请从以下 5 个符合您所有要求的商品中选择一个（必须选择一个方可进入下一步地址设置）：")

            selected_idx_s4 = None
            for idx, opt in enumerate(st.session_state.candidate_options):
                with st.container():
                    st.markdown(f"""
                    <div class="product-option-box">
                        <h4>【选项 {idx+1}】{opt['title']}</h4>
                        <p>🏷️️ <b>平台</b>：{opt['platform']} | 💰 <b>价格</b>：<span style="color:#FF4B4B; font-weight:bold;">￥{opt['final_price']}</span></p>
                        <p>💡 <b>推荐特点</b>：{opt['reason']}</p>
                    </div>
                    """, unsafe_allow_html=True)

                    if st.button(f"👉 确认选择【选项 {idx+1}】并进入地址确认", key=f"select_step4_{idx}"):
                        selected_idx_s4 = idx

            if selected_idx_s4 is not None:
                st.session_state.pending_order = st.session_state.candidate_options[selected_idx_s4]
                st.session_state.buy_stage = "select_address"
                current_session["messages"].append({
                    "role": "user", "content": f"我从最终 5 个选项中选定了：{st.session_state.candidate_options[selected_idx_s4]['title']}"
                })
                st.rerun()

    # =========================================================
    # 阶段：选择收货地址 / 添加新地址
    # =========================================================
    elif st.session_state.buy_stage == "select_address" and st.session_state.pending_order:
        st.info("📍 **请确认本单的收货地址：**")

        addr_options = [f"{a['name']} ({a['phone']}) - {a['address']}" for a in st.session_state.address_list]
        selected_addr_str = st.selectbox("选择已有收货地址：", addr_options)

        st.caption("👉 **没有目标地址？请告诉我新地址：**")

        col_input, col_add_btn = st.columns([3, 1])
        with col_input:
            new_addr_text = st.text_input("直接输入新地址", label_visibility="collapsed")
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

            pwd12 = generate_12digit_code()
            st.session_state.one_time_pwd = pwd12

            user_info = st.session_state.user_info or {}
            login_type = user_info.get("login_type", "phone")

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

    # =========================================================
    # 阶段：12 位密码验证与扣款支付
    # =========================================================
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

        pwd_input = st.text_input("请输入发送给您的 12 位一次性动态密码：", type="password", max_chars=12)

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
                    st.error("❌ 银行卡二次支付认证 Pin 码错误（测试密码：123456）！")
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
                    st.session_state.recommend_step = 1
                    st.session_state.target_product_category = ""
                    st.session_state.pending_order = None
                    st.session_state.one_time_pwd = None
                    time.sleep(1.5)
                    st.rerun()

        with pay_c2:
            if st.button("❌ 取消订单", use_container_width=True):
                st.session_state.buy_stage = "none"
                st.session_state.recommend_step = 1
                st.session_state.target_product_category = ""
                st.session_state.pending_order = None
                st.session_state.one_time_pwd = None
                st.info("已取消当前代购交易。")
                st.rerun()

    # =========================================================
    # 聊天输入框 (只有不在挑选或支付状态下响应新对话)
    # =========================================================
    if st.session_state.buy_stage == "none":
        if prompt := st.chat_input("输入你想购买的商品，例如：“帮我买一个无线耳机”"):
            current_session["messages"].append({"role": "user", "content": prompt})

            with st.chat_message("user"):
                st.markdown(prompt)

            with st.chat_message("assistant"):
                # 首次输入时，提取并锁定目标商品品类
                if not st.session_state.target_product_category:
                    st.session_state.target_product_category = prompt

                message_placeholder = st.empty()
                message_placeholder.markdown(f"🔍 **DeepSeek Agent 正在全网搜寻【{st.session_state.target_product_category}】的综合最高排名选择...**")

                st.session_state.recommend_step = 1
                new_order = call_deepseek_recommend_engine(
                    step=1,
                    item_category=st.session_state.target_product_category,
                    user_history=current_session["messages"]
                )

                st.session_state.pending_order = new_order
                st.session_state.buy_stage = "confirm_product"

                reply_content = f"为您全网比价，找到了【{st.session_state.target_product_category}】综合排名最高的商品！"
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