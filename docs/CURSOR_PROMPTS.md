# MandateWallet 分阶段 Cursor 提示词 v2

配套《HacKU_2026_Manual_v2.md》。使用方法：

1. 新建公开仓库 `mandate-wallet`，把 Manual v2 复制为仓库内 `docs/MANUAL.md`，把下面第 A 部分保存为仓库根目录 `AGENTS.md`，首个 commit。
2. 按顺序把阶段提示词整段粘贴给 Cursor（Agent 模式）。**一个阶段跑通、验收通过、commit 之后再进下一个阶段。** 不要一次粘多个阶段。
3. 每个阶段末尾有"验收"清单，由驱动该阶段的人逐项手动核对后再合并到 `main`。
4. 阶段 0、1、3A、4A 由李婧萱驱动；阶段 2、3B、4B 由李启成驱动。两人并行时各自在 `feat/ui-*`、`feat/core-*` 分支。
5. Cursor 若提出与 `docs/MANUAL.md` 不一致的方案，以 Manual 为准；若 Manual 本身有空白，让它选最简单的实现并在 `docs/DECISIONS.md` 记一行。

---

## A. 仓库 `AGENTS.md`（全文复制）

```markdown
# MandateWallet — Agent rules

本仓库是 HacKU 2026 FinTech PS1 的 48 小时黑客松项目。产品与技术规格在 docs/MANUAL.md，它是唯一依据；本文件只列出不可违反的不变量。

## 先读
- 写任何 Next.js 代码前，先读 node_modules/next/dist/docs/ 中与 App Router、Route Handlers、Server Components 相关的文档。本项目用 Next.js 16，API 与你训练数据中的版本可能不同。
- 写任何业务代码前，先读 docs/MANUAL.md 对应章节（§3 数据模型、§5 引擎、§6 结算、§7 接口）。

## 不变量（违反即为 bug）
1. 规则引擎 `src/server/rules/engine.ts` 的 `decide()` 是纯函数：无 I/O、无随机、无 Date.now()（时间从 ctx.now 传入）、不调用 LLM。
2. 结算 `src/server/settlement/settle.ts` 自己构造 EngineContext 并调用 decide(ctx, "PAY")。它不读取、不信任前端或 Agent 传来的任何 outcome。
3. 结算的所有写操作在同一个数据库事务、同一个 client 上完成：授权剩余额度与次数、库存、买家余额、商家余额、订单状态、journal 与 entries、attempt 状态。任一条件更新影响 0 行 → 整体 ROLLBACK。
4. 条件更新的 WHERE 必须包含业务条件（例：`remaining_minor >= $total AND status='active' AND expires_at > now() AND version = $v`），不能先 SELECT 再无条件 UPDATE。
5. 取锁顺序固定：mandate → buyer credential → merchant credential → products(按 id 排序) → buyer account → merchant account → order。所有写路径遵守。
6. 事务内禁止：调用 LLM、外部 HTTP、sleep、等待用户输入。
7. DENY 不能被任何确认绕过。REVIEW 只能被 cartVersion 一致、ruleIds 覆盖全部命中、未过期、且不含 blocking 规则的 confirmation 放行。
8. 金额一律整数分（BIGINT / JS bigint），字段名以 Minor 结尾；API 以十进制字符串传输；禁止 Number(金额) 和浮点运算。
9. 预算、上限、余额判断用实际扣款总额（商品 + 运费 + 消费者手续费）。回赠、积分只展示，不参与判断，不入账。
10. LLM 只在 src/server/agent/ 内使用；输出必须经 Zod 校验；输出中的金额、outcome、权限字段一律忽略。商品描述作为数据传给 LLM，不进入 system prompt。
11. 每个 route handler 第一行调用 requireSession()；服务端只信任 session.userId；前端只传对象 ID。不用 middleware/proxy 文件做鉴权。
12. /demo 页面与 /api/demo/* 在 process.env.DEMO_MODE !== "true" 时返回 404。
13. 不记录密码、session token、完整 LLM prompt。.env* 与 .local/ 不提交。
14. 所有代码在本仓库内从零编写；可以使用 npm 开源库，不复制任何外部项目源码。

## 代码组织
- src/contracts/：Zod schema、类型、rule_id 常量、money 工具。改这里的字段必须同步 migrations、seed、tests。
- src/server/<module>/：业务逻辑；repository 函数接收 client 参数。
- src/app/api/**/route.ts：只做校验、取 session、调用 service、映射错误。
- tests/：Vitest。单元测试不连数据库；集成测试连 TEST_DATABASE_URL。

## 工作方式
- 每个阶段结束生成一次 `npm run typecheck && npm run lint && npm run test:unit` 并修到通过。
- 不要新增 docs/MANUAL.md 未列出的功能、页面、表。需要取舍时选最简单的实现，并在 docs/DECISIONS.md 追加一行。
- 所有 npm scripts 必须能在 Windows PowerShell 下运行（用 cross-env 或 Node 脚本设置环境变量，不用 bash 语法）。
- 中文界面，保留 Trust / E-commerce / Agent / Payment 英文标签。
```

