import { z } from "zod";
import { draftFromChat } from "@/server/agent/chat";
import { requireSession } from "@/server/auth/session";
import { query } from "@/server/db/tx";
import { json, readJson, route } from "@/server/http";

const Body = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(1000),
});

export const POST = route(async (req: Request) => {
  const { sessionId: requestedId, message } = Body.parse(await readJson(req));
  let user: { id: string } | null = null;
  try {
    user = await requireSession(req);
  } catch (err) {
    if (process.env.DEMO_MODE !== "true") throw err;
  }
  if (!user) {
    const draft = await draftFromChat([], message);
    return json({ sessionId: null, message: draft.reply, query: draft.query, qty: draft.qty, mode: draft.mode });
  }
  let sessionId = requestedId;
  if (sessionId) {
    const owned = await query("SELECT id FROM chat_sessions WHERE id=$1 AND user_id=$2", [sessionId, user.id]);
    if (!owned.rowCount) sessionId = undefined;
  }
  if (!sessionId) {
    const created = await query<{ id: string }>(
      "INSERT INTO chat_sessions (user_id, title) VALUES ($1, $2) RETURNING id",
      [user.id, message.slice(0, 40)],
    );
    sessionId = created.rows[0].id;
  }
  const history = await query<{ role: "user" | "assistant"; content: string }>(
    "SELECT role, content FROM chat_messages WHERE session_id=$1 AND role IN ('user','assistant') ORDER BY id DESC LIMIT 8",
    [sessionId],
  );
  const draft = await draftFromChat(history.rows.reverse(), message);
  await query("INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', $2)", [sessionId, message]);
  await query("INSERT INTO chat_messages (session_id, role, content, metadata) VALUES ($1, 'assistant', $2, $3)", [
    sessionId,
    draft.reply,
    JSON.stringify({ query: draft.query, qty: draft.qty, mode: draft.mode }),
  ]);
  await query("UPDATE chat_sessions SET updated_at=now() WHERE id=$1", [sessionId]);
  return json({ sessionId, message: draft.reply, query: draft.query, qty: draft.qty, mode: draft.mode });
});
