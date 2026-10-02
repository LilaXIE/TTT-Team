import { requireSession } from "@/server/auth/session";
import { json, route } from "@/server/http";

export const GET = route(async (req: Request) => {
  const user = await requireSession(req);
  return json({ user });
});