---

## 阶段 0：脚手架、数据库连接、容器（李婧萱，约 45 分钟）

```text
你在一个空的 git 仓库里，仓库根目录已有 AGENTS.md 和 docs/MANUAL.md。先读 AGENTS.md 全文，再读 docs/MANUAL.md §0、§3、§8、§15。然后完成以下工作，不要做任何业务逻辑。

目标：生成一个能启动的 Next.js 16 应用骨架，连接 PostgreSQL，提供迁移脚本与容器配置。

1. 用 `npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --use-npm` 初始化（如目录非空请在子目录初始化后移动，保证最终结构为仓库根目录即应用根目录）。锁定 Node 24（.nvmrc 写 24）。
2. 安装依赖：pg、zod、bcryptjs、vitest、@vitest/coverage-v8（可选）、cross-env、tsx、dotenv。初始化 shadcn/ui（`npx shadcn@latest init`，默认风格），添加 button、card、input、label、select、checkbox、badge、dialog、table、tabs、sonner、progress、separator 组件。
3. 创建目录结构：严格按 docs/MANUAL.md §3.2（src/contracts、src/server/{db,auth,trust,mandates,rules,catalog,agent,payments,settlement,ledger,history}、migrations、fixtures、scripts、tests/{unit,integration,scenarios}）。空模块放一个 index.ts 导出占位。
4. src/server/db/pool.ts：pg Pool，读取 DATABASE_URL；src/server/db/tx.ts：`withTransaction(fn)`，支持 `SET LOCAL lock_timeout/statement_timeout`，在 40001/40P01 时整事务重试最多 2 次，其他错误直接抛出；确保失败的连接被 release 且不复用。
5. scripts/migrate.ts：按文件名顺序执行 migrations/*.sql，用 schema_migrations 表记录；scripts/seed.ts 与 scripts/reset-demo.ts 先留空壳（阶段 1 填）。脚本用 dotenv 加载 .env.local。
6. src/contracts/money.ts：bigint 分 ↔ "HK$1,234.50" 格式化、从十进制字符串解析、相加相减；禁止 Number。
7. src/contracts/errors.ts：AppError { code, message, retryable, correlationId, status }，以及 route handler 用的 toResponse()。
8. GET /api/health：返回 { ok: true, db: <SELECT 1 成功>, demoMode }。
9. .env.example：DATABASE_URL、TEST_DATABASE_URL、DEMO_MODE=true、SESSION_SECRET、LLM_BASE_URL、LLM_MODEL、LLM_API_KEY（可空）。
10. Dockerfile（多阶段，node:24-alpine，`npm ci && npm run build`，运行 `npm run start`）；compose.yaml：服务 db（postgres:18-alpine，端口仅绑定 127.0.0.1:5432，持久化 volume，healthcheck）和 app（依赖 db healthy，环境变量 DATABASE_URL 指向 db，启动命令先跑 migrate 和 seed 再 start）。
11. package.json scripts：dev、build、start、lint、typecheck（tsc --noEmit）、db:migrate、db:seed、demo:reset、test:unit（vitest run tests/unit）、test:integration（vitest run tests/integration，需要 TEST_DATABASE_URL）、test:scenarios、fixtures:validate（阶段 1 实现）。全部兼容 PowerShell。
12. README.md：三种启动方式（A. 本地 Node + 托管 Postgres 的 DATABASE_URL；B. docker compose up；C. 本地 Node + 本地 Postgres），以及演示账号占位。
13. docs/DECISIONS.md：建立文件，写下本阶段做出的任何默认选择。

验收（由我手动执行）：
- `npm run typecheck && npm run lint` 通过。
- 填好 .env.local 后 `npm run db:migrate` 成功（migrations 目录此时允许为空或只有 0000_schema_migrations）。
- `npm run dev` 后访问 /api/health 返回 db:true。
- `docker compose config` 无报错（本机可能没有 Docker，仅校验文件；实际启动由队友在有 Docker 的机器验证）。

完成后输出：修改的文件列表、我需要手动做的事（例如填 .env.local）。不要提交 git，由我提交。
```

