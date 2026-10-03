"use client";

import { Hourglass, MapPin, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Countdown, PageHeader, Panel, PanelTitle } from "@/components/app/primitives";
import { useStepUp } from "@/components/app/step-up";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDateTime } from "@/lib/format";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { actions, useMock, useSessionMode } from "@/lib/mock/store";
import { BackToMe } from "../back-link";

export default function AddressPage() {
  const { t, lang } = useLang();
  const s = useMock();
  const mode = useSessionMode();
  const stepUp = useStepUp();
  const [next, setNext] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const waiting = s.cooling.filter((c) => c.kind === "address" && c.status === "waiting");

  useEffect(() => {
    void api<{ addresses: Array<{ address: string; isDefault: boolean }> }>("/api/profile")
      .then((res) => setSaved(res.addresses.find((a) => a.isDefault)?.address ?? res.addresses[0]?.address ?? null))
      .catch(() => setSaved(null));
  }, []);

  const submit = async () => {
    const v = next.trim();
    if (v.length < 6) return;
    const ok = await stepUp({ title: { zh: "修改收货地址", en: "Change address" }, detail: { zh: `改为：${v}。24 小时后生效。`, en: `To: ${v}. Effective in 24 hours.` } });
    if (!ok) return;
    actions.requestAddressChange(v, mode === "attacker");
    try {
      await api("/api/profile", {
        method: "POST",
        json: { action: "saveAddress", address: { name: s.user.name, phone: "85200000000", address: v, isDefault: true } },
      });
      setSaved(v);
    } catch {
      // 没登录时仍保留页面上的冷静期演示。
    }
    setNext("");
  };

  return (
    <>
      <BackToMe />
      <PageHeader eyebrow={t("收货地址", "Address")} title={t("东西寄到哪", "Where things go")} description={t("改地址要通行密钥，24 小时后才生效，并短信通知你。就算账号被盗，也没法悄悄把东西寄走。", "Changing it needs your passkey, waits 24 hours and sends you an SMS. Even with your account, nobody can quietly redirect a parcel.")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Panel>
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-violet-soft text-violet">
                <MapPin className="size-5" />
              </span>
              <div>
                <div className="text-[12px] text-soft">{t("当前地址", "Current")}</div>
                <div className="mt-0.5 text-[16px]">{saved ?? s.address[lang]}</div>
              </div>
            </div>
          </Panel>
          {waiting.map((c) => (
            <Panel key={c.id} className={c.byAttacker ? "border-no/35" : "border-ask/35"}>
              <div className="flex flex-wrap items-center gap-3">
                <Hourglass className="size-5 text-ask" />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px]">
                    {t("改为", "Changing to")} {c.address}
                  </div>
                  <div className="text-[12px] text-soft">
                    {t("申请于", "Requested")} {fmtDateTime(c.requestedAt, lang)} · <Countdown until={c.effectiveAt} /> {t("后生效", "to go")}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => actions.cancelCooling(c.id)} disabled={mode === "attacker"}>
                  {t("取消", "Cancel")}
                </Button>
              </div>
              {c.byAttacker && (
                <p className="mt-3 flex gap-2 text-[13px] text-no">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  {t("这是从一台新设备发起的。不是你？取消它，然后去冻结账号。", "This came from a new device. Not you? Cancel it, then freeze your account.")}
                </p>
              )}
            </Panel>
          ))}
          <Panel>
            <PanelTitle>{t("换一个地址", "New address")}</PanelTitle>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input value={next} onChange={(e) => setNext(e.target.value)} placeholder={t("新的收货地址", "New delivery address")} />
              <Button onClick={submit} disabled={next.trim().length < 6}>
                {t("用通行密钥申请", "Request with passkey")}
              </Button>
            </div>
          </Panel>
        </div>
        <Panel>
          <PanelTitle>{t("为什么要等 24 小时", "Why the 24-hour wait")}</PanelTitle>
          <p className="text-[13px] leading-relaxed text-soft">{t("偷到账号的人最想做的，就是把东西寄到自己那里。等待期加短信通知，给你足够时间发现并取消。演示里压缩成 2 分钟。", "Redirecting parcels is the first thing a thief tries. The wait plus an SMS gives you time to notice and cancel. In this demo it's 2 minutes.")}</p>
        </Panel>
      </div>
    </>
  );
}
