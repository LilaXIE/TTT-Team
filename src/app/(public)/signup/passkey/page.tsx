"use client";

import { cn } from "cn";
import { Check, Fingerprint } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { CodeBoxes, StepTitle } from "../signup-frame";

export default function SignupPasskeyPage() {
  const { t } = useLang();
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "creating" | "done" | "pin">("idle");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const weak = /^(\d)\1{5}$/.test(pin) || pin === "123456" || pin === "654321";

  const create = () => {
    setPhase("creating");
    setTimeout(() => setPhase("done"), 1200);
  };

  return (
    <>
      <StepTitle
        title={t("绑定通行密钥", "Add a passkey")}
        sub={t("通行密钥存在你的设备里，用指纹或面容解锁，我们拿不到。签授权、确认付款、放宽上限都要它；只有密码的人只能看。", "A passkey lives on your device and unlocks with your fingerprint or face. We never see it. Signing mandates, approving payments and loosening limits all need it; a password alone is view-only.")}
      />
      {phase !== "pin" ? (
        <div className="flex flex-col items-center gap-6 py-2">
          <div
            className={cn(
              "grid size-28 place-items-center rounded-full transition-colors",
              phase === "done" ? "bg-ok-soft text-ok" : "bg-violet-soft text-violet",
              phase === "creating" && "animate-pulse",
            )}
          >
            {phase === "done" ? <Check className="size-12" /> : <Fingerprint className="size-12" />}
          </div>
          {phase === "done" ? (
            <>
              <p className="text-center text-[15px]">{t("通行密钥已绑定在这台设备上。", "Passkey added to this device.")}</p>
              <Button size="lg" className="w-full" onClick={() => router.push("/signup/wallet")}>
                {t("下一步", "Continue")}
              </Button>
            </>
          ) : (
            <>
              <Button size="lg" className="w-full" onClick={create} disabled={phase === "creating"}>
                {phase === "creating" ? t("等待设备确认…", "Waiting for your device…") : t("创建通行密钥", "Create passkey")}
              </Button>
              <button type="button" onClick={() => setPhase("pin")} className="text-[13px] text-soft hover:text-ink">
                {t("这台设备不支持？改用 6 位 PIN", "Device not supported? Use a 6-digit PIN")}
              </button>
            </>
          )}
        </div>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (pin.length === 6 && pin === pin2 && !weak) router.push("/signup/wallet");
          }}
        >
          <div>
            <div className="mb-2 text-[13px] text-soft">{t("设置 6 位 PIN", "Choose a 6-digit PIN")}</div>
            <CodeBoxes value={pin} onChange={setPin} masked autoFocus />
          </div>
          {pin.length === 6 && (
            <div>
              <div className="mb-2 text-[13px] text-soft">{t("再输一次", "Enter it again")}</div>
              <CodeBoxes value={pin2} onChange={setPin2} masked />
            </div>
          )}
          {weak && <p className="text-[13px] text-no">{t("太容易猜了，换一个。", "Too easy to guess. Pick another.")}</p>}
          {pin2.length === 6 && pin !== pin2 && <p className="text-[13px] text-no">{t("两次不一致。", "The PINs don't match.")}</p>}
          <p className="text-[12px] leading-relaxed text-soft">{t("PIN 在服务端校验，连续输错 3 次会锁定。之后在支持的设备上可以再绑定通行密钥。", "The PIN is checked on our server and locks after 3 wrong tries. You can add a passkey later on a supported device.")}</p>
          <Button type="submit" size="lg" className="w-full" disabled={pin.length !== 6 || pin !== pin2 || weak}>
            {t("下一步", "Continue")}
          </Button>
          <button type="button" onClick={() => setPhase("idle")} className="w-full text-center text-[13px] text-soft hover:text-ink">
            {t("返回用通行密钥", "Back to passkey")}
          </button>
        </form>
      )}
    </>
  );
}