---

## 阶段 1：契约、迁移、种子、登录、引擎、授权表单与预览（李婧萱，约 2.5 小时）

```text
先读 AGENTS.md，再读 docs/MANUAL.md §2、§3.3、§4、§5、§8。本阶段完成数据层、规则引擎、登录和授权书页面。不做 Agent、不做结算、不做支付比较。

一、契约（src/contracts/）
1. schemas.ts：用 Zod 定义 MandateDraft（§4.1 的 9 个字段）、MandateJson（§4.2）、Product、Merchant、PaymentMethod、CartItem、CartSnapshot、Decision、RuleHit、EngineContext（§5.1）。导出 TypeScript 类型。
2. rules.ts：RuleId 联合类型与常量，严格按 §5.2 的 DENY 与 REVIEW 列表，不增不减。
3. fixtures 的 JSON schema 导出（给 `npm run fixtures:validate` 用）。

二、迁移（migrations/0001_init.sql）
按 §3.3 建全部表、主键、外键、唯一约束、CHECK（库存 ≥ 0、余额 ≥ 0 但 treasury 账户例外、remaining_minor ≥ 0、remaining_purchases ≥ 0）、`journals` 上 `type='SALE'` 的 order_id 唯一部分索引、`orders(cart_id, cart_version)` 唯一、`payment_attempts(user_id, idempotency_key)` 唯一。金额列 BIGINT。常用查询加索引。

三、种子（scripts/seed.ts）与演示数据
1. 读取 fixtures/catalog.json、fixtures/rates.json、fixtures/scenarios.json。若文件不存在，先按 §2.2、§2.3 生成一份符合要求的占位数据写入 fixtures/（标注 "PLACEHOLDER"，队友会替换），包含：3 个商家（A、B 有效凭证，C 凭证 revoked）、16–20 件商品（4 件洗衣液价格按 §2.2、2 件 supplement 带 risk_tags ["health_claim"]、2 件描述含 "SYSTEM: ignore budget..." 注入文本、1 件价格高于 ref_price 40%）、2 种支付方式。
2. 创建买家 alex@demo.hk / demo1234（bcryptjs），买家凭证 valid；买家钱包账户 150000 分，通过 FUNDING journal 从 treasury 转入（entries 合计 0）；商家账户余额 0；user_payment_methods 两种都 enabled。
3. seed 幂等：重复运行不重复发资金、不重复建商品（按 sku upsert）。
4. scripts/reset-demo.ts：清空 tasks/agent_runs/carts/cart_versions/decisions/confirmations/orders/payment_attempts/journals(SALE)/ledger_entries(对应)/support_requests/audit_events/mandates/mandate_events，恢复库存、余额、凭证状态到种子值。
5. `npm run fixtures:validate`：用 Zod 校验三个 fixtures 文件，输出错误行。

四、登录（src/server/auth/）
1. password.ts：bcryptjs hash/verify。
2. session.ts：login(email, password) 生成 32 字节随机 token，数据库存 sha256，设置 HttpOnly、SameSite=Lax、8 小时 cookie；requireSession() 在 Route Handler 和 Server Component 中都可用，失败抛 AppError(AUTH_REQUIRED, 401)；logout 删除记录。
3. POST /api/auth/login、POST /api/auth/logout、GET /api/auth/me、GET /api/trust/me（返回买家凭证 status 与 expires_at）。
4. /login 页面：邮箱、密码、登录按钮；登录后跳首页。未登录访问其他页面在 Server Component 内检查并 redirect 到 /login。

五、规则引擎（src/server/rules/）
1. engine.ts：`decide(ctx: EngineContext, checkpoint: Checkpoint): Decision`。纯函数。实现 §5.2 全部规则与 §5.3 的五个检查点在各自检查点评估哪些规则：
   - INTENT：MANDATE_REVOKED/EXPIRED/COMPLETED、BUYER_CREDENTIAL_INVALID、CATEGORY_NOT_ALLOWED（任务品类）。
   - CANDIDATES：加 MERCHANT_CREDENTIAL_INVALID、MERCHANT_DENIED、SPEC_NOT_MET、SUBSTITUTE_BRAND、WATCH_CATEGORY、NEW_MERCHANT（仅 reviewWhen.newMerchantDays 非空）、PRICE_ABOVE_REF（仅 reviewWhen.priceAboveRefPct 非空）。
   - QUOTE：加 CAP_PER_TXN、CAP_TOTAL、USES_EXHAUSTED、NEAR_CAP、QUOTE_EXPIRED、INFO_MISSING（cart 或 merchant 缺失时，data.blocking=true）。
   - ROUTE：加 PAYMENT_METHOD_NOT_ALLOWED。
   - PAY：INTENT + CANDIDATES（对 cart 内每个商品）+ QUOTE + ROUTE 全部。
   优先级 DENY > REVIEW > ALLOW。Decision.rules 包含全部命中（不是只返回第一条）。
2. messages.ts：每个 rule_id 一条中文模板（按 §5.2 文案），用 {var} 占位，提供 render(ruleHit) 函数。该文件只含字符串与 render，便于非开发队友修改。
3. confirmation.ts：`isCovered(decision, confirmation, cartVersion, now)`：cartVersion 相等 ∧ confirmation.ruleIds ⊇ decision 中所有 REVIEW 的 id ∧ 未过期 ∧ 不含 blocking。
4. tests/unit/engine.test.ts：每条 DENY/REVIEW 规则至少 1 个用例；优先级 1 例（同时命中 DENY 与 REVIEW → DENY）；reviewWhen.newMerchantDays 为 null 时 NEW_MERCHANT 不触发 1 例；isCovered 正反各 1 例；含注入文本的商品描述不影响任何规则 1 例。不连数据库。

六、授权书（src/server/mandates/、页面）
1. service.ts：createMandate(userId, draft) → 编译为 MandateJson（§4.2；protectionLevel=enhanced 时若用户未手动设置则填 newMerchantDays=30、priceAboveRefPct=20），写入 mandates（remaining_minor=totalMinor、remaining_purchases=maxPurchases、version=1）与 mandate_events；getMandate；revokeMandate（status=revoked、revoked_at、事件）。
2. preview(draft)：读取 fixtures/scenarios.json 的三个固定示例（低价熟悉商家含运费 138；supplement 商品；含运费 158），为每个示例构造 EngineContext（mandate 用草稿编译出的快照，剩余额度=总额，次数=max，凭证 valid，now=当前），跑 decide(…, "QUOTE") 后再对商品跑 "CANDIDATES" 并合并 rules，返回三个 Decision。
3. 接口：POST /api/mandates/preview、POST /api/mandates、GET /api/mandates/[id]、POST /api/mandates/[id]/revoke。
4. 页面 /mandate/new：§4.1 的表单（移动优先，单列），字段变化 300ms 防抖调用 preview，右侧/下方三张卡："会直接买 / 会先问你 / 会被拒绝"，每张显示示例描述、Decision.outcome、命中规则的人话。底部"签发授权"→ 创建后跳 /mandate/[id]。
5. 页面 /mandate/[id]：把 JSON 渲染成人话条款列表（"第 1 条：只买 household 品类"…），显示剩余额度、剩余次数、有效期、状态，撤销按钮（二次确认）。
6. 首页 / 暂时只显示：当前有效授权卡（剩余额度环用 progress）、"新建授权"按钮、登出。

验收：
- `npm run db:migrate && npm run db:seed && npm run fixtures:validate` 成功；再次 seed 不重复发资金。
- `npm run test:unit` 全绿，用例数 ≥ 15。
- 登录 alex@demo.hk 成功；错误密码失败；未登录访问 /mandate/new 被重定向。
- /mandate/new：把单笔上限从 150 改为 160，第三张卡从"会被拒绝"变为"会直接买"；把保护级别改为加强，第一张卡若示例商家为新商家则变为"会先问你"。
- 签发后 /mandate/[id] 正确显示；撤销后状态为 revoked。

完成后列出：fixtures 中标记 PLACEHOLDER 的内容（给戚译匀替换）、messages.ts 路径（给邹思远审校）。
```

