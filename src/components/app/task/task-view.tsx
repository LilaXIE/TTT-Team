"use client";

import { cn } from "cn";
import { ArrowLeft, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Eyebrow, OutcomeChip, Panel, ZevAvatar } from "@/components/app/primitives";
import { TaskStatusChip } from "@/components/app/task-status";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { followUp, startTask } from "@/lib/mock/agent";
import { useMock, useNow, useSessionMode } from "@/lib/mock/store";
import type { Block, MockTask, TimelineStep } from "@/lib/mock/types";
import { AwaitingBlock, DeniedBlock, DraftBlock, HintBlock, InScopeBlock, ReceiptBlock, UserBubble, WorkingBlock, ZevBlock } from "./blocks";
import { CuratedBlock, ShortlistBlock } from "./curated-block";
import { PickBlock } from "./pick-block";

function BlockView({ b, index, task }: { b: Block; index: number; task: MockTask }) {
  switch (b.kind) {
    case "user":
      return <UserBubble b={b} />;
    case "zev":
      return <ZevBlock b={b} />;
    case "draft":
      return <DraftBlock b={b} index={index} taskId={task.id} />;
    case "in_scope":
      return <InScopeBlock b={b} />;
    case "working":
      return <WorkingBlock b={b} index={index} task={task} />;
    case "pick":
      return <PickBlock b={b} index={index} task={task} />;
    case "receipt":
      return <ReceiptBlock b={b} />;
    case "awaiting":
      return <AwaitingBlock b={b} />;
    case "denied":
      return <DeniedBlock b={b} taskId={task.id} />;
    case "hint":
      return <HintBlock />;
    case "curated":
      return <CuratedBlock b={b} index={index} task={task} />;
    case "shortlist":
      return <ShortlistBlock b={b} index={index} task={task} />;
  }
}

export function Composer({ onSend, placeholder, autoFocus, disabled }: { onSend: (text: string) => void; placeholder: string; autoFocus?: boolean; disabled?: boolean }) {
  const { t } = useLang();
  const [text, setText] = useState("");
  const send = () => {
    const v = text.trim();
    if (!v || disabled) return;
    onSend(v);
    setText("");
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="flex items-end gap-2 rounded-[22px] border border-line bg-white p-2 pl-4 shadow-[0_8px_30px_-12px_rgba(28,27,31,0.18)] focus-within:border-violet/50"
    >
      <textarea
        id="task-composer"
        rows={1}
        value={text}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        placeholder={placeholder}
        className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2.5 text-[15px] outline-none placeholder:text-soft disabled:cursor-not-allowed"
      />
      <Button type="submit" size="icon" disabled={!text.trim() || disabled} aria-label={t("发送", "Send")}>
        <ArrowUp />
      </Button>
    </form>
  );
}

const CHECKPOINT: Record<TimelineStep["checkpoint"], { zh: string; en: string }> = {
  INTENT: { zh: "理解", en: "Intent" },
  SEARCH: { zh: "搜索", en: "Search" },
  CANDIDATES: { zh: "候选", en: "Candidates" },
  QUOTE: { zh: "报价", en: "Quote" },
  ROUTE: { zh: "推荐", en: "Pick" },
  PAY: { zh: "付款", en: "Pay" },
};

