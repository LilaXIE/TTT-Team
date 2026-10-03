"use client";

import { cn } from "cn";
import { Bell, FlaskConical, House, Plus, ReceiptText, ShieldAlert, Snowflake, UserRound, Wallet, Inbox } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { actions, openPending, useMock, useNow, useSessionMode } from "@/lib/mock/store";
import { LangToggle } from "./lang-toggle";
import { Dot, Logo } from "./primitives";
import { StepUpProvider } from "./step-up";

type NavItem = { href: string; zh: string; en: string; icon: typeof House; match: (p: string) => boolean };

const NAV: NavItem[] = [
  { href: "/", zh: "首页", en: "Home", icon: House, match: (p) => p === "/" || p.startsWith("/task") },
  { href: "/wallet", zh: "钱包", en: "Wallet", icon: Wallet, match: (p) => p.startsWith("/wallet") || p.startsWith("/mandate") || p.startsWith("/pay-methods") },
  { href: "/inbox", zh: "待确认", en: "To approve", icon: Inbox, match: (p) => p.startsWith("/inbox") },
  { href: "/ledger", zh: "记录", en: "Records", icon: ReceiptText, match: (p) => p.startsWith("/ledger") },
  { href: "/me", zh: "我的", en: "Me", icon: UserRound, match: (p) => p.startsWith("/me") },
];

