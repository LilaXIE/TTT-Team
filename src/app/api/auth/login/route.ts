import { cookies } from "next/headers";
import { z } from "zod";
import { login, sessionCookieOptions } from "@/server/auth/session";
import { json, readJson, route } from "@/server/http";

const Body = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });

export const POST = route(async (req: Request) => {
  const { email, password } = Body.parse(await readJson(req));
  const { user, token, expiresAt } = await login(email, password);
  const jar = await cookies();
  jar.set({ ...sessionCookieOptions(expiresAt), value: token });
  return json({ user });
});
