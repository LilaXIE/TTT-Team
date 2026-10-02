"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { OutcomeBadge, RuleList } from "@/components/decision-badge";
import { MockBanner, SectionTag } from "@/components/section-tag";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { fmtDateTime, fmtHKD } from "@/lib/format";
import { MOCK_LEDGER } from "@/lib/mock-tasks";
import {
  CHECKPOINT_LABEL,
  METHOD_LABEL,
  TASK_STATUS_LABEL,
  type LedgerAttempt,
  type LedgerDecision,
  type LedgerGroup,
  type LedgerResponse,
} from "@/lib/task-view";
import { SupportButton } from "./support-button";

const ATTEMPT_LABEL: Record<LedgerAttempt["status"], string> = { pending: "处理中", settled: "已结算", declined: "被拒绝" };

interface LedgerState {
  groups: LedgerGroup[];
  isMock: boolean;
  mockReason: string | null;
}

export function LedgerView() {
  const router = useRouter();
  const [state, setState] = useState<LedgerState | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<LedgerResponse>("/api/ledger");
      setState({ groups: res.groups, isMock: false, mockReason: null });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace("/login");
        return;
      }
      const why = e instanceof ApiError ? `GET /api/ledger 返回 ${e.status}` : "GET /api/ledger 无法访问";
      setState({ groups: MOCK_LEDGER.groups, isMock: true, mockReason: `${why}，暂时显示 mock-s1、mock-s2、mock-s3。` });
    }
  }, [router]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">记录</h1>
        <p className="mt-1 text-sm text-zinc-600">
          每个任务按顺序列出：依据的授权版本 → Agent 找到的候选 → 每一步的判定 → 支付尝试 → 收据。内容来自当时的记录，不现场重算。
        </p>
      </div>

      {state?.isMock && <MockBanner>{state.mockReason}</MockBanner>}

      {!state ? (
        <p className="text-sm text-zinc-500">加载中…</p>
      ) : state.groups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-zinc-600">
            还没有记录。把任务交给 Agent 后，这里会出现完整的决策链路。
          </CardContent>
        </Card>
      ) : (
        state.groups.map((g) => <TaskGroup key={g.task.id} g={g} isMock={state.isMock} />)
      )}
    </div>
  );
}

function Step({ tag, title, children }: { tag: string; title: string; children: React.ReactNode }) {
  return (
    <li className="relative">
      <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-zinc-400" aria-hidden />
      <div className="flex items-baseline gap-2">
        <SectionTag>{tag}</SectionTag>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="mt-1">{children}</div>
    </li>
  );
}

