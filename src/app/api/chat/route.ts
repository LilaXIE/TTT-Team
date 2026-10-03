import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { query } from "@/server/db/tx";
import { json, readJson, route } from "@/server/http";
import { askDeepSeek } from "@/server/deepseek";

const Body = z.object({ sessionId: z.string().uuid().optional(), message: z.string().min(1).max(1000) });

export const POST = route(async (req: Request) => {
  const user = await requireSession(req);
  const { sessionId: requestedId, message } = Body.parse(await readJson(req));
  let sessionId = requestedId;
  if (sessionId) {
    const owned = await query("SELECT id FROM chat_sessions WHERE id=$1 AND user_id=$2", [sessionId, user.id]);
    if (!owned.rowCount) sessionId = undefined;
  }
  if (!sessionId) {
    const created = await query<{ id: string }>("INSERT INTO chat_sessions (user_id, title) VALUES ($1, $2) RETURNING id", [user.id, message.slice(0, 40)]);
    sessionId = created.rows[0].id;
  }
  await query("INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', $2)", [sessionId, message]);
  const history = await query<{ role: "user" | "assistant" | "system"; content: string }>("SELECT role, content FROM chat_messages WHERE session_id=$1 ORDER BY id DESC LIMIT 20", [sessionId]);
  const answer = await askDeepSeek([{ role: "system", content: "你是中文 AI 智能代购 Agent。回答简洁，优先询问商品、预算、规格和收货要求；不要声称已经付款，除非后端返回订单成功。" }, ...history.rows.reverse()]);
  await query("INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'assistant', $2)", [sessionId, answer]);
  await query("UPDATE chat_sessions SET updated_at=now() WHERE id=$1", [sessionId]);
  return json({ sessionId, message: answer });
});
