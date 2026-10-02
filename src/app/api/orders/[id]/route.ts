// GET /api/orders/[id] — 读取订单
import { NextRequest, NextResponse } from "next/server";
import { toResponse } from "@/contracts/errors";
import { requireSession } from "@/server/auth/session";
import { query } from "@/server/db/tx";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(req);
    const { id } = await params;

    const order = await query<{
      id: string;
      status: string;
      total_minor: string;
      method_id: string;
      paid_at: Date | null;
      created_at: Date;
    }>(
      `SELECT id, status, total_minor, method_id, paid_at, created_at
       FROM orders WHERE id=$1 AND user_id=$2`,
      [id, session.id],
    );

    if (order.rowCount === 0) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    }

    const attempts = await query(
      `SELECT id, status, result, created_at FROM payment_attempts WHERE order_id=$1 ORDER BY created_at DESC`,
      [id],
    );

    return NextResponse.json({
      order: order.rows[0],
      attempts: attempts.rows,
    });
  } catch (e) {
    return toResponse(e);
  }
}
