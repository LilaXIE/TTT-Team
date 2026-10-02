import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/server/auth/session";
import { LedgerView } from "./ledger-view";

export default async function LedgerPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <AppShell user={user}>
      <LedgerView />
    </AppShell>
  );
}
