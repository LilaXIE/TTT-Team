# 进度汇报

每条：时间 | 做了什么 | 怎么验证 | 遗留问题。

## 2026-10-03 02:45 /task 页面骨架（李婧萱分支 lilaxie，Cursor 代做）

做了什么
- `/task/[id]`：顶部任务状态与 Agent 模式徽标；决策卡（ALLOW/REVIEW/DENY + 规则人话，REVIEW 时显示确认按钮与 30 分钟倒计时，DENY 无按钮、给"修改授权"链接）；Agent 步骤时间线；E-commerce 候选对比（含运费总额、商家凭证、注册天数、送达，"为什么"展开）；Payment 结果卡（购物车版本、商品/运费/手续费/合计、订单与交易号）；Trust 各检查点判定列表。status=running 时每 2 秒轮询。
- `/task/new`：从授权书页"让 Agent 去买"进入，POST `/api/tasks { mandateId, text }` 后跳 `/task/[id]`。
- `src/lib/task-view.ts`：前端期望的 `GET /api/tasks/[id]` 响应形状（TaskDetail）。**阶段 2 接口字段以李启成实现为准，对齐后只改这个文件。**
- `src/lib/mock-tasks.ts`：`/task/mock-s1`（ALLOW 已付）、`/task/mock-s2`（REVIEW 换品牌）、`/task/mock-s3`（单笔上限 100 全部 DENY）。接口接通后删除。
- 未改 `src/server/`、`src/contracts/`、`migrations/`。

怎么验证
- `npm run typecheck`、`npm run lint`、`npm run test:unit`（39 通过）、`next build`（/task/[id]、/task/new 编译通过）。未连数据库，未截图。

遗留问题（早上需要决定）
1. **S1 首选会是 B 家而不是 A 家。** A 家品牌甲 118+20 与 B 家品牌甲 108+30 含运费都是 HK$138；§6.1 排序"含运费升序 → 送达天数"会选 B（1 天）。§10 S1 预期为 A。金额、余额、剩余额度不受影响，但商家入账账户不同。可选：改 fixtures（例如 B 家该商品改 HK$110）或在排序加一条"同价优先注册更久的商家"。需李启成在阶段 2 选定。
2. **戚译匀的真实费率还没进仓库。** 在 Hackathon 工作目录的 `fixtures/rates.json`、`docs/rates/`（截图、sources.json）中，已完成采集。但 Tap & Go `consumerFeeMinor` 为 `null`（未核实），现契约只允许金额字符串，导入需改 `src/contracts/schemas.ts` 与种子，并决定"手续费未知时不能自动支付"如何处理（她建议用 INFO_MISSING）。属于李启成锁定范围，需他同意后合入。
3. `/inbox`、`/pay-methods` 仍为导航占位（阶段 3A）。

## 2026-10-03 03:00 试合并戚译匀 / Ellan 数据交付（本地分支 qi-fixtures，未推送）

做了什么
- 把 Hackathon 工作目录中的 `fixtures/*.json`、`fixtures/README.md`、`docs/rates/`（3 张截图 + sources.json + README）、`tests/unit/fixtures.test.ts` 复制到本地分支 `qi-fixtures` 试跑。未改 lilaxie / main。

怎么验证
- `npm run fixtures:validate`、`tsc`、`vitest tests/unit`：不通过，原因如下。

遗留问题（需李启成 + 戚译匀决定后再合）
1. **Tap & Go `consumerFeeMinor: null`。** 现契约 `RatesFixture` 要求字符串 → Zod 报错；Codex 在 Hackathon 加的 `ObservedPaymentMethod`（允许 null）没带过来。即使契约放开，`seed.ts` 写 `payment_methods.consumer_fee_minor`（`NOT NULL`）会失败，需要迁移或"未核实方式不入库/不可支付"的规则。涉及契约、迁移、种子、结算，属李启成范围。
2. **商品与预览 ID 全部改名**（`A-LD-001` → `A-LAUNDRY-01`，`cheap_familiar` → `auto-household` 等）。影响：`scripts/validate-fixtures.ts`、`tests/unit/mandate-preview.test.ts`、`src/lib/mock-tasks.ts` 写死旧 ID；且 seed 按 id upsert，已部署的 Supabase 里旧商品不会删除，目录会出现新旧两套商品。需要一次 reset 或改回旧 ID。
3. **校验脚本两套。** mandate-wallet 阶段 1 已有 `validate-fixtures.ts`；Hackathon 版本（导出 `validateFixtures()`，含截图 SHA-256 校验）与之不同，`fixtures.test.ts` 依赖后者。需选一套。
4. 已确认的事实：Qi 的 README 也指出 S1 同价 HK$138 时排序会选 B 家（与上一条汇报第 1 点一致），并明确"不能为展示 A 强改排序或价格"。S1 预期需按此更新。

