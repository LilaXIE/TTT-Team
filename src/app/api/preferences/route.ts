import { requireSession } from "@/server/auth/session";
import { json, readJson, route } from "@/server/http";
import { getUserPreferences, upsertUserPreferences } from "@/server/preferences";

export const GET = route(async (req: Request) => {
  const user = await requireSession(req);
  return json({ preferences: await getUserPreferences(user.id) });
});

export const PUT = route(async (req: Request) => {
  const user = await requireSession(req);
  return json({ preferences: await upsertUserPreferences(user.id, await readJson(req)) });
});
