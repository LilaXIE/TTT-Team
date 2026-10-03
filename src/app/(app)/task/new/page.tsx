import { NewTask } from "@/components/app/task/task-view";

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <NewTask q={q} />;
}