function TaskGroup({ g, isMock }: { g: LedgerGroup; isMock: boolean }) {
  const { task, mandate, candidates, decisions, attempts, receipt } = g;
  const noAttemptText =
    task.status === "awaiting_confirmation"
      ? "等你确认，尚未尝试付款。"
      : task.status === "failed"
        ? "判定为拒绝，没有创建订单，也没有尝试付款。"
        : "没有支付尝试。";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">
            <Link href={`/task/${task.id}`} className="hover:underline">
              {task.inputText}
            </Link>
          </CardTitle>
          <div className="flex gap-1">
            <Badge variant={task.status === "completed" ? "default" : "secondary"}>{TASK_STATUS_LABEL[task.status]}</Badge>
            {g.runMode && <Badge variant="outline">{g.runMode === "llm" ? "LLM" : "规则演示模式"}</Badge>}
          </div>
        </div>
        <CardDescription>{fmtDateTime(task.createdAt)}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4 border-l border-zinc-200 pl-4">
          <Step tag="Trust" title="授权版本">
            <p className="text-sm text-zinc-700">
              {isMock ? (
                `授权书 v${mandate.version}`
              ) : (
                <Link href={`/mandate/${mandate.id}`} className="underline">
                  授权书 v{mandate.version}
                </Link>
              )}
              ：单笔 ≤ {fmtHKD(mandate.perTxnMinor)} · 总额 ≤ {fmtHKD(mandate.totalMinor)} · 最多 {mandate.maxPurchases} 次 · 有效至{" "}
              {fmtDateTime(mandate.expiresAt)}
            </p>
          </Step>

          <Step tag="Agent" title={`候选 ${candidates.length} 个`}>
            {candidates.length ? (
              <ul className="space-y-1">
                {candidates.map((c) => (
                  <li key={c.productId} className="flex flex-wrap items-center gap-2 text-sm">
                    <OutcomeBadge outcome={c.outcome} />
                    <span className={c.chosen ? "font-medium" : "text-zinc-700"}>
                      {c.chosen && <span className="mr-1 text-xs text-zinc-500">首选</span>}
                      {c.name}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {c.merchantName} · 含运费 {fmtHKD(c.totalMinor)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">没有候选。</p>
            )}
          </Step>

          <Step tag="Trust" title="每一步的判定">
            <div className="space-y-2">
              {decisions.map((dd) => (
                <DecisionRow key={dd.id} dd={dd} />
              ))}
            </div>
          </Step>

          <Step tag="Payment" title="支付尝试">
            {attempts.length ? (
              <ul className="space-y-1 text-sm">
                {attempts.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline gap-2">
                    <span className={a.status === "settled" ? "font-medium text-emerald-700" : a.status === "declined" ? "font-medium text-red-700" : "font-medium"}>
                      {ATTEMPT_LABEL[a.status]}
                    </span>
                    {a.reasonCode && <span className="font-mono text-xs text-zinc-500">{a.reasonCode}</span>}
                    {a.reason && <span className="text-zinc-700">{a.reason}</span>}
                    <span className="text-xs text-zinc-500">
                      订单 {a.orderId} · {fmtDateTime(a.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">{noAttemptText}</p>
            )}
          </Step>

          <Step tag="Payment" title="收据">
            {receipt ? (
              <div className="space-y-3 rounded-lg border border-zinc-200 p-3 text-sm">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-zinc-600">
                  <dt>订单</dt>
                  <dd className="font-mono text-xs text-zinc-900">{receipt.orderId}</dd>
                  <dt>交易</dt>
                  <dd className="font-mono text-xs text-zinc-900">{receipt.transactionId ?? "—"}</dd>
                  <dt>商家</dt>
                  <dd className="text-zinc-900">{receipt.merchantName}</dd>
                  <dt>商品</dt>
                  <dd className="text-zinc-900">{receipt.items.map((i) => `${i.name} ×${i.qty}`).join("、")}</dd>
                  <dt>商品 + 运费 + 手续费</dt>
                  <dd className="tabular-nums text-zinc-900">
                    {fmtHKD(receipt.subtotalMinor)} + {fmtHKD(receipt.shippingMinor)} + {fmtHKD(receipt.consumerFeeMinor)}
                  </dd>
                  <dt>合计</dt>
                  <dd className="font-semibold tabular-nums text-zinc-900">{fmtHKD(receipt.totalMinor)}</dd>
                  <dt>支付方式</dt>
                  <dd className="text-zinc-900">{METHOD_LABEL[receipt.methodId] ?? receipt.methodId}（模拟器执行）</dd>
                  <dt>付款时间</dt>
                  <dd className="text-zinc-900">{receipt.paidAt ? fmtDateTime(receipt.paidAt) : `订单状态：${receipt.orderStatus}`}</dd>
                </dl>
                {receipt.entries.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500">账本分录（合计为 0）</p>
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {receipt.entries.map((e) => (
                        <li key={e.account} className="flex justify-between gap-2">
                          <span className="text-zinc-700">{e.account}</span>
                          <span className="tabular-nums">{fmtHKD(e.amountMinor)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {receipt.orderStatus === "paid" && <SupportButton orderId={receipt.orderId} existing={receipt.support} isMock={isMock} />}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">没有收据。</p>
            )}
          </Step>
        </ol>
      </CardContent>
    </Card>
  );
}

function DecisionRow({ dd }: { dd: LedgerDecision }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-zinc-100 p-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <OutcomeBadge outcome={dd.outcome} />
        <span className="font-medium">{CHECKPOINT_LABEL[dd.checkpoint] ?? dd.checkpoint}</span>
        {dd.cartVersion !== null && <span className="text-xs text-zinc-500">购物车 v{dd.cartVersion}</span>}
        <button type="button" className="text-xs text-zinc-600 underline" onClick={() => setOpen((v) => !v)}>
          {open ? "收起" : "为什么"}
        </button>
      </div>
      {dd.rules.length > 0 && !open && (
        <ul className="mt-1 space-y-0.5 text-sm text-zinc-700">
          {dd.rules.map((r, i) => (
            <li key={`${r.id}-${i}`}>{r.message}</li>
          ))}
        </ul>
      )}
      {open && (
        <div className="mt-2 space-y-2">
          <RuleList rules={dd.rules} emptyText="没有命中任何先问或拒绝规则。" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-600">
            <dt>当时剩余额度</dt>
            <dd className="tabular-nums text-zinc-900">{fmtHKD(dd.snapshot.remainingMinor)}</dd>
            <dt>当时剩余次数</dt>
            <dd className="text-zinc-900">{dd.snapshot.remainingPurchases} 次</dd>
            <dt>含运费总额</dt>
            <dd className="tabular-nums text-zinc-900">{dd.snapshot.totalMinor !== null ? fmtHKD(dd.snapshot.totalMinor) : "（还没有购物车）"}</dd>
            <dt>支付方式</dt>
            <dd className="text-zinc-900">{dd.snapshot.methodId ? (METHOD_LABEL[dd.snapshot.methodId] ?? dd.snapshot.methodId) : "（未选定）"}</dd>
            <dt>依据</dt>
            <dd className="text-zinc-900">
              授权书 v{dd.mandateVersion} · {fmtDateTime(dd.evaluatedAt)}
            </dd>
          </dl>
        </div>
      )}
    </div>
  );
}
