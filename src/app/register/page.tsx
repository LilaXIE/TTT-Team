import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const user = await getSession();
  if (user) redirect("/");
  return <div className="flex min-h-screen items-center justify-center p-4"><div className="w-full max-w-sm space-y-6"><div className="space-y-1 text-center"><div className="mx-auto grid size-10 place-items-center rounded-xl bg-zinc-900 text-xl">🛍️</div><h1 className="text-xl font-semibold">创建 AI 代购账户</h1><p className="text-sm text-zinc-600">验证邮箱后开始使用你的代购 Agent。</p></div><RegisterForm /></div></div>;
}
