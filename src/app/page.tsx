import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, fmtHKD } from "@/lib/format";
import { getSession } from "@/server/auth/session";
import { getBuyerBalanceMinor } from "@/server/ledger/queries";
import { summarizeMandates } from "@/server/mandates/service";
import { getBuyerCredential } from "@/server/trust/credentials";
import { TaskPrompt } from "./task-prompt";

const STATUS_LABEL: Record<string, string> = { active: "生效中", revoked: "已撤销", expired: "已过期", completed: "已完成" };

export default async function HomePage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const [balance, credential, { mandates, activeCount, availableMinor }] = await Promise.all([
    getBuyerBalanceMinor(user.id),
    getBuyerCredential(user.id),
    summarizeMandates(user.id),
  ]);

  return (
    <AppShell user={user}>
      <TaskPrompt />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Metric label="钱包余额（模拟）" value={fmtHKD(balance)} />
        <Metric label="生效中的授权" value={`${activeCount} 份`} hint={`共 ${mandates.length} 份`} />
        <Metric label="Agent 还能花" value={fmtHKD(availableMinor)} hint="所有生效授权的剩余额度" />
        <Card size="sm">
          <CardHeader>
            <CardDescription>身份凭证 · Trust</CardDescription>
            <CardTitle className="flex items-center gap-2 text-base">
              <Badge variant={credential?.status === "valid" ? "default" : "destructive"}>{credential?.status ?? "missing"}</Badge>
              <span className="truncate text-sm font-normal text-zinc-600">{credential?.type ?? "无"}</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">我的授权书</h2>
        {mandates.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-zinc-600">
              还没有授权书。授权书写清楚：Agent 能买什么、最多花多少、哪些情况要先问你。
              <div className="mt-4">
                <Button render={<Link href="/mandate/new" />}>新建授权</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {mandates.map((m) => (
              <Link key={m.id} href={`/mandate/${m.id}`} className="block">
                <Card className="h-full transition hover:border-zinc-400">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">{m.taskText || m.task.query}</CardTitle>
                      <Badge variant={m.status === "active" ? "default" : "secondary"}>{STATUS_LABEL[m.status] ?? m.status}</Badge>
                    </div>
                    <CardDescription>
                      单笔 ≤ {fmtHKD(m.caps.perTxnMinor)} · 剩余 {fmtHKD(m.remainingMinor)} / {fmtHKD(m.caps.totalMinor)} · 还可买 {m.remainingPurchases} 次 · 至 {fmtDate(m.expiresAt)}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
        {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      </CardHeader>
    </Card>
  );
}
