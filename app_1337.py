import streamlit as st
import time
import random
from datetime import datetime

# ==========================================
# 1. 页面基本配置与 CSS 样式
# ==========================================
st.set_page_config(
    page_title="AI 智能代购与自动付款 Agent",
    page_icon="🛍️",
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
# 2. 初始化 Session State 数据状态 (包含模拟用户数据库)
# ==========================================

# 模拟用户数据库 (Key: phone 或 email, Value: 用户信息字典)
if "users_db" not in st.session_state:
    st.session_state.users_db = {
        # 预置一个演示测试账户
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

# 免密支付上限及交易限额设置（默认最高值）
if "max_limit" not in st.session_state:
    st.session_state.max_limit = 500

if "single_limit" not in st.session_state:
    st.session_state.single_limit = 10000.00  # 默认最高 1 万

if "daily_limit" not in st.session_state:
    st.session_state.daily_limit = 50000.00   # 默认最高 5 万

# 钱包与银行账户状态
if "wallet_balance" not in st.session_state:
    st.session_state.wallet_balance = 350.00  # 初始钱包余额

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
                {"role": "assistant", "content": "👋 你好！我是你的 **全网 AI 智能代购 Agent**。\n\n请告诉你想买什么商品（例如：*“帮我买一台 iPhone 15 Pro 256G 黑色”* 或 *“推荐一款性价比最高的无线降噪耳机并直接下单”*），我会为你全网比价、领券，并自动完成下单！"}
            ]
        }
    ]

if "current_session_index" not in st.session_state:
    st.session_state.current_session_index = 0

if "pending_order" not in st.session_state:
    st.session_state.pending_order = None

if "orders_history" not in st.session_state:
    st.session_state.orders_history = []  # 仅存已付款订单

if "simulated_code" not in st.session_state:
    st.session_state.simulated_code = None


# ==========================================
# 3. 辅助逻辑函数
# ==========================================
def search_and_generate_order(prompt: str):
    """模拟 AI 全网比价与创建订单"""
    time.sleep(1.2)
    platforms = ["京东自营", "淘宝天猫旗舰店", "拼多多百亿补贴"]
    platform = random.choice(platforms)
    
    base_price = round(random.uniform(100, 2000), 2)
    coupon = round(base_price * 0.1, 2)
    final_price = round(base_price - coupon, 2)
    order_id = f"AGENT-ORD-{random.randint(100000, 999999)}"
    
    return {
        "order_id": order_id,
        "title": f"【AI代购特惠】{prompt}",
        "platform": platform,
        "original_price": base_price,
        "coupon": coupon,
        "final_price": final_price,
        "status": "待付款确认"
    }


# ==========================================
# 4. 真实校验的 登录 / 注册页面 (Welcome Page)
# ==========================================
def render_welcome_page():
    st.markdown("<h1 style='text-align: center;'>🛍️ 欢迎体验 AI 智能代购 Agent</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center; color: #888;'>全网比价 · 自动领券 · 极速代付款</p>", unsafe_allow_html=True)
    st.divider()

    col_left, col_main, col_right = st.columns([1, 2, 1])
    
    with col_main:
        auth_mode = st.radio("选择操作方式", ["注册新账户 (Sign Up)", "登录账户 (Log In)"], horizontal=True)
        
        # ---------------- 模式 1：注册账户 ----------------
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

                # 校验逻辑
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
                    # 将新用户写入 Session 数据库 (同时绑定手机和邮箱)
                    user_data = {
                        "phone": f"{country_code} {clean_phone}",
                        "email": clean_email,
                        "password": password
                    }
                    st.session_state.users_db[clean_phone] = user_data
                    st.session_state.users_db[clean_email] = user_data

                    st.success("🎉 注册成功！自动为你完成登录...")
                    st.session_state.authenticated = True
                    st.session_state.user_info = user_data
                    time.sleep(1.2)
                    st.rerun()

        # ---------------- 模式 2：真实登录 ----------------
        else:
            st.subheader("🔑 账户登录")
            st.caption("提示：请输入已注册的手机号/邮箱与对应密码。快捷测试账号：`13800138000` / 密码：`password123`")
            
            login_identity = st.text_input("手机号 / 邮箱", placeholder="输入注册时使用的手机号或邮箱").strip()
            login_password = st.text_input("密码", type="password", placeholder="输入登录密码")
            
            if st.button("🔓 登录系统", type="primary", use_container_width=True):
                login_key = login_identity.lower()
                
                # 检查账号是否存在于 Session 数据库中
                if not login_identity or not login_password:
                    st.error("❌ 请输入账号与密码！")
                elif login_key not in st.session_state.users_db:
                    st.error("❌ 该账号未注册，请先选择【注册新账户】！")
                else:
                    user_data = st.session_state.users_db[login_key]
                    # 校验密码
                    if user_data["password"] != login_password:
                        st.error("❌ 登录密码错误，请重新输入！")
                    else:
                        st.success("✅ 登录验证通过！正在跳转...")
                        st.session_state.authenticated = True
                        st.session_state.user_info = user_data
                        time.sleep(1)
                        st.rerun()


