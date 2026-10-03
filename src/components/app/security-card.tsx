"use client";

import { cn } from "cn";
import { Check, Monitor, ShieldCheck, Snowflake } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { actions, maxLossMinor, useMock, useSessionMode } from "@/lib/mock/store";
import { Money } from "./primitives";

/** 「如果账号此刻被盗，你最多损失 X」= min(零钱包余额, 生效授权剩余额度之和) */
export function MaxLossLine({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const { t } = useLang();
  const s = useMock();
  return (
    <div className={className}>
      <div className="text-[13px] text-soft">{t("如果账号此刻被盗，你最多损失", "If your account were stolen right now, the most you could lose is")}</div>
      <Money minor={maxLossMinor(s)} className={cn("font-heading leading-tight", size === "lg" ? "text-[34px]" : "text-[26px]")} />
      <div className="mt-1 text-[12px] text-soft">{t("= 零钱包余额与生效授权剩余额度，取较小的那个", "= the smaller of your pocket balance and what is left on active mandates")}</div>
    </div>
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
