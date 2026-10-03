"use client";

import { cn } from "cn";
import { ChevronDown, Clock, MessageSquareText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Chip, Eyebrow, Money, OutcomeChip, PageHeader, Panel, PanelTitle, ProductThumb, SimNote } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fmtDateTime } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { METHODS, merchantOf, productOf } from "@/lib/mock/catalog";
import { actions, useMock, useSessionMode } from "@/lib/mock/store";
import type { MockOrder } from "@/lib/mock/types";
import { RULE_TITLE, ruleText } from "@/lib/rule-text";

type Filter = "all" | "auto" | "confirmed" | "support";

/** 引擎逐项检查的边界（未命中即通过） */
const CHECKED = [
  { zh: "授权有效", en: "Mandate active" },
  { zh: "商家凭证", en: "Merchant credential" },
  { zh: "品类", en: "Category" },
  { zh: "规格", en: "Spec" },
  { zh: "单笔上限", en: "Per-order cap" },
  { zh: "剩余额度", en: "Remaining budget" },
  { zh: "次数", en: "Purchases left" },
  { zh: "支付方式", en: "Payment method" },
];

export function LedgerView({ focus }: { focus?: string }) {
  const { t } = useLang();
  const s = useMock();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(focus ?? null);
  useEffect(() => {
    if (focus) document.getElementById(`order-${focus}`)?.scrollIntoView({ block: "center" });
  }, [focus]);

  const orders = s.orders.filter((o) =>
    filter === "all" ? true : filter === "auto" ? o.confirmedRules.length === 0 : filter === "confirmed" ? o.confirmedRules.length > 0 : o.support !== "none",
  );
  const tabs: { k: Filter; label: string }[] = [
    { k: "all", label: t("全部", "All") },
    { k: "auto", label: t("直接完成", "Auto-paid") },
    { k: "confirmed", label: t("你确认过的", "Approved by you") },
    { k: "support", label: t("售后中", "With support") },
  ];

  return (
    <>
      <PageHeader eyebrow={t("记录", "Records")} title={t("每一笔都能追溯", "Every order, fully traceable")} description={t("从你签的授权，到 Zev 看过的候选、规则怎么判、用什么付的款，都在这里。", "From the mandate you signed to what Zev looked at, how the rules decided and how it paid.")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="mb-4 inline-flex flex-wrap rounded-full bg-white p-1 ring-1 ring-line">
            {tabs.map((tab) => (
              <button key={tab.k} type="button" onClick={() => setFilter(tab.k)} className={cn("h-8 rounded-full px-3.5 text-[13px] transition-colors", filter === tab.k ? "bg-ink text-white" : "text-soft hover:text-ink")}>
                {tab.label}
              </button>
            ))}
          </div>
          {orders.length === 0 ? (
            <Panel className="py-12 text-center text-soft">{t("这里还没有记录。", "Nothing here yet.")}</Panel>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <OrderRow key={o.id} o={o} open={open === o.id} onToggle={() => setOpen(open === o.id ? null : o.id)} />
              ))}
            </div>
          )}
        </div>
        <div className="space-y-4">
          <ManualCompare />
          <Panel>
            <PanelTitle>{t("日志里不会有的", "Never logged")}</PanelTitle>
            <ul className="space-y-1.5 text-[13px] text-soft">
              <li>· {t("你的密码和登录凭证", "Your password or session token")}</li>
              <li>· {t("发给模型的完整提示词", "Full prompts sent to the model")}</li>
              <li>· {t("你的偏好档案（只用于推荐）", "Your preference profile (recommendations only)")}</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