# ==========================================
# 5. “我的” 中心各模块渲染
# ==========================================
def render_profile_navigation_home():
    """“我的” 导航主页卡片布局"""
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
    """渲染具体的“我的”子页面内容"""
    current_loc = st.session_state.nav_location
    
    # 顶部导航面包屑与返回
    nav_cols = st.columns([1, 5])
    with nav_cols[0]:
        if st.button("⬅️ 返回个人中心"):
            st.session_state.nav_location = "profile_home"
            st.rerun()

    st.divider()

    # ---------------- 栏目 1：支付设置 (银行账户 & 交易限额) ----------------
    if current_loc == "pay_settings":
        st.title("💳 支付设置")
        st.caption("在此统一管理银行账户以及代购交易限额配置")
        
        tab_bank, tab_limits = st.tabs(["🏦 银行账户", "⚙️️ 交易限额设置"])

        # Tab A: 银行账户
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

        # Tab B: 交易限额设置
        with tab_limits:
            st.subheader("⚙️ 调整交易限额")
            st.caption("提示：如果不单独自定义设置，系统默认将生效最高的默认限制额度（单笔最高 1 万，单日最高 5 万）。修改设定需验证登录密码。")
            
            lim_c1, lim_c2 = st.columns(2)
            with lim_c1:
                new_single = st.number_input(
                    "单笔限额 (元)",
                    min_value=100.0,
                    max_value=10000.0,
                    value=float(st.session_state.single_limit),
                    step=500.0,
                    help="设置单笔交易允许支付的最大金额，系统上限最高为 10,000 元"
                )
            with lim_c2:
                new_daily = st.number_input(
                    "单日累计支付总额 (元)",
                    min_value=1000.0,
                    max_value=50000.0,
                    value=float(st.session_state.daily_limit),
                    step=1000.0,
                    help="设置单日允许累计支付的最大金额，系统上限最高为 50,000 元"
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

    # ---------------- 栏目 2：我的钱包 ----------------
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
        st.markdown("📌 **扣款规则说明**：\n- **小额支付（≤ 免密上限）**：优先扣除【我的钱包】余额。\n- **大额支付（> 免密上限）**：直接通过【银行账户】并要求输入 6 位支付密码授权扣款。")

    # ---------------- 栏目 3：我的地址 ----------------
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

    # ---------------- 栏目 4：我的记录 ----------------
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
                        {"role": "assistant", "content": "👋 你好！我是你的 **全网 AI 智能代购 Agent**。\n\n请告诉你想买什么商品，我会为你全网比价并下单！"}
                    ]
                }
                st.session_state.chat_sessions.append(new_session)
                st.session_state.current_session_index = len(st.session_state.chat_sessions) - 1
                st.session_state.nav_location = "chat"
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
    st.title("🤖 自动付款 AI 购物 Agent")
    st.caption("全网比价 · 优惠券自动叠加 · 钱包/银行卡智能扣款")

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Agent 状态", "🟢 在线就绪", "延迟 < 0.8s")
    with col2:
        st.metric("我的钱包余额", f"￥{st.session_state.wallet_balance:.2f}", "可自动小额代扣")
    with col3:
        st.metric("已成功代购", f"{len(st.session_state.orders_history)} 笔")
    with col4:
        default_addr = next((a for a in st.session_state.address_list if a["is_default"]), None)
        st.metric("默认收货人", default_addr["name"] if default_addr else "未设置")

    st.divider()

    # 渲染当前会话历史
    current_session = st.session_state.chat_sessions[st.session_state.current_session_index]
    for message in current_session["messages"]:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    # 待付款订单处理
    if st.session_state.pending_order:
        order = st.session_state.pending_order
        max_limit = st.session_state.max_limit
        is_large_amount = order['final_price'] > max_limit
        
        st.warning("⚠️ **Agent 已锁定低价商品，请确认订单并授权支付：**")
        
        with st.container():
            col_img, col_info = st.columns([1, 3])
            with col_img:
                st.image("https://via.placeholder.com/150/1E212A/FFFFFF?text=Product", width=120)
            with col_info:
                st.subheader(order["title"])
                st.write(f"🏷️ **下单平台**：{order['platform']} | 🆔 **订单编号**：`{order['order_id']}`")
                st.write(f"💰 原价：~~￥{order['original_price']}~~ | 🎁 叠加优惠：**-￥{order['coupon']}**")
                st.markdown(f"### 实际应付：:red[￥{order['final_price']}]")

        st.divider()

        # 智能扣款渠道判定
        if not is_large_amount:
            st.info(f"💡 本单金额 (￥{order['final_price']}) ≤ 免密上限 (￥{max_limit})，默认优先使用【👛 我的钱包】扣款（当前余额：￥{st.session_state.wallet_balance:.2f}）。")
            pay_channel = "👛 我的钱包"
        else:
            st.warning(f"🚨 本单金额 (￥{order['final_price']}) > 免密上限 (￥{max_limit})，属于**大额支付**，强制使用【🏦 银行账户】并需验证 6 位密码。")
            pay_channel = st.selectbox("选择大额支付银行卡", [card["bank"] for card in st.session_state.bank_cards])

        pay_col1, pay_col2 = st.columns([2, 1])
        with pay_col1:
            pin_code = st.text_input("付款授权密码", type="password", max_chars=6, placeholder="6位密码 (演示密码: 123456)", label_visibility="collapsed")
        
        with pay_col2:
            confirm_pay = st.button("🚀 确认授权扣款", type="primary", use_container_width=True)
            cancel_pay = st.button("❌ 取消订单", use_container_width=True)

        if confirm_pay:
            if not is_large_amount and st.session_state.wallet_balance < order['final_price']:
                st.error("❌ 我的钱包余额不足，请先去【我的 -> 我的钱包】充值或使用银行卡支付！")
            elif pin_code == "123456" or len(pin_code) == 6:
                with st.spinner("💳 正在执行扣款并提交商家订单..."):
                    time.sleep(1.5)

                if not is_large_amount:
                    st.session_state.wallet_balance -= order['final_price']
                
                st.success(f"🎉 **代购付款成功！**")
                st.balloons()
                
                default_addr_str = default_addr["address"] if default_addr else "默认地址"
                order["status"] = "已付款成功"
                order["pay_channel"] = pay_channel
                order["shipping_address"] = default_addr_str
                st.session_state.orders_history.append(order)
                
                current_session["messages"].append({
                    "role": "assistant",
                    "content": f"✅ **代购成功！**\n- **商品**：{order['title']}\n- **实付金额**：￥{order['final_price']}\n- **支付渠道**：{pay_channel}\n- **送货地址**：{default_addr_str}\n记录已自动存入【我的 -> 购买记录】！"
                })
                
                st.session_state.pending_order = None
                time.sleep(1)
                st.rerun()
            else:
                st.error("❌ 付款密码错误，请输入正确的 6 位数字密码（测试密码：123456）")

        if cancel_pay:
            st.session_state.pending_order = None
            st.info("已取消当前代购订单。")
            st.rerun()

    # 聊天输入框
    if prompt := st.chat_input("输入你想购买的商品，例如：“帮我买一个 20000 毫安快充充电宝”"):
        current_session["messages"].append({"role": "user", "content": prompt})
        
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            message_placeholder = st.empty()
            message_placeholder.markdown("🔍 ** Agent 正在检索京东、淘宝、拼多多平台价格...**")
            time.sleep(1)
            
            new_order = search_and_generate_order(prompt)
            st.session_state.pending_order = new_order
            
            reply_content = f"已匹配最优商品！\n- **平台**：{new_order['platform']}\n- **券后最低价**：**￥{new_order['final_price']}**\n\n👇 **请确认订单信息并授权付款：**"
            message_placeholder.markdown(reply_content)
            
            current_session["messages"].append({"role": "assistant", "content": reply_content})
            st.rerun()


