// POST /api/orders/[id]/pay — 手动触发结算（阶段 2 用于测试）
import { NextRequest, NextResponse } from "next/server";
import { toResponse } from "@/contracts/errors";
import { requireSession } from "@/server/auth/session";
import { settle } from "@/server/settlement/settle";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(req);
    const { id: orderId } = await params;

    const idempotencyKey = req.headers.get("Idempotency-Key");
    if (!idempotencyKey) {
      return NextResponse.json({ error: "需要 Idempotency-Key header" }, { status: 400 });
    }

    const body = await req.json();
    const { methodId } = body;

    const result = await settle({
      orderId,
      userId: session.id,
      idempotencyKey,
      methodId: methodId || "fps",
    });

    return NextResponse.json(result);
  } catch (e) {
    return toResponse(e);
  }
}
