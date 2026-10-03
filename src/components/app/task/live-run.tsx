"use client";

import { ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OutcomeChip, Panel, ZevAvatar } from "@/components/app/primitives";
import { useStepUp } from "@/components/app/step-up";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import { useLang } from "@/lib/i18n";
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
type Payload = {
  task: { id: string; status: string; input_text: string; mandate_id: string };
  run: { steps?: WorkStep[]; candidates: Candidate[] } | null;
  decisions: DecisionRow[];
};

export function LiveRun({ taskId }: { taskId: string }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const stepUp = useStepUp();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payNote, setPayNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState("");

  useEffect(() => {
    let gone = false;
    api<Payload>(`/api/tasks/${taskId}`)
      .then((res) => {
        if (!gone) setData(res);
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

  const picked = [...data.decisions].reverse().find((d) => d.cart_id) ?? null;
  const candidates = data.run?.candidates ?? [];

  const pay = async () => {
    if (!picked?.cart_id || !picked.cart_version) return;
    const ok = await stepUp({
      title: { zh: "确认这笔付款", en: "Confirm this payment" },
      detail: {
        zh: "生产环境这里是通行密钥或银行 App。演示里点确认即可。",
        en: "In production this is a passkey or your bank app. In the demo, confirm to continue.",
      },
    });
    if (!ok) return;
    setBusy(true);
    setPayNote(null);
    try {
      if (picked.outcome === "REVIEW") {
        await api("/api/confirmations", {
          method: "POST",
          json: { taskId, cartId: picked.cart_id, cartVersion: picked.cart_version },
        });
      }
      const result = await api<{ status: string; totalMinor: string; decisionOutcome: string; reason?: string }>("/api/orders/settle", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        json: { cartId: picked.cart_id, cartVersion: picked.cart_version, methodId: "fps" },
      });
      setPayNote(
        result.status === "succeeded"
          ? t(`已付款 ${fmtMoney(result.totalMinor, "zh")}。账本里可以核对。`, `Paid ${fmtMoney(result.totalMinor, "en")}. Check the ledger.`)
          : result.reason || result.decisionOutcome,
      );
    } catch (err) {
      setPayNote(err instanceof ApiError ? err.message : t("付款没有完成。", "Payment did not complete."));
    } finally {
      setBusy(false);
    }
  };

  const refine = async (text: string) => {
    const next = text.trim();
    if (!next || busy) return;
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
    <div className="mx-auto grid max-w-3xl gap-4">
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-[18px] rounded-br-md bg-ink px-4 py-2.5 text-[14px] text-white">{data.task.input_text}</div>
      </div>
      <div className="flex items-start gap-3">
        <ZevAvatar />
        <Panel className="flex-1">
          <p className="text-[14px] text-soft">
            {t("下面是演示目录里的商品。能不能买由规则引擎决定，不是模型决定。", "These are demo-catalogue items. The rules decide, not the model.")}
          </p>
          <div className="mt-4 grid gap-3">
            {candidates.length === 0 && (
              <div className="space-y-3">
                <p className="text-[14px]">{t("按这些条件没有找到商品。放宽一点试试？", "Nothing matched these conditions. Try widening them?")}</p>
                <NeedGuide onApply={(text) => void refine(text)} />
              </div>
            )}
            {candidates.map((c) => (
              <div key={c.product.id} className="rounded-2xl bg-canvas/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[15px]">{c.product.name}</div>
                    <div className="text-[12px] text-soft">
                      {c.product.brand} · {c.merchant.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <OutcomeChip outcome={c.decision.outcome} />
                    <div className="mt-1 text-[13px] tabular">{fmtMoney(c.quote.totalMinor, lang)}</div>
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
              </div>
            ))}
          </div>
          {picked && picked.outcome !== "DENY" && (
            <Button className="mt-4" onClick={() => void pay()} disabled={busy}>
              {picked.outcome === "REVIEW" ? t("确认规则并付款", "Confirm the rules and pay") : t("用通行密钥付款", "Pay with passkey")}
            </Button>
          )}
          {picked?.outcome === "DENY" && <p className="mt-4 text-[14px] text-no">{t("已拦住。拒绝不能被确认绕过。", "Stopped. A refusal cannot be confirmed away.")}</p>}
          {payNote && <p className="mt-3 text-[14px]">{payNote}</p>}
          {steps.length > 0 && (
            <ol className="mt-5 space-y-2 border-t border-line pt-4">
              <li className="text-[12px] text-soft">{t("Zev 的工作记录", "Zev's work log")}</li>
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
  );
}