---

## 阶段 2：目录、报价、Agent 执行、结算事务（李启成，约 4 小时）

```text
先读 AGENTS.md（特别是不变量 2–9），再读 docs/MANUAL.md §5.3、§6、§7.2、§10 的 S1/S3/S4、§11。阶段 1 已完成契约、迁移、种子、引擎、登录、授权书。本阶段打通"创建任务 → Agent 比较 → 引擎判定 → 自动结算"的闭环，先用规则 fallback，不接 LLM。

一、目录与报价（src/server/catalog/）
1. search.ts：searchProducts(query, { categories }) → 对 name/brand/category 做 ILIKE 匹配，只返回 status='published'、stock_qty>0 且商家凭证 valid 的商品，同时返回商家凭证状态供引擎使用（C 家商品也要能被单独查询到以便演示 DENY，因此提供 includeUnverified 选项）。
2. quote.ts：quoteCart(merchant, items, methodId) → subtotal、shipping（满减规则）、consumerFee（来自 payment_methods）、total、quoteExpiresAt = now + 5 分钟、hash = sha256(规范化 items+merchant+total+method)。

二、购物车版本（src/server/catalog/cart.ts）
createCartVersion(taskId, merchantId, items, methodId) → 若 cart 不存在则建；插入 cart_versions（version 递增、快照、hash）；返回快照。

三、Agent 执行（src/server/agent/）
1. fallback.ts：extractIntentFallback(text) → 关键词（去掉"帮我/补/一瓶"等停用词）、qty（默认 1）、minSpec（解析 "2L 以上"/"2000ml" 为 volumeMl）、maxPriceMinor（解析 "150 以内"）。解释模板 explainFallback(candidates)。
2. llm.ts：OpenAI 兼容客户端（LLM_BASE_URL/LLM_MODEL/LLM_API_KEY），8 秒超时、1 次重试；本阶段只写接口与 Zod 校验，默认不启用（无 key 时 mode=fallback）。
3. run.ts：按 §6.1 的 9 步实现 runTask(taskId)。步骤写入 agent_runs.steps（tool、输入摘要、输出摘要、耗时）。每一步的引擎调用写 decisions。首选 DENY 且次选 ALLOW 时自动切换并记录 step "switched_candidate"。REVIEW 时 task.status='awaiting_confirmation'。ALLOW 时调用 settle()。
4. 工具白名单：search_catalog、quote、create_cart_version、engine_decide、settle。LLM 不能调用 settle。

四、结算（src/server/settlement/settle.ts、src/server/ledger/post.ts）
严格按 docs/MANUAL.md §6.3 的伪代码实现 settle({ orderId | cartId+version, userId, idempotencyKey, methodId })：
1. 若订单不存在则在事务内从 cart_version 创建 pending 订单（orders(cart_id, cart_version) 唯一）。
2. 幂等：payment_attempts 插入冲突时比较 request_hash，相同返回保存结果，不同抛 IDEMPOTENCY_CONFLICT(409)。
3. 按不变量 5 的顺序 SELECT … FOR UPDATE。
4. 用锁内数据构造 EngineContext，decide(ctx, "PAY")。DENY → 记录 attempt declined 与 decisions，提交，返回；REVIEW → 用 isCovered 检查 confirmations，不覆盖则返回 RISK_CONFIRMATION_REQUIRED。
5. 读取 demo 设置（简单表 demo_settings(key, value) 或复用 audit；若阶段 1 没建，新增迁移 0002）："next_issuer_decline" 为 true 时写 declined ISSUER_DECLINED 并清除标记，提交，返回。
6. 条件更新：mandates（remaining_minor、remaining_purchases，WHERE 含 version/status/expires_at/余量条件）→ products 库存 → 买家 account → 商家 account → orders status pending→paid。任一 rowCount=0 → 抛对应 AppError（CAP_TOTAL/USES_EXHAUSTED/MANDATE_REVOKED/OUT_OF_STOCK/INSUFFICIENT_FUNDS/ORDER_NOT_PENDING），由 withTransaction 回滚。
7. ledger/post.ts：postSale(client, orderId, buyerAcc, merchantAcc, total) 写 journals(SALE) 与两条 entries，断言合计为 0。
8. remaining_purchases 变为 0 → mandates.status='completed'；tasks.status='completed'。
9. attempt → settled，result 保存收据 { orderId, transactionId(=attempt id), totalMinor, methodId, merchant, items, paidAt, decision }。
10. 外层：40001/40P01 由 withTransaction 重试；lock_timeout → PAYMENT_BUSY(503, retryable=true)。

五、接口
POST /api/tasks（body: { mandateId, text }）→ 创建 task、同步 runTask、返回 { task, run, decisions, order? }；GET /api/tasks/[id]；POST /api/orders/[id]/pay（Header Idempotency-Key 必填）；GET /api/orders/[id]；GET /api/ledger（本人 tasks → decisions → orders → attempts 关联）。

六、测试（tests/integration/，连接 TEST_DATABASE_URL，每个测试前 reset-demo）
1. settle.s1.test.ts：种子任务"帮我补一瓶洗衣液，2L 以上，150 以内"→ 一个 paid 订单、SALE journal 合计 0、买家余额 150000−13800、商家 +13800、mandate remaining_minor=16200、remaining_purchases=1、库存 −1。
2. settle.s3.test.ts：单笔上限 150、首选含运费 158 → DENY CAP_PER_TXN 并切换次选；撤销 mandate 后 pay → MANDATE_REVOKED，无资金变化；C 家商品 → MERCHANT_CREDENTIAL_INVALID。
3. settle.s4.test.ts：同一订单、同一幂等键 Promise.all 10 次 → 1 次扣款，其余返回同一结果或 PAYMENT_BUSY；剩余额度 20000 时两笔 14000 订单并发 → 最多 1 笔 paid，另一笔 CAP_TOTAL；同一订单不同幂等键并发 → 最多 1 个 SALE journal。
4. settle.fault.test.ts：在扣库存之后注入异常（通过可选的测试钩子）→ 全部回滚，无 attempt settled、无 entries。

验收：
- `npm run test:integration` 全绿。
- 用 curl/Bruno：登录 → 创建授权（单笔 150、总额 300、2 次）→ POST /api/tasks → 返回 paid 订单；GET /api/ledger 能看到完整链路。
- 把授权单笔改为 100 → 任务 DENY，无资金变化。
- 重启 dev server 后数据仍在。

完成后列出：新增迁移文件、接口的请求/响应示例（给前端对接）、docs/DECISIONS.md 新增行。
```

