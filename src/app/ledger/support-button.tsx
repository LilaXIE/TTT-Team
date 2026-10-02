"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type { SupportRequest, SupportTicket } from "@/lib/task-view";

const TYPE_LABEL: Record<SupportTicket["type"], string> = { refund: "退款", return: "退货" };

export function SupportButton({ orderId, existing, isMock }: { orderId: string; existing: SupportTicket | null; isMock: boolean }) {
  const [ticket, setTicket] = useState<SupportTicket | null>(existing);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<SupportTicket["type"]>("refund");
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const trimmed = reason.trim();

  if (ticket) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-medium">已提交人工处理；当前订单尚未退款。</p>
        <p className="mt-1 text-xs">
          工单 <span className="font-mono">{ticket.id}</span> · {TYPE_LABEL[ticket.type]} · {fmtDateTime(ticket.createdAt)}
        </p>
      </div>
    );
  }

  const submit = () =>
    start(async () => {
      const body: SupportRequest = { type, reason: trimmed };
      if (isMock) {
        setTicket({ id: "mock-support-1", type, reason: trimmed, status: "manual_review", createdAt: new Date().toISOString() });
        setOpen(false);
        toast.info(`示例数据：接口接通后这里会调用 POST /api/orders/${orderId}/support`);
        return;
      }
      try {
        setTicket(await api<SupportTicket>(`/api/orders/${orderId}/support`, { method: "POST", json: body }));
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "提交失败");
      }
    });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        申请退款/退货
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => !pending && setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-title"
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 id="support-title" className="text-base font-semibold">
                申请退款/退货
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                订单 <span className="font-mono">{orderId}</span>。提交后由人工处理，不会自动退款，余额和订单状态暂不变化。
              </p>
            </div>
            <div className="flex gap-2">
              {(Object.keys(TYPE_LABEL) as SupportTicket["type"][]).map((t) => (
                <Button key={t} size="sm" variant={type === t ? "default" : "outline"} onClick={() => setType(t)}>
                  {TYPE_LABEL[t]}
                </Button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="support-reason">原因</Label>
              <Textarea
                id="support-reason"
                value={reason}
                maxLength={500}
                placeholder="例如：收到的商品包装破损"
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button size="sm" disabled={pending || trimmed.length < 2} onClick={submit}>
                提交
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
