import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtHKD } from "@/lib/format";
import { getSession } from "@/server/auth/session";
import { listMandates } from "@/server/mandates/service";
import { NewTaskForm } from "./new-task-form";

function activeOnly<T extends { status: string; expiresAt: string }>(list: T[]): T[] {
  const now = Date.now();
  return list.filter((m) => m.status === "active" && new Date(m.expiresAt).getTime() > now);
}

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ mandate?: string }> }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { mandate: mandateId } = await searchParams;

  const active = activeOnly(await listMandates(user.id));
  const m = active.find((x) => x.id === mandateId) ?? active[0];

  return (
    <AppShell user={user}>
      {m ? (
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle>把任务交给 Agent</CardTitle>
            <CardDescription>
              按授权书 v{m.version} 执行：单笔最多 {fmtHKD(m.caps.perTxnMinor)}，剩余 {fmtHKD(m.remainingMinor)}、{m.remainingPurchases} 次。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewTaskForm mandateId={m.id} defaultText={m.taskText} />
          </CardContent>
        </Card>
      ) : (
        <Card className="mx-auto max-w-xl">
          <CardHeader>
            <CardTitle>还没有生效中的授权</CardTitle>
            <CardDescription>Agent 只能在你签发的授权范围内购买。</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/mandate/new" className="text-sm underline">先签发一份授权</Link>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
