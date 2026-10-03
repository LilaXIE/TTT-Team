import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/server/auth/session";
import { getMandate } from "@/server/mandates/service";
import { TaskStartForm } from "./task-start-form";

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ mandate?: string }> }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { mandate: mandateId } = await searchParams;
  if (!mandateId) notFound();
  const mandate = await getMandate(user.id, mandateId);
  return <AppShell user={user}><div className="mb-6"><p className="text-sm font-medium text-emerald-600">Agent · Trust</p><h1 className="mt-1 text-2xl font-semibold">开始一次购买任务</h1><p className="mt-2 text-sm text-zinc-600">当前授权：{mandate.taskText || mandate.task.query}。用户不再填写技术规则，边界由授权快照和 Agent 判断。</p></div><TaskStartForm mandateId={mandate.id} defaultQuery={mandate.task.query} /></AppShell>;
}
