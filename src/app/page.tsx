import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { getBuyerBalanceMinor } from "@/server/ledger/queries";
import { query } from "@/server/db/tx";
import { hasTaobaoLogin } from "@/server/taobao-account";
import { Workbench } from "./workbench";

export default async function HomePage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const [balance, orders, address, taobaoLoggedIn] = await Promise.all([
    getBuyerBalanceMinor(user.id),
    query<{ count: number }>("SELECT count(*)::int AS count FROM orders WHERE user_id=$1 AND status='paid'", [user.id]),
    query<{ recipient_name: string }>("SELECT recipient_name FROM user_addresses WHERE user_id=$1 AND is_default=true LIMIT 1", [user.id]),
    hasTaobaoLogin(user.id),
  ]);
  return <Workbench initialBalance={balance.toString()} orderCount={orders.rows[0]?.count ?? 0} defaultRecipient={address.rows[0]?.recipient_name ?? ""} taobaoLoggedIn={taobaoLoggedIn} userName={user.displayName} />;
}