---

## 阶段 3A：任务页、确认与 inbox、支付方式比较、LLM 接入（李婧萱，约 3 小时）

```text
先读 AGENTS.md，再读 docs/MANUAL.md §6.1、§6.2、§7.1、§9、§10 的 S2。阶段 2 已提供 /api/tasks、/api/orders、/api/ledger。本阶段把闭环做成界面，并加入人工确认与支付方式比较。

一、确认（src/server/mandates/confirmations.ts + 接口）
1. POST /api/confirmations（body: { taskId, cartId, cartVersion, ruleIds }）：校验 task 属于当前用户且 status='awaiting_confirmation'；写 confirmations（expires_at = now + 30 分钟）；然后重新执行 runTask 的第 8–9 步（重新报价 → 若新 cart hash ≠ 确认时 hash，则新建 cart_version，确认自然不覆盖 → 仍为 REVIEW；否则 decide → ALLOW 则 settle）。返回最新 task 状态。
2. GET /api/inbox：当前用户 awaiting_confirmation 的任务与对应 decisions、剩余秒数。过期（30 分钟）后 task.status='cancelled'（在查询时惰性更新）。

二、支付方式比较（src/server/payments/compare.ts + 接口）
GET /api/pay-methods/compare?cartId&version：按 §9 对每种方式计算 eligible（授权允许 ∧ 商家接受 ∧ 用户启用）、consumerCostMinor、estReward（按 rates.json 的 rewards 计算，附 conditions、sourceUrl、observedAt）。仅 eligible 项排序。返回数组。

三、LLM 接入（src/server/agent/llm.ts）
1. extractIntentLLM(text)：system prompt 只描述输出 JSON 结构 { query, qty, minSpec:{volumeMl?}, maxPriceMinor? }，Zod 校验，失败或超时 → fallback。
2. explainLLM(candidates, decision)：输入为工具结果（商品名、含运费总额、送达天数、商家状态、命中规则），要求 1–2 句中文解释，只能引用输入字段；输出中若出现 "ALLOW/DENY/HK$ 数字与输入不符/ignore/SYSTEM" 等，丢弃并用模板。商品 description 字段不传入。
3. agent_runs.mode 记录 'llm' 或 'fallback'；/demo 可切换强制 fallback（阶段 3B 提供 API，这里先读环境变量 FORCE_FALLBACK）。

四、页面
1. / 首页：有效授权卡 + 剩余额度环；"把任务交给 Agent"输入框（默认填示例句）+ 提交 → POST /api/tasks → 跳 /task/[id]；待确认数徽标 → /inbox；最近 3 条记录。
2. /task/[id]：
   - 顶部：任务文本、状态徽标、Agent 模式徽标（LLM / 规则演示模式）。
   - 步骤时间线：agent_runs.steps（工具名、摘要、耗时）。
   - 候选对比表（最多 3 行）：商品、商家（凭证状态徽标、注册天数）、商品价、运费、含运费总额、送达、规则标注（REVIEW 黄 / DENY 红），"为什么推荐"展开。
   - 决策卡：outcome 大字 + 每条命中规则的人话（messages.render）+ 授权版本号。REVIEW 时显示确认按钮（列出将确认的 ruleIds，30 分钟倒计时）；DENY 时无按钮，显示"修改授权"链接。
   - 支付结果卡：订单号、交易号、支付方式、金额、商家入账、时间；"查看支付方式比较"链接。
   - 轮询：status 为 running 时每 2 秒 GET。
3. /inbox：待确认列表（任务、规则、倒计时、确认/取消）。
4. /pay-methods?cartId&version：两列卡片：资格（通过/不通过及原因）、消费者成本、预计回赠（标"预计"、来源链接、采集时间）、结算时效；底部声明："本次支付由模拟器执行；商家手续费不计入消费者成本；回赠为公开页面观测值。"

验收（S2）：
- 创建允许换品牌的授权，任务首选为不同品牌 → /task 显示 REVIEW SUBSTITUTE_BRAND；/inbox 出现；点击确认 → 变为 paid。
- 确认前用数据库手动把该商品价格 +10 → 确认后仍为 REVIEW（新 cart_version），界面提示"购物车已变化，请重新确认"。
- 无 LLM key 时任务仍完成，徽标显示"规则演示模式"；有 key 时解释文本为 LLM 生成且不含注入文本。
- /pay-methods 两种方式显示正确，FPS 成本 = 总额，卡显示预计回赠与来源。
- 移动端宽度（390px）下所有页面无横向滚动。
```