export function AppShell({ demoMode, children }: { demoMode: boolean; children: React.ReactNode }) {
  const { t } = useLang();
  const pathname = usePathname();
  const s = useMock();
  const mode = useSessionMode();
  const now = useNow(5000);
  const pendingCount = now === null ? 0 : openPending(s, now).length;
  const newDevice = s.devices.find((d) => d.isNew);

  useEffect(() => {
    const id = setInterval(() => actions.tick(), 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <StepUpProvider>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col border-r border-line px-3 py-5 md:flex lg:w-[236px] lg:px-4">
          <Link href="/" className="mb-7 flex h-9 items-center px-2.5">
            <span className="lg:hidden">
              <Dot className="size-3.5" />
            </span>
            <Logo className="hidden lg:inline-flex" />
          </Link>
          <Link href="/task/new" className={cn(buttonVariants({ size: "default" }), "mb-5 w-full justify-center lg:justify-start")} aria-label={t("新任务", "New task")}>
            <Plus />
            <span className="hidden lg:inline">{t("新任务", "New task")}</span>
          </Link>
          <nav className="flex flex-col gap-1">
            {NAV.map((n) => {
              const active = n.match(pathname);
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  title={t(n.zh, n.en)}
                  className={cn(
                    "relative flex h-10 items-center gap-3 rounded-full px-3 text-[14px] transition-colors",
                    active ? "bg-white text-violet shadow-[0_1px_2px_rgba(28,27,31,0.06)]" : "text-ink/75 hover:bg-white/60 hover:text-ink",
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                  <span className="hidden lg:inline">{t(n.zh, n.en)}</span>
                  {n.href === "/inbox" && pendingCount > 0 && (
                    <span className="absolute top-1.5 left-7 grid size-4 place-items-center rounded-full bg-violet text-[10px] text-white lg:static lg:ml-auto lg:size-5 lg:text-[11px]">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto flex flex-col gap-1">
            {demoMode && (
              <Link
                href="/demo"
                className={cn(
                  "flex h-10 items-center gap-3 rounded-full px-3 text-[14px] text-soft hover:bg-white/60 hover:text-ink",
                  pathname.startsWith("/demo") && "bg-white text-violet",
                )}
                title={t("演示控制", "Demo controls")}
              >
                <FlaskConical className="size-[18px]" />
                <span className="hidden lg:inline">{t("演示控制", "Demo controls")}</span>
              </Link>
            )}
            <div className="mt-2 flex items-center gap-3 rounded-2xl px-2 py-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-noir text-[13px] text-white">A</span>
              <div className="hidden min-w-0 lg:block">
                <div className="truncate text-sm">{s.user.name}</div>
                <div className="truncate text-[11px] text-soft">{mode === "attacker" ? t("新设备 · 只读", "New device · read-only") : t("本机 · 已绑定通行密钥", "This device · passkey on")}</div>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 bg-canvas/85 px-4 backdrop-blur sm:px-6 lg:px-10">
            <Link href="/" className="md:hidden">
              <Logo />
            </Link>
            <div className="hidden md:block" />
            <div className="flex items-center gap-2">
              <Link href="/inbox" className="relative grid size-9 place-items-center rounded-full text-ink/70 hover:bg-white md:hidden" aria-label={t("待确认", "To approve")}>
                <Bell className="size-[18px]" />
                {pendingCount > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-violet" />}
              </Link>
              <LangToggle />
            </div>
          </header>

          {mode === "attacker" && (
            <Banner tone="ask" icon={<ShieldAlert className="size-4" />}>
              {s.session.frozen
                ? t("账号主人已冻结账号。这台设备什么都做不了。", "The owner froze this account. This device can't do anything.")
                : t("这是一台新设备，只能查看。付款、签授权、改上限、改地址都需要通行密钥。", "This is a new device and can only look. Paying, signing, raising limits and changing the address all need a passkey.")}
            </Banner>
          )}
          {mode === "owner" && s.session.frozen && (
            <Banner tone="no" icon={<Snowflake className="size-4" />}>
              {t("账号已冻结：所有授权已撤销，Zev 不会再付款。", "Account frozen: every mandate is revoked and Zev will not pay.")}
              <Link href="/me/security" className="ml-2 underline underline-offset-2">
                {t("查看", "View")}
              </Link>
            </Banner>
          )}
          {mode === "owner" && !s.session.frozen && newDevice && (
            <Banner tone="ask" icon={<ShieldAlert className="size-4" />}>
              <span>
                {t(`有新设备登录：${newDevice.name.zh} · ${newDevice.place.zh}。它只能查看。`, `New sign-in: ${newDevice.name.en} · ${newDevice.place.en}. It can only look.`)}
              </span>
              <span className="ml-auto flex shrink-0 gap-2">
                <Button size="xs" variant="outline" onClick={() => actions.signOutDevice(newDevice.id)}>
                  {t("让它退出", "Sign it out")}
                </Button>
                <Button size="xs" variant="ink" onClick={() => actions.freeze()}>
                  <Snowflake />
                  {t("不是我，冻结", "Not me, freeze")}
                </Button>
              </span>
            </Banner>
          )}

          <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pt-4 pb-28 sm:px-6 md:pb-12 lg:px-10">{children}</main>
          <Disclaimer />
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-white/95 px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur md:hidden">
          {[NAV[0], NAV[1]].map((n) => (
            <TabLink key={n.href} item={n} active={n.match(pathname)} />
          ))}
          <Link href="/task/new" className="grid place-items-center" aria-label={t("新任务", "New task")}>
            <span className="grid size-11 place-items-center rounded-full bg-violet text-white">
              <Plus className="size-5" />
            </span>
          </Link>
          {[NAV[3], NAV[4]].map((n) => (
            <TabLink key={n.href} item={n} active={n.match(pathname)} />
          ))}
        </nav>
      </div>
    </StepUpProvider>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const { t } = useLang();
  const Icon = item.icon;
  return (
    <Link href={item.href} className={cn("flex flex-col items-center justify-center gap-0.5 py-1 text-[11px]", active ? "text-violet" : "text-soft")}>
      <Icon className="size-5" />
      {t(item.zh, item.en)}
    </Link>
  );
}

function Banner({ tone, icon, children }: { tone: "ask" | "no"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-4 sm:px-6 lg:px-10">
      <div
        className={cn(
          "mx-auto mt-1 flex w-full max-w-[1120px] flex-wrap items-center gap-2 rounded-2xl px-4 py-2.5 text-[13px]",
          tone === "ask" ? "bg-ask-soft text-ask" : "bg-no-soft text-no",
        )}
      >
        {icon}
        {children}
      </div>
    </div>
  );
}

export function Disclaimer({ className }: { className?: string }) {
  const { t } = useLang();
  return (
    <footer className={cn("px-4 pb-24 text-[11.5px] leading-relaxed text-soft sm:px-6 md:pb-6 lg:px-10", className)}>
      <div className="mx-auto max-w-[1120px] border-t border-line pt-4">
        {t(
          "支付由模拟器执行，不连接真实资金。费率与回赠为公开页面的观测值，标注来源与时间。「商家凭证验证通过」只表示所验证的条件通过，不代表商家绝对可信。",
          "Payments run on a simulator and move no real money. Fees and rewards are values observed on public pages, with source and time. “Merchant credential verified” only means the checked conditions passed, not that the merchant is fully trustworthy.",
        )}
      </div>
    </footer>
  );
}