## 2026-10-03 02:52 第 1 步：/inbox 待确认页（lilaxie）

做了什么
- `/inbox`：列出 awaiting_confirmation 任务；标题链接到 `/task/[id]`；显示购物车（商家、商品、含运费总额、手续费、支付方式）、命中的 REVIEW 规则（规则人话）、30 分钟倒计时（每秒更新，到 0 显示"已过期"并隐藏按钮）、确认按钮（POST `/api/confirmations { taskId, cartId, cartVersion, ruleIds }`，ruleIds 为全部 REVIEW 规则）和取消按钮（POST `/api/tasks/[id]/cancel`）。含 `blocking` 规则（INFO_MISSING）时不显示确认。
- `src/lib/task-view.ts` 新增 `InboxItem` / `InboxResponse` / `ConfirmationRequest`，`CHECKPOINT_LABEL` 移到这里共用。
- `src/lib/mock-tasks.ts` 新增 `MOCK_INBOX`（来自 mock-s2）；mock-s2、mock-s3 改为授权书 v2、v3。
- 抽出 `src/components/section-tag.tsx`（SectionTag、MockBanner）和 `src/lib/use-now.ts`（渲染期不调用 Date.now()），`/task/[id]` 改用它们。

怎么验证
- `npm run typecheck`、`npm run lint`、`npm run test:unit`（39 通过）、`npx next build`（/inbox 为动态路由）。未连数据库，未运行 dev，未截图。

遗留问题
- 取消接口 `POST /api/tasks/[id]/cancel` 不在 MANUAL §7.2，需李启成确认（见 DECISIONS）。
- 确认后的提示按响应里的 `task.status` / `order.status` 判断（completed → 已付款；awaiting_confirmation → 购物车已变化），需与阶段 3A 实际响应对齐。
## 2026-10-03 03:02 第 2 步：/pay-methods 支付方式比较页（lilaxie）

做了什么
- `/pay-methods?cartId&version`：顶部显示购物车版本、商家、含运费总额、当前选用方式；两列卡片（窄屏堆叠），每张显示资格（通过 / 不通过及原因）、消费者成本（含运费总额 + 手续费）、手续费适用条件、预计回赠、结算时效、来源链接和采集时间；排名徽标（成本最低 / 不参与成本排序）。底部声明："本次支付由模拟器执行；商家手续费不计入消费者成本；回赠为公开页面观测值，未核实的不计入节省。"
- `src/lib/task-view.ts` 新增 `PayMethodOption` / `PayMethodsCompare` / `SETTLEMENT_LABEL`。
- 假数据 `mockPayMethods()` 按戚译匀核实的口径：FPS 手续费 0（仅限 HSBC 个人客户经其 App 或网上理财做本地港元付款，来源 HSBC FAQ）；Tap & Go Mastercard 手续费 null 显示"未核实"、不参与排序（来源 Tap & Go 收费表）；两者回赠 null 显示"未核实"；采集时间 2026-10-03 01:18:49 +08:00。
- `/task/[id]` 示例页的 Payment 卡也显示"查看支付方式比较"链接。

怎么验证
- `npm run typecheck`、`npm run lint`、`npm run test:unit`（39 通过）、`npx next build`（/pay-methods 为动态路由）。未连数据库，未截图。

遗留问题
- 真接口的手续费 null 需要契约放开（`src/contracts/schemas.ts` 的 `PaymentMethod.consumerFeeMinor`）和种子/迁移处理，见交接清单。
- T+1 结算显示为"模拟设定，不是官方结算承诺"，依据戚译匀 notes；如阶段 2 的 settlement 字段取值不同，需补 `SETTLEMENT_LABEL`。
## 2026-10-03 03:12 第 3 步：/ledger 记录页（阶段 4A 提前做，lilaxie）

做了什么
- `/ledger`：按任务分组（新任务在前），每组一条时间线：授权版本（链接 `/mandate/[id]`，显示当时的单笔、总额、次数、有效期）→ 候选摘要（判定徽标、首选、含运费总额）→ 各检查点判定（结果 + 规则人话，"为什么"展开后显示全部命中规则、当时剩余额度和次数、含运费总额、支付方式、授权版本与时间）→ 支付尝试（已结算 / 被拒绝 + 错误码）→ 收据（订单、交易、金额拆分、账本分录合计为 0）。任务标题链接到 `/task/[id]`。
- 已付订单的收据上有"申请退款/退货"按钮：弹窗选类型、填原因（≥ 2 字）后 POST `/api/orders/[id]/support { type, reason }`，提交后显示"已提交人工处理；当前订单尚未退款"和工单号；已有工单时直接显示该状态。
- `src/lib/task-view.ts` 新增 `LedgerResponse` / `LedgerGroup` / `LedgerDecision` / `LedgerAttempt` / `LedgerReceipt` / `SupportTicket` / `SupportRequest`。
- 假数据 `MOCK_LEDGER`：S3（v3 单笔 100，QUOTE 拒绝）、S2（v2 单笔 200，等确认）、S1（v1 单笔 150，已付，分录 −13800 / +13800，授权剩余 300 → 162）。

