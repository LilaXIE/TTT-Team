"use client";

import { cn } from "cn";
import { ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Chip, OutcomeChip, Panel, ZevAvatar } from "@/components/app/primitives";
import { useStepUp } from "@/components/app/step-up";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { needsExplicitChoice, payTarget } from "@/lib/purchase-choice";
import { namesSameItem, spokenProduct } from "@/lib/spoken-product";
import { startLiveTask } from "@/lib/live";
import { workStepTitle, type WorkStep } from "@/lib/work-log";
import type { Outcome } from "@/contracts";
import { NeedGuide } from "./blocks";

type RuleHit = { id: string; severity: string; message: string };
type Candidate = {
  product: { id: string; name: string; brand: string; merchant_name?: string };
  merchant: { name: string };
  quote: { totalMinor: string };
  explanation: string;
  decision: { outcome: Outcome; rules: RuleHit[] };
};
type DecisionRow = {
  outcome: Outcome;
  rules: RuleHit[];
  cart_id: string | null;
  cart_version: number | null;
};
type Selection = {
  cartId: string;
  cartVersion: number;
  outcome: Outcome;
  productId: string;
  name: string;
  merchantName: string;
  totalMinor: string;
  methodId: string;
  explicit: boolean;
};
type Paid = {
  cartId: string;
  cartVersion: number;
  productId: string;
  name: string;
  merchantName: string;
  totalMinor: string;
};
type Payload = {
  task: { id: string; status: string; input_text: string; mandate_id: string };
  run: { steps?: WorkStep[]; candidates: Candidate[] } | null;
  decisions: DecisionRow[];
  cart: Selection | null;
  paid: Paid | null;
};

function productName(name: string, lang: "zh" | "en"): string {
  const [zh, ...english] = name.split(" / ");
  return lang === "en" && english.length ? english.join(" / ") : zh;
}

