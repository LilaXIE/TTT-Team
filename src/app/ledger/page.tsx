import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate, fmtHKD } from "@/lib/format";
import { getSession } from "@/server/auth/session";
import { query } from "@/server/db/tx";

export default async function LedgerPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const [searches, orders] = await Promise.all([
    query<{ keyword: string; source: string; result_count: number; created_at: Date }>("SELECT keyword, source, result_count, created_at FROM search_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20", [user.id]),
    query<{ id: string; status: string; total_minor: string; task_text: string; created_at: Date }>("SELECT o.id, o.status, o.total_minor, t.input_text AS task_text, o.created_at FROM orders o JOIN tasks t ON t.id=o.task_id WHERE o.user_id=$1 ORDER BY o.created_at DESC LIMIT 20", [user.id]),
  ]);
  return <AppShell user={user}>
    <div className="mb-6"><p className="text-sm font-medium text-emerald-600">Activity</p><h1 className="mt-1 text-2xl font-semibold">查询与交易记录</h1></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>淘宝查询</CardTitle></CardHeader><CardContent className="space-y-3">{searches.rows.length ? searches.rows.map((item, index) => <div key={`${item.keyword}-${index}`} className="flex items-center justify-between border-b pb-3 text-sm"><div><p className="font-medium">{item.keyword}</p><p className="text-xs text-zinc-500">{item.source} · {item.result_count} 件结果</p></div><time className="text-xs text-zinc-400">{fmtDate(item.created_at)}</time></div>) : <p className="text-sm text-zinc-500">暂无查询记录。</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>交易记录</CardTitle></CardHeader><CardContent className="space-y-3">{orders.rows.length ? orders.rows.map((item) => <div key={item.id} className="flex items-center justify-between border-b pb-3 text-sm"><div><p className="font-medium">{item.task_text}</p><p className="text-xs text-zinc-500">{item.status} · {fmtDate(item.created_at)}</p></div><span className="font-semibold tabular-nums">{fmtHKD(BigInt(item.total_minor))}</span></div>) : <p className="text-sm text-zinc-500">暂无交易记录。</p>}</CardContent></Card>
    </div>
  </AppShell>;
}
