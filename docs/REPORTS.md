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