---

## 阶段 3B：演示控制、撤销路径、剩余测试（李启成，约 2 小时）

```text
先读 AGENTS.md 与 docs/MANUAL.md §6.4、§7.1 的 /demo、§10 的 S3/S4/S5。阶段 2 完成后进行。

一、演示控制（仅 DEMO_MODE）
1. 迁移 0002（若阶段 2 未建）：demo_settings(key text primary key, value jsonb)。
2. 接口：POST /api/demo/credentials/[id]/revoke（商家或买家凭证 → revoked）、POST /api/demo/credentials/[id]/restore、POST /api/demo/issuer-decline（设置 next_issuer_decline=true）、POST /api/demo/force-fallback（切换）、POST /api/demo/reset（调用 reset-demo 逻辑）、POST /api/demo/products/[id]/price（body { priceMinor }，用于 S2 演示购物车变化）。全部写 audit_events。
3. /demo 页面：按钮列表 + 当前状态（凭证状态表、demo_settings）。非 DEMO_MODE 返回 404。

二、撤销路径
1. POST /api/mandates/[id]/revoke 后，任何进行中的 task 在下一次引擎调用 DENY MANDATE_REVOKED；界面文案按 §6.4。
2. tests/integration/revoke.test.ts：撤销与 pay 并发 → 结果为"先提交者生效"，两种结果都接受但资金与状态一致（paid 则账本有记录且 mandate 剩余已扣；declined 则无变化）。

三、售后
POST /api/orders/[id]/support（body { type: 'refund'|'return', reason }）→ support_requests(status='manual_review')，重复提交返回同一工单；不改余额、库存、订单状态。

四、补测试
1. tests/scenarios/s1-s3.test.ts：通过 HTTP（用 fetch 调本地 dev server 或 Next 的 route handler 直接 import）跑 S1、S2（含确认）、S3。
2. tests/unit/injection.test.ts：含注入文本的商品在 CANDIDATES 与 QUOTE 的 Decision 与不含注入文本时完全一致。

验收：
- /demo 撤销商家 A 凭证后，新任务中 A 家商品不再出现在候选，若无其他候选则 DENY MERCHANT_CREDENTIAL_INVALID。
- 设置 issuer-decline 后下一笔 pay 返回 ISSUER_DECLINED，再下一笔正常。
- reset 后余额、库存、凭证恢复种子值，tasks 清空。
- 全部测试绿。
```

