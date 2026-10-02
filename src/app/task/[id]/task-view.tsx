"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { OutcomeBadge, RuleList } from "@/components/decision-badge";
import { MockBanner, SectionTag } from "@/components/section-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { fmtDateTime, fmtHKD } from "@/lib/format";
import {
  CHECKPOINT_LABEL,
  METHOD_LABEL,
  TASK_STATUS_LABEL,
  type CandidateView,
  type DecisionRecord,
  type TaskDetail,
} from "@/lib/task-view";
import { useNow } from "@/lib/use-now";

const POLL_MS = 2000;
const CONFIRM_TTL_MS = 30 * 60 * 1000;

export function TaskView({ id, initial, isMock }: { id: string; initial: TaskDetail | null; isMock: boolean }) {
  const [data, setData] = useState<TaskDetail | null>(initial);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<TaskDetail>(`/api/tasks/${id}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.message}（${e.code}）` : "加载失败");
    }
  }, [id]);

  useEffect(() => {
    if (isMock) return;
    if (data && data.task.status !== "running") return;
    const t = setTimeout(load, data ? POLL_MS : 0);
    return () => clearTimeout(t);
  }, [isMock, data, load]);

  if (error && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">无法加载任务</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void load()}>重试</Button>
        </CardContent>
      </Card>
    );
  }
  if (!data) return <p className="text-sm text-zinc-500">加载中…</p>;

  const { task, run, cart, decisions, order } = data;
  const latest = decisions.at(-1) ?? null;

  return (
    <div className="space-y-4">
      {isMock && <MockBanner />}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">任务</h1>
          <Badge variant={task.status === "completed" ? "default" : "secondary"}>{TASK_STATUS_LABEL[task.status]}</Badge>
          {run && <Badge variant="outline">{run.mode === "llm" ? "LLM" : "规则演示模式"}</Badge>}
        </div>
        <p className="mt-1 text-sm text-zinc-800">{task.inputText}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {fmtDateTime(task.createdAt)} ·{" "}
          {isMock ? `授权书 v${task.mandateVersion}` : <Link href={`/mandate/${task.mandateId}`} className="underline">授权书 v{task.mandateVersion}</Link>}
        </p>
      </div>

      {latest && <DecisionCard decision={latest} taskId={task.id} isMock={isMock} awaiting={task.status === "awaiting_confirmation"} onDone={load} />}

      <div className="grid gap-4 md:grid-cols-5">
        <Card className="md:col-span-2">
          <CardHeader>
            <SectionTag>Agent</SectionTag>
            <CardTitle className="text-base">执行步骤</CardTitle>
          </CardHeader>
          <CardContent>
            {run?.steps.length ? (
              <ol className="space-y-2 border-l border-zinc-200 pl-4">
                {run.steps.map((s, i) => (
                  <li key={i} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-zinc-400" aria-hidden />
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-xs text-zinc-500">{s.tool}</span>
                      <span className="text-[10px] tabular-nums text-zinc-400">{s.ms} ms</span>
                    </div>
                    <p className="text-zinc-700">{s.summary}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-zinc-500">{task.status === "running" ? "Agent 正在开始…" : "没有执行记录。"}</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 md:col-span-3">
          <Card>
            <CardHeader>
              <SectionTag>E-commerce</SectionTag>
              <CardTitle className="text-base">候选对比</CardTitle>
              <CardDescription>按含运费总额排序；金额为实际扣款（商品 + 运费 + 手续费）。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {run?.candidates.length ? (
                run.candidates.slice(0, 3).map((c) => <CandidateRow key={c.productId} c={c} />)
              ) : (
                <p className="text-sm text-zinc-500">还没有候选。</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTag>Payment</SectionTag>
              <CardTitle className="text-base">支付结果</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {cart && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-zinc-600">
                  <dt>购物车</dt><dd className="text-zinc-900">v{cart.version} · {cart.merchantName}</dd>
                  <dt>商品</dt><dd className="text-zinc-900 tabular-nums">{fmtHKD(cart.subtotalMinor)}</dd>
                  <dt>运费</dt><dd className="text-zinc-900 tabular-nums">{fmtHKD(cart.shippingMinor)}</dd>
                  <dt>手续费</dt><dd className="text-zinc-900 tabular-nums">{fmtHKD(cart.consumerFeeMinor)}</dd>
                  <dt>合计</dt><dd className="font-semibold text-zinc-900 tabular-nums">{fmtHKD(cart.totalMinor)}</dd>
                  <dt>支付方式</dt><dd className="text-zinc-900">{METHOD_LABEL[cart.methodId] ?? cart.methodId}</dd>
                </dl>
              )}
              {order?.status === "paid" ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                  <p className="font-medium">已付款 {fmtHKD(order.totalMinor)}，商家 {order.merchantName} 已入账</p>
                  <p className="mt-1 font-mono text-xs">订单 {order.id} · 交易 {order.transactionId}</p>
                  {order.paidAt && <p className="text-xs">{fmtDateTime(order.paidAt)} · 由模拟器执行</p>}
                </div>
              ) : (
                <p className="text-zinc-500">{order ? `订单状态：${order.status}` : "尚未付款。"}</p>
              )}
              {cart && !isMock && (
                <Link href={`/pay-methods?cartId=${cart.cartId}&version=${cart.version}`} className="text-xs underline">
                  查看支付方式比较
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <SectionTag>Trust</SectionTag>
          <CardTitle className="text-base">每一步的判定</CardTitle>
          <CardDescription>规则引擎不使用 LLM；结算时用锁内最新数据重新判定一次。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {decisions.map((dd) => (
            <div key={dd.id} className="flex flex-col gap-1 border-b border-zinc-100 pb-2 last:border-0">
              <div className="flex items-center gap-2 text-sm">
                <OutcomeBadge outcome={dd.outcome} />
                <span className="font-medium">{CHECKPOINT_LABEL[dd.checkpoint] ?? dd.checkpoint}</span>
                {dd.cartVersion !== null && <span className="text-xs text-zinc-500">购物车 v{dd.cartVersion}</span>}
              </div>
              {dd.rules.length > 0 && <RuleList rules={dd.rules} />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function CandidateRow({ c }: { c: CandidateView }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-lg border p-3 ${c.chosen ? "border-zinc-900" : "border-zinc-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            {c.chosen && <span className="mr-1 text-xs text-zinc-500">首选</span>}
            {c.name}
          </p>
          <p className="text-xs text-zinc-500">
            {c.merchantName} ·{" "}
            <span className={c.merchantCredentialStatus === "valid" ? "text-emerald-700" : "text-red-700"}>
              {c.merchantCredentialStatus === "valid" ? "凭证有效" : `凭证 ${c.merchantCredentialStatus}`}
            </span>{" "}
            · 注册 {c.merchantAgeDays} 天 · {c.deliveryDays} 天送达
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums">{fmtHKD(c.totalMinor)}</p>
          <p className="text-[11px] text-zinc-500 tabular-nums">
            {fmtHKD(c.priceMinor)} + 运费 {fmtHKD(c.shippingMinor)}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <OutcomeBadge outcome={c.decision.outcome} />
        {(c.decision.rules.length > 0 || c.explanation) && (
          <button type="button" className="text-xs text-zinc-600 underline" onClick={() => setOpen((v) => !v)}>
            {open ? "收起" : "为什么"}
          </button>
        )}
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          {c.explanation && <p className="text-sm text-zinc-700">{c.explanation}</p>}
          <RuleList rules={c.decision.rules} />
        </div>
      )}
    </div>
  );
}

function DecisionCard({
  decision,
  taskId,
  isMock,
  awaiting,
  onDone,
}: {
  decision: DecisionRecord;
  taskId: string;
  isMock: boolean;
  awaiting: boolean;
  onDone: () => Promise<void>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const reviewIds = decision.rules.filter((r) => r.severity === "REVIEW").map((r) => r.id);
  const canConfirm = decision.outcome === "REVIEW" && awaiting && decision.cartId !== null && decision.cartVersion !== null;
  const now = useNow(30_000);
  const remainingMin =
    now === null ? null : Math.max(0, Math.ceil((new Date(decision.evaluatedAt).getTime() + CONFIRM_TTL_MS - now) / 60_000));

  const confirm = () =>
    start(async () => {
      if (isMock) {
        toast.info("示例数据：接口接通后这里会调用 POST /api/confirmations");
        return;
      }
      try {
        await api("/api/confirmations", {
          method: "POST",
          json: { taskId, cartId: decision.cartId, cartVersion: decision.cartVersion, ruleIds: reviewIds },
        });
        await onDone();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "确认失败");
      }
    });

  const headline =
    decision.outcome === "ALLOW" ? "在你的边界内，已自动处理" : decision.outcome === "REVIEW" ? "需要你确认后才会付款" : "越过了你的边界，已拒绝";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <OutcomeBadge outcome={decision.outcome} className="text-sm" />
          <CardTitle className="text-base">{headline}</CardTitle>
        </div>
        <CardDescription>
          {CHECKPOINT_LABEL[decision.checkpoint] ?? decision.checkpoint} · 依据授权书 v{decision.mandateVersion}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <RuleList rules={decision.rules} emptyText="没有命中任何先问或拒绝规则。" />
        {canConfirm && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <span className="text-amber-900">
              确认将放行：{reviewIds.join("、")}。只对购物车 v{decision.cartVersion} 有效{remainingMin !== null && `，还剩约 ${remainingMin} 分钟`}；价格或商品变化需重新确认。
            </span>
            <Button size="sm" disabled={pending} onClick={confirm}>
              确认购买
            </Button>
          </div>
        )}
        {decision.outcome === "DENY" && (
          <p className="text-sm text-zinc-600">
            拒绝不能通过确认放行。如需继续，请{" "}
            <Link href="/mandate/new" className="underline">修改授权</Link>。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
