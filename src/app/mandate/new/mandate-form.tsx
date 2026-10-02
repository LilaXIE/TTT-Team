"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { OutcomeBadge, RuleList } from "@/components/decision-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Decision, MandateDraft } from "@/contracts/schemas";
import { api, ApiError } from "@/lib/api";
import { fmtHKD, OUTCOME_STYLE } from "@/lib/format";
import { cn } from "cn";

const CATEGORIES = [
  { id: "household", label: "家居日用" },
  { id: "grocery", label: "食品杂货" },
  { id: "supplement", label: "保健品（高关注）" },
  { id: "electronics", label: "电子产品" },
];

interface PreviewCard {
  scenarioId: string;
  title: string;
  description: string;
  totalMinor: string;
  decision: Decision;
}

function plusDays(n: number): string {
  const d = new Date(Date.now() + n * 86_400_000);
  d.setHours(23, 59, 59, 0);
  return d.toISOString();
}

function toLocalDateInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function MandateForm({ methods }: { methods: { id: string; label: string }[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<MandateDraft>({
    taskText: "帮我补一瓶洗衣液，2L 以上，HK$150 以内，可以换牌子，这周内买到。",
    task: { query: "洗衣液", qty: 1, minSpec: { volumeMl: 2000 }, allowSubstituteBrand: true, preferredBrand: "品牌甲" },
    categories: ["household"],
    merchantDeny: [],
    perTxnHKD: "150",
    totalHKD: "300",
    maxPurchases: 2,
    expiresAt: plusDays(7),
    reviewWhen: { nearCapPct: 95, substituteBrand: true, watchCategories: ["supplement"], newMerchantDays: null, priceAboveRefPct: null },
    protectionLevel: "standard",
    allowedMethods: methods.map((m) => m.id),
  });
  const [cards, setCards] = useState<PreviewCard[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enhanced = draft.protectionLevel === "enhanced";
  const minSpecMl = draft.task.minSpec.volumeMl ?? 0;

  // 300ms 防抖预览
  const draftKey = useMemo(() => JSON.stringify(draft), [draft]);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const r = await api<{ cards: PreviewCard[] }>("/api/mandates/preview", { method: "POST", json: JSON.parse(draftKey) });
        setCards(r.cards);
        setPreviewError(null);
      } catch (e) {
        setPreviewError(e instanceof ApiError ? e.message : "预览失败");
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draftKey]);

  function patch(p: Partial<MandateDraft>) {
    setDraft((d) => ({ ...d, ...p }));
  }
  function toggleCategory(id: string) {
    setDraft((d) => {
      const has = d.categories.includes(id);
      const categories = has ? d.categories.filter((c) => c !== id) : [...d.categories, id];
      return { ...d, categories: categories.length ? categories : d.categories };
    });
  }
  function toggleMethod(id: string) {
    setDraft((d) => {
      const has = d.allowedMethods.includes(id);
      const allowedMethods = has ? d.allowedMethods.filter((c) => c !== id) : [...d.allowedMethods, id];
      return { ...d, allowedMethods: allowedMethods.length ? allowedMethods : d.allowedMethods };
    });
  }
  function setProtection(level: "standard" | "enhanced") {
    setDraft((d) => ({
      ...d,
      protectionLevel: level,
      reviewWhen:
        level === "enhanced"
          ? { ...d.reviewWhen, newMerchantDays: d.reviewWhen.newMerchantDays ?? 30, priceAboveRefPct: d.reviewWhen.priceAboveRefPct ?? 20 }
          : { ...d.reviewWhen, newMerchantDays: null, priceAboveRefPct: null },
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        const r = await api<{ mandate: { id: string } }>("/api/mandates", { method: "POST", json: draft });
        toast.success("授权书已签发");
        router.push(`/mandate/${r.mandate.id}`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "签发失败");
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        {/* 1 要买什么 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1 · 要买什么</CardTitle>
            <CardDescription>用你自己的话说，再补几个让 Agent 不会买错的硬条件。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea value={draft.taskText} onChange={(e) => patch({ taskText: e.target.value })} rows={2} maxLength={200} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="关键词">
                <Input value={draft.task.query} onChange={(e) => patch({ task: { ...draft.task, query: e.target.value } })} />
              </Field>
              <Field label="数量">
                <Input type="number" min={1} max={20} value={draft.task.qty} onChange={(e) => patch({ task: { ...draft.task, qty: Number(e.target.value) || 1 } })} />
              </Field>
              <Field label="最低容量 (ml)">
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={minSpecMl}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const minSpec = { ...draft.task.minSpec };
                    if (v > 0) minSpec.volumeMl = v;
                    else delete minSpec.volumeMl;
                    patch({ task: { ...draft.task, minSpec } });
                  }}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="常买品牌（可空）">
                <Input value={draft.task.preferredBrand ?? ""} onChange={(e) => patch({ task: { ...draft.task, preferredBrand: e.target.value || null } })} />
              </Field>
              <label className="flex items-center gap-2 pt-6 text-sm">
                <input type="checkbox" className="size-4" checked={draft.task.allowSubstituteBrand} onChange={(e) => patch({ task: { ...draft.task, allowSubstituteBrand: e.target.checked } })} />
                可以换牌子
              </label>
            </div>
          </CardContent>
        </Card>

        {/* 2 品类 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2 · 可以在哪些品类买</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const on = draft.categories.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  className={cn("rounded-full border px-3 py-1 text-sm transition", on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white hover:border-zinc-500")}
                >
                  {c.label}
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* 3-6 额度 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3 · 花多少、买几次、到什么时候</CardTitle>
            <CardDescription>所有上限按实际扣款（商品 + 运费）计算。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <Field label="单笔最多 (HK$)">
              <Input inputMode="decimal" value={draft.perTxnHKD} onChange={(e) => patch({ perTxnHKD: e.target.value.replace(/[^\d.]/g, "") })} />
            </Field>
            <Field label="这次总共最多 (HK$)">
              <Input inputMode="decimal" value={draft.totalHKD} onChange={(e) => patch({ totalHKD: e.target.value.replace(/[^\d.]/g, "") })} />
            </Field>
            <Field label="最多成功购买">
              <Input type="number" min={1} max={20} value={draft.maxPurchases} onChange={(e) => patch({ maxPurchases: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="有效期至">
              <Input
                type="date"
                value={toLocalDateInput(draft.expiresAt)}
                onChange={(e) => {
                  const d = new Date(e.target.value + "T23:59:59");
                  if (!Number.isNaN(d.getTime())) patch({ expiresAt: d.toISOString() });
                }}
              />
            </Field>
          </CardContent>
        </Card>

        {/* 7-8 先问我 + 保护级别 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4 · 哪些情况先问我</CardTitle>
            <CardDescription>这些是「暂停等你确认」，不是拒绝。超上限、凭证无效等硬规则永远拒绝，不可被确认绕过。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={draft.reviewWhen.nearCapPct !== null}
                  onChange={(e) => patch({ reviewWhen: { ...draft.reviewWhen, nearCapPct: e.target.checked ? 95 : null } })}
                />
                接近单笔上限
                <Input
                  type="number"
                  min={50}
                  max={100}
                  className="h-7 w-16"
                  disabled={draft.reviewWhen.nearCapPct === null}
                  value={draft.reviewWhen.nearCapPct ?? 95}
                  onChange={(e) => patch({ reviewWhen: { ...draft.reviewWhen, nearCapPct: Math.min(100, Math.max(50, Number(e.target.value) || 95)) } })}
                />
                %
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4" checked={draft.reviewWhen.substituteBrand} onChange={(e) => patch({ reviewWhen: { ...draft.reviewWhen, substituteBrand: e.target.checked } })} />
                换了品牌
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={draft.reviewWhen.watchCategories.includes("supplement")}
                  onChange={(e) => patch({ reviewWhen: { ...draft.reviewWhen, watchCategories: e.target.checked ? ["supplement"] : [] } })}
                />
                保健品等高关注类别
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={draft.reviewWhen.newMerchantDays !== null}
                  onChange={(e) => patch({ reviewWhen: { ...draft.reviewWhen, newMerchantDays: e.target.checked ? 30 : null } })}
                />
                新商家（注册 &lt; 30 天）
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={draft.reviewWhen.priceAboveRefPct !== null}
                  onChange={(e) => patch({ reviewWhen: { ...draft.reviewWhen, priceAboveRefPct: e.target.checked ? 20 : null } })}
                />
                价格高于参考价
                <Input
                  type="number"
                  min={1}
                  max={200}
                  className="h-7 w-16"
                  disabled={draft.reviewWhen.priceAboveRefPct === null}
                  value={draft.reviewWhen.priceAboveRefPct ?? 20}
                  onChange={(e) => patch({ reviewWhen: { ...draft.reviewWhen, priceAboveRefPct: Math.min(200, Math.max(1, Number(e.target.value) || 20)) } })}
                />
                %
              </label>
            </div>
            <div className="flex items-center gap-3 border-t pt-3 text-sm">
              <span className="text-zinc-600">保护级别</span>
              <div className="inline-flex rounded-lg border p-0.5">
                {(["standard", "enhanced"] as const).map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setProtection(lv)}
                    className={cn("rounded-md px-3 py-1 transition", draft.protectionLevel === lv ? "bg-zinc-900 text-white" : "hover:bg-zinc-100")}
                  >
                    {lv === "standard" ? "标准" : "加强"}
                  </button>
                ))}
              </div>
              <span className="text-xs text-zinc-500">{enhanced ? "加强：自动勾选「新商家」和「价格高于参考价 20%」，只多问、不多拒。" : "标准：按你勾选的条件先问。"}</span>
            </div>
          </CardContent>
        </Card>

        {/* 9 支付方式 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">5 · 允许的支付方式</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {methods.map((m) => {
              const on = draft.allowedMethods.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMethod(m.id)}
                  className={cn("rounded-full border px-3 py-1 text-sm transition", on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white hover:border-zinc-500")}
                >
                  {m.label}
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="submit" size="lg" disabled={pending || !cards}>
            {pending ? "签发中…" : "签发授权书"}
          </Button>
        </div>
      </div>

      {/* 预览 */}
      <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700">签发前预览</h2>
          <p className="text-xs text-zinc-500">按当前设置，遇到这三类情况 Agent 会怎么做。</p>
        </div>
        {previewError && <p className="text-sm text-red-600">{previewError}</p>}
        {!cards && !previewError && <div className="h-40 animate-pulse rounded-xl bg-zinc-200" />}
        {cards?.map((c) => (
          <div key={c.scenarioId} className={cn("rounded-xl border p-4", OUTCOME_STYLE[c.decision.outcome])}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">{c.title}</div>
                <div className="mt-0.5 text-xs opacity-80">{c.description}</div>
              </div>
              <OutcomeBadge outcome={c.decision.outcome} className="bg-white/70" />
            </div>
            <div className="mt-2 text-xs opacity-80">含运费 {fmtHKD(c.totalMinor)}</div>
            <div className="mt-2 rounded-lg bg-white/70 p-2">
              <RuleList rules={c.decision.rules} emptyText="在授权范围内，会自动完成。" />
            </div>
          </div>
        ))}
      </aside>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-zinc-600">{label}</Label>
      {children}
    </div>
  );
}
