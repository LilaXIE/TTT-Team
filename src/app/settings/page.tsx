import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/server/auth/session";
import { loadRates } from "@/server/fixtures";
import { getUserPreferences } from "@/server/preferences";
import { PreferencesForm } from "./preferences-form";

export default async function SettingsPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const [preferences, rates] = await Promise.all([getUserPreferences(user.id), Promise.resolve(loadRates())]);
  return <AppShell user={user}><div className="mb-6"><p className="text-sm font-medium text-emerald-600">Agent 账户与安全设置</p><h1 className="mt-1 text-2xl font-semibold">下单偏好</h1><p className="mt-2 max-w-2xl text-sm text-zinc-600">把额度、确认条件和支付方式集中设置一次。新授权书会读取这里的默认值，既有授权不会被悄悄改变。</p></div><PreferencesForm initial={preferences} methods={rates.methods.map((m) => ({ id: m.id, label: m.label }))} /></AppShell>;
}
