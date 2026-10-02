import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { mockPayMethods } from "@/lib/mock-tasks";
import { getSession } from "@/server/auth/session";
import { PayMethodsView } from "./pay-methods-view";

export default async function PayMethodsPage({ searchParams }: { searchParams: Promise<{ cartId?: string; version?: string }> }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { cartId, version } = await searchParams;

  const validVersion = version !== undefined && /^\d+$/.test(version) ? Number.parseInt(version, 10) : null;
  const real = cartId && !cartId.startsWith("mock-") && validVersion !== null ? { cartId, version: validVersion } : null;
  const mockReason = real ? null : cartId?.startsWith("mock-") ? null : "没有指定购物车，显示 mock-s1 的购物车。";

  return (
    <AppShell user={user}>
      <PayMethodsView real={real} initial={real ? null : mockPayMethods(cartId)} initialMockReason={mockReason} />
    </AppShell>
  );
}
