"use client";

import { cn } from "cn";
import { Check, ExternalLink, X } from "lucide-react";
import { Chip, Eyebrow, Money, PageHeader, Panel, PanelTitle, SimNote } from "@/components/app/primitives";
import { fmtDateTime } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { METHODS, MERCHANTS, merchantOf } from "@/lib/mock/catalog";
import { choosePaymentMethod } from "@/lib/payment-choice";
import { useMock } from "@/lib/mock/store";

export default function PayMethodsPage() {
  const { t, lang } = useLang();
  const s = useMock();
  const order = s.orders[0];
  const mandate = order ? s.mandates.find((m) => m.id === order.mandateId) : undefined;
  const merchant = order ? merchantOf(order.merchantId) : MERCHANTS[0];
  const base = order ? BigInt(order.totalMinor) : 13800n;

  const chosen = choosePaymentMethod({
    allowed: mandate ? mandate.methods : ["fps", "tapngo_mc"],
    accepts: merchant.accepts,
    pocketCovers: BigInt(s.pocketMinor) >= base,
  });
  const rows = METHODS.map((m) => {
    const inMandate = mandate ? mandate.methods.includes(m.id) : true;
    const accepted = merchant.accepts.includes(m.id);
    const eligible = inMandate && accepted;
    const cost = m.consumerFeeMinor === null ? null : base + BigInt(m.consumerFeeMinor);
    return { m, inMandate, accepted, eligible, cost };
  }).sort((a, b) => {
    if (a.m.id === chosen.id) return -1;
    if (b.m.id === chosen.id) return 1;
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.cost === null || b.cost === null) return a.cost === null ? 1 : -1;
    return a.cost < b.cost ? -1 : a.cost > b.cost ? 1 : 0;
  });

  return (
    <>
      <PageHeader
        eyebrow={t("付款方式", "Payment methods")}
        title={t("Zev 怎么选付款方式", "How Zev picks a payment method")}
        description={t(chosen.reason.zh, chosen.reason.en)}
      />

      <Panel className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Eyebrow>{t("以这笔为例", "Using this order")}</Eyebrow>
            <div className="mt-1 text-[15px]">
              {merchant.name[lang]} · {t("含运费", "with shipping")} <Money minor={base} className="font-medium" />
            </div>
          </div>
          <SimNote>{t("本次支付由模拟器执行", "Payments run on a simulator")}</SimNote>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((r, i) => (
          <Panel key={r.m.id} className={cn(i === 0 && r.eligible && "border-violet/40 shadow-[0_18px_50px_-30px_rgba(92,77,255,0.5)]")}>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="font-heading text-[22px]">{r.m.label[lang]}</div>
                <div className="text-[13px] text-soft">
                  {r.m.network} · {r.m.settlement[lang]}
                </div>
              </div>
              {i === 0 && r.eligible ? <Chip tone="violet">{t("Zev 会用这个", "Zev uses this")}</Chip> : <Chip>{t("备选", "Fallback")}</Chip>}
            </div>

            <ol className="space-y-4">
              <li>
                <div className="mb-2 text-[12px] tracking-[0.12em] text-soft uppercase">{t("1 · 能不能用", "1 · Allowed?")}</div>
                <ul className="space-y-1.5 text-[13px]">
                  <Check1 ok={r.inMandate} text={t("授权里允许", "Allowed by your mandate")} />
                  <Check1 ok={r.accepted} text={t(`${merchant.name.zh}接受`, `${merchant.name.en} accepts it`)} />
                  <Check1 ok text={t("你已启用", "Enabled by you")} />
                </ul>
              </li>
              <li>
                <div className="mb-2 text-[12px] tracking-[0.12em] text-soft uppercase">{t("2 · 你实际付多少", "2 · What you pay")}</div>
                <div className="flex items-baseline justify-between gap-3">
                  {r.cost === null ? <Chip tone="ask">{t("手续费未核实", "Fee unverified")}</Chip> : <Money minor={r.cost} className="font-heading text-[24px]" />}
                  <span className="text-[12px] text-soft">
                    {t("消费者手续费", "Consumer fee")}: {r.m.consumerFeeMinor === null ? t("未核实", "unverified") : <Money minor={r.m.consumerFeeMinor} />}
                  </span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-soft">{r.m.feeNote[lang]}</p>
              </li>
              <li>
                <div className="mb-2 text-[12px] tracking-[0.12em] text-soft uppercase">{t("3 · 预计回赠（只展示）", "3 · Est. rewards (display only)")}</div>
                <p className="text-[13px] leading-relaxed">{r.m.rewardNote[lang]}</p>
              </li>
            </ol>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-[12px] text-soft">
              <span>
                {t("观测于", "Observed")} {fmtDateTime(r.m.observedAt, lang)}
              </span>
              <a href={r.m.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet hover:underline">
                {t("来源", "Source")}
                <ExternalLink className="size-3" />
              </a>
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="mt-4">
        <PanelTitle>{t("规则", "The rules")}</PanelTitle>
        <ul className="grid gap-2 text-[13px] text-soft sm:grid-cols-2">
          <li>· {t("零钱包付得起、商家也收 Tap & Go 时，用 Tap & Go。钱本来就是从那里充进来的。", "When the pocket covers it and the shop takes Tap & Go, use Tap & Go. That is where the pocket was funded.")}</li>
          <li>· {t("否则用 FPS。已观测的个人本地港元手续费是 0。", "Otherwise use FPS. The observed personal local-HKD fee is 0.")}</li>
          <li>· {t("本地港元消费两边的手续费都是 0。非港币结算或海外以港币结算，Tap & Go 另有收费，这笔演示用不到。", "Local HKD spending is 0 on both rails. Tap & Go charges for foreign-currency settlement and for overseas spends settled in HKD. This demo does not use those.")}</li>
          <li>· {t("回赠只展示，不参与选择，也不计入预算。", "Rewards are shown only. They never choose the method or count toward the budget.")}</li>
        </ul>
      </Panel>
    </>
  );
}

function Check1({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className={cn("flex items-center gap-2", !ok && "text-no")}>
      {ok ? <Check className="size-4 text-ok" /> : <X className="size-4" />}
      {text}
    </li>
  );
}
