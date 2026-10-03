import { notFound } from "next/navigation";
import { ConsentView, type Provider } from "./consent-view";

export default async function ConsentPage({ params, searchParams }: { params: Promise<{ provider: string }>; searchParams: Promise<{ return?: string }> }) {
  const { provider } = await params;
  const { return: returnTo } = await searchParams;
  if (provider !== "tapngo" && provider !== "kuaikuai") notFound();
  return <ConsentView provider={provider as Provider} returnTo={returnTo ?? "/me/connections"} />;
}
