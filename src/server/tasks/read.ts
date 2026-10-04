import { AppError } from "@/contracts/errors";
import { query } from "@/server/db/tx";

export async function readTask(userId: string, id: string) {
  const task = await query<{
    id: string;
    status: string;
    input_text: string;
    mandate_id: string;
    created_at: Date;
  }>(
    `SELECT id, status, input_text, mandate_id, created_at FROM tasks WHERE id=$1 AND user_id=$2`,
    [id, userId],
  );

  if (task.rowCount === 0) {
    throw new AppError("NOT_FOUND", "任务不存在。");
  }

  const run = await query(
    `SELECT mode, steps, candidates FROM agent_runs WHERE task_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [id],
  );

  const decisions = await query(
    `SELECT checkpoint, outcome, rules, cart_id, cart_version, created_at FROM decisions WHERE task_id=$1 ORDER BY id`,
    [id],
  );

  const cart = await query<{
    outcome: string;
    cart_id: string;
    cart_version: number;
    items: Array<{ productId?: string; name?: string }>;
    total_minor: string;
    merchant_name: string;
    method_id: string;
    context: { selection?: string };
  }>(
    `SELECT d.outcome, d.cart_id, d.cart_version, d.context, cv.items, cv.method_id, cv.total_minor::text AS total_minor, m.name AS merchant_name
     FROM decisions d
     JOIN cart_versions cv ON cv.cart_id = d.cart_id AND cv.version = d.cart_version
     JOIN carts c ON c.id = d.cart_id
     JOIN merchants m ON m.id = c.merchant_id
     WHERE d.task_id = $1 AND d.cart_id IS NOT NULL AND d.checkpoint = 'CANDIDATES'
     ORDER BY d.id DESC
     LIMIT 1`,
    [id],
  );
  const cartRow = cart.rows[0];
  const cartItem = cartRow?.items?.[0];

  const paid = await query<{ cart_id: string; cart_version: number; total_minor: string; items: Array<{ productId?: string; name?: string }>; merchant_name: string }>(
    `SELECT o.cart_id, o.cart_version, o.total_minor::text AS total_minor, cv.items, m.name AS merchant_name
     FROM orders o
     JOIN cart_versions cv ON cv.cart_id = o.cart_id AND cv.version = o.cart_version
     JOIN merchants m ON m.id = o.merchant_id
     WHERE o.task_id = $1 AND o.user_id = $2 AND o.status = 'paid'
     ORDER BY o.paid_at DESC NULLS LAST
     LIMIT 1`,
    [id, userId],
  );
  const paidRow = paid.rows[0];
  const paidItem = paidRow?.items?.[0];

  return {
    task: task.rows[0],
    run: run.rows[0] ?? null,
    decisions: decisions.rows,
    cart:
      cartRow && cartItem?.productId && cartItem.name
        ? {
            cartId: cartRow.cart_id,
            cartVersion: cartRow.cart_version,
            outcome: cartRow.outcome,
            productId: cartItem.productId,
            name: cartItem.name,
            merchantName: cartRow.merchant_name,
            totalMinor: cartRow.total_minor,
            methodId: cartRow.method_id,
            explicit: cartRow.context.selection === "explicit",
          }
        : null,
    paid:
      paidRow && paidItem?.productId && paidItem.name
        ? {
            cartId: paidRow.cart_id,
            cartVersion: paidRow.cart_version,
            productId: paidItem.productId,
            name: paidItem.name,
            merchantName: paidRow.merchant_name,
            totalMinor: paidRow.total_minor,
          }
        : null,
  };
}
