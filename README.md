# MandateWallet

HacKU 2026 · FinTech PS1 "Give a Machine a Wallet – Agentic Commerce"

**一句话**：用户用一张表单写下 AI 购物助理的花钱边界（买什么、最多花多少、最多买几次、何时失效、哪些情况先问我）；Agent 在边界内跨商家比价并自动付款；条件变化时暂停询问，越界时拒绝并引用用户自己写的规则；每一笔都可追溯。

四个维度在同一笔交易中的位置：

- **Trust**：买家与商家凭证（主体、有效期、撤销）决定谁能参与；授权书（mandate）决定 Agent 被允许做什么。
- **E-commerce**：任务 → 候选 → 报价（含运费）→ 购物车版本快照 → 订单。
- **Agent**：理解任务、搜索、比较、解释；不做任何权限判断。
- **Payment**：支付方式资格与成本比较 → 模拟钱包结算（一个事务）→ 平衡账本 → 收据。

## 文档

- `docs/MANUAL.md` — 产品与技术规格（唯一依据）
- `docs/CURSOR_PROMPTS.md` — 分阶段开发指令
- `docs/DECISIONS.md` — 决策记录
- `AGENTS.md` — 不可违反的不变量

## 运行

```powershell
npm install
Copy-Item .env.example .env.local   # 填 DATABASE_URL、SESSION_SECRET
npm run db:migrate
npm run db:seed
npm run dev                          # http://localhost:3000
```

方式 B（有 Docker）：`docker compose up --build`，自动迁移与种子。

演示账号：`alex@demo.hk / demo1234`（阶段 1 后可用）。

## 分支

- `main`：始终可运行；由李启成合并
- `feat/ui-*`：李婧萱（页面、集成）
- `feat/core-*`：李启成（引擎、结算、部署）
- `data/fixtures`：戚译匀（`fixtures/`、`docs/rates/`）
- `docs/pitch`：邹思远（`docs/pitch/`、规则文案 `messages.ts`）

## 声明

所有代码于 2026 年 10 月 2 日 13:00 之后在本仓库从零编写。使用的开源库：Next.js、React、Tailwind CSS、shadcn/ui、pg、zod、bcryptjs、vitest。AI 辅助工具：Cursor、SenseNova、Raccoon Work。支付由模拟器执行；费率为公开页面观测值；商家凭证验证仅表示所验证条件通过。
