"use client";

import Link from "next/link";
import { Dot } from "@/components/app/primitives";
import { buttonVariants } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useLang();
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="text-center">
        <Dot className="mx-auto mb-6 size-4" />
        <h1 className="font-heading text-[34px]">{t("这里什么都没有", "Nothing here")}</h1>
        <p className="mt-2 text-soft">{t("链接可能写错了，或者这个页面只在演示模式下开放。", "The link may be wrong, or this page only exists in demo mode.")}</p>
        <Link href="/" className={buttonVariants({ className: "mt-6" })}>
          {t("回到首页", "Back home")}
        </Link>
      </div>
    </div>
  );
}
