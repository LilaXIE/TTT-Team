import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { readTask } from "@/server/tasks/read";
import { json, route } from "@/server/http";

export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSession(req);
  const { id } = await ctx.params;
  return json(await readTask(user.id, z.string().uuid().parse(id)));
});