---

## 阶段 4A：记录与解释、首页打磨、移动端（李婧萱，约 2.5 小时）

```text
先读 AGENTS.md 与 docs/MANUAL.md §7.1 的 /ledger、§10 的 S5、§1.3。功能已齐，本阶段做记录页与可用性，不加新功能。

1. /ledger：按任务分组的时间线。每个任务：授权版本（链接到 /mandate/[id]，显示当时的上限）→ Agent 候选摘要 → 每个检查点的 Decision（outcome、规则人话）→ 支付尝试（settled/declined 与原因）→ 收据。订单条目上有"申请退款/退货"按钮 → 弹窗填写原因 → POST support → 显示"已提交人工处理；当前订单尚未退款"与工单号。
2. 每条 Decision 可展开"为什么"：列出全部命中规则、当时的剩余额度与次数、含运费总额、支付方式。全部来自数据库记录，不现场重算。
3. 首页：额度环显示"本次授权剩余 HK$X / HK$Y，剩余 N 次"；任务卡显示状态和一句话结果；空状态引导"先签发一份授权"。
4. 全站：Trust / E-commerce / Agent / Payment 四个英文标签作为区块小标题出现在 /task 页的对应区域（凭证与授权 → Trust；候选与购物车 → E-commerce；步骤时间线 → Agent；支付结果与比较 → Payment）。
5. 页脚声明（所有页面）：§1.3 的三句——支付由模拟器执行；费率为观测值；凭证验证仅表示所验证条件通过。
6. 移动端 390px 与桌面 1280px 都检查一遍；表格在窄屏改为卡片。
7. 空状态、加载态、错误态（AppError 的 message + correlationId）统一组件。
8. 不改引擎、不改结算、不改契约。

验收（S5）：完成 S1、S2、S3 各一次后，/ledger 能完整回放三条链路；售后工单可见；刷新与重启后仍在。
```

