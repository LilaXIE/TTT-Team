"use client";

import { ArrowRight, ArrowUp, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MandateCard, QuotaRing } from "@/components/app/mandate-card";
import { Countdown, Money, OutcomeChip, Panel, PanelTitle, ProductThumb, ZevAvatar } from "@/components/app/primitives";
import { SecurityCard } from "@/components/app/security-card";
import { TaskStatusChip } from "@/components/app/task-status";
import { buttonVariants } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { catalogToken, merchantOf, productOf } from "@/lib/mock/catalog";
import { activeMandates, openPending, useMock, useNow } from "@/lib/mock/store";

export const SUGGESTIONS = [
  { zh: "帮我补一瓶洗衣液，2L 以上，HK$150 以内，可以换牌子，这周内买到。", en: "Restock laundry liquid: 2L or more, under HK$150, any brand, within this week." },
  { zh: "再买一包纸巾。", en: "Buy another pack of tissue." },
  { zh: "帮我细挑一个黑色、极简的保温杯。", en: "Help me carefully pick a black, minimal tumbler." },
  { zh: "帮我买一瓶洗洁精。", en: "Buy a bottle of dish soap." },
];

export function HomeView() {
  const { t, lang } = useLang();
  const router = useRouter();
  const s = useMock();
  const now = useNow(30_000);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const daily = activeMandates(s)[0] ?? s.mandates[0];
  const pending = now === null ? [] : openPending(s, now);
  const hour = now === null ? null : Number(new Date(now).toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Hong_Kong" }));
  const greeting =
    hour === null ? t("你好", "Hello") : hour < 12 ? t("早上好", "Good morning") : hour < 18 ? t("下午好", "Good afternoon") : t("晚上好", "Good evening");

  const go = async (q: string) => {
    const clean = q.trim();
    if (!clean || sending) return;
    setSending(true);
    let next = clean;
    try {
      const draft = await api<{ query: string; message: string; mode: "llm" | "fallback" }>("/api/chat", { method: "POST", json: { message: clean } });
      if (draft.query.trim() && !clean.includes(draft.query)) {
        const merged = `${clean}（${draft.query}）`;
        const before = catalogToken(clean);
        const after = catalogToken(merged);
        if (!before || before === after) next = merged;
      }
      sessionStorage.setItem("mw.chatReply", JSON.stringify({ reply: draft.message, mode: draft.mode }));
    } catch {
      sessionStorage.removeItem("mw.chatReply");
    }
    router.push(`/task/new?q=${encodeURIComponent(next)}`);
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="relative overflow-hidden rounded-[24px] border border-line bg-[linear-gradient(135deg,#ffffff_0%,#f6f4ff_55%,#ecebff_100%)] p-6 sm:p-8">
          <div className="flex items-center gap-2.5 text-[13px] text-soft">
            <ZevAvatar className="size-7" />
            Zev
          </div>
          <h1 className="mt-5 font-heading text-[30px] leading-tight sm:text-[40px]">
            {greeting}
            {t("，", ", ")}
            {s.user.name}
          </h1>
          <p className="mt-2 text-[15px] text-soft">{t("想让 Zev 帮你买什么？说清楚边界，范围内它直接买。", "What should Zev buy? Set the boundary once and it buys within it.")}</p>
          <form
            className="mt-6 flex items-end gap-2 rounded-[20px] border border-line bg-white p-2 pl-4 focus-within:border-violet"
            onSubmit={(e) => {
              e.preventDefault();
              void go(text);
            }}
          >
            <textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void go(text);
                }
              }}
              placeholder={t("例如：帮我补一瓶洗衣液，HK$150 以内…", "e.g. Restock laundry liquid under HK$150…")}
              className="min-h-12 flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-soft"
            />
            <button type="submit" className="grid size-10 shrink-0 place-items-center rounded-full bg-violet text-white disabled:opacity-40" disabled={!text.trim() || sending} aria-label={t("发送", "Send")}>
              <ArrowUp className="size-5" />
            </button>
          </form>
          {sending ? <p className="mt-2 text-[13px] text-soft">{t("DeepSeek 在读这句话…", "DeepSeek is reading that…")}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((q) => (
              <button key={q.zh} type="button" onClick={() => void go(q[lang])} className="rounded-full border border-line bg-white/80 px-3 py-1.5 text-left text-[13px] text-ink/80 hover:border-violet hover:text-ink">
                {q[lang]}
              </button>
            ))}
          </div>
        </section>
        <SecurityCard />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Panel className="flex items-center gap-5">
          <QuotaRing remaining={daily.remainingMinor} total={daily.totalMinor} size={112}>
            <div>
              <div className="text-[11px] text-soft">{t("剩余", "Left")}</div>
              <div className="tabular text-[15px] font-medium">{daily.remainingPurchases}/{daily.maxPurchases}</div>
              <div className="text-[11px] text-soft">{t("次", "buys")}</div>
            </div>
          </QuotaRing>
          <div className="min-w-0">
            <div className="text-[13px] text-soft">{t("剩余额度", "Remaining")} · {daily.title[lang]}</div>
            <Money minor={daily.remainingMinor} className="mt-1 block font-heading text-[26px] leading-tight" />
            <div className="text-[12px] text-soft">
              {t("共", "of")} <Money minor={daily.totalMinor} />
              {" · "}
              {t("签过的额度里还没用完的，不是账户现金", "unused allowance you signed, not cash")}
            </div>
            <Link href={`/mandate/${daily.id}`} className="mt-2 inline-flex items-center gap-1 text-[13px] text-violet hover:underline">
              {t("看边界", "See limits")} <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </Panel>

        <Panel className="flex flex-col">
          <div className="text-[13px] text-soft">{t("待确认", "To approve")}</div>
          <div className="mt-1 font-heading text-[26px] leading-tight">{now === null ? "–" : pending.length}</div>
          {pending[0] ? (
            <div className="mt-2 text-[13px] text-soft">
              {productOf(pending[0].productId).name[lang]} · <Countdown until={pending[0].expiresAt} className="text-ask" /> {t("后过期", "left")}
            </div>
          ) : (
            <div className="mt-2 text-[13px] text-soft">{t("没有需要你确认的。", "Nothing needs you.")}</div>
          )}
          <Link href="/inbox" className="mt-auto inline-flex items-center gap-1 pt-3 text-[13px] text-violet hover:underline">
            {t("去确认", "Review")} <ChevronRight className="size-3.5" />
          </Link>
        </Panel>

        <Panel className="flex flex-col">
          <div className="text-[13px] text-soft">{t("Agent 零钱包", "Agent pocket")}</div>
          <Money minor={s.pocketMinor} className="mt-1 block font-heading text-[26px] leading-tight" />
          <div className="mt-2 text-[13px] text-soft">{t("从 Tap & Go 充进来、只给 Zev 用的钱。和授权额度不会自动互转。", "Money moved in from Tap & Go, only for Zev. It does not become mandate allowance on its own.")}</div>
          <Link href="/wallet" className="mt-auto inline-flex items-center gap-1 pt-3 text-[13px] text-violet hover:underline">
            {t("打开钱包", "Open wallet")} <ChevronRight className="size-3.5" />
          </Link>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Panel>
          <PanelTitle
            action={
              <Link href="/task/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
                {t("新任务", "New task")}
              </Link>
            }
          >
            {t("任务", "Tasks")}
          </PanelTitle>
          <ul className="-mx-2">
            {s.tasks.map((task) => (
              <li key={task.id}>
                <Link href={`/task/${task.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-3 hover:bg-canvas">
                  <ZevAvatar working={task.status === "running"} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px]">{task.title[lang]}</div>
                    <div className="truncate text-[12.5px] text-soft">
                      {task.timeline.at(-1)?.title[lang] ?? t("起草中", "Drafting")} · {fmtDateTime(task.createdAt, lang)}
                    </div>
                  </div>
                  <TaskStatusChip status={task.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelTitle
            action={
              <Link href="/ledger" className="text-[13px] text-violet hover:underline">
                {t("全部记录", "All records")}
              </Link>
            }
          >
            {t("最近交易", "Recent")}
          </PanelTitle>
          <ul className="grid gap-1">
            {s.orders.slice(0, 4).map((o) => {
              const p = productOf(o.productId);
              return (
                <li key={o.id} className="flex items-center gap-3 py-2">
                  <ProductThumb product={p} className="size-11 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{p.name[lang]}</div>
                    <div className="truncate text-[12px] text-soft">
                      {merchantOf(o.merchantId).name[lang]} · {fmtDateTime(o.paidAt, lang)}
                    </div>
                  </div>
                  <div className="text-right">
                    <Money minor={o.totalMinor} className="text-sm" />
                    <div className="mt-0.5">
                      <OutcomeChip outcome={o.confirmedRules.length ? "REVIEW" : "ALLOW"} className="h-5 px-2 text-[11px]" />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-[19px]">{t("我的授权", "My mandates")}</h2>
          <Link href="/mandate/new" className="inline-flex items-center gap-1 text-[13px] text-violet hover:underline">
            {t("新建授权", "New mandate")} <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {s.mandates.map((m) => (
            <MandateCard key={m.id} m={m} href={`/mandate/${m.id}`} compact />
          ))}
        </div>
      </section>
    </div>
  );
}
