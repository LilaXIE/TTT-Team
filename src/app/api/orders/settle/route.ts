import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { json, readJson, route } from "@/server/http";
import { settle } from "@/server/settlement/settle";

const Body = z.object({
  cartId: z.string().uuid(),
  cartVersion: z.number().int().positive(),
  methodId: z.string().min(1).default("fps"),
});

export const POST = route(async (req: Request) => {
  const user = await requireSession(req);
  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (!idempotencyKey) return json({ error: { code: "VALIDATION_ERROR", message: "需要 Idempotency-Key。" } }, { status: 400 });
  const body = Body.parse(await readJson(req));
  const result = await settle({
    cartId: body.cartId,
    cartVersion: body.cartVersion,
    userId: user.id,
    idempotencyKey,
    methodId: body.methodId,
  });
  return json(result);
});
