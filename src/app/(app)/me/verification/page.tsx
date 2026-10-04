"use client";

import { cn } from "cn";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Chip, PageHeader, Panel, PanelTitle, SimNote } from "@/components/app/primitives";
import { useStepUp } from "@/components/app/step-up";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { actions, useMock, useSessionMode } from "@/lib/mock/store";
import { BackToMe } from "../back-link";

export default function VerificationPage() {
  const { t } = useLang();
  const s = useMock();
  const mode = useSessionMode();
  const stepUp = useStepUp();
  const upgraded = s.user.walletKyc === "upgraded";
  const levels = [
    { done: true, title: t("手机号", "Phone"), sub: t("登录、安全提醒", "Sign-in and alerts"), unlock: t("可以查看", "View") },
    { done: s.user.passkey, title: t("通行密钥", "Passkey"), sub: t("签授权、确认付款", "Sign mandates, approve payments"), unlock: t("可以授权 Zev 买东西", "Let Zev buy") },
    { done: s.connections.tapngo, title: t("钱包实名", "Wallet identity"), sub: t("由 Tap & Go 完成，我们不看证件", "Done by Tap & Go; we never see your ID"), unlock: t("单笔 $1,000.00 以内", "Orders up to $1,000.00") },
    { done: upgraded, title: t("升级认证", "Upgraded"), sub: t("单笔超过 $1,000.00 时才需要", "Only for orders above $1,000.00"), unlock: t("单笔 $1,000.00 以上", "Orders above $1,000.00") },
  ];

  const upgrade = async () => {
    const ok = await stepUp({ title: { zh: "升级认证", en: "Upgrade verification" }, detail: { zh: "会跳到钱包方完成，我们只接收「已通过」的结果。", en: "You'll finish it with the wallet provider; we only get a pass/fail result." } });
    if (!ok) return;
    actions.completeKyc();
    toast(t("已升级（模拟）", "Upgraded (simulated)"));
  };

  return (
    <>
      <BackToMe />
      <PageHeader eyebrow={t("认证等级", "Verification")} title={t("用多少，验多少", "Verify only what you need")} description={t("大部分日用品只需要前三步。要买得多、买得贵，再往上走。", "Everyday shopping only needs the first three steps. Go further only for bigger orders.")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel>
          <ol>
            {levels.map((l, i) => (
              <li key={l.title} className="relative flex gap-4 pb-7 last:pb-0">
                {i < levels.length - 1 && <span className={cn("absolute top-9 bottom-0 left-[17px] w-px", l.done ? "bg-violet/40" : "bg-line")} />}
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-[13px] tabular", l.done ? "bg-violet text-white" : "bg-canvas text-soft")}>{l.done ? <Check className="size-4" /> : i + 1}</span>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px]">{l.title}</span>
                    {i === 2 && l.done && <SimNote />}
                  </div>
                  <div className="text-[13px] text-soft">{l.sub}</div>
                  <div className="mt-1.5">
                    <Chip tone={l.done ? "ok" : "neutral"}>{l.unlock}</Chip>
                  </div>
                  {i === 3 && !l.done && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={upgrade} disabled={mode === "attacker"}>
                      {t("现在升级", "Upgrade now")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        <div className="space-y-4">
          <Panel>
            <PanelTitle>{t("年龄", "Age")}</PanelTitle>
            <div className="flex items-center gap-2 text-[14px]">
              {s.user.age18 ? <Chip tone="ok">{t("已声明满 18 岁", "Declared 18+")}</Chip> : <Chip>{t("未声明", "Not declared")}</Chip>}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-soft">{t("只用于酒类等有年龄限制的商品。第一次买这类商品时，还会请你用通行密钥再确认一次。", "Only for age-restricted items like alcohol. The first time you buy one, you'll confirm again with your passkey.")}</p>
          </Panel>
          <Panel>
            <PanelTitle>{t("我们不保存", "We don't keep")}</PanelTitle>
            <ul className="space-y-1.5 text-[13px] text-soft">
              <li>· {t("身份证件照片或号码", "ID photos or numbers")}</li>
              <li>· {t("钱包的余额与交易", "Wallet balances or transactions")}</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
