"use client";

import { Fingerprint, Hourglass, ShieldOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { hkdToMinor } from "@/contracts/money";
import { MandateCard, QuotaRing, useMandateStatusLabel } from "@/components/app/mandate-card";
import { Chip, Countdown, Eyebrow, Money, PageHeader, Panel, PanelTitle, ProductThumb } from "@/components/app/primitives";
import { useStepUp } from "@/components/app/step-up";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { METHODS, productOf } from "@/lib/mock/catalog";
import { actions, useMock, useNow, useSessionMode } from "@/lib/mock/store";
import { CATEGORY_LABEL } from "@/lib/rule-text";

export function MandateDetail({ id }: { id: string }) {
  const { t, lang } = useLang();
  const s = useMock();
  const mode = useSessionMode();
  const stepUp = useStepUp();
  const mounted = useNow(60_000) !== null;
  const statusLabel = useMandateStatusLabel();
  const [revoke, setRevoke] = useState(false);
  const m = s.mandates.find((x) => x.id === id);
  const [lower, setLower] = useState("");
  const [raise, setRaise] = useState("");

  if (!m) {
    return mounted ? (
      <Panel className="mx-auto max-w-lg text-center">
        <p className="font-heading text-xl">{t("找不到这份授权", "Mandate not found")}</p>
        <Link href="/wallet" className="mt-4 inline-block text-violet hover:underline">
          {t("回到钱包", "Back to wallet")}
        </Link>
      </Panel>
    ) : (
      <div className="h-64 animate-pulse rounded-[20px] bg-white/60" />
    );
  }

  const active = m.status === "active";
  const orders = s.orders.filter((o) => o.mandateId === m.id);
  const waiting = s.cooling.find((c) => c.kind === "raise_cap" && c.mandateId === m.id && c.status === "waiting");
  const asks: string[] = [];
  if (m.reviewWhen.nearCapPct !== null) asks.push(t(`一笔到了单笔上限的 ${m.reviewWhen.nearCapPct}%`, `an order reaches ${m.reviewWhen.nearCapPct}% of the cap`));
  if (m.reviewWhen.substituteBrand) asks.push(t(`换了牌子${m.preferredBrand ? `（不是${m.preferredBrand}）` : ""}`, "it's a different brand"));
  for (const c of m.reviewWhen.watchCategories) asks.push(t(`买「${CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL]?.zh ?? c}」`, `it's ${CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL]?.en ?? c}`));
  if (m.reviewWhen.newMerchantDays) asks.push(t(`商家注册不到 ${m.reviewWhen.newMerchantDays} 天`, `the shop is under ${m.reviewWhen.newMerchantDays} days old`));
  if (m.reviewWhen.priceAboveRefPct) asks.push(t(`价格比参考价高 ${m.reviewWhen.priceAboveRefPct}% 以上`, `the price is ${m.reviewWhen.priceAboveRefPct}%+ above reference`));

  const doLower = () => {
    let v: bigint;
    try {
      v = hkdToMinor(lower);
    } catch {
      toast.error(t("请输入金额", "Enter an amount"));
      return;
    }
    if (v <= 0n || v >= BigInt(m.perTxnMinor)) {
      toast.error(t("收紧要比现在的上限低", "Must be below the current cap"));
      return;
    }
    actions.tightenMandate(m.id, { perTxnMinor: v.toString() }, { zh: `单笔上限降到 ${fmtMoney(v, "zh")}`, en: `Per-order cap lowered to ${fmtMoney(v, "en")}` });
    setLower("");
    toast(t("已收紧，立即生效", "Tightened, effective now"));
  };

  const doRaise = async () => {
    let v: bigint;
    try {
      v = hkdToMinor(raise);
    } catch {
      toast.error(t("请输入金额", "Enter an amount"));
      return;
    }
    if (v <= BigInt(m.perTxnMinor)) {
      toast.error(t("要比现在的上限高", "Must be above the current cap"));
      return;
    }
    const ok = await stepUp({ title: { zh: "提高单笔上限", en: "Raise per-order cap" }, detail: { zh: `${fmtMoney(m.perTxnMinor, "zh")} → ${fmtMoney(v, "zh")}，24 小时后生效`, en: `${fmtMoney(m.perTxnMinor, "en")} → ${fmtMoney(v, "en")}, effective in 24 hours` } });
    if (!ok) return;
    actions.requestRaiseCap(m.id, v.toString());
    setRaise("");
  };

  return (
    <>
      <PageHeader
        eyebrow={`${t("授权", "Mandate")} · v${m.version} · ${statusLabel(m.status)}`}
        title={m.title[lang]}
        description={m.taskText ? t(`来自你说的：「${m.taskText}」`, `From your request: “${m.taskText}”`) : undefined}
        actions={
          active && (
            <Button variant="destructive" onClick={() => setRevoke(true)} disabled={mode === "attacker"}>
              <ShieldOff />
              {t("撤销授权", "Revoke")}
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Panel>
            <PanelTitle>{t("用大白话说", "In plain words")}</PanelTitle>
            <div className="space-y-3 text-[15px] leading-relaxed">
              <p>
                {t(
                  `在 ${fmtDate(m.expiresAt, "zh")} 之前，Zev 可以替你买「${m.query.zh}」${m.minVolumeMl ? `（至少 ${m.minVolumeMl / 1000}L）` : ""}，范围限于${m.categories.map((c) => CATEGORY_LABEL[c].zh).join("、")}。`,
                  `Until ${fmtDate(m.expiresAt, "en")}, Zev may buy ${m.query.en.toLowerCase()}${m.minVolumeMl ? ` (at least ${m.minVolumeMl / 1000}L)` : ""} for you, within ${m.categories.map((c) => CATEGORY_LABEL[c].en).join(", ")}.`,
                )}
              </p>
              <p>
                {t(
                  `每笔连运费不超过 ${fmtMoney(m.perTxnMinor, "zh")}，总共不超过 ${fmtMoney(m.totalMinor, "zh")}，最多 ${m.maxPurchases} 次。`,
                  `Each order, shipping included, stays under ${fmtMoney(m.perTxnMinor, "en")}; ${fmtMoney(m.totalMinor, "en")} in total; at most ${m.maxPurchases} purchases.`,
                )}
              </p>
              {m.mode === "curated" ? (
                <p>{t("这是精选授权：每一笔都会先问你。", "This is a curated mandate: every purchase asks you first.")}</p>
              ) : (
                asks.length > 0 && <p>{t(`遇到这些情况会先问你：${asks.join("；")}。`, `It asks you first when ${asks.join("; ")}.`)}</p>
              )}
              <p>{t(`只用 ${m.methods.map((x) => METHODS.find((y) => y.id === x)?.label.zh).join(" 或 ")} 付款。`, `It pays only with ${m.methods.map((x) => METHODS.find((y) => y.id === x)?.label.en).join(" or ")}.`)}</p>
              <p className="text-soft">{t("它不能：超出这些数字、买别的品类、换付款方式，或者自己修改这份授权。", "It can't exceed these numbers, buy other categories, switch payment method, or change this mandate itself.")}</p>
            </div>
          </Panel>

          {active && (
            <Panel>
              <PanelTitle>{t("修改", "Change it")}</PanelTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-canvas/60 p-4">
                  <div className="text-[14px]">{t("收紧", "Tighten")}</div>
                  <p className="mt-1 text-[12px] text-soft">{t("立即生效，不需要通行密钥。", "Instant, no passkey needed.")}</p>
                  <div className="mt-3 flex gap-2">
                    <Input value={lower} onChange={(e) => setLower(e.target.value)} placeholder={t("新的单笔上限", "New cap")} inputMode="decimal" className="h-10 tabular" />
                    <Button variant="outline" onClick={doLower} disabled={mode === "attacker"}>
                      {t("降低", "Lower")}
                    </Button>
                  </div>
                  {m.remainingPurchases > 1 && (
                    <button
                      type="button"
                      disabled={mode === "attacker"}
                      onClick={() => actions.tightenMandate(m.id, { remainingPurchases: m.remainingPurchases - 1 }, { zh: "剩余次数减 1", en: "One fewer purchase left" })}
                      className="mt-2 text-[12px] text-violet hover:underline"
                    >
                      {t("少买一次", "One fewer purchase")}
                    </button>
                  )}
                </div>
                <div className="rounded-2xl bg-canvas/60 p-4">
                  <div className="text-[14px]">{t("放宽", "Loosen")}</div>
                  <p className="mt-1 text-[12px] text-soft">{t("要通行密钥，24 小时后生效，并短信通知你。", "Passkey, 24-hour wait, and an SMS to you.")}</p>
                  {waiting ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
                      <Hourglass className="size-4 text-ask" />
                      <Money minor={waiting.toMinor ?? "0"} />
                      <span className="text-soft">
                        <Countdown until={waiting.effectiveAt} /> {t("后生效", "to go")}
                      </span>
                      <button type="button" onClick={() => actions.cancelCooling(waiting.id)} className="text-violet hover:underline" disabled={mode === "attacker"}>
                        {t("取消", "Cancel")}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <Input value={raise} onChange={(e) => setRaise(e.target.value)} placeholder={t("新的单笔上限", "New cap")} inputMode="decimal" className="h-10 tabular" />
                      <Button variant="outline" onClick={doRaise}>
                        <Fingerprint />
                        {t("申请", "Request")}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          )}

          <Panel>
            <PanelTitle>{t("用这份授权买过的", "Bought with this mandate")}</PanelTitle>
            {orders.length === 0 ? (
              <p className="text-[14px] text-soft">{t("还没有。", "Nothing yet.")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {orders.map((o) => {
                  const p = productOf(o.productId);
                  return (
                    <li key={o.id}>
                      <Link href={`/ledger?order=${o.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                        <ProductThumb product={p} className="size-10 rounded-xl" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px]">{p.name[lang]}</div>
                          <div className="text-[12px] text-soft">
                            {fmtDateTime(o.paidAt, lang)} · v{o.mandateVersion}
                          </div>
                        </div>
                        <Money minor={o.totalMinor} className="text-[14px]" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <MandateCard m={m} />
          <Panel className="flex items-center gap-5">
            <QuotaRing remaining={m.remainingMinor} total={m.totalMinor} size={112}>
              <div>
                <div className="text-[11px] text-soft">{t("还可买", "Left")}</div>
                <div className="font-heading text-[20px] tabular">
                  {m.remainingPurchases}/{m.maxPurchases}
                </div>
              </div>
            </QuotaRing>
            <div className="text-[13px]">
              <div className="text-soft">{t("剩余额度", "Remaining")}</div>
              <Money minor={m.remainingMinor} className="font-heading text-[22px]" />
              <div className="mt-1 text-soft">
                {t("共", "of")} <Money minor={m.totalMinor} />
              </div>
            </div>
          </Panel>
          <Panel>
            <PanelTitle>{t("版本", "Versions")}</PanelTitle>
            <ol className="space-y-3">
              {[...m.versions].reverse().map((v) => (
                <li key={v.v} className="flex gap-3 text-[13px]">
                  <Chip tone={v.v === m.version ? "violet" : "neutral"}>v{v.v}</Chip>
                  <div>
                    <div>{v.note[lang]}</div>
                    <div className="text-[12px] text-soft">{fmtDateTime(v.at, lang)}</div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[12px] text-soft">{t("每笔订单都记着它用的是哪个版本。", "Every order records which version it used.")}</p>
          </Panel>
          {m.revokedAt && (
            <Panel className="text-[13px]">
              <Eyebrow className="mb-1">{t("已撤销", "Revoked")}</Eyebrow>
              {fmtDateTime(m.revokedAt, lang)} · {t("已完成的订单保留在记录里。", "Completed orders stay in your records.")}
            </Panel>
          )}
        </div>
      </div>

      <Dialog open={revoke} onOpenChange={setRevoke}>
        <DialogContent className="rounded-[24px] p-6 sm:max-w-md">
          <DialogTitle className="font-heading text-xl">{t("撤销这份授权？", "Revoke this mandate?")}</DialogTitle>
          <DialogDescription>{t("立即生效。Zev 不能再用它付款，等你确认的也会一起取消。已完成的订单不受影响。", "Takes effect now. Zev can't pay with it, and anything waiting for you is cancelled. Finished orders are unaffected.")}</DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRevoke(false)}>
              {t("先不", "Keep it")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                actions.revokeMandate(m.id);
                setRevoke(false);
              }}
            >
              {t("撤销", "Revoke")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
