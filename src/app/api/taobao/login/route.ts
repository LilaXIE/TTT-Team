import { requireSession } from "@/server/auth/session";
import { json, route } from "@/server/http";
import { hasTaobaoLogin, startTaobaoLogin } from "@/server/taobao-account";

export const GET = route(async (req: Request) => {
  const user = await requireSession(req);
  return json({ loggedIn: await hasTaobaoLogin(user.id) });
});

export const POST = route(async (req: Request) => {
  const user = await requireSession(req);
  await startTaobaoLogin(user.id);
  return json({ loggedIn: true });
});
