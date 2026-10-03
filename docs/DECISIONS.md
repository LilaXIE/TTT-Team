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


## 2026-10-03 20:40 UI 重做（feat/ui-redesign）：先用模拟数据搭全部页面

- 分支 feat/ui-redesign 从 origin/Nick 切出，只做页面与层次，不接数据库。数据在 src/lib/mock：localStorage 存全局状态（跨标签页同步，用于攻击演示），sessionStorage 存本标签页是本人还是攻击者。旧页面删除，接线代码仍在 origin/Nick，接真实接口时按页替换 store 的 actions。
- 页面以设计讨论中新定的流程为准，超出 MANUAL 的：注册五步、Tap & Go / 快快屋授权页、精选模式（细挑）、付款方式说明、安全与验证等级、地址冷静期、攻击演示面板。
- 精选模式不新增规则：签发时把品类放进 watchCategories，所以每笔都是 REVIEW；偏好只影响推荐排序，不进规则判断。
- 前端预览直接调用纯函数 decideCandidate（同一套规则）；结算时在 mock store 里重新判定一次，不读取页面上显示的结果。DENY 没有确认入口。
- Zev 在原型里是确定性的规则演示模式（src/lib/mock/agent.ts），不调用模型；界面标「规则演示模式（模板）」。
- 演示用时间：放宽上限 / 改地址的冷静期原型里缩成 2 分钟（文案仍写 24 小时规则）；范围内自动付款前留 8 秒可「先别买」。
- 界面一次只显示一种语言（右上角切换），Trust / Agent 等标签也跟着翻译，覆盖 AGENTS.md「保留英文标签」一条。
- 筛选滑块按 10 港元一档的整数档位工作，换算回分时用 bigint，不出现浮点金额。

