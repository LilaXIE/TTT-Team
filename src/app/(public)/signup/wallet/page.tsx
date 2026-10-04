"use client";

import { Check, Wallet } from "lucide-react";
import Link from "next/link";
import { Chip, SimNote } from "@/components/app/primitives";
import { buttonVariants } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { useMock } from "@/lib/mock/store";
import { StepTitle } from "../signup-frame";

export default function SignupWalletPage() {
  const { t } = useLang();
  const s = useMock();
  const connected = s.connections.tapngo;
  return (
    <>
      <StepTitle
        title={t("连接你的钱包", "Connect your wallet")}
        sub={t("Zev 不直接动你的 Tap & Go。它只从一个单独的「Agent 零钱包」付款，钱要你自己充进去。没有充进去的钱，Zev 碰不到。", "Zev never touches your Tap & Go balance. It pays only from a separate Agent pocket that you top up yourself. Money you have not moved in stays out of reach.")}
      />
      <div className="rounded-2xl border border-line bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-canvas">
            <Wallet className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px]">Tap &amp; Go</div>
            <div className="text-[12px] text-soft">{t("用于给 Agent 零钱包充值", "Used to top up the Agent pocket")}</div>
          </div>
          {connected ? (
            <Chip tone="ok">
              <Check className="size-3" />
              {t("已连接", "Connected")}
            </Chip>
          ) : (
            <Link href="/consent/tapngo?return=/signup/wallet" className={buttonVariants({ size: "sm" })}>
              {t("连接", "Connect")}
            </Link>
          )}
        </div>
        {connected && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-[12.5px]">
            <span>{t("已由钱包方完成实名认证", "Identity verified by the wallet provider")}</span>
            <SimNote />
          </div>
        )}
      </div>
      <ul className="mt-5 space-y-2 text-[13px] text-soft">
        <li>· {t("单次充值最多 $500，由你在钱包里确认。", "Each top-up is capped at $500 and you confirm it in the wallet.")}</li>
        <li>· {t("我们看不到你的钱包余额和交易记录。", "We can't see your wallet balance or history.")}</li>
        <li>· {t("随时可以在「我的 › 连接」里断开。", "Disconnect anytime under Me › Connections.")}</li>
      </ul>
      <div className="mt-7 flex flex-col gap-2">
        <Link href="/signup/age" className={buttonVariants({ size: "lg", className: "w-full" })}>
          {connected ? t("下一步", "Continue") : t("先跳过", "Skip for now")}
        </Link>
      </div>
    </>
  );
}
