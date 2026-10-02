import { requireSession } from "@/server/auth/session";
import { json, route } from "@/server/http";
import { revokeMandate } from "@/server/mandates/service";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSession(req);
  const { id } = await ctx.params;
  return json({ mandate: await revokeMandate(user.id, id) });
});
