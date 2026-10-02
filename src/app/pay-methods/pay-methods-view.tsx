"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MockBanner, SectionTag } from "@/components/section-tag";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { fmtDateTime, fmtHKD } from "@/lib/format";
import { mockPayMethods } from "@/lib/mock-tasks";
import { METHOD_LABEL, SETTLEMENT_LABEL, type PayMethodOption, type PayMethodsCompare } from "@/lib/task-view";

interface ViewState {
  data: PayMethodsCompare;
  isMock: boolean;
  mockReason: string | null;
}

export function PayMethodsView({
  real,
  initial,
  initialMockReason,
}: {
  real: { cartId: string; version: number } | null;
  initial: PayMethodsCompare | null;
  initialMockReason: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<ViewState | null>(initial ? { data: initial, isMock: true, mockReason: initialMockReason } : null);

  const load = useCallback(async () => {
    if (!real) return;
    const qs = new URLSearchParams({ cartId: real.cartId, version: String(real.version) });
    try {
      setState({ data: await api<PayMethodsCompare>(`/api/pay-methods/compare?${qs}`), isMock: false, mockReason: null });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace("/login");
        return;
      }
      const why = e instanceof ApiError ? `GET /api/pay-methods/compare 返回 ${e.status}` : "GET /api/pay-methods/compare 无法访问";
      setState({ data: mockPayMethods(), isMock: true, mockReason: `${why}，暂时显示 mock-s1 的购物车。` });
    }
  }, [real, router]);

  useEffect(() => {
    if (!real) return;
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [real, load]);

  if (!state) return <p className="text-sm text-zinc-500">加载中…</p>;
  const { data, isMock, mockReason } = state;

  return (
    <div className="space-y-4">
      {isMock && <MockBanner>{mockReason ?? "阶段 2 接口接通前用于预览页面。"}</MockBanner>}

      <div>
        <SectionTag>Payment</SectionTag>
        <h1 className="text-xl font-semibold">支付方式比较</h1>
        <p className="mt-1 text-sm text-zinc-600">
          购物车 v{data.cart.version} · {data.cart.merchantName} · 含运费 {fmtHKD(data.cart.totalMinor)} · 当前选用{" "}
          {METHOD_LABEL[data.cart.methodId] ?? data.cart.methodId}
        </p>
        <p className="mt-1 text-xs text-zinc-500">先看资格，再按消费者成本排序；手续费未核实的方式不参与排序，预计回赠只展示、不参与排序。</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data.methods.map((m) => (
          <MethodCard key={m.methodId} m={m} current={m.methodId === data.cart.methodId} />
        ))}
      </div>

      <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
        本次支付由模拟器执行；商家手续费不计入消费者成本；回赠为公开页面观测值，未核实的不计入节省。
      </p>
    </div>
  );
}

const UNVERIFIED = <span className="font-medium text-amber-700">未核实</span>;

function MethodCard({ m, current }: { m: PayMethodOption; current: boolean }) {
  return (
    <Card className={current ? "border-zinc-900" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{m.label}</CardTitle>
          {current && <Badge>当前选用</Badge>}
          {m.costRank !== null ? (
            <Badge variant="outline">{m.costRank === 1 ? "成本最低" : `成本第 ${m.costRank}`}</Badge>
          ) : (
            <Badge variant="secondary">不参与成本排序</Badge>
          )}
        </div>
        <CardDescription>{m.network}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">资格</dt>
            <dd>
              {m.eligible ? (
                <span className="font-medium text-emerald-700">通过</span>
              ) : (
                <>
                  <span className="font-medium text-red-700">不通过</span>
                  <ul className="mt-1 list-disc pl-5 text-zinc-700">
                    {m.ineligibleReasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className="text-xs text-zinc-500">授权允许、商家接受、你已启用，三项都满足才通过。</p>
            </dd>
          </div>

          <div>
            <dt className="text-xs text-zinc-500">消费者成本</dt>
            <dd>
              <p className="text-base font-semibold tabular-nums">{m.consumerCostMinor !== null ? fmtHKD(m.consumerCostMinor) : UNVERIFIED}</p>
              <p className="text-xs text-zinc-600">
                手续费 {m.consumerFeeMinor !== null ? <span className="tabular-nums">{fmtHKD(m.consumerFeeMinor)}</span> : UNVERIFIED}
                {m.consumerFeeMinor === null && "，不当作 0，不参与成本排序"}
              </p>
              {m.feeConditions && <p className="mt-1 text-xs text-zinc-500">{m.feeConditions}</p>}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-zinc-500">预计回赠</dt>
            <dd>
              {m.estRewardMinor !== null ? <span className="tabular-nums">预计 {fmtHKD(m.estRewardMinor)}</span> : UNVERIFIED}
              <span className="text-xs text-zinc-500">（不计入节省）</span>
              {m.rewardConditions && <p className="mt-1 text-xs text-zinc-500">{m.rewardConditions}</p>}
            </dd>
          </div>

          <div>
            <dt className="text-xs text-zinc-500">结算时效</dt>
            <dd>{SETTLEMENT_LABEL[m.settlement] ?? m.settlement}</dd>
          </div>

          <div>
            <dt className="text-xs text-zinc-500">来源</dt>
            <dd className="space-y-0.5">
              {m.sourceUrl ? (
                <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="block break-all text-xs underline">
                  {m.sourceUrl}
                </a>
              ) : (
                <span className="text-xs">{UNVERIFIED}（无来源）</span>
              )}
              <p className="text-xs text-zinc-500">采集时间 {fmtDateTime(m.observedAt)}</p>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
