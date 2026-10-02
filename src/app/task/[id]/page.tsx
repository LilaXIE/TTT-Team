import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MOCK_TASKS } from "@/lib/mock-tasks";
import { getSession } from "@/server/auth/session";
import { TaskView } from "./task-view";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { id } = await params;
  const mock = MOCK_TASKS[id] ?? null;

  return (
    <AppShell user={user}>
      <TaskView id={id} initial={mock} isMock={mock !== null} />
    </AppShell>
  );
}
