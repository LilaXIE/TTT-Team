"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";

export function NewTaskForm({ mandateId, defaultText }: { mandateId: string; defaultText: string }) {
  const router = useRouter();
  const [text, setText] = useState(defaultText);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      try {
        const res = await api<{ task: { id: string } }>("/api/tasks", { method: "POST", json: { mandateId, text } });
        router.push(`/task/${res.task.id}`);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "创建任务失败");
      }
    });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={200} rows={3} />
      <Button type="submit" disabled={pending || text.trim().length < 2} className="w-full">
        {pending ? "Agent 正在比较和判定…" : "开始"}
      </Button>
    </form>
  );
}
