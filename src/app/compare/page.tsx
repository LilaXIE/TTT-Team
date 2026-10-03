import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/server/auth/session";
import { CompareClient } from "./compare-client";

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { q = "" } = await searchParams;
  return <AppShell user={user}><div className="mb-6"><p className="text-sm font-medium text-emerald-600">E-commerce · Agent</p><h1 className="mt-1 text-2xl font-semibold">真实淘宝比价</h1><p className="mt-2 max-w-2xl text-sm text-zinc-600">授权并指挥 Agent 下单后，可以在这里查看淘宝真实商品的价格、商家和商品链接。</p></div><CompareClient initialQuery={q} /></AppShell>;
}
