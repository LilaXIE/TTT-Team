import Link from "next/link";
import { LangToggle } from "@/components/app/lang-toggle";
import { Logo } from "@/components/app/primitives";
import { Disclaimer } from "@/components/app/shell";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[radial-gradient(120%_80%_at_0%_0%,#e4e0ff_0%,transparent_55%),radial-gradient(90%_70%_at_100%_100%,#efe6ff_0%,transparent_55%)]">
      <header className="relative z-10 flex h-16 items-center justify-between px-5 sm:px-8">
        <Link href="/login" aria-label="Mandate Wallet">
          <Logo />
        </Link>
        <LangToggle />
      </header>
      <main className="relative z-10 flex flex-1 flex-col">{children}</main>
      <Disclaimer className="relative z-10 px-5 pb-6 sm:px-8" />
    </div>
  );
}
