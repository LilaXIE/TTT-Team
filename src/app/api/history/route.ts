import { requireSession } from "@/server/auth/session";
import { json, route } from "@/server/http";
import { query } from "@/server/db/tx";

export const GET = route(async (req: Request) => {
  const user = await requireSession(req);
  const [searches, orders] = await Promise.all([
    query<{ id: string; keyword: string; source: string; result_count: number; created_at: Date }>(
      `SELECT id, keyword, source, result_count, created_at FROM search_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [user.id],
    ),
    query<{ id: string; status: string; total_minor: string; created_at: Date; task_text: string }>(
      `SELECT o.id, o.status, o.total_minor, o.created_at, t.input_text AS task_text
       FROM orders o JOIN tasks t ON t.id=o.task_id WHERE o.user_id=$1 ORDER BY o.created_at DESC LIMIT 50`, [user.id],
    ),
  ]);
  return json({ searches: searches.rows, orders: orders.rows });
});
