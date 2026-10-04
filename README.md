## AI Shopping Agent with Auto Payment

An intelligent, end-to-end AI shopping assistant built with Streamlit and DeepSeek. 
It understands natural-language shopping requests, compares real-time prices across China's top e-commerce platforms,
curates refined product recommendations through a 4-stage funnel, and completes the entire checkout flow — from address selection to payment — with email-based verification.

# ✨ Features

*🤖 Conversational Shopping Assistant*
- Natural-language intent parsing (category, price range, attributes like color/brand/capacity).
- Multi-turn dialogue: refine, reject, or re-scope recommendations without restarting.
- Strictly English output for all titles, reasons, and descriptions, even when product titles are originally Chinese.

*🔍 Real-Time Web Price Comparison*
- Powered by Tencent Cloud Web Search API (WSA – SearchPro).
- Hard-restricted to 5 official platforms: Taobao · Tmall · JD · Pinduoduo · VIP.com.
- Automatically detects and prefers product detail pages over generic search pages.
- Falls back to the platform's official search page when no detail page is found, so every product card always carries a clickable link.

*🎯 4-Stage Refined Recommendation Funnel*
- Top Overall Pick: Best cross-platform match.
- Three-Dimension Options: Lowest price, Best reviews, Best seller.
- Budget Filtering: Auto-estimated price range with a slider for precise matching.
- 5 Curated Products: Based on your detailed requirements; if nothing matches, gracefully exit.

*💳 Complete Payment & Checkout Flow*
- Shipping Address Book: Add, edit, delete, and set default addresses.
- Bank Card Management: Bind, edit, and delete debit/credit cards.
- Wallet System: Top up balance and auto-deduct for orders when sufficient.
- Dual Payment Methods: Wallet balance OR Direct bank debit.
- One-Time Payment Password: 12-character code sent to your email (valid for 10 minutes).
- Login Password Re-Authentication: Required for direct bank debit above the password-free threshold.
- Transaction Limits: Per-order single limit and daily cumulative limit, all configurable.
- Email Receipt: Auto-sent by the "merchant" after successful payment.

*📧 Email Integration*
- SMTP auto-configuration from st.secrets (invisible to end users).
- 30+ preset SMTP providers (Gmail, Outlook, QQ, 163, iCloud, Yahoo, Zoho, etc.).
- Used for registration verification codes, payment passwords, and payment receipts.

*👤 User Account System*
- Email-based registration with 6-digit verification codes.
- Password validation (min 8 chars, must include letters and digits).
- Persistent chat sessions and purchase history per user.

# 📂 Project Structure

```text
Agent/
├── .streamlit/
│   ├── config.toml         # Streamlit theme & server settings
│   └── secrets.toml        # API keys & SMTP credentials (DO NOT COMMIT)
├── app.py                  # Main application
├── requirements.txt        # Python dependencies
└── README.md               # This file
```

# 🚀 Quick Start

*1. Prerequisites*
- Python 3.12 or higher
- DeepSeek API key (platform.deepseek.com)
- Tencent Cloud account with the Web Search API (WSA) enabled
- SMTP-enabled email account (with an app password, not your login password)

*2. Clone & Install*
git clone <your-repo-url>
cd Agent
pip install -r requirements.txt

*3. Configure Secrets*

Create .streamlit/secrets.toml with the following content:

```text
===== DeepSeek =====
DEEPSEEK_API_KEY = "sk-xxxxxxxxxxxxxxxxxxxxxxxx"

===== Tencent Cloud WSA =====
TENCENT_SECRET_ID  = "AKIDxxxxxxxxxxxxxxxxxxxx"
TENCENT_SECRET_KEY = "xxxxxxxxxxxxxxxxxxxxxxxx"

===== SMTP (sender email) =====
SMTP_USER = "your_email@gmail.com"
SMTP_PASS = "your_app_password"      # App password, NOT your login password

===== Optional overrides (auto-detected from SMTP_USER if omitted) =====
SMTP_HOST     = "smtp.gmail.com"
SMTP_PORT     = 465
SMTP_USE_SSL  = true
```

# ⚠️ Never commit secrets.toml to version control. Add .streamlit/secrets.toml to .gitignore.

*4. Run the App*
- Local Implementation: streamlit run app.py
- Internet Website: https://ttt-team-hku-hackthon-2026.streamlit.app/

# 🧪 Test Account
A demo account is pre-loaded for quick testing:

```text
Field	    Value
-----------------------------
Email:    test@example.com
Password: password123
```

# 🛒 Usage Walkthrough

1. Sign up / log in with your email.
2. Tell the agent what you want — e.g.:
  *"Help me buy a 20,000 mAh fast-charging power bank"*
  *"I want a black camera around $1000"*
3. Review the top pick, or click "Not satisfied" to see more options.
4. Narrow down by dimension → budget slider → detailed requirements.
5. Pick a product, confirm the shipping address.
6. Enter the one-time payment password (sent to your email) and choose a payment method.
7. Done! You'll receive a payment receipt email.

*Key modules in app.py:*
```text
        Key	       | Required |         Description
--------------------------------------------------------------------
DEEPSEEK_API_KEY	 |    ✅	  |  DeepSeek API key for LLM reasoning
TENCENT_SECRET_ID	 |    ✅	  |  Tencent Cloud SecretId (for WSA)
TENCENT_SECRET_KEY |   	✅	  |  Tencent Cloud SecretKey
SMTP_USER	         |    ✅    |  Sender email address
SMTP_PASS	         |    ✅    |  Sender email app password
SMTP_HOST	         |    ❌	  |  SMTP host (auto-detected)
SMTP_PORT	         |    ❌	  |  SMTP port (auto-detected)
SMTP_USE_SSL	     |    ❌	  |  Use SSL (auto-detected)
```

# 📄 License
This project is provided for educational and demonstration purposes. Use at your own risk. Ensure compliance with the terms of service of all third-party APIs (DeepSeek, Tencent Cloud, and the e-commerce platforms referenced).

# Acknowledgements
Streamlit – Rapid UI framework
DeepSeek – LLM reasoning engine
Tencent Cloud WSA – Real-time web search

