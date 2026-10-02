import { cookies } from "next/headers";
import { logout, SESSION_COOKIE } from "@/server/auth/session";
import { json, route } from "@/server/http";

export const POST = route(async () => {
  const jar = await cookies();
  await logout(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  return json({ ok: true });
});
