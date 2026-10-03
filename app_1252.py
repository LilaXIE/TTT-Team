import streamlit as st
import time
import random
import re

# ==========================================
# 1. 页面基本配置与 CSS 样式强化
# ==========================================
st.set_page_config(
    page_title="AI 智能代购与自动付款 Agent",
    page_icon="🛍️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 自定义部分 CSS 增强 Visual Aesthetics
st.markdown("""
<style>
    .order-card {
        background-color: #1E212A;
        border: 1px solid #313543;
        border-radius: 10px;
        padding: 15px;
        margin-bottom: 10px;
    }
    .badge-discount {
        background-color: #FF4B4B;
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
    }
    .stButton>button {
        border-radius: 8px;
    }
    .auth-container {
        max-width: 500px;
        margin: 0 auto;
        padding: 30px;
        background-color: #1E212A;
        border-radius: 12px;
        border: 1px solid #313543;
    }
</style>
""", unsafe_allow_html=True)


# ==========================================
# 2. 初始化 Session State 数据状态
# ==========================================
if "authenticated" not in st.session_state:
    st.session_state.authenticated = False

if "user_info" not in st.session_state:
    st.session_state.user_info = None

if "messages" not in st.session_state:
    st.session_state.messages = [
        {
            "role": "assistant",
            "content": "👋 你好！我是你的 **全网 AI 智能代购 Agent**。\n\n请告诉你想买什么商品（例如：*“帮我买一台 iPhone 15 Pro 256G 黑色”* 或 *“推荐一款性价比最高的无线降噪耳机并直接下单”*），我会为你全网比价、领券，并自动完成下单！"
        }
    ]

if "pending_order" not in st.session_state:
    st.session_state.pending_order = None

if "orders_history" not in st.session_state:
    st.session_state.orders_history = []

if "simulated_code" not in st.session_state:
    st.session_state.simulated_code = None


# ==========================================
# 3. 模拟 Agent 函数
# ==========================================
def search_and_generate_order(prompt: str):
    """模拟 AI 全网比价与创建订单"""
    time.sleep(1.5)
    platforms = ["京东自营", "淘宝天猫旗舰店", "拼多多百亿补贴"]
    platform = random.choice(platforms)
    
    base_price = round(random.uniform(200, 5000), 2)
    coupon = round(base_price * 0.12, 2)
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
# 4. 欢迎与登录 / 注册页面 (Welcome Page)
# ==========================================
def render_welcome_page():
    st.markdown("<h1 style='text-align: center;'>🛍️ 欢迎体验 AI 智能代购 Agent</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center; color: #888;'>全网比价 · 自动领券 · 极速代付款</p>", unsafe_allow_html=True)
    st.divider()

    col_left, col_main, col_right = st.columns([1, 2, 1])
    
    with col_main:
        auth_mode = st.radio("选择操作方式", ["登录账户 (Log In)", "注册新账户 (Sign Up)"], horizontal=True, label_visibility="collapsed")
        
        # ----------------- 注册逻辑 (Sign Up) -----------------
        if auth_mode == "注册新账户 (Sign Up)":
            st.subheader("📝 注册新账户")
            
            # 手机号与区号
            phone_col1, phone_col2 = st.columns([1, 2])
            with phone_col1:
                country_code = st.selectbox("区号", ["+86", "+852"])
            with phone_col2:
                phone_num = st.text_input("手机号码", placeholder="输入手机号")

            # 邮箱输入
            email = st.text_input("电子邮箱", placeholder="example@domain.com")

            # 验证码类型选择
            verify_type = st.radio("验证码接收渠道", ["手机短信验证", "邮箱验证"], horizontal=True)
            
            code_col1, code_col2 = st.columns([2, 1])
            with code_col1:
                verify_code = st.text_input("验证码", placeholder="输入 6 位验证码", max_chars=6)
            with code_col2:
                st.write("") # 间距微调
                if st.button("发送验证码", use_container_width=True):
                    target = phone_num if verify_type == "手机短信验证" else email
                    if not target:
                        st.error("请先填写对应的手机号或邮箱！")
                    else:
                        st.session_state.simulated_code = str(random.randint(100000, 999999))
                        st.toast(f"📩 【模拟验证码】已发送至 {target}：{st.session_state.simulated_code}", icon="💬")

            # 密码设定 (要求至少 8 位)
            password = st.text_input("设置登录密码 (至少 8 位)", type="password", placeholder="包含字母和数字，至少8位")
            confirm_password = st.text_input("确认登录密码", type="password", placeholder="再次输入密码")

            # 法律协议勾选
            st.markdown("---")
            agree_terms = st.checkbox(
                "我已阅读并同意 [《AI代购Agent用户服务协议》](#) 与 [《隐私保护政策》](#)"
            )

            # 注册提交按钮
            if st.button("🚀 立即完成注册并登录", type="primary", use_container_width=True):
                if not agree_terms:
                    st.error("❌ 必须勾选同意法律协议方可注册！")
                elif not phone_num or not email:
                    st.error("❌ 请完整填写手机号和邮箱！")
                elif verify_code != st.session_state.simulated_code or not verify_code:
                    st.error("❌ 验证码不正确或未获取！")
                elif len(password) < 8:
                    st.error("❌ 登录密码长度不能少于 8 位！")
                elif password != confirm_password:
                    st.error("❌ 两次输入的密码不一致！")
                else:
                    st.success("🎉 注册成功！自动登录中...")
                    st.session_state.authenticated = True
                    st.session_state.user_info = {
                        "phone": f"{country_code} {phone_num}",
                        "email": email
                    }
                    time.sleep(1)
                    st.rerun()

        # ----------------- 登录逻辑 (Log In) -----------------
        else:
            st.subheader("🔑 账户登录")
            login_identity = st.text_input("手机号 / 邮箱", placeholder="输入注册时使用的手机号或邮箱")
            login_password = st.text_input("密码", type="password", placeholder="输入登录密码")
            
            if st.button("🔓 登录", type="primary", use_container_width=True):
                if not login_identity or not login_password:
                    st.error("请填写登录凭证！")
                elif len(login_password) < 8:
                    st.error("密码格式不正确（至少8位）")
                else:
                    st.success("✅ 登录成功！")
                    st.session_state.authenticated = True
                    st.session_state.user_info = {
                        "phone": login_identity if login_identity.startswith("+") else "+86 " + login_identity,
                        "email": login_identity if "@" in login_identity else "user@example.com"
                    }
                    time.sleep(1)
                    st.rerun()


# ==========================================
# 5. 代购 Agent 主界面 (Main App)
# ==========================================
def render_main_app():
    # 侧边栏：账户与安全设置
    with st.sidebar:
        st.title("⚙️ Agent 设置")
        
        # 显示登录账户信息
        if st.session_state.user_info:
            st.info(f"👤 **当前账户**：\n- 📱 {st.session_state.user_info['phone']}\n- ✉️ {st.session_state.user_info['email']}")

        st.subheader("💳 关联支付通道")
        pay_method = st.selectbox("默认扣款方式", ["支付宝 (Alipay Auto-Pay)", "微信支付 (WeChat Pay)", "银联云闪付", "Visa / MasterCard"])
        
        st.subheader("🛡️ 自动下单权限")
        max_limit = st.number_input("单笔免密代购授权上限 (元)", min_value=0, max_value=50000, value=500, step=100)
        st.caption("提示：当商品金额超过此上限时，必须输入 6 位付款密码方可执行扣款。")
        
        st.subheader("🏪 支持跨平台比价")
        st.checkbox("京东 (JD.com)", value=True)
        st.checkbox("淘宝 / 天猫 (Taobao)", value=True)
        st.checkbox("拼多多 (Pinduoduo)", value=True)
        st.checkbox("抖音电商", value=True)
        
        st.divider()
        col_side_a, col_side_b = st.columns(2)
        with col_side_a:
            if st.button("🗑️ 清空历史", use_container_width=True):
                st.session_state.messages = [st.session_state.messages[0]]
                st.session_state.pending_order = None
                st.rerun()
        with col_side_b:
            if st.button("🚪 退出登录", use_container_width=True):
                st.session_state.authenticated = False
                st.session_state.user_info = None
                st.rerun()

    # 主界面标题与卡片指标
    st.title("🤖 自动付款 AI 购物 Agent")
    st.caption("基于大模型的智能全网代购平台 · 自动搜索 · 优惠券叠加 · 一键授权支付")

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Agent 状态", "🟢 在线就绪", "响应延迟 < 0.8s")
    with col2:
        st.metric("累计节省金额", "¥ 1,280.50", "全网历史最低")
    with col3:
        st.metric("成功代购笔数", f"{len(st.session_state.orders_history)} 笔", "+1 本周")
    with col4:
        st.metric("绑定的支付账户", "支付宝 (已加密)", "安全等级: 高")

    st.divider()

    # 对话历史渲染
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    # 待付款订单逻辑处理
    if st.session_state.pending_order:
        order = st.session_state.pending_order
        
        st.warning("⚠️️ **Agent 已为你锁定最低价商品，等待输入付款密码授权执行下单：**")
        
        with st.container():
            col_img, col_info = st.columns([1, 3])
            with col_img:
                st.image("https://via.placeholder.com/150/1E212A/FFFFFF?text=Product+Image", width=120)
            with col_info:
                st.subheader(order["title"])
                st.write(f"🏷️️ **下单平台**：{order['platform']} | 🆔 **订单编号**：`{order['order_id']}`")
                st.write(f"💰 原价：~~￥{order['original_price']}~~ | 🎁 已自动领券叠加：**-￥{order['coupon']}**")
                st.markdown(f"### 实际应付：:red[￥{order['final_price']}]")

        st.divider()
        st.write("🔒 **请输入 6 位支付授权密码完成自动下单与划款：**")
        
        pay_col1, pay_col2 = st.columns([2, 1])
        with pay_col1:
            pin_code = st.text_input("付款密码", type="password", max_chars=6, placeholder="输入6位数字密码 (默认演示密码: 123456)", label_visibility="collapsed")
        
        with pay_col2:
            confirm_pay = st.button("🚀 立即授权代扣付款", type="primary", use_container_width=True)
            cancel_pay = st.button("❌ 取消代购", use_container_width=True)

        if confirm_pay:
            if pin_code == "123456" or len(pin_code) == 6:
                with st.spinner("💳 正在调用支付 API 执行扣款与商家自动下单..."):
                    time.sleep(2)
                    
                st.success(f"🎉 **付款成功！Agent 已替你在【{order['platform']}】下单成功！**")
                st.balloons()
                
                order["status"] = "已付款成功"
                st.session_state.orders_history.append(order)
                
                st.session_state.messages.append({
                    "role": "assistant",
                    "content": f"✅ **代购成功！**\n- **商品**：{order['title']}\n- **实付金额**：￥{order['final_price']}\n- **平台**：{order['platform']}\n- **物流单号**：SF{random.randint(1000000000, 9999999999)}\n商家正在紧急备货中！"
                })
                
                st.session_state.pending_order = None
                time.sleep(1)
                st.rerun()
            else:
                st.error("❌ 密码错误，请输入正确的 6 位数字付款密码（测试密码：123456）")

        if cancel_pay:
            st.session_state.pending_order = None
            st.info("已取消当前代购订单。")
            st.rerun()

    # 聊天输入框处理逻辑
    if prompt := st.chat_input("输入你想购买的商品，例如：“帮我买一个20000毫安的快充充电宝”"):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            message_placeholder = st.empty()
            
            message_placeholder.markdown("🔍 ** Agent 正在检索京东、淘宝、拼多多平台价格...**")
            time.sleep(1)
            
            message_placeholder.markdown("🎟️ **正在识别全网店铺优惠券与满减活动，自动叠加折扣...**")
            
            new_order = search_and_generate_order(prompt)
            st.session_state.pending_order = new_order
            
            reply_content = f"已找到为您匹配的最优商品方案！\n- **推荐平台**：{new_order['platform']}\n- **原价**：￥{new_order['original_price']}\n- **券后最低价**：**￥{new_order['final_price']}**\n\n👇 **请在下方卡片中确认商品信息并输入支付密码完成代购付款：**"
            message_placeholder.markdown(reply_content)
            
            st.session_state.messages.append({"role": "assistant", "content": reply_content})
            st.rerun()


# ==========================================
# 6. 主程序入口控制
# ==========================================
if __name__ == "__main__":
    if not st.session_state.authenticated:
        render_welcome_page()
    else:
        render_main_app()