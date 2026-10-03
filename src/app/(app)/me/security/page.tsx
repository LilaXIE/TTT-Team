"use client";

import { cn } from "cn";
import { Check, Fingerprint, KeyRound, Laptop, Smartphone, Snowflake, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { Chip, PageHeader, Panel, PanelTitle } from "@/components/app/primitives";
import { MaxLossLine } from "@/components/app/security-card";
import { useStepUp } from "@/components/app/step-up";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fmtDateTime } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { actions, useMock, useSessionMode } from "@/lib/mock/store";
import { BackToMe } from "../back-link";

export default function SecurityPage() {
  const { t, lang } = useLang();
  const s = useMock();
  const mode = useSessionMode();
  const stepUp = useStepUp();
  const [confirmFreeze, setConfirmFreeze] = useState(false);

  const rows: { what: string; pw: boolean; pk: string | true }[] = [
    { what: t("看余额、授权和记录", "See balance, mandates, records"), pw: true, pk: true },
    { what: t("收紧或撤销授权、一键冻结", "Tighten or revoke, freeze"), pw: true, pk: true },
    { what: t("签发新授权", "Sign a new mandate"), pw: false, pk: true },
    { what: t("确认「先问你」的订单", "Approve an ask-first order"), pw: false, pk: true },
    { what: t("给零钱包充值", "Top up the pocket"), pw: false, pk: true },
    { what: t("提高上限", "Raise a limit"), pw: false, pk: t("+ 24 小时", "+ 24 h") },
    { what: t("改收货地址", "Change address"), pw: false, pk: t("+ 24 小时", "+ 24 h") },
  ];

  const unfreeze = async () => {
    const ok = await stepUp({ title: { zh: "解除冻结", en: "Unfreeze" }, detail: { zh: "解除后需要重新签授权，Zev 才能再买东西。", en: "You'll need to sign new mandates before Zev can buy again." } });
    if (ok) actions.unfreeze();
  };

  return (
    <>
      <BackToMe />
      <PageHeader eyebrow={t("安全", "Security")} title={t("登录 ≠ 能花钱", "Signing in ≠ spending")} description={t("只有密码的人只能看。所有花钱和放宽权限的动作，都要你的通行密钥。", "A password alone only lets someone look. Anything that spends or loosens limits needs your passkey.")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Panel>
            <PanelTitle>{t("谁能做什么", "Who can do what")}</PanelTitle>
            <div className="overflow-hidden rounded-2xl border border-line">
              <div className="grid grid-cols-[1fr_88px_108px] bg-canvas/70 px-4 py-2.5 text-[12px] text-soft">
                <span />
                <span className="text-center">{t("只有密码", "Password")}</span>
                <span className="text-center">{t("通行密钥", "Passkey")}</span>
              </div>
              {rows.map((r) => (
                <div key={r.what} className="grid grid-cols-[1fr_88px_108px] items-center border-t border-line px-4 py-2.5 text-[14px]">
                  <span>{r.what}</span>
                  <span className="flex justify-center">{r.pw ? <Check className="size-4 text-ok" /> : <X className="size-4 text-no" />}</span>
                  <span className="flex items-center justify-center gap-1 text-[12px] text-ask">
                    <Check className="size-4 text-ok" />
                    {r.pk !== true && r.pk}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelTitle>{t("登录的设备", "Signed-in devices")}</PanelTitle>
            <ul className="divide-y divide-line">
              {s.devices.map((d) => (
                <li key={d.id} className={cn("flex flex-wrap items-center gap-3 py-3", d.isNew && "rounded-2xl bg-no-soft/50 px-3")}>
                  <span className="grid size-10 place-items-center rounded-xl bg-canvas">{/iphone/i.test(d.name.en) ? <Smartphone className="size-5" /> : <Laptop className="size-5" />}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[14px]">
                      {d.name[lang]}
                      {d.current && mode === "owner" && <Chip tone="violet">{t("这台", "This one")}</Chip>}
                      {d.isNew && <Chip tone="no">{t("新设备", "New")}</Chip>}
                      {d.readOnly ? <Chip>{t("只能查看", "View-only")}</Chip> : d.passkey && <Chip tone="ok">{t("有通行密钥", "Has passkey")}</Chip>}
                    </div>
                    <div className="text-[12px] text-soft">
                      {d.place[lang]} · {fmtDateTime(d.lastSeen, lang)}
                    </div>
                  </div>
                  {!d.current && (
                    <Button variant="outline" size="sm" onClick={() => actions.signOutDevice(d.id)} disabled={mode === "attacker"}>
                      {t("让它退出", "Sign out")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelTitle>{t("最近的安全动态", "Recent security activity")}</PanelTitle>
            <ul className="space-y-2.5">
              {s.activity.slice(0, 14).map((a) => (
                <li key={a.id} className={cn("flex items-start gap-3 text-[13px]", a.risky && "text-no")}>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", a.risky ? "bg-no" : "bg-violet/50")} />
                  <span className="min-w-0 flex-1">{a.text[lang]}</span>
                  <span className="shrink-0 text-[12px] text-soft">{fmtDateTime(a.at, lang)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-4">
          {s.session.frozen ? (
            <Panel className="border-no/30 bg-no-soft/40">
              <div className="flex items-center gap-2 text-no">
                <Snowflake className="size-5" />
                <span className="font-heading text-[20px]">{t("账号已冻结", "Account frozen")}</span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed">
                {t("全部授权已撤销，等你确认的已取消，冷静期中的修改已作废。Zev 现在什么都买不了。", "All mandates are revoked, pending approvals cancelled, cooling changes voided. Zev can't buy anything.")}
              </p>
              {s.session.frozenAt && <p className="mt-1 text-[12px] text-soft">{fmtDateTime(s.session.frozenAt, lang)}</p>}
              <Button className="mt-4 w-full" onClick={unfreeze} disabled={mode === "attacker"}>
                <Fingerprint />
                {t("用通行密钥解除冻结", "Unfreeze with passkey")}
              </Button>
            </Panel>
          ) : (
            <Panel>
              <MaxLossLine size="lg" />
              <Button variant="ink" size="lg" className="mt-5 w-full" onClick={() => setConfirmFreeze(true)} disabled={mode === "attacker"}>
                <Snowflake />
                {t("一键冻结", "Freeze everything")}
              </Button>
              <p className="mt-2 text-[12px] text-soft">{t("不需要通行密钥。觉得不对劲，先冻结再说。", "No passkey needed. If something feels off, freeze first.")}</p>
            </Panel>
          )}
          <Panel>
            <PanelTitle>{t("验证方式", "Verification methods")}</PanelTitle>
            <ul className="space-y-3 text-[14px]">
              <li className="flex items-center gap-3">
                <Fingerprint className="size-5 text-violet" />
                <span className="flex-1">{t("通行密钥", "Passkey")}</span>
                <Chip tone="ok">{t("已绑定", "On")}</Chip>
              </li>
              <li className="flex items-center gap-3">
                <KeyRound className="size-5 text-violet" />
                <span className="flex-1">{t("6 位 PIN（备用）", "6-digit PIN (backup)")}</span>
                <Chip tone="ok">{t("已设置", "Set")}</Chip>
              </li>
            </ul>
            <p className="mt-3 text-[12px] text-soft">{t("PIN 在服务端校验，连续输错 3 次锁定。", "The PIN is checked server-side and locks after 3 wrong tries.")}</p>
          </Panel>
          {s.devices.some((d) => d.isNew) && (
            <Panel className="border-no/30">
              <div className="flex gap-2 text-[13px] text-no">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                {t("有一台新设备用密码登录了。它只能看，不能花钱。不是你的话，让它退出或直接冻结。", "A new device signed in with your password. It can look but not spend. If it isn't you, sign it out or freeze.")}
              </div>
            </Panel>
          )}
        </div>
      </div>

      <Dialog open={confirmFreeze} onOpenChange={setConfirmFreeze}>
        <DialogContent className="rounded-[24px] p-6 sm:max-w-md">
          <DialogTitle className="font-heading text-xl">{t("冻结账号？", "Freeze your account?")}</DialogTitle>
          <DialogDescription>{t("立刻撤销全部授权、取消所有待确认和冷静期中的修改。解除冻结需要通行密钥。", "Revokes every mandate and cancels all pending approvals and cooling changes at once. Unfreezing needs your passkey.")}</DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmFreeze(false)}>
              {t("取消", "Cancel")}
            </Button>
            <Button
              variant="ink"
              onClick={() => {
                actions.freeze();
                setConfirmFreeze(false);
              }}
            >
              {t("冻结", "Freeze")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
