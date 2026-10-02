import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/server/auth/session";
import { loadRates } from "@/server/fixtures";
import { MandateForm } from "./mandate-form";

export default async function NewMandatePage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const rates = loadRates();
  const methods = rates.methods.map((m) => ({ id: m.id, label: m.label }));
  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">写一份授权书</h1>
        <p className="mt-1 text-sm text-zinc-600">
          这是 Agent 唯一能花钱的依据。右侧三张卡会随你的设置实时变化，让你在签发前就知道它会怎么做。
        </p>
      </div>
      <MandateForm methods={methods} />
    </AppShell>
  );
}
