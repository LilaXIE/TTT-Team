"use client";

import { cn } from "cn";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Hourglass, Plus, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { hkdToMinor } from "@/contracts/money";
import { MandateCard } from "@/components/app/mandate-card";
import { Countdown, Eyebrow, Money, PageHeader, Panel, PanelTitle, SimNote } from "@/components/app/primitives";
import { MaxLossLine, SecurityCard } from "@/components/app/security-card";
import { useStepUp } from "@/components/app/step-up";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fmtDateTime, fmtMoney } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { actions, useMock, useSessionMode } from "@/lib/mock/store";

const TOPUP_MAX = 50000n;

export default function WalletPage() {
  const { t, lang } = useLang();
  const s = useMock();
  const mode = useSessionMode();
  const stepUp = useStepUp();
  const [topup, setTopup] = useState(false);
  const [amount, setAmount] = useState("200");
  const waiting = s.cooling.filter((c) => c.status === "waiting");
  const sorted = [...s.mandates].sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1));

  let parsed: bigint | null = null;
  try {
    parsed = hkdToMinor(amount);
  } catch {
    parsed = null;
  }
  const amountOk = parsed !== null && parsed > 0n && parsed <= TOPUP_MAX;

  const doTopup = async () => {
    if (!amountOk || parsed === null) return;
    const value = parsed;
    const ok = await stepUp({ title: { zh: "给 Agent 零钱包充值", en: "Top up Agent pocket" }, detail: { zh: `从 Tap & Go 转入 ${fmtMoney(value, "zh")}`, en: `Move ${fmtMoney(value, "en")} from Tap & Go` } });
    if (!ok) return;
    actions.topUp(value.toString());
    setTopup(false);
    toast(t("已充值（模拟）", "Topped up (simulated)"));
  };

  return (
    <>
      <PageHeader
        eyebrow={t("钱包", "Wallet")}
        title={t("钱和边界", "Money & limits")}
        description={t("Zev 只从 Agent 零钱包付款，而且只在你签的授权里付。", "Zev only pays from the Agent pocket, and only within the mandates you signed.")}
        actions={
          <Link href="/pay-methods" className={buttonVariants({ variant: "outline" })}>
            {t("付款方式比较", "Compare payment methods")}
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel className="relative overflow-hidden bg-noir text-white">
          <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-violet/30 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <Eyebrow className="text-white/50">{t("Agent 零钱包", "Agent pocket")}</Eyebrow>
              <SimNote className="border-white/20 text-white/60" />
            </div>
            <Money minor={s.pocketMinor} className="mt-3 block font-heading text-[44px] leading-none" />
            <p className="mt-3 max-w-sm text-[13px] text-white/60">{t("和你的主钱包分开。账号被盗时，坏人最多也只能动这里的钱，而且还要在授权范围内。", "Kept apart from your main wallet. Even a thief could only touch this, and only within your mandates.")}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setTopup(true)} disabled={mode === "attacker" || s.session.frozen}>
                <Plus />
                {t("充值", "Top up")}
              </Button>
              <span className="self-center text-[12px] text-white/50">{t("单次最多 $500.00", "Up to $500.00 each time")}</span>
            </div>
          </div>
        </Panel>
        <Panel className="flex flex-col justify-between gap-5">
          <MaxLossLine size="lg" />
          <div className="flex items-center gap-3 rounded-2xl bg-canvas/70 p-3.5">
            <span className="grid size-10 place-items-center rounded-xl bg-white">
              <Wallet className="size-5" />
            </span>
            <div className="min-w-0 flex-1 text-[13px]">
              <div>{t("充值来源 · Tap & Go", "Funding · Tap & Go")}</div>
              <div className="text-soft">{s.connections.tapngo ? t("已连接 · 已由钱包方完成实名认证（模拟）", "Connected · identity verified by the wallet (simulated)") : t("还没连接", "Not connected")}</div>
            </div>
            {!s.connections.tapngo && (
              <Link href="/consent/tapngo?return=/wallet" className={buttonVariants({ size: "sm" })}>
                {t("连接", "Connect")}
              </Link>
            )}
          </div>
        </Panel>
      </div>

      {waiting.length > 0 && (
        <Panel className="mt-4 border-ask/35">
          <PanelTitle>
            <span className="inline-flex items-center gap-2">
              <Hourglass className="size-4 text-ask" />
              {t("冷静期中的修改", "Changes cooling off")}
            </span>
          </PanelTitle>
          <ul className="divide-y divide-line">
            {waiting.map((c) => {
              const m = c.mandateId ? s.mandates.find((x) => x.id === c.mandateId) : null;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1 text-[14px]">
                    {c.kind === "raise_cap" ? (
                      <span>
                        {t(`「${m?.title.zh}」单笔上限`, `“${m?.title.en}” per-order cap`)} <Money minor={c.fromMinor ?? "0"} /> → <Money minor={c.toMinor ?? "0"} className="font-medium" />
                      </span>
                    ) : (
                      <span>
                        {t("收货地址改为", "Address change to")} {c.address}
                      </span>
                    )}
                    <div className="text-[12px] text-soft">
                      {t("申请于", "Requested")} {fmtDateTime(c.requestedAt, lang)} · {t("已短信通知你", "SMS sent")}
                    </div>
                    {c.byAttacker && (
                      <div className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-no">
                        <TriangleAlert className="size-3.5" />
                        {t("来自一台新设备。不是你？立刻取消并冻结。", "From a new device. Not you? Cancel and freeze now.")}
                      </div>
                    )}
                  </div>
                  <span className="text-[13px] text-ask">
                    <Countdown until={c.effectiveAt} /> {t("后生效", "to go")}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => actions.cancelCooling(c.id)} disabled={mode === "attacker"}>
                    {t("取消", "Cancel")}
                  </Button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[12px] text-soft">{t("放宽权限都要等 24 小时（演示压缩为 2 分钟）。收紧随时生效。", "Loosening waits 24 hours (2 minutes in the demo). Tightening applies at once.")}</p>
        </Panel>
      )}

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-[22px]">{t("我的授权", "My mandates")}</h2>
          <Link href="/mandate/new" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <Plus />
            {t("新建授权", "New mandate")}
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((m) => (
            <MandateCard key={m.id} m={m} href={`/mandate/${m.id}`} />
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel>
          <PanelTitle>{t("零钱包流水", "Pocket activity")}</PanelTitle>
          <ul className="divide-y divide-line">
            {s.pocketLog.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-3">
                <span className={cn("grid size-9 place-items-center rounded-full", l.kind === "spend" ? "bg-canvas" : "bg-ok-soft text-ok")}>
                  {l.kind === "spend" ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px]">{l.note[lang]}</div>
                  <div className="text-[12px] text-soft">{fmtDateTime(l.at, lang)}</div>
                </div>
                <span className={cn("tabular text-[14px]", l.kind !== "spend" && "text-ok")}>
                  {l.kind === "spend" ? "−" : "+"}
                  {fmtMoney(l.amountMinor, lang)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <div className="space-y-4">
          <SecurityCard />
          <Link href="/pay-methods" className="flex items-center gap-3 rounded-[20px] border border-line bg-white p-5 hover:border-violet/40">
            <div className="min-w-0 flex-1">
              <div className="font-heading text-[17px]">{t("用哪种方式付最划算？", "Which method costs least?")}</div>
              <div className="mt-1 text-[13px] text-soft">{t("FPS 和 Tap & Go 的手续费、回赠，附来源和观测时间。", "Fees and rewards for FPS and Tap & Go, with sources and dates.")}</div>
            </div>
            <ChevronRight className="size-5 text-soft" />
          </Link>
        </div>
      </div>

      <Dialog open={topup} onOpenChange={setTopup}>
        <DialogContent className="rounded-[24px] p-6 sm:max-w-md">
          <DialogTitle className="font-heading text-xl">{t("给 Agent 零钱包充值", "Top up Agent pocket")}</DialogTitle>
          <DialogDescription>{t("从 Tap & Go 转入。单次最多 $500.00。", "From Tap & Go. Up to $500.00 each time.")}</DialogDescription>
          {!s.connections.tapngo ? (
            <div className="rounded-2xl bg-canvas p-4 text-[14px]">
              {t("先连接 Tap & Go。", "Connect Tap & Go first.")}{" "}
              <Link href="/consent/tapngo?return=/wallet" className="text-violet hover:underline">
                {t("去连接", "Connect")}
              </Link>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                {["100", "200", "500"].map((v) => (
                  <button key={v} type="button" onClick={() => setAmount(v)} className={cn("h-9 flex-1 rounded-full border text-[13px]", amount === v ? "border-violet bg-violet-soft text-violet" : "border-line")}>
                    {fmtMoney(hkdToMinor(v), lang)}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[13px] text-soft">{t("金额（$）", "Amount ($)")}</span>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="tabular" />
              </label>
              {!amountOk && <p className="text-[13px] text-no">{t("请输入 0.01 到 500.00 之间的金额。", "Enter between 0.01 and 500.00.")}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setTopup(false)}>
                  {t("取消", "Cancel")}
                </Button>
                <Button onClick={doTopup} disabled={!amountOk}>
                  {t("用通行密钥确认", "Confirm with passkey")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
