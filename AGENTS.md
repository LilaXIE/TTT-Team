# MandateWallet — Agent rules

本仓库是 HacKU 2026 FinTech PS1 的 48 小时黑客松项目。产品与技术规格在 docs/MANUAL.md，它是唯一依据；本文件只列出不可违反的不变量。分阶段开发指令在 docs/CURSOR_PROMPTS.md。

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
- 每个阶段结束运行 `npm run typecheck && npm run lint && npm run test:unit` 并修到通过。
- 用户能看到的更新做完就提交，推到 GitHub 的 `lilaxie-ui-redesign` 和 `integrate`，并等到 Vercel 生产部署 Ready。不要等用户再确认一次才推。
- 不要新增 docs/MANUAL.md 未列出的功能、页面、表。需要取舍时选最简单的实现，并在 docs/DECISIONS.md 追加一行。
- 所有 npm scripts 必须能在 Windows PowerShell 下运行（用 cross-env 或 Node 脚本设置环境变量，不用 bash 语法）。
- 中文界面，保留 Trust / E-commerce / Agent / Payment 英文标签。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
