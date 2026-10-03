import { z } from "zod";
import { AppError } from "@/contracts/errors";
import { BLOCKING_REVIEW_RULES } from "@/contracts/rules";
import { requireSession } from "@/server/auth/session";
import { query } from "@/server/db/tx";
import { json, readJson, route } from "@/server/http";

const Body = z.object({
  taskId: z.string().uuid(),
  cartId: z.string().uuid(),
  cartVersion: z.number().int().positive(),
});

export const POST = route(async (req: Request) => {
  const user = await requireSession(req);
  const body = Body.parse(await readJson(req));
  const owned = await query<{ id: string }>("SELECT id FROM tasks WHERE id=$1 AND user_id=$2", [body.taskId, user.id]);
  if (!owned.rowCount) throw new AppError("NOT_FOUND", "任务不存在。");

  const decision = await query<{ outcome: string; rules: Array<{ id: string; severity: string; data?: { blocking?: boolean } }> }>(
    `SELECT outcome, rules FROM decisions WHERE task_id=$1 AND cart_id=$2 AND cart_version=$3 ORDER BY id DESC LIMIT 1`,
    [body.taskId, body.cartId, body.cartVersion],
  );
  const row = decision.rows[0];
  if (!row) throw new AppError("NOT_FOUND", "找不到这次购物车的判定。");
  if (row.outcome === "DENY") throw new AppError("VALIDATION_ERROR", "拒绝不能被确认绕过。");
  if (row.outcome === "ALLOW") return json({ ok: true, needed: false });

  const review = row.rules.filter((r) => r.severity === "REVIEW");
  if (review.some((r) => (BLOCKING_REVIEW_RULES as readonly string[]).includes(r.id) || r.data?.blocking === true)) {
    throw new AppError("VALIDATION_ERROR", "这条规则不能靠确认放行。");
  }
  const ruleIds = review.map((r) => r.id);
  await query(
    `INSERT INTO confirmations (user_id, task_id, cart_id, cart_version, rule_ids, expires_at)
     VALUES ($1,$2,$3,$4,$5, now() + interval '30 minutes')`,
    [user.id, body.taskId, body.cartId, body.cartVersion, ruleIds],
  );
  return json({ ok: true, needed: true, ruleIds });
});
