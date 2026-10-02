import streamlit as st
import time
import random

# ==========================================
# 1. 页面基本配置与 CSS 样式强化
# ==========================================
st.set_page_config(
    page_title="AI 智能代购与自动付款 Agent",
    page_icon="🛍️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 自定义部分 CSS 增强 Streamlit 视觉体验
st.markdown("""
<style>
    /* 密码输入框与订单卡片样式 */
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
</style>
""", unsafe_allow_html=True)


# ==========================================
# 2. 初始化 Session State 数据状态
# ==========================================
if "messages" not in st.session_state:
    st.session_state.messages = [
        {
            "role": "assistant",
            "content": "👋 你好！我是你的 **全网 AI 智能代购 Agent**。\n\n请告诉你想买什么商品（例如：*“帮我买一台 iPhone 15 Pro 256G 黑色”* 或 *“推荐一款性价比最高的无线降噪耳机并直接下单”*），我会为你全网比价、领券，并自动完成下单！"
        }
    ]

if "pending_order" not in st.session_state:
    st.session_state.pending_order = None  # 待付款订单

if "orders_history" not in st.session_state:
    st.session_state.orders_history = []  # 已完成订单列表


# ==========================================
# 3. 侧边栏：账户与支付安全设置
# ==========================================
with st.sidebar:
    st.title("⚙️ Agent 账户与安全设置")
    
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
    if st.button("🗑️ 清空对话历史"):
        st.session_state.messages = [st.session_state.messages[0]]
        st.session_state.pending_order = None
        st.rerun()


# ==========================================
# 4. 主界面标题与卡片指标
# ==========================================
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


# ==========================================
# 5. 模拟后端 Agent 逻辑函数
# ==========================================
def search_and_generate_order(prompt: str):
    """模拟 AI 全网比价与创建订单"""
    # 模拟搜索时间
    time.sleep(1.5)
    
    # 假数据根据输入简单生成
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
# 6. 对话历史渲染
# ==========================================
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])


# ==========================================
# 7. 待付款订单浮动/弹框处理逻辑（如果存在待确认订单）
# ==========================================
if st.session_state.pending_order:
    order = st.session_state.pending_order
    
    st.warning("⚠️ **Agent 已为你锁定最低价商品，等待输入付款密码授权执行下单：**")
    
    # 订单卡片展示
    with st.container():
        col_img, col_info = st.columns([1, 3])
        with col_img:
            st.image("https://via.placeholder.com/150/1E212A/FFFFFF?text=Product+Image", width=120)
        with col_info:
            st.subheader(order["title"])
            st.write(f"🏷️ **下单平台**：{order['platform']} | 🆔 **订单编号**：`{order['order_id']}`")
            st.write(f"💰 原价：~~￥{order['original_price']}~~ | 🎁 已自动领券叠加：**-￥{order['coupon']}**")
            st.markdown(f"### 实际应付：:red[￥{order['final_price']}]")

    # 支付密码验证区域
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
            
            # 记录交易
            order["status"] = "已付款成功"
            st.session_state.orders_history.append(order)
            
            # 追加 assistant 消息
            st.session_state.messages.append({
                "role": "assistant",
                "content": f"✅ **代购成功！**\n- **商品**：{order['title']}\n- **实付金额**：￥{order['final_price']}\n- **平台**：{order['platform']}\n- **物流单号**：SF{random.randint(1000000000, 9999999999)}\n商家正在紧急备货中！"
            })
            
            # 清空待付款状态
            st.session_state.pending_order = None
            time.sleep(1)
            st.rerun()
        else:
            st.error("❌ 密码错误，请输入正确的 6 位数字付款密码（测试密码：123456）")

    if cancel_pay:
        st.session_state.pending_order = None
        st.info("已取消当前代购订单。")
        st.rerun()


# ==========================================
# 8. 聊天输入框处理逻辑
# ==========================================
if prompt := st.chat_input("输入你想购买的商品，例如：“帮我买一个20000毫安的快充充电宝”"):
    # 1. 渲染用户输入
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # 2. Agent 处理与搜索
    with st.chat_message("assistant"):
        message_placeholder = st.empty()
        
        # 步骤 1：全网比价
        message_placeholder.markdown("🔍 ** Agent 正在检索京东、淘宝、拼多多平台价格...**")
        time.sleep(1)
        
        # 步骤 2：自动领券
        message_placeholder.markdown("🎟️ **正在识别全网店铺优惠券与满减活动，自动叠加折扣...**")
        
        # 步骤 3：生成订单数据
        new_order = search_and_generate_order(prompt)
        st.session_state.pending_order = new_order
        
        # 步骤 4：更新对话
        reply_content = f"已找到为您匹配的最优商品方案！\n- **推荐平台**：{new_order['platform']}\n- **原价**：￥{new_order['original_price']}\n- **券后最低价**：**￥{new_order['final_price']}**\n\n👇 **请在下方卡片中确认商品信息并输入支付密码完成代购付款：**"
        message_placeholder.markdown(reply_content)
        
        st.session_state.messages.append({"role": "assistant", "content": reply_content})
        
        # 重新加载页面以显示支付卡片
        st.rerun()