"use client";

import { cn } from "cn";
import { Check, Monitor, ShieldCheck, Snowflake } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useLang } from "@/lib/i18n";
import { actions, maxLossMinor, useMock, useSessionMode } from "@/lib/mock/store";
import { Money } from "./primitives";

/** Zev 现在最多能花 = min(零钱包余额, 生效授权剩余额度之和) */
export function MaxLossLine({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const { t } = useLang();
  const s = useMock();
  return (
    <div className={className}>
      <div className="text-[13px] text-soft">{t("Zev 现在最多能花", "The most Zev can spend right now")}</div>
      <Money minor={maxLossMinor(s)} className={cn("font-heading leading-tight", size === "lg" ? "text-[34px]" : "text-[26px]")} />
      <div className="mt-1 text-[12px] text-soft">{t("= 零钱包余额与生效授权剩余额度，取较小的那个", "= the smaller of your pocket balance and what is left on active mandates")}</div>
      <MoneyHow className="mt-2" />
    </div>
  );
}

export function MoneyHow({ className }: { className?: string }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("text-[12px] text-violet hover:underline", className)}>
        {t("这三个数怎么算？", "How do these three numbers work?")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-[24px] p-6 sm:max-w-md">
          <DialogTitle className="font-heading text-xl">{t("钱和额度是两回事", "Cash and permission are different")}</DialogTitle>
          <DialogDescription>
            {t("Zev 付款时两边都要够。任何一边不够，整笔退回，不会扣一半。", "Zev pays only when both are enough. If either falls short, the whole payment rolls back.")}
          </DialogDescription>
          <div className="space-y-3 text-[13.5px] leading-relaxed">
            <p>
              <span className="font-medium">{t("Agent 零钱包", "Agent pocket")}</span>
              {t("是你从 Tap & Go 转入、专门给 Zev 用的钱。没有充进来的余额，Zev 碰不到。充值要通行密钥，充进去之后才出现在零钱包。", " is money you move in from Tap & Go, only for Zev. Anything you have not moved stays out of reach. Topping up needs your passkey, and the money shows up in the pocket only after that.")}
            </p>
            <p>
              <span className="font-medium">{t("生效授权剩余额度", "Remaining mandate allowance")}</span>
              {t("是你在授权书里写下的总额，减去已经按这份授权花掉的。它限制 Zev 被允许花多少，不是账户里的现金。收紧上限马上生效；放宽要等冷静期。", " is the total you wrote on the mandate, minus what has already been spent on it. It limits what Zev is allowed to spend. It is not cash in the account. Tightening a cap takes effect now; loosening one waits through a cooling-off period.")}
            </p>
            <p>
              <span className="font-medium">{t("Zev 现在最多能花", "The most Zev can spend right now")}</span>
              {t("是上面两个数里较小的那个。零钱包有钱、但额度用完了，不能再付。额度还在、但零钱包是空的，也付不了。两边不会自动互相转化：想多花，就给零钱包充值，并且授权里还要有剩余额度。", " is the smaller of those two. Money in the pocket with no allowance left cannot be spent. Allowance left with an empty pocket cannot be spent either. One does not turn into the other. To spend more, top up the pocket, and keep allowance left on the mandate.")}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SecurityCard({ className }: { className?: string }) {
  const { t, lang } = useLang();
  const s = useMock();
  const mode = useSessionMode();
  const device = s.devices.find((d) => (mode === "attacker" ? d.isNew : d.current));
  return (
    <section className={cn("flex flex-col rounded-[20px] border border-line bg-white p-5 sm:p-6", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-[19px]">{t("安全状态", "Security")}</h2>
        <Link href="/me/security" className="text-[13px] text-violet hover:underline">
          {t("管理", "Manage")}
        </Link>
      </div>
      <ul className="grid gap-2.5 text-sm">
        <li className="flex items-center gap-2.5">
          <span className="grid size-6 place-items-center rounded-full bg-ok-soft text-ok">
            <ShieldCheck className="size-3.5" />
          </span>
          {mode === "attacker" ? t("这台设备没有通行密钥", "No passkey on this device") : t("通行密钥已绑定", "Passkey on")}
        </li>
        <li className="flex items-center gap-2.5">
          <span className="grid size-6 place-items-center rounded-full bg-canvas text-ink/70">
            <Monitor className="size-3.5" />
          </span>
          <span className="truncate">
            {t("当前设备", "This device")} · {device?.name[lang]}
          </span>
        </li>
        <li className="flex items-center gap-2.5">
          <span className="grid size-6 place-items-center rounded-full bg-canvas text-ink/70">
            <Check className="size-3.5" />
          </span>
          {t("密码只能看，花钱要通行密钥", "Password to look, passkey to spend")}
        </li>
      </ul>
      <MaxLossLine className="mt-5 border-t border-line pt-4" />
      <div className="mt-4">
        {s.session.frozen ? (
          <div className="rounded-xl bg-no-soft px-3 py-2 text-[13px] text-no">{t("已冻结。所有授权已撤销。", "Frozen. Every mandate is revoked.")}</div>
        ) : (
          <Button variant="ink" className="w-full" onClick={() => actions.freeze()} disabled={mode === "attacker"}>
            <Snowflake />
            {t("一键冻结", "Freeze everything")}
          </Button>
        )}
      </div>
    </section>
  );
}
