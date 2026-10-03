"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SimNote } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/lib/i18n";
import { CodeBoxes, StepTitle } from "./signup-frame";

const DEMO_OTP = "123456";

export default function SignupPhonePage() {
  const { t } = useLang();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const phoneOk = /^\d{8}$/.test(phone.replace(/\s/g, ""));

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    if (code !== DEMO_OTP) {
      setError(t("验证码不对。演示验证码是 123456。", "Wrong code. The demo code is 123456."));
      return;
    }
    if (pw.length < 8) {
      setError(t("密码至少 8 位。", "Use at least 8 characters."));
      return;
    }
    router.push("/signup/passkey");
  };

  return (
    <>
      <StepTitle title={t("先用手机号注册", "Start with your phone")} sub={t("手机号用来登录和接收安全提醒：新设备登录、改上限、改地址都会短信通知你。", "Your phone is for sign-in and security alerts: new devices, raised limits and address changes all trigger an SMS.")} />
      {!sent ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (phoneOk) setSent(true);
          }}
        >
          <div className="flex gap-2">
            <span className="grid h-11 shrink-0 place-items-center rounded-xl border border-line bg-canvas/60 px-3 text-sm text-soft">+852</span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("8 位手机号", "8-digit number")} inputMode="tel" autoFocus />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={!phoneOk}>
            {t("发送验证码", "Send code")}
          </Button>
        </form>
      ) : (
        <form className="space-y-5" onSubmit={verify}>
          <div>
            <div className="mb-2 flex items-center justify-between text-[13px]">
              <span className="text-soft">{t(`验证码已发到 +852 ${phone}`, `Code sent to +852 ${phone}`)}</span>
              <SimNote>{t("演示验证码 123456", "Demo code 123456")}</SimNote>
            </div>
            <CodeBoxes value={code} onChange={setCode} autoFocus />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-soft">{t("设置密码（只用于查看）", "Set a password (view-only)")}</span>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" placeholder={t("至少 8 位", "At least 8 characters")} />
          </label>
          {error && <p className="text-[13px] text-no">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={code.length !== 6 || !pw}>
            {t("下一步", "Continue")}
          </Button>
          <button type="button" onClick={() => setSent(false)} className="w-full text-center text-[13px] text-soft hover:text-ink">
            {t("换个号码", "Use a different number")}
          </button>
        </form>
      )}
    </>
  );
}
