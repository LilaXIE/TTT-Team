import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, fmtHKD } from "@/lib/format";
import { getSession } from "@/server/auth/session";
import { getBuyerBalanceMinor } from "@/server/ledger/queries";
import { listMandates } from "@/server/mandates/service";
import { getBuyerCredential } from "@/server/trust/credentials";

const STATUS_LABEL: Record<string, string> = { active: "生效中", revoked: "已撤销", expired: "已过期", completed: "已完成" };

export default async function HomePage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const [balance, credential, mandates] = await Promise.all([
    getBuyerBalanceMinor(user.id),
    getBuyerCredential(user.id),
    listMandates(user.id),
  ]);

  return (
    <AppShell user={user}>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>钱包余额（模拟）</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{fmtHKD(balance)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>身份凭证</CardDescription>
            <CardTitle className="flex items-center gap-2 text-base">
              {credential ? (
                <>
                  <Badge variant={credential.status === "valid" ? "default" : "destructive"}>{credential.status}</Badge>
                  <span className="text-zinc-600">{credential.type} · {credential.issuer}</span>
                </>
              ) : (
                <Badge variant="destructive">missing</Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>下一步</CardDescription>
            <CardTitle className="text-base">
              <Link href="/mandate/new" className={buttonVariants()}>写一份授权书</Link>
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
                <Link href="/mandate/new" className={buttonVariants()}>新建授权</Link>
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
