import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/server/auth/session";
import { CompareClient } from "./compare-client";

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ q?: string; taskId?: string; mandateId?: string; risk?: string }> }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { q = "", taskId = "", mandateId = "", risk = "" } = await searchParams;
  return (
    <AppShell user={user}>
      <div className="mb-6">
        <p className="text-sm font-medium text-emerald-600">E-commerce · Agent</p>
        <h1 className="mt-1 text-2xl font-semibold">真实淘宝比价与代理下单</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Agent 已完成风险评估。若为低风险任务则已自动下单；若触发风险规则，您可在下方挑选任意商品点击【委托 Agent 代理下单】。
        </p>
      </div>
      <CompareClient initialQuery={q} taskId={taskId} mandateId={mandateId} isRisk={risk === "1"} />
    </AppShell>
  );
}