function OrderRow({ o, open, onToggle }: { o: MockOrder; open: boolean; onToggle: () => void }) {
  const { t, lang } = useLang();
  const p = productOf(o.productId);
  const mer = merchantOf(o.merchantId);
  return (
    <Panel id={`order-${o.id}`} className={cn("p-0 transition-shadow", open && "shadow-[0_18px_50px_-30px_rgba(92,77,255,0.45)]")}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left sm:p-5" aria-expanded={open}>
        <ProductThumb product={p} className="size-12 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px]">{p.name[lang]}</div>
          <div className="truncate text-[12px] text-soft">
            {mer.name[lang]} · {fmtDateTime(o.paidAt, lang)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Money minor={o.totalMinor} className="text-[15px]" />
          {o.support !== "none" ? <Chip tone="ask">{t("人工处理中", "With support")}</Chip> : o.confirmedRules.length > 0 ? <Chip tone="ask">{t("你确认过", "Approved")}</Chip> : <OutcomeChip outcome="ALLOW" />}
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-soft transition-transform", open && "rotate-180")} />
      </button>
      {open && <Trace o={o} />}
    </Panel>
  );
}

function Step({ n, title, children, last }: { n: number; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <li className="relative pl-10">
      {!last && <span className="absolute top-7 bottom-0 left-[13px] w-px bg-line" />}
      <span className="absolute top-0 left-0 grid size-7 place-items-center rounded-full bg-violet-soft text-[12px] text-violet tabular">{n}</span>
      <div className="pb-6">
        <div className="mb-2 pt-0.5 font-heading text-[16px]">{title}</div>
        {children}
      </div>
    </li>
  );
}

function Trace({ o }: { o: MockOrder }) {
  const { t, lang } = useLang();
  const s = useMock();
  const mode = useSessionMode();
  const [why, setWhy] = useState(false);
  const [support, setSupport] = useState(false);
  const [reason, setReason] = useState<"missing" | "quality" | "not_me">("missing");
  const m = s.mandates.find((x) => x.id === o.mandateId);
  const task = s.tasks.find((x) => x.id === o.taskId);
  const method = METHODS.find((x) => x.id === o.method);
  const p = productOf(o.productId);
  const others = o.candidates.filter((c) => c.productId !== o.productId);
  const chosen = o.candidates.find((c) => c.productId === o.productId);
  const at = new Date(o.paidAt);

  return (
    <div className="border-t border-line px-4 pt-5 sm:px-5">
      <ol>
        <Step n={1} title={t("你签的授权", "Your mandate")}>
          {m ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
              <Link href={`/mandate/${m.id}`} className="text-violet hover:underline">
                {m.title[lang]} v{o.mandateVersion}
              </Link>
              <span className="text-soft">
                {t("单笔 ≤", "≤")} <Money minor={m.perTxnMinor} /> {t("", "per order")}
              </span>
              <span className="text-soft">
                {t("总额", "Total")} <Money minor={m.totalMinor} />
              </span>
              <span className="flex items-center gap-1 text-soft">
                <ShieldCheck className="size-3.5" />
                {t("用通行密钥签发", "Signed with passkey")}
              </span>
            </div>
          ) : (
            <span className="text-[13px] text-soft">—</span>
          )}
          {task && (
            <Link href={`/task/${task.id}`} className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-soft hover:text-ink">
              <MessageSquareText className="size-3.5" />
              {t("原话：", "Request: ")}
              {(() => {
                const u = task.blocks.find((b) => b.kind === "user");
                return u && u.kind === "user" ? (typeof u.text === "string" ? u.text : u.text[lang]) : "";
              })()}
            </Link>
          )}
        </Step>

        <Step n={2} title={t(`Zev 看过的候选（${o.candidates.length}）`, `Candidates Zev checked (${o.candidates.length})`)}>
          <ul className="space-y-1.5">
            {[...(chosen ? [chosen] : []), ...others].map((c) => {
              const cp = productOf(c.productId);
              return (
                <li key={c.productId} className={cn("flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[13px]", c.productId === o.productId ? "bg-violet-soft/60" : "bg-canvas/60")}>
                  <span className="min-w-0 flex-1 truncate">
                    {cp.name[lang]}
                    <span className="text-soft"> · {merchantOf(cp.merchantId).name[lang]}</span>
                    {cp.injected && <span className="text-ask"> · {t("描述含可疑指令，已忽略", "suspicious text ignored")}</span>}
                  </span>
                  {c.rules.length > 0 && <span className="hidden truncate text-[12px] text-soft sm:inline">{c.rules.map((r) => RULE_TITLE[r.id][lang]).join(t("、", ", "))}</span>}
                  <OutcomeChip outcome={c.outcome} className="h-5 px-2 text-[10px]" />
                  {c.productId === o.productId && <Chip tone="violet" className="h-5 px-2 text-[10px]">{t("选中", "Chosen")}</Chip>}
                </li>
              );
            })}
          </ul>
        </Step>

        <Step n={3} title={t("规则怎么判", "How the rules decided")}>
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <OutcomeChip outcome={o.confirmedRules.length > 0 ? "REVIEW" : "ALLOW"} />
            <span>{o.confirmedRules.length > 0 ? t(`先问了你，你确认了：${o.confirmedRules.map((r) => RULE_TITLE[r].zh).join("、")}`, `Asked first; you approved: ${o.confirmedRules.map((r) => RULE_TITLE[r].en).join(", ")}`) : t("全部边界都通过", "Every limit passed")}</span>
            <button type="button" onClick={() => setWhy((v) => !v)} className="text-violet hover:underline">
              {why ? t("收起", "Hide") : t("为什么？", "Why?")}
            </button>
          </div>
          {why && (
            <div className="mt-3 rounded-2xl bg-canvas/60 p-3.5 text-[13px]">
              <div className="flex flex-wrap gap-1.5">
                {CHECKED.map((c) => (
                  <Chip key={c.en} tone="ok" className="h-6">
                    ✓ {c[lang]}
                  </Chip>
                ))}
              </div>
              {m &&
                o.confirmedRules.map((r) => (
                  <p key={r} className="mt-2.5">
                    <span className="text-ask">{RULE_TITLE[r][lang]}</span> · {ruleText(r, { product: p, mandate: m, now: at }, lang)}
                  </p>
                ))}
              <p className="mt-2.5 text-[12px] text-soft">{t("推荐分只决定排序；这里的判断全部来自规则引擎，模型的输出不参与。", "The score only ranks. Every decision here comes from the rule engine; model output plays no part.")}</p>
            </div>
          )}
        </Step>

        <Step n={4} title={t("付款", "Payment")}>
          <div className="grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
            <KV k={t("方式", "Method")} v={<span>{method?.label[lang]} <SimNote className="ml-1" /></span>} />
            <KV k={t("从", "From")} v={t("Agent 零钱包", "Agent pocket")} />
            <KV k={t("购物车版本", "Cart version")} v={`v${o.cartVersion}`} />
            <KV k={t("幂等键", "Idempotency key")} v={<span className="font-mono text-[11.5px]">{o.idempotencyKey}</span>} />
          </div>
          <p className="mt-2 text-[12px] text-soft">{t("结算时重新判定一次，额度、次数、库存、余额、订单在同一个事务里一起变；任何一项不满足，整笔回滚。", "Settlement re-checks once, then budget, uses, stock, balance and order change in one transaction. If any check fails, the whole thing rolls back.")}</p>
        </Step>

        <Step n={5} title={t("收据", "Receipt")} last>
          <div className="grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
            <KV k={t("商品", "Item")} v={<Money minor={o.subtotalMinor} />} />
            <KV k={t("运费", "Shipping")} v={<Money minor={o.shippingMinor} />} />
            <KV k={t("手续费", "Fee")} v={<Money minor={o.feeMinor} />} />
            <KV k={t("合计", "Total")} v={<Money minor={o.totalMinor} className="font-medium" />} />
            <KV k={t("订单号", "Order")} v={<span className="font-mono text-[11.5px]">{o.id}</span>} />
            <KV k={t("时间", "Time")} v={fmtDateTime(o.paidAt, lang)} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {o.support === "none" ? (
              <Button variant="outline" size="sm" onClick={() => setSupport(true)} disabled={mode === "attacker"}>
                {t("申请售后", "Get help")}
              </Button>
            ) : (
              <Chip tone="ask">
                <Clock className="size-3" />
                {t("人工处理中，预计 1 个工作日内回复（模拟）", "With a person, reply within 1 business day (simulated)")}
              </Chip>
            )}
            <Link href="/pay-methods" className="text-[13px] text-violet hover:underline">
              {t("为什么用这个付款方式", "Why this payment method")}
            </Link>
          </div>
        </Step>
      </ol>

      <Dialog open={support} onOpenChange={setSupport}>
        <DialogContent className="rounded-[24px] p-6 sm:max-w-md">
          <DialogTitle className="font-heading text-xl">{t("申请售后", "Get help")}</DialogTitle>
          <DialogDescription>{t("售后由真人处理，Zev 不会替你和商家谈。", "A person handles this. Zev won't negotiate with the shop for you.")}</DialogDescription>
          <div className="space-y-2">
            {(
              [
                ["missing", t("没收到货", "Didn't arrive")],
                ["quality", t("东西有问题", "Something's wrong with it")],
                ["not_me", t("这笔不是我让买的", "I didn't ask for this")],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setReason(k)} className={cn("flex w-full items-center rounded-2xl border px-4 py-3 text-left text-[14px] transition-colors", reason === k ? "border-violet bg-violet-soft/60" : "border-line hover:border-soft/50")}>
                {label}
              </button>
            ))}
          </div>
          {reason === "not_me" && (
            <p className="rounded-2xl bg-no-soft p-3 text-[13px] text-no">
              {t("如果怀疑账号被盗，先去「我的 › 安全」一键冻结，再提交。", "If you think your account is compromised, freeze it under Me › Security first.")}
              <Link href="/me/security" className="ml-1 underline">
                {t("去冻结", "Freeze")}
              </Link>
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSupport(false)}>
              {t("取消", "Cancel")}
            </Button>
            <Button
              onClick={() => {
                actions.requestSupport(o.id);
                setSupport(false);
                toast(t("已提交，转人工处理（模拟）", "Submitted to a person (simulated)"));
              }}
            >
              {t("提交", "Submit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KV({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1.5">
      <span className="text-soft">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}

function ManualCompare() {
  const { t } = useLang();
  return (
    <Panel>
      <Eyebrow className="mb-2">{t("对照", "Comparison")}</Eyebrow>
      <PanelTitle>{t("和自己动手买比", "Versus doing it yourself")}</PanelTitle>
      <div className="grid grid-cols-2 gap-3 text-[13px]">
        <div className="rounded-2xl bg-violet-soft/60 p-3">
          <div className="text-[12px] text-violet">Zev</div>
          <div className="mt-1">{t("说一句话", "One sentence")}</div>
          <div className="text-soft">{t("+ 需要时确认一次", "+ one approval if needed")}</div>
        </div>
        <div className="rounded-2xl bg-canvas p-3">
          <div className="text-[12px] text-soft">{t("自己买", "Yourself")}</div>
          <div className="mt-1">{t("开两个 App 比价", "Compare in two apps")}</div>
          <div className="text-soft">{t("算运费、填地址、付款", "Shipping, address, pay")}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-2xl border border-dashed border-line px-3 py-2.5 text-[12px]">
        <span className="text-soft">{t("实测用时（3 人）", "Timed test (3 people)")}</span>
        <Chip>{t("待补", "Pending")}</Chip>
      </div>
    </Panel>
  );
}
