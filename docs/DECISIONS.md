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

