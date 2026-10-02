import { requireSession } from "@/server/auth/session";
import { json, readJson, route } from "@/server/http";
import { createMandate, listMandates } from "@/server/mandates/service";

export const GET = route(async (req: Request) => {
  const user = await requireSession(req);
  return json({ mandates: await listMandates(user.id) });
});

export const POST = route(async (req: Request) => {
  const user = await requireSession(req);
  const mandate = await createMandate(user.id, await readJson(req));
  return json({ mandate }, { status: 201 });
});
