"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

export function RevokeButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (disabled) return null;

  if (!confirming) {
    return (
      <Button variant="outline" onClick={() => setConfirming(true)}>
        撤销授权
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm">
      <span className="text-red-800">撤销后 Agent 立即停止付款，已付订单不受影响。</span>
      <Button
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              await api(`/api/mandates/${id}/revoke`, { method: "POST" });
              toast.success("授权已撤销");
              router.refresh();
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "撤销失败");
            }
          })
        }
      >
        确认撤销
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        取消
      </Button>
    </div>
  );
}
