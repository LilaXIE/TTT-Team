import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getSession();
  if (user) redirect("/");
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <div className="mx-auto size-10 rounded-xl bg-zinc-900" aria-hidden />
          <h1 className="text-xl font-semibold">MandateWallet</h1>
          <p className="text-sm text-zinc-600">给 Agent 一个有边界的钱包：你定规则，它去买，每一步可追溯。</p>
        </div>
        <LoginForm />
        <p className="text-center text-xs text-zinc-500">
          演示账号：<code className="rounded bg-zinc-100 px-1">alex@demo.hk</code> / <code className="rounded bg-zinc-100 px-1">demo1234</code>
        </p>
      </div>
    </div>
  );
}
