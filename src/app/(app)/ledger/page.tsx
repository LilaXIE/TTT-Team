import { LedgerView } from "./ledger-view";

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  return <LedgerView focus={order} />;
}