export function Timeline({ task, className }: { task: MockTask; className?: string }) {
  const { t, lang } = useLang();
  return (
    <Panel className={cn("p-5", className)}>
      <div className="mb-1 flex items-center gap-2">
        <ZevAvatar working={task.status === "running"} className="size-7" />
        <h2 className="font-heading text-[17px]">{t("Zev 的工作记录", "Zev's work log")}</h2>
      </div>
      <p className="mb-5 text-[12px] leading-relaxed text-soft">
        {task.agentMode === "llm"
          ? t("模型负责理解和解释；金额、能不能买，都由规则决定。", "The model reads and explains. Amounts and decisions come from the rules.")
          : t("规则演示模式：不调用模型，结果完全一样由规则决定。", "Rules demo mode: no model is called; the rules decide exactly as before.")}
      </p>
      {task.timeline.length === 0 ? (
        <p className="text-[13px] text-soft">{t("还没有开始。", "Nothing yet.")}</p>
      ) : (
        <ol className="relative space-y-5 before:absolute before:top-1.5 before:bottom-1.5 before:left-[5px] before:w-px before:bg-line">
          {task.timeline.map((s, i) => (
            <li key={i} className="relative pl-6">
              <span className={cn("absolute top-1.5 left-0 size-[11px] rounded-full border-2 border-white", s.outcome === "DENY" ? "bg-no" : s.outcome === "REVIEW" ? "bg-ask" : s.outcome === "ALLOW" ? "bg-ok" : "bg-violet")} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] tracking-[0.12em] text-soft uppercase">{CHECKPOINT[s.checkpoint][lang]}</span>
                {s.outcome && <OutcomeChip outcome={s.outcome} mode="result" className="h-5 px-2 text-[10px]" />}
              </div>
              <div className="mt-0.5 text-[14px] leading-snug">{s.title[lang]}</div>
              <p className="mt-1 text-[12px] leading-relaxed text-soft">{s.detail[lang]}</p>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-6 border-t border-line pt-4 text-[11px] leading-relaxed text-soft">
        {t("商品描述只当数据读，不会变成 Zev 的指令。", "Product descriptions are read as data and never become instructions for Zev.")}
      </p>
    </Panel>
  );
}

export function TaskView({ taskId }: { taskId: string }) {
  const { t, lang } = useLang();
  const s = useMock();
  const router = useRouter();
  const mode = useSessionMode();
  const mounted = useNow(60_000) !== null;
  const task = s.tasks.find((x) => x.id === taskId);
  const bottom = useRef<HTMLDivElement>(null);
  const count = task?.blocks.length ?? 0;

  useEffect(() => {
    if (count > 1) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [count]);

  if (!task) {
    return mounted ? (
      <Panel className="mx-auto max-w-lg text-center">
        <p className="font-heading text-xl">{t("找不到这个任务", "Task not found")}</p>
        <p className="mt-2 text-sm text-soft">{t("可能是演示数据被重置了。", "The demo data may have been reset.")}</p>
        <Link href="/" className="mt-4 inline-block text-violet hover:underline">
          {t("回到首页", "Back home")}
        </Link>
      </Panel>
    ) : (
      <div className="h-64 animate-pulse rounded-[20px] bg-white/60" />
    );
  }

  const send = (text: string) => {
    const next = followUp(task.id, text);
    if (next && next !== task.id) router.push(`/task/${next}`);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/" className="grid size-9 place-items-center rounded-full border border-line bg-white text-soft hover:text-ink" aria-label={t("返回", "Back")}>
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <Eyebrow>
              {task.mode === "curated" ? t("精选", "Curated") : t("极速", "Quick")} · {fmtDateTime(task.createdAt, lang)}
            </Eyebrow>
            <h1 className="mt-1 truncate font-heading text-[26px] leading-tight">{task.title[lang]}</h1>
          </div>
          <TaskStatusChip status={task.status} />
        </div>

        <div className="space-y-5">
          {task.blocks.map((b, i) => (
            <BlockView key={i} b={b} index={i} task={task} />
          ))}
        </div>
        <div ref={bottom} className="h-4" />

        <div className="sticky bottom-20 z-10 mt-6 md:bottom-4">
          <Composer
            onSend={send}
            disabled={mode === "attacker" || s.session.frozen}
            placeholder={
              mode === "attacker"
                ? t("这台设备只能查看", "This device is read-only")
                : s.session.frozen
                  ? t("账号已冻结", "Account frozen")
                  : t("补充要求，如「要今天到」", "Add a detail, e.g. “arrives today”")
            }
          />
        </div>

        <Timeline task={task} className="mt-8 xl:hidden" />
      </div>
      <div className="hidden xl:block">
        <Timeline task={task} className="sticky top-24" />
      </div>
    </div>
  );
}

/** /task/new：没有 ?q= 时显示空白的开始页 */
export function NewTask({ q }: { q?: string }) {
  const { t } = useLang();
  const router = useRouter();
  const mode = useSessionMode();
  const s = useMock();
  const started = useRef(false);

  useEffect(() => {
    if (!q || started.current) return;
    started.current = true;
    const id = startTask(q);
    router.replace(`/task/${id}`);
  }, [q, router]);

  const start = (text: string) => {
    const id = startTask(text);
    router.push(`/task/${id}`);
  };

  const examples = [
    t("帮我补一瓶洗衣液，2L 以上，HK$150 以内，可以换牌子，这周内买到。", "Restock laundry liquid, 2L+, under HK$150, other brands OK, this week."),
    t("再补一瓶洗衣液。", "Another bottle of laundry liquid."),
    t("买一包纸巾，100 块以内。", "A pack of tissue, under HK$100."),
    t("帮我细挑一个黑色、极简的保温杯。", "Help me choose a black, minimal tumbler."),
  ];

  if (q) return <div className="h-64 animate-pulse rounded-[20px] bg-white/60" />;

  return (
    <div className="mx-auto max-w-2xl pt-6 sm:pt-12">
      <div className="mb-8 text-center">
        <ZevAvatar className="mx-auto mb-5 size-14" working />
        <h1 className="font-heading text-[30px] leading-tight sm:text-[38px]">{t("要 Zev 帮你买什么？", "What should Zev buy?")}</h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-soft">
          {t("说一句就行。超出已有授权时，Zev 会先起草一份让你签；在范围内的，直接去办。", "One sentence is enough. If it's outside your mandates, Zev drafts one for you to sign. If it's inside, Zev just does it.")}
        </p>
      </div>
      <Composer
        onSend={start}
        autoFocus
        disabled={mode === "attacker" || s.session.frozen}
        placeholder={mode === "attacker" ? t("这台设备只能查看", "This device is read-only") : t("比如：帮我补一瓶洗衣液，150 以内", "e.g. Restock laundry liquid under HK$150")}
      />
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {examples.map((e) => (
          <button
            key={e}
            type="button"
            disabled={mode === "attacker" || s.session.frozen}
            onClick={() => start(e)}
            className="rounded-full border border-line bg-white px-3.5 py-2 text-left text-[13px] transition-colors hover:border-violet hover:text-violet disabled:opacity-50"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
