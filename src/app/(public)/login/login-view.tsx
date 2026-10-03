"use client";

import { cn } from "cn";
import { Check, Fingerprint, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Dot, Eyebrow, OutcomeChip, ZevAvatar } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { actions, setSessionMode } from "@/lib/mock/store";

const DEMO_EMAIL = "alex@demo.hk";
const DEMO_PASSWORD = "demo1234";

const SCENE_MS = 3200;

/** 左侧演示舞台：一句话 → 授权黑卡 → 三种结果 → 收据，循环播放 */
function Stage() {
  const { t } = useLang();
  const [scene, setScene] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setScene((s) => (s + 1) % 4), SCENE_MS);
    return () => clearInterval(id);
  }, []);
  const show = (i: number) => (scene >= i ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0");
  return (
    <div className="group relative aspect-[4/3] w-full max-w-[640px] overflow-hidden rounded-[28px] border border-white/70 bg-white/55 p-6 shadow-[0_30px_80px_-40px_rgba(92,77,255,0.45)] backdrop-blur-xl transition-transform duration-500 hover:scale-[1.02] sm:p-8">
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-violet/20 blur-3xl" />
      <div className="relative flex h-full flex-col gap-4">
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-[18px] rounded-br-md bg-ink px-4 py-2.5 text-[14px] text-white">
            {t("帮我补一瓶洗衣液，HK$150 以内，可以换牌子。", "Restock laundry liquid under HK$150, other brands OK.")}
          </div>
        </div>
        {scene === 0 && (
          <div className="flex items-center gap-3 text-[13px] text-soft">
            <ZevAvatar working />
            {t("Zev 正在起草授权…", "Zev is drafting a mandate…")}
          </div>
        )}
        <div className={cn("flex items-start gap-3 transition-all duration-500", show(1), scene === 0 && "hidden")}>
          <ZevAvatar working={scene === 1} />
          <div className="relative w-[62%] overflow-hidden rounded-[18px] bg-noir p-4 text-white">
            <div className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full bg-violet/30 blur-2xl" />
            <div className="text-[10px] tracking-[0.18em] text-white/50 uppercase">{t("授权书 · v1", "Mandate · v1")}</div>
            <div className="mt-1 font-heading text-[17px]">{t("日用品补货", "Household restock")}</div>
            <div className="mt-3 text-[10px] text-white/50">{t("剩余额度", "Remaining")}</div>
            <div className="font-heading text-[20px] tabular">{t("300.00 港元", "HK$300.00")}</div>
            <div className="mt-1 text-[11px] text-white/60">{t("单笔 ≤ 150.00 港元 · 7 天", "≤ HK$150.00 per order · 7 days")}</div>
            <Dot className="absolute right-4 bottom-4 size-2.5" />
          </div>
        </div>
        <div className={cn("ml-11 grid grid-cols-3 gap-2 transition-all delay-100 duration-500", show(2))}>
          {(
            [
              ["ALLOW", t("品牌甲 2L", "Brand Jia 2L"), "138"],
              ["REVIEW", t("换了牌子", "New brand"), "135"],
              ["DENY", t("超过上限", "Over cap"), "158"],
            ] as const
          ).map(([o, label, n]) => (
            <div key={o} className="rounded-2xl bg-white p-3 ring-1 ring-line">
              <OutcomeChip outcome={o} className="h-5 px-2 text-[10px]" />
              <div className="mt-2 truncate text-[12px]">{label}</div>
              <div className="text-[11px] text-soft tabular">{t(`${n}.00 港元`, `HK$${n}.00`)}</div>
            </div>
          ))}
        </div>
        <div className={cn("mt-auto ml-11 flex items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-ok/25 transition-all duration-500", show(3))}>
          <span className="grid size-8 place-items-center rounded-full bg-ok-soft text-ok">
            <Check className="size-4" />
          </span>
          <div className="flex-1 text-[13px]">
            <div>{t("已付款 · 规则全部通过", "Paid · every rule passed")}</div>
            <div className="text-[11px] text-soft">{t("FPS · 模拟", "FPS · simulated")}</div>
          </div>
          <span className="font-heading text-[18px] tabular">{t("138.00 港元", "HK$138.00")}</span>
        </div>
      </div>
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1.5 rounded-full transition-all", i === scene ? "w-5 bg-violet" : "w-1.5 bg-violet/25")} />
        ))}
      </div>
    </div>
  );
}

