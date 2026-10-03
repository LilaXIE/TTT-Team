"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";

export function TaskStartForm({ mandateId, defaultQuery }: { mandateId: string; defaultQuery: string }) {
  const router = useRouter();
  const [text, setText] = useState(`帮我买${defaultQuery}`);
  const [pending, start] = useTransition();
  function submit(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      try {
        const res = await api<{ status: string; autoSettled?: boolean; taskId: string }>("/api/tasks", { method: "POST", json: { mandateId, text } });
        if (res.status === "completed" && res.autoSettled) {
          toast.success("🛡️ 低风险关联购买：Agent 已根据授权边界自动为您代理扣款下单！");
          router.push("/ledger");
        } else {
          toast.info("⚠️ 当前代购任务评估存在需确认项/风险规则，已进入全网比价环节供您选择确认。");
          router.push(`/compare?q=${encodeURIComponent(defaultQuery)}&taskId=${res.taskId}&mandateId=${mandateId}&risk=1`);
        }
      } catch (e) { toast.error(e instanceof ApiError ? e.message : "Agent 执行失败"); }
    });
  }
  return <Card className="max-w-2xl border-zinc-200 shadow-sm"><CardHeader><CardTitle>把任务交给 Agent</CardTitle><CardDescription>Agent 会按照这份授权搜索商品、判断边界并执行允许的动作；完成后可查看真实淘宝比价。</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><Input value={text} onChange={(e) => setText(e.target.value)} placeholder="例如：帮我买洗衣液" required /><div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "Agent 执行中…" : "开始搜索并比价"}</Button></div></form></CardContent></Card>;
}
