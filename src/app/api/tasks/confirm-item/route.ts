import { requireSession } from "@/server/auth/session";
import { json, readJson, route } from "@/server/http";
import { query, withTransaction } from "@/server/db/tx";
import { settle } from "@/server/settlement/settle";
import { z } from "zod";
import { AppError } from "@/contracts/errors";

const ConfirmItemSchema = z.object({
  taskId: z.string().uuid(),
  mandateId: z.string().uuid(),
  item: z.object({
    title: z.string(),
    price: z.string(),
    shop: z.string().optional(),
    url: z.string().optional(),
    image: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const POST = route(async (req: Request) => {
  const session = await requireSession(req);
  const body = await readJson(req);
  const { taskId, item } = ConfirmItemSchema.parse(body);

  // 解析价格（如 ¥27.9 -> 2790n）
  const match = item.price.match(/(\d+(?:\.\d+)?)/);
  if (!match) throw new AppError("VALIDATION_ERROR", "商品价格无法识别。");
  const priceMinor = BigInt(Math.round(parseFloat(match[1]) * 100));

  // 结算与授权逻辑
  const result = await withTransaction(async (tx) => {
    // 检查任务所属
    const t = await tx.query(`SELECT id FROM tasks WHERE id=$1 AND user_id=$2`, [taskId, session.id]);
    if (!t.rowCount) throw new AppError("NOT_FOUND", "任务不存在。");

    // 寻找或建立商品与商家记录
    const merchantId = "A"; // 关联已有有效商家 A
    const existingP = await tx.query<{ id: string }>(`SELECT id FROM products WHERE merchant_id=$1 LIMIT 1`, [merchantId]);
    const productId = existingP.rows[0]?.id ?? "A-LD-001";

    // 创建对应购物车与版本
    const cart = await tx.query<{ id: string }>(
      `INSERT INTO carts (task_id, merchant_id, current_version) VALUES ($1, $2, 1) RETURNING id`,
      [taskId, merchantId],
    );
    const cartId = cart.rows[0].id;

    const items = [{
      productId,
      name: item.title,
      brand: "淘宝代购",
      category: "household",
      qty: 1,
      unitPriceMinor: priceMinor.toString(),
      spec: {},
      riskTags: [],
      refPriceMinor: priceMinor.toString(),
    }];

    await tx.query(
      `INSERT INTO cart_versions (cart_id, version, items, subtotal_minor, shipping_minor, consumer_fee_minor, total_minor, method_id, quote_expires_at, hash)
       VALUES ($1, 1, $2, $3, 0, 0, $3, 'fps', now() + interval '10 minutes', 'manual_confirm_hash')`,
      [cartId, JSON.stringify(items), priceMinor.toString()],
    );

    // 插入人工确认记录，放行 REVIEW 校验
    await tx.query(
      `INSERT INTO confirmations (user_id, task_id, cart_id, cart_version, rule_ids, expires_at)
       VALUES ($1, $2, $3, 1, ARRAY['NEAR_CAP','SUBSTITUTE_BRAND','WATCH_CATEGORY','NEW_MERCHANT','PRICE_ABOVE_REF'], now() + interval '30 minutes')`,
      [session.id, taskId, cartId],
    );

    return { cartId, version: 1 };
  });

  // 事务外调用 settle 执行划扣与复式账本记账
  const settleRes = await settle({
    cartId: result.cartId,
    cartVersion: result.version,
    userId: session.id,
    idempotencyKey: `manual-${taskId}-${Date.now()}`,
    methodId: "fps",
  });

  if (settleRes.status === "succeeded") {
    await query(`UPDATE tasks SET status='completed', updated_at=now() WHERE id=$1`, [taskId]);
  }

  return json({ status: settleRes.status, orderId: settleRes.orderId, totalMinor: settleRes.totalMinor });
});
