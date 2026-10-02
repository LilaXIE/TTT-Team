import { requireSession } from "@/server/auth/session";
import { json, route } from "@/server/http";
import { getMandate } from "@/server/mandates/service";

export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSession(req);
  const { id } = await ctx.params;
  return json({ mandate: await getMandate(user.id, id) });
});
