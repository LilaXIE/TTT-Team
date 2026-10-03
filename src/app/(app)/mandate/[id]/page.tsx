import { MandateDetail } from "./mandate-detail";

export default async function MandatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MandateDetail id={id} />;
}
