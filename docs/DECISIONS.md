# 决策记录

每行一条：日期 时间 | 决定 | 原因。Cursor 在 Manual 有空白时做出的默认选择也记在这里。

- 2026-10-02 22:40 | 单一 Next.js 16 应用（TS），`pg` + SQL 迁移文件，不用 ORM | 减少学习成本，结算 SQL 直接可读
- 2026-10-02 22:40 | 本地开发默认连托管 Postgres（Supabase/Neon）；compose.yaml 供有 Docker 的机器复现 | 队长机器无 Docker
- 2026-10-02 22:40 | shadcn 组件先加 12 个，dialog/textarea 阶段 1 按需补 | 初始化时网络中断

## 2026-10-02 23:30 nearCapPct 默认值 90 → 95

S1 示例含运费 138 是单笔上限 150 的 92%，按 90% 会被判 REVIEW（NEAR_CAP），与「S1 自动完成」矛盾。默认改为 95%（≥142.5 才先问），S3 的 158 仍为 DENY。用户可在表单里自行调整。

## 2026-10-02 23:30 tsconfig target ES2017 → ES2022

金额用 bigint 字面量（13800n），需要 ES2020+。Node 24 与现代浏览器均支持。


## 2026-10-02 23:50 授权预览不带任务规格

预览三张卡检验的是授权书边界（品类、上限、先问我条件、商家凭证），快照中去掉 minSpec/preferredBrand。否则「维他命 C」会因不满足「2L」被 SPEC_NOT_MET 拒绝，误导用户。演示脚本：上限 150→160 第三张卡 DENY→REVIEW(NEAR_CAP)；→170 变 ALLOW；勾选 supplement 品类后第二张卡 DENY→REVIEW(WATCH_CATEGORY)；保护级别加强后第三张卡命中 NEW_MERCHANT。


## 2026-10-03 01:25 部署：Vercel + Supabase

生产地址 https://mandate-wallet.vercel.app（main 自动部署）。数据库 Supabase Session pooler（5432，支持事务与 SET LOCAL）。Vercel 上连接池默认 2（PG_POOL_MAX 可覆盖），避免多实例耗尽免费版连接数。Function Region 设 sin1 以贴近数据库。


- 2026-10-03 02:50 | /inbox、/pay-methods、/ledger 在真接口返回任何错误（404 未上线、500 等，401 除外）时都回退到 mock 数据并标注"示例数据"和失败原因 | 阶段 2 接口未上线；只区分 404 会让 500 时页面空白，演示更不稳
- 2026-10-03 02:50 | /inbox 取消按钮调用 POST /api/tasks/[id]/cancel（task → cancelled，不动资金）；该接口 MANUAL §7.2 未列，需李启成确认或指定替代 | 阶段 3A 要求 inbox 有"取消"，但没有对应接口
- 2026-10-03 02:50 | /inbox 倒计时用服务端 remainingSeconds，以收到响应的时刻为起点，不用客户端时钟对比 expiresAt | 避免客户端时钟偏差；过期仍以服务端判定为准
- 2026-10-03 02:50 | mock-s1/s2/s3 改为同一授权书的 v1/v2/v3（单笔上限 150/200/100），创建时间错开 10 分钟 | 三个任务的上限不同，放在 /ledger 同一条时间线上需要不同授权版本才自洽- 2026-10-03 03:00 | /pay-methods 响应里 consumerFeeMinor、consumerCostMinor、estRewardMinor 允许 null（= 未核实），null 不当作 0、不参与成本排序；排序结果由服务端给 costRank，前端按数组原顺序渲染 | 戚译匀核实 Tap & Go 手续费无法确认；现 contracts 的 PaymentMethod 要求字符串，需李启成在合入费率时一并决定
- 2026-10-03 03:00 | /pay-methods 不带 cartId 或带 mock-* cartId 时直接显示 mock 购物车；/task 示例页也显示"查看支付方式比较"链接 | 演示时可从任一示例任务点进比较页- 2026-10-03 03:10 | /ledger 每条判定的"为什么"读取响应里的 snapshot（当时剩余额度、次数、含运费总额、支付方式），前端不重算；需要阶段 2 在写 decisions 时把这些值存进 rules/data 或单独字段 | 阶段 4A 要求"全部来自数据库记录，不现场重算"，现 decisions 表只存 rules 与 mandate_version
- 2026-10-03 03:10 | 售后弹窗用页面内固定定位的 div 实现，不新增 shadcn dialog 组件；类型只给"退款 / 退货"两种 | 最简单；与阶段 3B 的 support 请求体 { type: 'refund'|'return', reason } 对齐