# ==========================================
# 7. 主架构 (统一导航控制)
# ==========================================
def render_main_app():
    # ---------------- 侧边栏统一导航 ----------------
    with st.sidebar:
        st.title("🛍️ 代购 Agent 导航")
        
        if st.session_state.user_info:
            st.info(f"👤 **当前登录用户**：\n- 📱 {st.session_state.user_info['phone']}\n- ✉️ {st.session_state.user_info['email']}")

        st.subheader("📌 核心导航")
        
        # 1. 切换至 AI 聊天界面
        if st.button("💬 AI 代购助手 (Chatbot)", use_container_width=True, type="primary" if st.session_state.nav_location == "chat" else "secondary"):
            st.session_state.nav_location = "chat"
            st.rerun()

        # 2. 点击“我的”进入个人中心导航大页
        if st.button("👤 我的 (个人中心)", use_container_width=True, type="primary" if st.session_state.nav_location.startswith("profile") or st.session_state.nav_location in ["pay_settings", "wallet", "address", "records"] else "secondary"):
            st.session_state.nav_location = "profile_home"
            st.rerun()

        st.divider()
        if st.button("🚪 退出登录", use_container_width=True):
            st.session_state.authenticated = False
            st.session_state.user_info = None
            st.rerun()

    # ---------------- 主界面视图按 State 切换 ----------------
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