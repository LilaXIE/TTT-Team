"use client";

import { cn } from "cn";
import { ChevronDown, Info, ShieldAlert, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Chip, Money, OutcomeChip, Panel, ProductThumb, SimNote } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { fmtMoneyShort } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { AUTO_PAY_MS, choose, enterCurated, pausePick, payPick, rankedFor, refine, skipPick, type Filters } from "@/lib/mock/agent";
import { merchantOf } from "@/lib/mock/catalog";
import type { Scored } from "@/lib/mock/evaluate";
import { useMock, useNow, useSessionMode } from "@/lib/mock/store";
import type { Block, Delivery, MockTask } from "@/lib/mock/types";
import { RULE_TITLE } from "@/lib/rule-text";
import { ZevSays } from "./blocks";

type PickB = Extract<Block, { kind: "pick" }>;

const DELIVERY_LABEL: Record<Delivery, { zh: string; en: string }> = {
  today: { zh: "今日达", en: "Today" },
  tomorrow: { zh: "次日达", en: "Next day" },
  week: { zh: "7 日内", en: "Within 7 days" },
};

export function PickBlock({ b, index, task }: { b: PickB; index: number; task: MockTask }) {
  const { t, lang } = useLang();
  const s = useMock();
  const mode = useSessionMode();
  const now = useNow(250);
  const [open, setOpen] = useState<null | "alts" | "filter">(null);
  const m = s.mandates.find((x) => x.id === b.mandateId);
  const ranked = useMemo(() => (m ? rankedFor(m.id, m.queryKind) : []), [m]);
  const lastPick = task.blocks.reduce((acc, x, i) => (x.kind === "pick" ? i : acc), -1);
  const isLatest = lastPick === index;
  const x = ranked.find((r) => r.product.id === b.productId);
  const curatedLater = task.blocks.slice(index + 1).some((y) => y.kind === "curated");

  // 已暂停或已不在倒计时状态时，保持展开
  useEffect(() => {
    if (open && b.state === "offered" && b.autoPayAt) pausePick(task.id, index);
  }, [open, b.state, b.autoPayAt, task.id, index]);

  if (!m || !x) return null;
  const p = x.product;
  const mer = merchantOf(p.merchantId);
  const left = b.autoPayAt && now !== null ? Math.max(0, Date.parse(b.autoPayAt) - now) : null;
  const counting = b.state === "offered" && !!b.autoPayAt;

  const stateChip = {
    offered: x.evaluation.outcome === "ALLOW" ? <Chip tone="ok">{t("在授权范围内", "Within mandate")}</Chip> : <OutcomeChip outcome={x.evaluation.outcome} />,
    paid: <Chip tone="ok">{t("已付款", "Paid")}</Chip>,
    awaiting: <OutcomeChip outcome="REVIEW" />,
    denied: <OutcomeChip outcome="DENY" />,
    skipped: <Chip>{t("没有买", "Not bought")}</Chip>,
    declined: <Chip tone="no">{t("付款没成功", "Payment failed")}</Chip>,
  }[b.state];

  return (
    <ZevSays>
      <Panel className={cn("overflow-hidden p-0", (b.state === "skipped" || b.state === "declined") && !isLatest && "opacity-70")}>
        <div className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] text-soft">
              {b.chosenByUser ? t("你选的", "Your choice") : t(`第 ${b.round} 次推荐 · 极速`, `Pick #${b.round} · Quick`)}
            </span>
            {stateChip}
          </div>
          <div className="flex gap-4">
            <ProductThumb product={p} className="size-20 rounded-2xl sm:size-24" />
            <div className="min-w-0 flex-1">
              <div className="text-[16px] leading-snug">{p.name[lang]}</div>
              <div className="mt-1 text-[13px] text-soft">
                {mer.name[lang]} · {mer.delivery === "week" ? t(`${mer.deliveryDays} 天内到`, `${mer.deliveryDays} days`) : DELIVERY_LABEL[mer.delivery][lang]} · {t(`评分 ${(p.rating10 / 10).toFixed(1)}`, `${(p.rating10 / 10).toFixed(1)}★`)} · {t(`已售 ${p.sales}`, `${p.sales} sold`)}
              </div>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Money minor={x.evaluation.total} className="font-heading text-[24px] leading-none" />
                <span className="text-[12px] text-soft tabular">
                  {t("商品", "Item")} {fmtMoneyShort(x.evaluation.subtotal, lang)} + {t("运费", "Ship")} {fmtMoneyShort(x.evaluation.shipping, lang)} + {t("手续费", "Fee")} {fmtMoneyShort(x.evaluation.fee, lang)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-canvas/70 p-3.5">
            <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[12px] text-soft">
              <Sparkles className="size-3.5 text-violet" />
              {task.agentMode === "llm" ? t("推荐理由 · 模型撰写，只作解释", "Why · written by the model, explanation only") : t("推荐理由 · 规则演示模式（模板）", "Why · rules demo mode (template)")}
            </div>
            <p className="text-[14px] leading-relaxed">{b.reason[lang]}</p>
            <ScoreLine x={x} />
          </div>

          {p.injected && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl bg-ask-soft/60 p-3 text-[13px]">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-ask" />
              <span>{t("这件商品的描述里藏着「忽略预算」之类的指令。Zev 只把描述当数据读，规则照常判断。", "This listing hides instructions like “ignore the budget”. Zev reads descriptions as data; the rules apply as usual.")}</span>
            </div>
          )}

          {b.state === "offered" && x.evaluation.outcome === "ALLOW" && (
            <div className="mt-4">
              {counting ? (
                <>
                  <div className="mb-2 flex items-center justify-between text-[13px]">
                    <span>{t(`在范围内，${left === null ? "8" : Math.ceil(left / 1000)} 秒后自动付款`, `Within limits. Paying in ${left === null ? "8" : Math.ceil(left / 1000)}s`)}</span>
                    <span className="text-soft">{t("展开其他选项会暂停", "Opening options pauses this")}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-violet-soft">
                    <div className="h-full rounded-full bg-violet transition-[width] duration-200 ease-linear" style={{ width: `${left === null ? 100 : (left / AUTO_PAY_MS) * 100}%` }} />
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-soft">{t("自动付款已暂停，你来决定。", "Auto-pay paused. Your call.")}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => payPick(task.id, index)} disabled={mode === "attacker"}>
                  {counting ? t("现在付款", "Pay now") : t("确认购买", "Buy it")}
                </Button>
                <Button variant="ghost" onClick={() => skipPick(task.id, index)}>
                  {t("先别买", "Not now")}
                </Button>
              </div>
            </div>
          )}
        </div>

        {isLatest && b.state !== "paid" && !curatedLater && m.status === "active" && (
          <div className="border-t border-line bg-canvas/40">
            <button
              type="button"
              onClick={() => setOpen(open === "alts" ? null : "alts")}
              className="group flex w-full flex-col items-center gap-0.5 py-2.5 text-[12px] text-soft hover:text-ink"
              aria-expanded={open === "alts"}
            >
              {open !== "alts" && t("看看别的", "See others")}
              <ChevronDown className={cn("size-5", open === "alts" ? "rotate-180" : "animate-breathe")} />
            </button>
            {open === "alts" && <Alternatives ranked={ranked} current={p.id} task={task} mandateId={m.id} onFilter={() => setOpen("filter")} />}
            {open === "filter" && <FilterLayer ranked={ranked} capMinor={m.perTxnMinor} onCancel={() => setOpen("alts")} onApply={(f) => refine(task.id, m.id, f)} />}
            <div className="flex justify-center pb-3">
              <button type="button" onClick={() => enterCurated(task.id, m.id)} className="text-[13px] text-violet hover:underline">
                {t("都不太对？帮我细挑", "Not quite? Help me choose carefully")}
              </button>
            </div>
          </div>
        )}
      </Panel>
    </ZevSays>
  );
}

function ScoreLine({ x }: { x: Scored }) {
  const { t } = useLang();
  const [show, setShow] = useState(false);
  return (
    <div className="mt-2.5">
      <button type="button" onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-1.5 text-[12px] text-soft hover:text-ink">
        <Info className="size-3.5" />
        {t(`推荐分 ${x.score} / 100`, `Score ${x.score} / 100`)}
      </button>
      {show && (
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[12px]">
          {[
            { k: t("评分", "Rating"), v: x.parts.rating, max: 50 },
            { k: t("销量", "Sales"), v: x.parts.sales, max: 30 },
            { k: t("含运费价格", "Price"), v: x.parts.price, max: 20 },
          ].map((r) => (
            <div key={r.k} className="rounded-xl bg-white p-2">
              <div className="text-soft">{r.k}</div>
              <div className="tabular">
                {r.v}
                <span className="text-soft">/{r.max}</span>
              </div>
            </div>
          ))}
          <p className="col-span-3 text-left text-soft">{t("推荐分是公开公式，只决定排序；能不能买由授权规则决定。", "The score is a public formula that only sets the order. Whether it can be bought is up to your mandate's rules.")}</p>
        </div>
      )}
    </div>
  );
}

type SortKey = "sales" | "rating" | "price";

function Alternatives({ ranked, current, task, mandateId, onFilter }: { ranked: Scored[]; current: string; task: MockTask; mandateId: string; onFilter: () => void }) {
  const { t, lang } = useLang();
  const [sort, setSort] = useState<SortKey>("sales");
  const list = ranked
    .filter((r) => r.product.id !== current)
    .slice()
    .sort((a, b) =>
      sort === "sales" ? b.product.sales - a.product.sales : sort === "rating" ? b.product.rating10 - a.product.rating10 : a.evaluation.total < b.evaluation.total ? -1 : a.evaluation.total > b.evaluation.total ? 1 : 0,
    )
    .slice(0, 3);
  const tabs: { k: SortKey; label: string }[] = [
    { k: "sales", label: t("销量最高", "Best selling") },
    { k: "rating", label: t("好评最多", "Top rated") },
    { k: "price", label: t("价格最低", "Lowest price") },
  ];
  return (
    <div className="px-4 pb-2 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-full bg-white p-1 ring-1 ring-line">
          {tabs.map((tab) => (
            <button
              key={tab.k}
              type="button"
              onClick={() => setSort(tab.k)}
              className={cn("h-7 rounded-full px-3 text-[12px] transition-colors", sort === tab.k ? "bg-ink text-white" : "text-soft hover:text-ink")}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onFilter} className="inline-flex items-center gap-1.5 text-[12px] text-violet hover:underline">
          <SlidersHorizontal className="size-3.5" />
          {t("再筛一下", "Filter")}
        </button>
      </div>
      <ul className="space-y-2">
        {list.map((r) => {
          const deny = r.evaluation.outcome === "DENY";
          const mer = merchantOf(r.product.merchantId);
          return (
            <li key={r.product.id} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 ring-1 ring-line">
              <ProductThumb product={r.product} className="size-11 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px]">{r.product.name[lang]}</div>
                <div className="truncate text-[12px] text-soft">
                  {mer.name[lang]} · {t(`评分 ${(r.product.rating10 / 10).toFixed(1)}`, `${(r.product.rating10 / 10).toFixed(1)}★`)} · {t(`已售 ${r.product.sales}`, `${r.product.sales} sold`)}
                  {r.product.injected && <span className="ml-1 text-ask">· {t("描述可疑，已忽略", "suspicious text ignored")}</span>}
                </div>
                {deny && <div className="truncate text-[12px] text-no">{r.evaluation.rules.filter((x) => x.severity === "DENY").map((x) => RULE_TITLE[x.id][lang]).join(t("、", ", "))}</div>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Money minor={r.evaluation.total} className="text-[14px]" />
                <OutcomeChip outcome={r.evaluation.outcome} mode="preview" className="h-5 px-2 text-[11px]" />
              </div>
              <Button size="sm" variant={deny ? "ghost" : "outline"} disabled={deny} onClick={() => choose(task.id, mandateId, r.product.id)}>
                {t("选这件", "Pick")}
              </Button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[12px] text-soft">{t("你亲自选的也一样要过规则：范围内直接付，「先问你」的会等你确认，「拒绝」的选不了。", "Your own picks go through the same rules: in-range pays, ask-first waits for you, declined can't be picked.")}</p>
    </div>
  );
}

function FilterLayer({ ranked, capMinor, onCancel, onApply }: { ranked: Scored[]; capMinor: string; onCancel: () => void; onApply: (f: Filters) => void }) {
  const { t, lang } = useLang();
  // 滑块按 $10一档，档位是序号而不是金额本身
  const STEP = 1000n;
  const steps = Number(BigInt(capMinor) / STEP);
  const [idx, setIdx] = useState(steps);
  const [delivery, setDelivery] = useState<Delivery[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const maxMinor = (BigInt(idx) * STEP).toString();
  const allBrands = Array.from(new Map(ranked.map((r) => [r.product.brand.zh, r.product.brand])).values());
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <div className="space-y-5 px-4 pt-1 pb-4 sm:px-5">
      <div>
        <div className="mb-3 flex items-baseline justify-between text-[13px]">
          <span className="text-soft">{t("含运费最多", "Max with shipping")}</span>
          <span className="tabular">{fmtMoneyShort(maxMinor, lang)}</span>
        </div>
        <Slider value={idx} min={1} max={steps} onValueChange={(v) => setIdx(Array.isArray(v) ? v[0] : v)} />
        <div className="mt-1.5 flex justify-between text-[11px] text-soft">
          <span>{fmtMoneyShort(STEP, lang)}</span>
          <span>{t(`上限 = 你的单笔上限 ${fmtMoneyShort(capMinor, lang)}`, `Max = your cap ${fmtMoneyShort(capMinor, lang)}`)}</span>
        </div>
      </div>
      <div>
        <div className="mb-2 text-[13px] text-soft">{t("送达时间", "Delivery")}</div>
        <div className="flex flex-wrap gap-2">
          {(["today", "tomorrow", "week"] as Delivery[]).map((d) => (
            <FilterPill key={d} on={delivery.includes(d)} onClick={() => setDelivery(toggle(delivery, d))}>
              {DELIVERY_LABEL[d][lang]}
            </FilterPill>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-[13px] text-soft">{t("品牌", "Brand")}</div>
        <div className="flex flex-wrap gap-2">
          {allBrands.map((br) => (
            <FilterPill key={br.zh} on={brands.includes(br.zh)} onClick={() => setBrands(toggle(brands, br.zh))}>
              {br[lang]}
            </FilterPill>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => onApply({ maxMinor, delivery, brands })}>{t("确认", "Apply")}</Button>
        <Button variant="ghost" onClick={onCancel}>
          {t("返回", "Back")}
        </Button>
        <SimNote className="ml-auto">{t("送达时间为模拟设定", "Delivery times simulated")}</SimNote>
      </div>
    </div>
  );
}

function FilterPill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn("h-8 rounded-full border px-3 text-[13px] transition-colors", on ? "border-violet bg-violet-soft text-violet" : "border-line bg-white hover:border-soft/50")}
    >
      {children}
    </button>
  );
}