---

## 阶段 4B：容器验证、README、冷启动（李启成，约 1.5 小时）

```text
先读 AGENTS.md 与 docs/MANUAL.md §3.2、§15。本阶段不改业务代码，只保证可复现与可交付。

1. 在有 Docker 的机器上 `docker compose up --build`：app 容器启动时自动 migrate + seed；浏览器打开 http://localhost:3000 可登录并完成 S1。修复 Dockerfile/compose 中的问题（例如 next build 的 standalone 输出、环境变量传递、等待 db healthy）。
2. 无 Docker 路径：README 的方式 A（托管 Postgres 的 DATABASE_URL）在一台没有本地 Postgres 的机器上验证。
3. README 定稿：产品一句话；四维度在交易中的位置（§0 的列表）；三种启动方式；演示账号；演示脚本（S1→S3→S2→/ledger，每步要点击什么、看什么）；/demo 控制说明；测试命令；已知限制与对外表述边界（§1.3）；使用的开源库与 AI 工具（Next.js、shadcn/ui、pg、zod、bcryptjs、vitest、Cursor、SenseNova、Raccoon Work）。
4. docs/ARCHITECTURE.md：§3.1 的 mermaid 图 + 结算事务伪代码 + 规则表（从 messages.ts 自动生成或手工同步）。
5. `npm run demo:reset` 一键回到演示初始状态；确认两次连续运行无报错。
6. 输出一份"第二台机器从零运行"检查清单，交给李婧萱在她的机器上照做一遍。
```

---

## B. 粘贴前检查

- [ ] 仓库根目录有 AGENTS.md 和 docs/MANUAL.md，且已 commit
- [ ] `.env.local` 已填 DATABASE_URL（托管或本地）、TEST_DATABASE_URL（可与 DATABASE_URL 相同但建议独立库）、DEMO_MODE=true、SESSION_SECRET
- [ ] Cursor 开启 Agent 模式，模型选默认；每个阶段开新对话，首句粘贴整段提示词
- [ ] 阶段完成后由驱动者执行验收，再 `git commit -m "stage N: ..."` 并合并到 main
- [ ] 遇到 Cursor 反复失败（同一问题 3 次）：停止，截图发群，站会决定是否按 §12 砍
