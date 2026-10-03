"use client";

import { cn } from "cn";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { StepTitle } from "../signup-frame";

export default function SignupAgePage() {
  const { t } = useLang();
  const router = useRouter();
  const [adult, setAdult] = useState(false);
  return (
    <>
      <StepTitle title={t("你满 18 岁了吗？", "Are you 18 or older?")} sub={t("只在买酒类这类有年龄限制的商品时用到。我们不收集证件。", "Only used for age-restricted items like alcohol. We don't collect ID.")} />
      <button
        type="button"
        onClick={() => setAdult((v) => !v)}
        aria-pressed={adult}
        className={cn("flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors", adult ? "border-violet bg-violet-soft/60" : "border-line bg-white hover:border-soft/50")}
      >
        <span className={cn("grid size-6 shrink-0 place-items-center rounded-lg border", adult ? "border-violet bg-violet text-white" : "border-line bg-white")}>{adult && <Check className="size-4" />}</span>
        <span className="text-[15px]">{t("我确认我已年满 18 岁", "I confirm I'm 18 or older")}</span>
      </button>
      <p className="mt-3 text-[12px] leading-relaxed text-soft">{t("这是自我声明。之后第一次买酒类时，还会请你用通行密钥再确认一次。", "This is a self-declaration. The first time you buy alcohol, we'll ask you to confirm again with your passkey.")}</p>
      <div className="mt-7 flex flex-col gap-2">
        <Button size="lg" className="w-full" disabled={!adult} onClick={() => router.push("/signup/done")}>
          {t("确认", "Confirm")}
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => router.push("/signup/done")}>
          {t("跳过，暂时不买酒类", "Skip, no alcohol for now")}
        </Button>
      </div>
    </>
  );
}
