# 决策记录

每行一条：日期 时间 | 决定 | 原因。Cursor 在 Manual 有空白时做出的默认选择也记在这里。

- 2026-10-02 22:40 | 单一 Next.js 16 应用（TS），`pg` + SQL 迁移文件，不用 ORM | 减少学习成本，结算 SQL 直接可读
- 2026-10-02 22:40 | 本地开发默认连托管 Postgres（Supabase/Neon）；compose.yaml 供有 Docker 的机器复现 | 队长机器无 Docker
- 2026-10-02 22:40 | shadcn 组件先加 12 个，dialog/textarea 阶段 1 按需补 | 初始化时网络中断
