// POST /api/tasks — 创建任务并执行 Agent run
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toResponse } from "@/contracts/errors";
import { requireSession } from "@/server/auth/session";
import { runTask } from "@/server/agent/run";
import { withTransaction } from "@/server/db/tx";

const CreateTaskSchema = z.object({
  mandateId: z.string().uuid(),
  text: z.string().min(2).max(500),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const body = await req.json();
    const { mandateId, text } = CreateTaskSchema.parse(body);

    // 创建任务记录
    const taskId = await withTransaction(async (tx) => {
      const r = await tx.query<{ id: string }>(
        `INSERT INTO tasks (user_id, mandate_id, input_text, status)
         VALUES ($1, $2, $3, 'running') RETURNING id`,
        [session.id, mandateId, text],
      );
      return r.rows[0].id;
    });

    // 执行 Agent
    const result = await runTask({
      taskId,
      userId: session.id,
      mandateId,
      inputText: text,
    });

    return NextResponse.json(result);
  } catch (e) {
    return toResponse(e);
  }
}
