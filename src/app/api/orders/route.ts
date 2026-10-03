import { requireSession } from "@/server/auth/session";
import { query } from "@/server/db/tx";
import { json, route } from "@/server/http";

export const GET = route(async (req: Request) => {
  const user = await requireSession(req);
  const orders = await query<{
    id: string;
    status: string;
    total_minor: string;
    created_at: Date;
    task_id: string;
    task_text: string;
    steps: unknown;
  }>(
    `SELECT o.id, o.status, o.total_minor::text, o.created_at, o.task_id,
            t.input_text AS task_text, r.steps
     FROM orders o
     JOIN tasks t ON t.id = o.task_id
     LEFT JOIN LATERAL (
       SELECT steps FROM agent_runs WHERE task_id = o.task_id ORDER BY created_at DESC LIMIT 1
     ) r ON true
     WHERE o.user_id = $1
     ORDER BY o.created_at DESC
     LIMIT 20`,
    [user.id],
  );
  const denied = await query<{ id: string; input_text: string; status: string }>(
    `SELECT id, input_text, status FROM tasks
     WHERE user_id = $1 AND status = 'failed'
     ORDER BY created_at DESC
     LIMIT 5`,
    [user.id],
  );
  return json({ orders: orders.rows, denied: denied.rows });
});
