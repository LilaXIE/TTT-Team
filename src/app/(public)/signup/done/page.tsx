"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { Dot } from "@/components/app/primitives";
import { buttonVariants } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { setSessionMode } from "@/lib/mock/store";

export default function SignupDonePage() {
  const { t } = useLang();
  const items = [
    t("手机号已验证", "Phone verified"),
    t("通行密钥已绑定", "Passkey added"),
    t("钱包已连接（可稍后再连）", "Wallet connected (or later)"),
    t("Zev 还没有任何权限，等你签第一份授权", "Zev has no permissions yet — it waits for your first mandate"),
  ];
  return (
    <div className="text-center">
      <span className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-violet-soft">
        <Dot className="size-5" working />
      </span>
      <h1 className="font-heading text-[30px] leading-tight">{t("准备好了", "You're all set")}</h1>
      <p className="mt-2 text-[14px] text-soft">{t("说一句话，让 Zev 帮你买第一样东西。", "Tell Zev what to buy first.")}</p>
      <ul className="mx-auto mt-6 max-w-sm space-y-2.5 text-left text-[14px]">
        {items.map((x) => (
          <li key={x} className="flex items-start gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-ok" />
            {x}
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-col gap-2">
        <Link href="/task/new" onClick={() => setSessionMode("owner")} className={buttonVariants({ size: "lg", className: "w-full" })}>
          {t("开始第一个任务", "Start my first task")}
        </Link>
        <Link href="/" onClick={() => setSessionMode("owner")} className={buttonVariants({ variant: "ghost", className: "w-full" })}>
          {t("先看看首页", "Look around first")}
        </Link>
      </div>
    </div>
  );
}
