// POST /api/tasks/[id]/select — 多件都符合时，用户点名要买的那一件。
import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { selectCandidate } from "@/server/agent/select";
import { json, readJson, route } from "@/server/http";

const Body = z.object({
  productId: z.string().min(1).max(80),
});

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSession(req);
  const { id } = await ctx.params;
  const body = Body.parse(await readJson(req));
  return json(await selectCandidate(user.id, z.string().uuid().parse(id), body.productId));
});