怎么验证
- `npm run typecheck`、`npm run lint`、`npm run test:unit`（39 通过）、`npx next build`（/ledger 为动态路由）。未连数据库，未截图。

遗留问题
- `snapshot` 字段需要阶段 2 在写 decisions 时保存（见 DECISIONS），否则只能现场重算，违反阶段 4A 要求。
- 账本分录的 `account` 是展示名，需要服务端拼好（如"买家钱包 Alex""商家 日日鲜百货"）。
## 2026-10-03 03:15 第 4 步：导航开放 /inbox、/ledger、/pay-methods（lilaxie）

做了什么
- `src/components/app-shell.tsx`：三项 `ready` 改为 true，导航可点击。

怎么验证
- `npm run typecheck`、`npm run lint`、`npm run test:unit`（39 通过）、`npx next build` 通过。

遗留问题
- 导航在 640px 以下仍隐藏（原有 `hidden sm:flex`），390px 移动端没有入口；阶段 4A 移动端排版时再处理。
## 2026-10-03 03:25 第 5 步：邹思远展位稿与补充问答（不进仓库）

- 文件：`C:\Users\xjx05\Desktop\NoWork\Hackathon\output\邹思远_展位稿与补充问答_草稿.md`（30 秒稿、2 分钟稿 S1→S3→S2→/ledger、补充问答第 13–15 条；"已实现"表述均标【实测后改为已演示】）。
## 给李启成的早上交接清单（2026-10-03 03:30，李婧萱 / Cursor）

lilaxie 分支已有 `/task/[id]`、`/task/new`、`/inbox`、`/pay-methods`、`/ledger` 五个页面，全部先调真接口，接口报错（401 除外）时回退到示例数据并标注"示例数据"。**前端期望的响应形状全部写在 `src/lib/task-view.ts`，以它为准。** 你的字段名如果不同，直接改 `task-view.ts` 或告诉我，我改页面；接口全部接通后删除 `src/lib/mock-tasks.ts` 和回退分支。

### 1 需要对齐的接口字段

通用：金额一律是分的十进制字符串（字段名以 Minor 结尾）；错误体 `{ code, message, ... }`（`src/lib/api.ts` 同时兼容 `{ error: { code, message } }`）；时间为 ISO 字符串。

- **GET `/api/tasks/[id]`** → `TaskDetail`
  - `task { id, mandateId, mandateVersion, status, inputText, createdAt }`，status ∈ running / awaiting_confirmation / completed / failed / cancelled；running 时前端每 2 秒轮询。
  - `run { mode: "llm"|"fallback", steps[{ tool, summary, ms }], candidates: CandidateView[] } | null`；CandidateView = `productId, name, brand, merchantId, merchantName, merchantCredentialStatus, merchantAgeDays, priceMinor, shippingMinor, totalMinor, deliveryDays, decision, chosen, explanation?`。
  - `cart: CartVersionView | null` = `cartId, version, merchantName, items[{ name, qty, unitPriceMinor }], subtotalMinor, shippingMinor, consumerFeeMinor, totalMinor, methodId, quoteExpiresAt`。
  - `decisions: DecisionRecord[]`（Decision + `id, cartId, cartVersion`），按时间升序，**最后一条视为当前决策**。
  - `order { id, status, totalMinor, methodId, merchantName, paidAt, transactionId } | null`。
- **GET `/api/inbox`** → `{ items: InboxItem[] }`；InboxItem = `task { id, mandateId, mandateVersion, inputText, createdAt }`、`cart: CartVersionView`、`decision: DecisionRecord`（REVIEW）、`expiresAt`、`remainingSeconds`（前端以收到响应时刻起倒计时）。
  - **POST `/api/confirmations`** 请求 `{ taskId, cartId, cartVersion, ruleIds }`（ruleIds = 该决策全部 REVIEW 规则），响应按 `TaskDetail` 处理：`task.status` 为 completed 或 `order.status` 为 paid → "已付款"；仍为 awaiting_confirmation → "购物车已变化，请重新确认"。
  - **POST `/api/tasks/[id]/cancel`**（inbox 的取消按钮）：MANUAL §7.2 没有，**需要你确认是否加**，或指定替代做法（DECISIONS 已记）。
