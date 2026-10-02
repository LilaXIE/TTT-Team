import { requireSession } from "@/server/auth/session";
import { json, route } from "@/server/http";
import { getBuyerCredential } from "@/server/trust/credentials";

export const GET = route(async (req: Request) => {
  const user = await requireSession(req);
  const credential = await getBuyerCredential(user.id);
  return json({ credential });
});
