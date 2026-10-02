import { requireSession } from "@/server/auth/session";
import { json, readJson, route } from "@/server/http";
import { preview } from "@/server/mandates/service";

export const POST = route(async (req: Request) => {
  await requireSession(req);
  const cards = preview(await readJson(req));
  return json({ cards });
});