- **GET `/api/pay-methods/compare?cartId&version`** → `PayMethodsCompare`：`cart { cartId, version, merchantName, totalMinor, methodId }`、`methods: PayMethodOption[]`；PayMethodOption = `methodId, label, network, eligible, ineligibleReasons[], consumerFeeMinor|null, consumerCostMinor|null, feeConditions|null, estRewardMinor|null, rewardConditions|null, settlement, sourceUrl|null, observedAt, costRank|null`。**null 表示未核实，前端显示"未核实"，不当作 0**；数组顺序就是排序结果；costRank 只在 eligible 且成本已知的方式中给。
- **GET `/api/ledger`** → `{ groups: LedgerGroup[] }`，新任务在前；LedgerGroup =
  - `task { id, inputText, status, createdAt }`、`mandate { id, version, perTxnMinor, totalMinor, maxPurchases, expiresAt }`（任务执行时那一版）、`runMode`、`candidates[{ productId, name, merchantName, totalMinor, outcome, chosen }]`；
  - `decisions: LedgerDecision[]` = DecisionRecord + `snapshot { remainingMinor, remainingPurchases, totalMinor|null, methodId|null }`。**这些是判定当时的值，阶段 4A 要求来自数据库记录、不现场重算，需要你在写 decisions 时一并保存**（现 decisions 表只有 rules 与 mandate_version）；
  - `attempts[{ id, orderId, status: pending|settled|declined, reasonCode|null, reason|null, createdAt }]`；
  - `receipt { orderId, orderStatus, transactionId, merchantName, items, subtotalMinor, shippingMinor, consumerFeeMinor, totalMinor, methodId, paidAt, entries[{ account, amountMinor }], support: SupportTicket|null } | null`；entries 的 account 请给展示名（如"买家钱包 Alex"）。
  - **POST `/api/orders/[id]/support`** 请求 `{ type: "refund"|"return", reason }`，响应 `SupportTicket { id, type, reason, status: "manual_review", createdAt }`，重复提交返回同一工单（与阶段 3B 一致）。

### 2 S1 预期：同价 HK$138 时会选 B 家，不是 A 家

A 家品牌甲 2L HK$118 + 运费 20 与 B 家品牌甲 2L HK$108 + 运费 30 含运费都是 HK$138。§6.1 排序"含运费升序 → 送达天数"会选 B 家（1 天送达，A 家 3 天）；§10 S1 写的是 A 家。金额、余额、授权剩余（162、1 次）不受影响，只是商家入账账户不同。戚译匀的 README 也指出这一点，并要求不为展示 A 家去强改排序或价格。**请你定一个：把 S1 预期改为 B 家（最简单，只改 §10 文字、S1 集成测试断言和展位稿）；或改排序规则（例如同价按注册时间长者优先，需改 §6.1）。** 写 S1 集成测试前需要定。

### 3 戚译匀数据合并要做的三个决定

详情见我本地的 `qi-fixtures` 分支（未推送，只在李婧萱电脑上）和本文件"试合并戚译匀 / Ellan 数据交付"一条；原始文件在 Hackathon 工作目录的 `fixtures/`、`docs/rates/`。

1. **Tap & Go 手续费 null 的契约、种子和迁移。** `src/contracts/schemas.ts` 的 `PaymentMethod.consumerFeeMinor` 现要求字符串，Zod 会报错；`payment_methods.consumer_fee_minor` 为 NOT NULL，种子会失败。要定：契约是否允许 null；迁移改成可空，还是未核实的方式不入库；结算和引擎怎么处理"手续费未知"（戚译匀建议 `INFO_MISSING`，blocking，确认不能放行；或在 ROUTE 判为不可用）。前端已按 null = 未核实处理。
2. **商品和预览 ID 改名与已部署数据库的旧数据。** 她把 `A-LD-001` 改成 `A-LAUNDRY-01`、`cheap_familiar` 改成 `auto-household` 等。影响 `scripts/validate-fixtures.ts`、`tests/unit/mandate-preview.test.ts`、`src/lib/mock-tasks.ts`；而且种子按 id upsert，已部署的 Supabase 里旧商品不会被删，目录会出现新旧两套。要定：接受新 ID 并对部署库做一次 reset，还是改回旧 ID。
3. **两套 validate-fixtures 选哪套。** 仓库阶段 1 的 `scripts/validate-fixtures.ts`，与 Hackathon 目录里的版本（导出 `validateFixtures()`，含截图 SHA-256 校验，`tests/unit/fixtures.test.ts` 依赖它）不同，需要保留一套。

### 4 其他需要你知道的

- 示例数据里 mock-s1/s2/s3 改为同一授权书的 v1/v2/v3（单笔 150/200/100），只影响示例，不影响接口。
- `/pay-methods` 的 settlement 显示依赖 `SETTLEMENT_LABEL`（目前只有 "instant" 和 "T+1 (simulated)"），如果你的取值不同告诉我。
- 本轮没有改 `src/server/`、`src/contracts/`、`migrations/`、`fixtures/`、`package.json`；没有连任何数据库；没有合并 main。