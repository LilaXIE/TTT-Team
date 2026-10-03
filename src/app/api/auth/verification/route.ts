import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { json, readJson, route } from "@/server/http";
import { sendVerificationCode } from "@/server/smtp";
const Body = z.object({ email: z.string().email(), purpose: z.enum(["registration", "payment"]) });
export const POST = route(async (req: Request) => { const body = Body.parse(await readJson(req)); const user = body.purpose === "registration" ? null : await requireSession(req); await sendVerificationCode(user?.id, body.email, body.purpose); return json({ sent: true, expiresInSeconds: 300 }); });