export function LoginView({ attacker }: { attacker: boolean }) {
  const { t } = useLang();
  const router = useRouter();
  const [via, setVia] = useState<"phone" | "email">(attacker ? "phone" : "email");
  const [id, setId] = useState(attacker ? "5123 5678" : "");
  const [pw, setPw] = useState(attacker ? "alex-2026!" : "");
  const [passkey, setPasskey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", json: { email, password } });
      setSessionMode("owner");
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("登录失败。请确认数据库已启动并完成种子数据。", "Sign-in failed. Check that the database is seeded."));
      setBusy(false);
    }
  };

  const loginWithPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !pw) return;
    if (attacker) {
      setSessionMode("attacker");
      actions.attackerLogin();
      router.push("/");
      return;
    }
    if (via === "phone") {
      setError(t("演示账号用邮箱登录。", "The demo account uses email."));
      return;
    }
    void signIn(id.trim(), pw);
  };

  const loginWithPasskey = () => {
    setPasskey(true);
    setTimeout(() => {
      setSessionMode("owner");
      router.push("/");
    }, 1100);
  };

  return (
    <div className="mx-auto grid w-full max-w-[1200px] flex-1 items-center gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-14">
      <div className="hidden flex-col gap-8 lg:flex">
        <div>
          <Eyebrow className="mb-4">{t("给购物 Agent 的授权钱包", "A mandate wallet for shopping agents")}</Eyebrow>
          <h1 className="max-w-[600px] font-heading text-[42px] leading-[1.12] tracking-tight">
            {t("把钱包交给 Agent 之前，", "Set the limits")}
            <br />
            {t("先写好边界。", "before an agent touches your wallet.")}
          </h1>
          <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-soft">
            {t("说一句话，Zev 起草授权；你用通行密钥签发。范围内它直接买，超出就先问你，越界就拒绝。", "Say it once. Zev drafts a mandate and you sign it with your passkey. Inside the limits it buys; near them it asks; beyond them it refuses.")}
          </p>
        </div>
        <Stage />
      </div>

      <div className="mx-auto w-full max-w-[420px]">
        <div className="mb-6 lg:hidden">
          <h1 className="font-heading text-[32px] leading-tight">{t("把钱包交给 Agent 之前，先写好边界。", "Set the limits before an agent touches your wallet.")}</h1>
        </div>
        <div className="rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-[0_24px_60px_-30px_rgba(28,27,31,0.25)] backdrop-blur-xl sm:p-8">
          {attacker && (
            <div className="mb-5 flex gap-2.5 rounded-2xl bg-no-soft p-3.5 text-[13px] text-no">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{t("攻击演示：你拿到了 Alex 的密码，在一台陌生设备上登录。", "Attack demo: you have Alex's password and are signing in from an unknown device.")}</span>
            </div>
          )}
          <h2 className="font-heading text-[26px]">{t("登录", "Sign in")}</h2>
          <p className="mt-1 text-[14px] text-soft">{t("欢迎回来。", "Welcome back.")}</p>

          <Button variant="ink" size="lg" className="mt-6 w-full" onClick={loginWithPasskey} disabled={passkey || attacker}>
            <Fingerprint />
            {passkey ? t("正在验证通行密钥…", "Checking passkey…") : t("用通行密钥登录", "Sign in with passkey")}
          </Button>
          {attacker && <p className="mt-2 text-center text-[12px] text-soft">{t("这台设备上没有 Alex 的通行密钥。", "Alex's passkey isn't on this device.")}</p>}

          <div className="my-6 flex items-center gap-3 text-[12px] text-soft">
            <span className="h-px flex-1 bg-line" />
            {t("或用密码", "or use a password")}
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={loginWithPassword} className="space-y-3">
            <div className="inline-flex rounded-full bg-canvas p-1">
              {(["phone", "email"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setVia(v)} className={cn("h-7 rounded-full px-3.5 text-[12px] transition-colors", via === v ? "bg-white text-ink shadow-sm" : "text-soft")}>
                  {v === "phone" ? t("手机号", "Phone") : t("邮箱", "Email")}
                </button>
              ))}
            </div>
            {via === "phone" ? (
              <div className="flex gap-2">
                <span className="grid h-11 shrink-0 place-items-center rounded-xl border border-line bg-canvas/60 px-3 text-sm text-soft">+852</span>
                <Input value={id} onChange={(e) => setId(e.target.value)} placeholder={t("手机号", "Phone number")} inputMode="tel" autoComplete="tel" />
              </div>
            ) : (
              <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="name@example.com" type="email" autoComplete="email" />
            )}
            <Input value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t("密码", "Password")} type="password" autoComplete="current-password" />
            <Button type="submit" variant="outline" size="lg" className="w-full" disabled={!id || !pw || busy}>
              {t("用密码登录", "Sign in with password")}
            </Button>
          </form>
          {!attacker && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="mt-3 w-full"
              disabled={busy}
              onClick={() => {
                setVia("email");
                setId(DEMO_EMAIL);
                setPw(DEMO_PASSWORD);
                void signIn(DEMO_EMAIL, DEMO_PASSWORD);
              }}
            >
              {t("使用演示账号 alex@demo.hk", "Use demo account alex@demo.hk")}
            </Button>
          )}
          {error && <p className="mt-3 text-[13px] text-no">{error}</p>}

          <p className="mt-4 rounded-2xl bg-violet-soft/70 px-3.5 py-3 text-[12.5px] leading-relaxed text-violet">
            {t("密码登录只能查看。签授权、付款、改上限和地址，都要再用通行密钥确认。", "Password sign-in is view-only. Signing mandates, paying, and changing limits or address all need your passkey.")}
          </p>
          <p className="mt-6 text-center text-[14px] text-soft">
            {t("没有账号？", "New here?")}{" "}
            <Link href="/signup" className="text-violet hover:underline">
              {t("注册", "Create an account")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
