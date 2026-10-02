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
