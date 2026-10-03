"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { OutcomeBadge, RuleList } from "@/components/decision-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Decision, MandateDraft } from "@/contracts/schemas";
import { api, ApiError } from "@/lib/api";
import { fmtHKD, OUTCOME_STYLE } from "@/lib/format";
import { cn } from "cn";

const CATEGORIES = [
  { id: "household", label: "家居日用" },
  { id: "grocery", label: "食品杂货" },
  { id: "supplement", label: "保健品" },
  { id: "electronics", label: "电子产品" },
];

interface PreviewCard { scenarioId: string; title: string; description: string; totalMinor: string; decision: Decision }

function plusDays(days: number) { const d = new Date(Date.now() + days * 86400000); d.setHours(23, 59, 59, 0); return d.toISOString(); }
function localDate(iso: string) { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

type Preferences = { perTxnHKD: string; totalHKD: string; maxPurchases: number; reviewWhen: MandateDraft["reviewWhen"]; protectionLevel: MandateDraft["protectionLevel"]; allowedMethods: string[] };

export function MandateForm({ methods, preferences }: { methods: { id: string; label: string }[]; preferences: Preferences }) {
  const router = useRouter();
  const [draft, setDraft] = useState<MandateDraft>({
    taskText: "帮我买洗衣液",
    task: { query: "洗衣液", qty: 1, minSpec: {}, allowSubstituteBrand: true, preferredBrand: null, priceRangeHKD: { min: "0", max: preferences.perTxnHKD } },
    categories: ["household"], merchantDeny: [], perTxnHKD: preferences.perTxnHKD, totalHKD: preferences.totalHKD,
    maxPurchases: preferences.maxPurchases, expiresAt: plusDays(7), reviewWhen: preferences.reviewWhen,
    protectionLevel: preferences.protectionLevel, allowedMethods: preferences.allowedMethods.length ? preferences.allowedMethods : methods.map((m) => m.id),
  });
  const [cards, setCards] = useState<PreviewCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftKey = useMemo(() => JSON.stringify(draft), [draft]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { const response = await api<{ cards: PreviewCard[] }>("/api/mandates/preview", { method: "POST", json: JSON.parse(draftKey) }); setCards(response.cards); setError(null); }
      catch (e) { setError(e instanceof ApiError ? e.message : "预览失败"); }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [draftKey]);

  function patch(p: Partial<MandateDraft>) { setDraft((current) => ({ ...current, ...p })); }
  function setRange(min: string, max: string) {
    const nextMin = min.replace(/[^\d.]/g, "") || "0";
    const nextMax = max.replace(/[^\d.]/g, "") || draft.perTxnHKD;
    setDraft((current) => ({ ...current, perTxnHKD: nextMax, task: { ...current.task, priceRangeHKD: { min: nextMin, max: nextMax } } }));
  }
  function toggleCategory(id: string) { setDraft((current) => { const categories = current.categories.includes(id) ? current.categories.filter((c) => c !== id) : [...current.categories, id]; return { ...current, categories: categories.length ? categories : current.categories }; }); }
  function submit(event: React.FormEvent) { event.preventDefault(); start(async () => { try { const result = await api<{ mandate: { id: string } }>("/api/mandates", { method: "POST", json: draft }); toast.success("授权书已签发"); router.push(`/mandate/${result.mandate.id}`); } catch (e) { toast.error(e instanceof ApiError ? e.message : "签发失败"); } }); }

  const min = Number(draft.task.priceRangeHKD?.min ?? 0);
  const max = Number(draft.task.priceRangeHKD?.max ?? draft.perTxnHKD);
  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Card className="border-zinc-200 shadow-sm"><CardHeader><CardTitle className="text-lg">商品与价格</CardTitle><CardDescription>只需要告诉 Agent 买什么，以及可以接受的单件价格。</CardDescription></CardHeader><CardContent className="space-y-6">
          <div className="space-y-2"><Label htmlFor="product-query">商品名称</Label><div className="relative"><span className="pointer-events-none absolute left-3 top-2.5 text-zinc-400">⌕</span><Input id="product-query" className="pl-8 text-base" placeholder="例如：洗衣液、无线耳机" value={draft.task.query} onChange={(e) => patch({ taskText: `帮我买${e.target.value}`, task: { ...draft.task, query: e.target.value } })} /></div></div>
          <div className="space-y-3"><div className="flex items-end justify-between"><div><Label>可接受价格区间（HK$）</Label><p className="mt-1 text-xs text-zinc-500">拖动滑块或直接输入上下界</p></div><strong>HK${min} – HK${max}</strong></div><div className="grid grid-cols-2 gap-3"><Field label="最低价"><Input inputMode="decimal" value={draft.task.priceRangeHKD?.min ?? "0"} onChange={(e) => setRange(e.target.value, draft.task.priceRangeHKD?.max ?? draft.perTxnHKD)} /></Field><Field label="最高价"><Input inputMode="decimal" value={draft.task.priceRangeHKD?.max ?? draft.perTxnHKD} onChange={(e) => setRange(draft.task.priceRangeHKD?.min ?? "0", e.target.value)} /></Field></div><div className="relative h-7 pt-2"><div className="h-2 rounded-full bg-zinc-200"><div className="h-2 rounded-full bg-zinc-900" style={{ marginLeft: `${Math.min(min / 500 * 100, 100)}%`, width: `${Math.max(0, Math.min((max - min) / 500 * 100, 100))}%` }} /></div><input aria-label="最低价格" type="range" min="0" max="500" value={min} onChange={(e) => setRange(e.target.value, String(Math.max(max, Number(e.target.value))))} className="absolute inset-x-0 top-0 w-full accent-zinc-900" /><input aria-label="最高价格" type="range" min="0" max="500" value={max} onChange={(e) => setRange(String(Math.min(min, Number(e.target.value))), e.target.value)} className="absolute inset-x-0 top-0 w-full accent-zinc-900" /></div></div>
          <div className="space-y-2"><Label>商品类别</Label><div className="flex flex-wrap gap-2">{CATEGORIES.map((category) => <button key={category.id} type="button" onClick={() => toggleCategory(category.id)} className={cn("rounded-full border px-3 py-2 text-sm", draft.categories.includes(category.id) ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white hover:border-zinc-500")}>{category.label}</button>)}</div></div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">授权有效期</CardTitle><CardDescription>额度、次数、确认条件和支付方式使用账户设置中的默认偏好。</CardDescription></CardHeader><CardContent><Input type="date" value={localDate(draft.expiresAt)} onChange={(e) => { const date = new Date(`${e.target.value}T23:59:59`); if (!Number.isNaN(date.getTime())) patch({ expiresAt: date.toISOString() }); }} /></CardContent></Card>
        <div className="flex items-center justify-between"><p className="text-xs text-zinc-500">下单偏好可在账户设置中统一修改。</p><Button type="submit" size="lg" disabled={pending || !cards}>{pending ? "签发中…" : "签发授权书"}</Button></div>
      </div>
      <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start"><div><h2 className="text-sm font-semibold text-zinc-700">签发前预览</h2><p className="text-xs text-zinc-500">Agent 会如何处理三个示例。</p></div>{error && <p className="text-sm text-red-600">{error}</p>}{!cards && !error && <div className="h-40 animate-pulse rounded-xl bg-zinc-200" />}{cards?.map((card) => <div key={card.scenarioId} className={cn("rounded-xl border p-4", OUTCOME_STYLE[card.decision.outcome])}><div className="flex items-start justify-between gap-2"><div><div className="text-sm font-semibold">{card.title}</div><div className="mt-0.5 text-xs opacity-80">{card.description}</div></div><OutcomeBadge outcome={card.decision.outcome} className="bg-white/70" /></div><div className="mt-2 text-xs opacity-80">含运费 {fmtHKD(card.totalMinor)}</div><div className="mt-2 rounded-lg bg-white/70 p-2"><RuleList rules={card.decision.rules} emptyText="在授权范围内，会自动完成。" /></div></div>)}</aside>
    </form>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label className="text-xs text-zinc-600">{label}</Label>{children}</div>; }
