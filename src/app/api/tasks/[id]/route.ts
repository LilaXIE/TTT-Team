// GET /api/tasks/[id] — 读取任务
import { NextRequest, NextResponse } from "next/server";
import { toResponse } from "@/contracts/errors";
import { requireSession } from "@/server/auth/session";
import { query } from "@/server/db/tx";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession(req);
    const { id } = await params;

    const task = await query<{
      id: string;
      status: string;
      input_text: string;
      created_at: Date;
    }>(
      `SELECT id, status, input_text, created_at FROM tasks WHERE id=$1 AND user_id=$2`,
      [id, session.id],
    );

    if (task.rowCount === 0) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    const run = await query(
      `SELECT mode, steps, candidates FROM agent_runs WHERE task_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [id],
    );

    const decisions = await query(
      `SELECT checkpoint, outcome, rules, created_at FROM decisions WHERE task_id=$1 ORDER BY id`,
      [id],
    );

    return NextResponse.json({
      task: task.rows[0],
      run: run.rows[0] ?? null,
      decisions: decisions.rows,
    });
  } catch (e) {
    return toResponse(e);
  }
}
