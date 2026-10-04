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

Agent/
├── .streamlit/
│   ├── config.toml         # Streamlit theme & server settings
│   └── secrets.toml        # API keys & SMTP credentials (DO NOT COMMIT)
├── app.py                  # Main application
├── requirements.txt        # Python dependencies
└── README.md               # This file

# 🚀 Quick Start
1. Prerequisites
Python 3.10 or higher
A DeepSeek API key (platform.deepseek.com)
A Tencent Cloud account with the Web Search API (WSA) enabled

An SMTP-enabled email account (with an app password, not your login password)




