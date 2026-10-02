import Link from "next/link";
import type { SessionUser } from "@/server/auth/session";
import { LogoutButton } from "./logout-button";

const NAV: { href: string; label: string; ready: boolean }[] = [
  { href: "/", label: "首页", ready: true },
  { href: "/mandate/new", label: "新建授权", ready: true },
  { href: "/inbox", label: "待确认", ready: false },
  { href: "/ledger", label: "记录", ready: false },
  { href: "/pay-methods", label: "支付方式", ready: false },
];

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="inline-block size-6 rounded-md bg-zinc-900" aria-hidden />
              MandateWallet
            </Link>
            <nav className="hidden gap-4 text-sm text-zinc-600 sm:flex">
              {NAV.map((n) =>
                n.ready ? (
                  <Link key={n.href} href={n.href} className="hover:text-zinc-900">
                    {n.label}
                  </Link>
                ) : (
                  <span key={n.href} className="cursor-not-allowed text-zinc-400" title="即将上线">
                    {n.label}
                  </span>
                ),
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-600">{user.displayName}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t bg-white py-3 text-center text-xs text-zinc-500">
        模拟环境 · 所有商家、支付与资金均为演示数据 · HacKU 2026
      </footer>
    </div>
  );
}
