"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useLang } from "@/lib/i18n";

export function BackToMe() {
  const { t } = useLang();
  return (
    <Link href="/me" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-soft hover:text-ink">
      <ArrowLeft className="size-4" />
      {t("我的", "Me")}
    </Link>
  );
}
