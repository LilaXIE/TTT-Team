import Link from "next/link";
import type { SessionUser } from "@/server/auth/session";
import { LogoutButton } from "./logout-button";

const NAV = [
  { href: "/", label: "首页" },
  { href: "/mandate/new", label: "新建授权" },
  { href: "/inbox", label: "待确认" },
  { href: "/ledger", label: "记录" },
  { href: "/pay-methods", label: "支付方式" },
] as const;

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
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-zinc-900">
                  {n.label}
                </Link>
              ))}
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