export function LiveRun({ taskId }: { taskId: string }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const stepUp = useStepUp();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payNote, setPayNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState("");
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [cart, setCart] = useState<Selection | null>(null);
  const [paid, setPaid] = useState<Paid | null>(null);
  const operation = useRef(false);
  const paymentAttempt = useRef<{ cartId: string; version: number; key: string } | null>(null);

  useEffect(() => {
    let gone = false;
    api<Payload>(`/api/tasks/${taskId}`)
      .then((res) => {
        if (!gone) {
          setData(res);
          setCart(res.cart);
          setPaid(res.paid);
          setChosenId(res.cart?.explicit ? res.cart.productId : null);
        }
      })
      .catch((err) => {
        if (!gone) setError(err instanceof ApiError ? err.message : t("读不到这次任务。", "Couldn't load this task."));
      });
    return () => {
      gone = true;
    };
  }, [taskId, t]);

  if (error) {
    return (
      <Panel className="mx-auto max-w-lg">
        <p className="text-[15px] text-no">{error}</p>
      </Panel>
    );
  }
  if (!data) return <div className="h-64 animate-pulse rounded-[20px] bg-white/60" />;

  const candidates = data.run?.candidates ?? [];
  const choiceItems = candidates.map((c) => ({ productId: c.product.id, outcome: c.decision.outcome }));
  const mustChoose = needsExplicitChoice(choiceItems);
  const payableCount = choiceItems.filter((c) => c.outcome !== "DENY").length;
  const soleId = choiceItems.find((c) => c.outcome !== "DENY")?.productId ?? null;
  const target = payTarget(choiceItems, mustChoose ? chosenId : soleId);
  const ready = !paid && !!target && !!cart && cart.productId === target.productId;

  const pick = async (productId: string) => {
    if (paid || operation.current) return;
    operation.current = true;
    setBusy(true);
    setPayNote(null);
    try {
      const next = await api<Selection>(`/api/tasks/${taskId}/select`, { method: "POST", json: { productId } });
      setCart(next);
      setChosenId(productId);
    } catch (err) {
      setPayNote(err instanceof ApiError ? err.message : t("这件现在选不了。", "That one can't be selected right now."));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!ready || !cart || operation.current) return;
    operation.current = true;
    setBusy(true);
    const name = cart.name;
    const merchant = cart.merchantName;
    const amountZh = fmtMoney(cart.totalMinor, "zh");
    const amountEn = fmtMoney(cart.totalMinor, "en");
    try {
      const ok = await stepUp({
        title: { zh: `买「${productName(name, "zh")}」`, en: `Buy “${productName(name, "en")}”` },
        detail: {
          zh: `只买这一件：${productName(name, "zh")}（${merchant}），${amountZh}。其他列出的商品不会扣款。演示里点确认即可。`,
          en: `Only this one: ${productName(name, "en")} (${merchant}), ${amountEn}. Nothing else listed is charged. In the demo, confirm to continue.`,
        },
      });
      if (!ok) return;
      setPayNote(null);
      if (cart.outcome === "REVIEW") {
        await api("/api/confirmations", {
          method: "POST",
          json: { taskId, cartId: cart.cartId, cartVersion: cart.cartVersion },
        });
      }
      if (paymentAttempt.current?.cartId !== cart.cartId || paymentAttempt.current.version !== cart.cartVersion) {
        paymentAttempt.current = { cartId: cart.cartId, version: cart.cartVersion, key: crypto.randomUUID() };
      }
      const result = await api<{ status: string; totalMinor: string; decisionOutcome: string; reason?: string }>("/api/orders/settle", {
        method: "POST",
        headers: { "Idempotency-Key": paymentAttempt.current.key },
        json: { cartId: cart.cartId, cartVersion: cart.cartVersion, methodId: cart.methodId },
      });
      if (result.status === "succeeded") {
        setPaid({
          cartId: cart.cartId,
          cartVersion: cart.cartVersion,
          productId: cart.productId,
          name,
          merchantName: merchant,
          totalMinor: result.totalMinor,
        });
        setPayNote(
          t(
            `已付款 ${fmtMoney(result.totalMinor, "zh")}，买的是「${productName(name, "zh")}」（${merchant}）。账本里可以核对。`,
            `Paid ${fmtMoney(result.totalMinor, "en")} for “${productName(name, "en")}” (${merchant}). Check the ledger.`,
          ),
        );
      } else {
        paymentAttempt.current = null;
        setPayNote(result.reason || result.decisionOutcome);
      }
    } catch (err) {
      setPayNote(err instanceof ApiError ? err.message : t("还未确认付款结果，请重试核对。同一笔不会重复扣款。", "Payment status is unconfirmed. Retry to check; this payment will not be charged twice."));
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };

  const refine = async (text: string) => {
    const next = text.trim();
    if (!next || busy || !data) return;
    const current = spokenProduct(data.task.input_text);
    const switching = Boolean(spokenProduct(next).phrase && !namesSameItem(current.catalog ?? current.phrase ?? data.task.input_text, next));
    if (!switching) {
      let heard = "";
      try {
        const draft = await api<{ message: string; mode: "llm" | "fallback" }>("/api/chat", { method: "POST", json: { message: next } });
        if (draft.mode === "llm" && draft.message.trim()) heard = `${draft.message.trim()} `;
      } catch {
        heard = "";
      }
      const delivery = /今天|今日/.test(next)
        ? t("目录里没有今日达，最快是明天。", "Nothing arrives today; the fastest is tomorrow.")
        : /明天|次日/.test(next)
          ? t("能明天到的会排在前面；没有的话仍留着现在这几件。", "Tomorrow arrivals come first; if none do, these stay.")
          : t("这句只补充当前这单。", "That only adds to this order.");
      setPayNote(`${heard}${delivery}${t("还是这一单，没有另开任务，也没有改已签的上限。", " Still this order. No new task, and the signed cap is unchanged.")}`);
      setExtra("");
      return;
    }
    setBusy(true);
    try {
      const id = await startLiveTask(`${data.task.input_text}。另外：${next}`, data.task.mandate_id);
      if (id) router.push(`/task/${id}`);
      else setPayNote(t("这次补充没有发出去。", "That follow-up did not send."));
    } catch (err) {
      setPayNote(err instanceof ApiError ? err.message : t("这次补充没有发出去。", "That follow-up did not send."));
    } finally {
      setBusy(false);
      setExtra("");
    }
  };

  const steps = data.run?.steps ?? [];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,720px)_300px]">
      <div className="grid min-w-0 gap-4">
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-[18px] rounded-br-md bg-ink px-4 py-2.5 text-[14px] text-white">{data.task.input_text}</div>
      </div>
      <div className="zev-line flex items-start gap-3">
        <ZevAvatar
          mood={
            !data
              ? "search"
              : data.task.status === "completed"
                ? "done"
                : candidates.some((c) => c.decision.outcome === "ALLOW")
                  ? "done"
                  : candidates.some((c) => c.decision.outcome === "REVIEW")
                    ? "ask"
                    : candidates.length > 0
                      ? "deny"
                      : "search"
          }
        />
        <Panel className="min-w-0 flex-1">
          <p className="text-[14px] text-soft">
            {paid
              ? t(
                  `买的是「${productName(paid.name, "zh")}」（${paid.merchantName}），${fmtMoney(paid.totalMinor, "zh")}。其余列出的没有扣款。`,
                  `Bought “${productName(paid.name, "en")}” (${paid.merchantName}), ${fmtMoney(paid.totalMinor, "en")}. Nothing else listed was charged.`,
                )
              : mustChoose
                ? t(
                    `找到 ${payableCount} 件都符合。你只要一件，请先点「就买这件」。没点中的不会扣款。`,
                    `${payableCount} items fit. You asked for one — tap “Buy this one” first. Anything you don't tap is not charged.`,
                  )
                : t("下面是演示目录里的商品。能不能买由规则引擎决定，不是模型决定。", "These are demo-catalogue items. The rules decide, not the model.")}
          </p>
          <div className="mt-4 grid gap-3">
            {candidates.length === 0 && (
              <div className="space-y-3">
                <p className="text-[14px]">
                  {t(
                    `演示目录里没有「${spokenProduct(data.task.input_text).zh || data.task.input_text}」，没有换成别的商品。`,
                    `Nothing in the demo catalogue matches “${spokenProduct(data.task.input_text).en || data.task.input_text}”. It was not switched to a different product.`,
                  )}
                </p>
                <NeedGuide onApply={(text) => void refine(text)} />
              </div>
            )}
            {candidates.map((c) => {
              const denied = c.decision.outcome === "DENY";
              const isBought = paid?.productId === c.product.id;
              const isChosen = !paid && target?.productId === c.product.id && cart?.productId === c.product.id;
              const canPay = isChosen && ready;
              return (
                <div
                  key={c.product.id}
                  className={cn(
                    "rounded-2xl p-4",
                    isBought || isChosen ? "bg-white ring-2 ring-violet" : "bg-canvas/70",
                    paid && !isBought && "opacity-60",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[15px]">{productName(c.product.name, lang)}</div>
                      <div className="text-[12px] text-soft">
                        {c.product.brand} · {c.merchant.name}
                      </div>
                    </div>
                    <div className="text-right">
                      {isBought ? (
                        <Chip tone="ok">{t("已买这件", "Bought")}</Chip>
                      ) : paid ? (
                        <Chip>{t("没有买", "Not bought")}</Chip>
                      ) : isChosen ? (
                        <Chip tone="violet">{t("就买这件", "This one")}</Chip>
                      ) : denied ? (
                        <OutcomeChip outcome="DENY" />
                      ) : c.decision.outcome === "REVIEW" ? (
                        <OutcomeChip outcome="REVIEW" />
                      ) : (
                        <Chip tone="ok">{t("可以买", "Can buy")}</Chip>
                      )}
                      <div className="mt-1 text-[13px] tabular">{fmtMoney(isBought ? paid.totalMinor : isChosen && cart ? cart.totalMinor : c.quote.totalMinor, lang)}</div>
                    </div>
                  </div>
                  {c.decision.rules.length > 0 && (
                    <ul className="mt-2 space-y-1 text-[12px] text-soft">
                      {c.decision.rules.map((r) => (
                        <li key={r.id}>
                          {r.id} · {r.message}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!paid && !denied && !canPay && (
                    <Button className="mt-3" variant={mustChoose ? "default" : "outline"} disabled={busy} onClick={() => void pick(c.product.id)}>
                      {t("就买这件", "Buy this one")}
                    </Button>
                  )}
                  {canPay && cart && (
                    <div className="flex flex-wrap gap-2">
                    <Button className="mt-3 h-auto min-h-10 max-w-full whitespace-normal py-2" onClick={() => void pay()} disabled={busy}>
                      {cart.outcome === "REVIEW"
                        ? t(`确认规则并买「${productName(cart.name, "zh")}」`, `Confirm the rules and buy “${productName(cart.name, "en")}”`)
                        : t(`用通行密钥买「${productName(cart.name, "zh")}」`, `Pay with passkey for “${productName(cart.name, "en")}”`)}
                    </Button>
                    <Button className="mt-3" variant="outline" onClick={() => void pick(c.product.id)} disabled={busy}>
                      {t("刷新报价", "Refresh quote")}
                    </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!paid && payableCount === 0 && candidates.length > 0 && (
            <p className="mt-4 text-[14px] text-no">{t("已拦住。拒绝不能被确认绕过。", "Stopped. A refusal cannot be confirmed away.")}</p>
          )}
          {!paid && payNote && <p className="mt-3 text-[14px]">{payNote}</p>}
        </Panel>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void refine(extra);
        }}
        className="sticky bottom-20 z-10 flex items-end gap-2 rounded-[22px] border border-line bg-white p-2 pl-4 md:bottom-4"
      >
        <textarea
          id="task-composer"
          rows={1}
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder={t("补充或修改要求，如「要无香的」。不会改你签过的金额上限。", "Add or change a requirement, e.g. “unscented”. This does not change a cap you signed.")}
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2.5 text-[15px] outline-none placeholder:text-soft"
        />
        <Button type="submit" size="icon" disabled={!extra.trim() || busy} aria-label={t("发送", "Send")}>
          <ArrowUp />
        </Button>
      </form>
      {candidates.length > 0 && (
        <div className="flex justify-center">
          <NeedGuide onApply={(text) => void refine(text)} />
        </div>
      )}
      </div>
      <Panel className="p-5 lg:sticky lg:top-24">
        <h2 className="font-heading text-[17px]">{t("Zev 的工作记录", "Zev's work log")}</h2>
        {steps.length === 0 ? (
          <p className="mt-3 text-[13px] text-soft">{t("还没有开始。", "Nothing yet.")}</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {steps.map((step, i) => (
              <li key={`${step.tool}-${i}`} className="text-[13px]">
                <div>{workStepTitle(step.tool, lang)}</div>
                {step.outputSummary && <div className="text-[12px] text-soft">{step.outputSummary}</div>}
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
