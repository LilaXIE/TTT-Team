"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { RuleList } from "@/components/decision-badge";
import { MockBanner, SectionTag } from "@/components/section-tag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { fmtDateTime, fmtHKD } from "@/lib/format";
import { MOCK_INBOX } from "@/lib/mock-tasks";
import { METHOD_LABEL, type ConfirmationRequest, type InboxItem, type InboxResponse, type TaskDetail } from "@/lib/task-view";
import { useNow } from "@/lib/use-now";

interface InboxState {
  items: InboxItem[];
  receivedAt: number;
  isMock: boolean;
  mockReason: string | null;
}

export function InboxView() {
  const router = useRouter();
  const [state, setState] = useState<InboxState | null>(null);
  const now = useNow(1000);

  const load = useCallback(async () => {
    try {
      const res = await api<InboxResponse>("/api/inbox");
      setState({ items: res.items, receivedAt: Date.now(), isMock: false, mockReason: null });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace("/login");
        return;
      }
      const why = e instanceof ApiError ? `GET /api/inbox 返回 ${e.status}` : "GET /api/inbox 无法访问";
      setState({ items: MOCK_INBOX.items, receivedAt: Date.now(), isMock: true, mockReason: `${why}，暂时显示 mock-s2。` });
    }
  }, [router]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const dropLocal = (taskId: string) =>
    setState((s) => (s ? { ...s, items: s.items.filter((i) => i.task.id !== taskId) } : s));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">待确认</h1>
        <p className="mt-1 text-sm text-zinc-600">
          这些购买命中了你在授权书里写的「先问我」条件。确认只对当时那份购物车有效，30 分钟内有效；价格、商品、商家或支付方式变化后需要重新确认。
        </p>
      </div>

      {state?.isMock && <MockBanner>{state.mockReason}</MockBanner>}

      {!state ? (
        <p className="text-sm text-zinc-500">加载中…</p>
      ) : state.items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-zinc-600">
            没有等你确认的任务。
            <div className="mt-3">
              <Link href="/" className="underline">回到首页</Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        state.items.map((item) => (
          <InboxCard
            key={item.task.id}
            item={item}
            deadline={state.receivedAt + item.remainingSeconds * 1000}
            now={now}
            isMock={state.isMock}
            onReload={load}
            onDropLocal={dropLocal}
          />
        ))
      )}
    </div>
  );
}

function fmtCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function InboxCard({
  item,
  deadline,
  now,
  isMock,
  onReload,
  onDropLocal,
}: {
  item: InboxItem;
  deadline: number;
  now: number | null;
  isMock: boolean;
  onReload: () => Promise<void>;
  onDropLocal: (taskId: string) => void;
}) {
  const [pending, start] = useTransition();
  const { task, cart, decision } = item;
  const reviewIds = decision.rules.filter((r) => r.severity === "REVIEW").map((r) => r.id);
  const blocking = decision.rules.some((r) => r.data?.blocking === true);
  const leftMs = now === null ? null : deadline - now;
  const expired = leftMs !== null && leftMs <= 0;
  const canConfirm =
    decision.outcome === "REVIEW" && !blocking && !expired && leftMs !== null && decision.cartId !== null && decision.cartVersion !== null;

  const confirm = () =>
    start(async () => {
      if (isMock) {
        toast.info("示例数据：接口接通后这里会调用 POST /api/confirmations");
        return;
      }
      const body: ConfirmationRequest = { taskId: task.id, cartId: decision.cartId!, cartVersion: decision.cartVersion!, ruleIds: reviewIds };
      try {
        const res = await api<TaskDetail | null>("/api/confirmations", { method: "POST", json: body });
        const status = res?.task?.status;
        if (status === "completed" || res?.order?.status === "paid") toast.success("已确认，Agent 已完成付款");
        else if (status === "awaiting_confirmation") toast.warning("购物车已变化，请重新确认");
        else toast.info("已确认，结果见任务页");
        await onReload();
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "确认失败");
      }
    });

  const cancel = () =>
    start(async () => {
      if (isMock) {
        onDropLocal(task.id);
        toast.info("示例数据：接口接通后这里会调用 POST /api/tasks/[id]/cancel");
        return;
      }
      try {
        await api(`/api/tasks/${task.id}/cancel`, { method: "POST" });
        toast.success("已取消，Agent 不会购买这件商品");
        await onReload();
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "取消失败");
      }
    });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">
            <Link href={`/task/${task.id}`} className="hover:underline">
              {task.inputText}
            </Link>
          </CardTitle>
          {expired ? (
            <Badge variant="secondary">已过期</Badge>
          ) : (
            <Badge variant="outline" className="tabular-nums">
              {leftMs === null ? "剩余 --:--" : `剩余 ${fmtCountdown(leftMs)}`}
            </Badge>
          )}
        </div>
        <CardDescription>
          {fmtDateTime(task.createdAt)} ·{" "}
          {isMock ? `授权书 v${task.mandateVersion}` : <Link href={`/mandate/${task.mandateId}`} className="underline">授权书 v{task.mandateVersion}</Link>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <SectionTag>E-commerce</SectionTag>
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="text-zinc-800">
              {cart.merchantName} · {cart.items.map((i) => `${i.name} ×${i.qty}`).join("、")}
            </span>
            <span className="font-semibold tabular-nums">{fmtHKD(cart.totalMinor)}</span>
          </div>
          <p className="text-xs text-zinc-500">
            购物车 v{cart.version} · 商品 {fmtHKD(cart.subtotalMinor)} + 运费 {fmtHKD(cart.shippingMinor)} + 手续费 {fmtHKD(cart.consumerFeeMinor)} ·{" "}
            {METHOD_LABEL[cart.methodId] ?? cart.methodId}
          </p>
        </div>

        <div className="space-y-1">
          <SectionTag>Trust</SectionTag>
          <p className="text-xs text-zinc-500">为什么要先问你</p>
          <RuleList rules={decision.rules} />
        </div>

        {expired ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
            已过期：确认窗口已超过 30 分钟，Agent 不会付款。需要的话请重新把任务交给 Agent。
          </p>
        ) : blocking ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            缺少必要信息，确认不能放行；需要补齐后重新评估。
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <span className="flex-1 text-amber-900">
              确认将放行：{reviewIds.join("、")}。只对购物车 v{decision.cartVersion} 有效。
            </span>
            <div className="flex gap-2">
              <Button size="sm" disabled={pending || !canConfirm} onClick={confirm}>
                确认购买
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={cancel}>
                取消
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
