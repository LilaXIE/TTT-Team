"use client";

// 登录 ≠ 能花钱：签授权、放宽上限、改地址、确认「先问你」都要再验证一次。
// 真实实现：WebAuthn（@simplewebauthn）+ 服务端校验的 6 位 PIN 兜底。原型里模拟这两步。
import { Fingerprint, KeyRound, Lock, TriangleAlert } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useLang } from "@/lib/i18n";
import { actions, useSessionMode } from "@/lib/mock/store";
import type { Tx } from "@/lib/mock/types";

interface Request {
  title: Tx;
  detail?: Tx;
}

type Phase = "passkey" | "verifying" | "pin" | "locked";

const Ctx = createContext<((r: Request) => Promise<boolean>) | null>(null);

export function useStepUp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStepUp outside StepUpProvider");
  return v;
}

const DEMO_PIN = "123456";

export function StepUpProvider({ children }: { children: React.ReactNode }) {
  const { t, lang } = useLang();
  const mode = useSessionMode();
  const [req, setReq] = useState<Request | null>(null);
  const [phase, setPhase] = useState<Phase>("passkey");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const request = useCallback((r: Request) => {
    setReq(r);
    setPhase("passkey");
    setPin("");
    setError(null);
    setFails(0);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setReq(null);
  };

  const tryPasskey = () => {
    if (mode === "attacker") {
      setError(t("这台设备没有绑定通行密钥。", "No passkey is registered on this device."));
      actions.stepUpFailed({ zh: "新设备尝试用通行密钥验证，失败", en: "New device tried passkey verification and failed" });
      return;
    }
    setPhase("verifying");
    setTimeout(() => finish(true), 900);
  };

  const submitPin = () => {
    if (mode === "owner" && pin === DEMO_PIN) return finish(true);
    const n = fails + 1;
    setFails(n);
    setPin("");
    if (n >= 3) {
      setPhase("locked");
      actions.stepUpFailed({ zh: "PIN 连续输错 3 次，已锁定 15 分钟", en: "PIN wrong 3 times, locked for 15 minutes" });
    } else {
      setError(t(`PIN 不对，还可以试 ${3 - n} 次。`, `Wrong PIN. ${3 - n} tries left.`));
    }
  };

  return (
    <Ctx.Provider value={request}>
      {children}
      <Dialog open={req !== null} onOpenChange={(open) => !open && finish(false)}>
        <DialogContent className="gap-0 rounded-[24px] p-0 sm:max-w-[400px]">
          <div className="px-6 pt-7 pb-5 text-center">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-violet-soft text-violet">
              {phase === "locked" ? <Lock className="size-6" /> : phase === "pin" ? <KeyRound className="size-6" /> : <Fingerprint className="size-7" />}
            </div>
            <DialogTitle className="font-heading text-[22px] leading-snug font-normal">{req?.title[lang]}</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed">
              {req?.detail?.[lang] ?? t("密码登录只能查看。这一步要用通行密钥再确认一次。", "Signing in with a password only lets you look. This step needs your passkey.")}
            </DialogDescription>
          </div>

          <div className="border-t border-line px-6 py-5">
            {phase === "passkey" && (
              <div className="grid gap-2.5">
                <Button size="lg" onClick={tryPasskey}>
                  <Fingerprint />
                  {t("使用通行密钥", "Use passkey")}
                </Button>
                <Button size="lg" variant="ghost" onClick={() => { setPhase("pin"); setError(null); }}>
                  {t("用 6 位 PIN 代替", "Use 6-digit PIN instead")}
                </Button>
              </div>
            )}
            {phase === "verifying" && <div className="py-3 text-center text-sm text-soft">{t("正在验证（模拟 WebAuthn）…", "Verifying (simulated WebAuthn)…")}</div>}
            {phase === "pin" && (
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitPin();
                }}
              >
                <input
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className="tabular h-14 w-full rounded-2xl border border-line bg-canvas text-center text-2xl tracking-[0.5em] outline-none focus:border-violet"
                  aria-label="PIN"
                />
                <Button size="lg" type="submit" disabled={pin.length !== 6}>
                  {t("验证", "Verify")}
                </Button>
                {mode === "owner" && <p className="text-center text-xs text-soft">{t("演示 PIN：123456 · 由服务端校验", "Demo PIN: 123456 · checked by the server")}</p>}
              </form>
            )}
            {phase === "locked" && <p className="py-2 text-center text-sm text-no">{t("连续输错 3 次，已锁定 15 分钟，并通知了账号主人。", "Wrong 3 times. Locked for 15 minutes and the owner was notified.")}</p>}
            {error && phase !== "locked" && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-no">
                <TriangleAlert className="size-4" />
                {error}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
