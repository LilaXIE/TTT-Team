import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EXAMPLES = ["帮我补一瓶洗衣液，2L 以上，HK$150 以内，可以换牌子", "买两包抽纸，HK$80 以内，这周到货"];

export function TaskPrompt() {
  return (
    <div className="rounded-xl border bg-white p-5">
      <h1 className="text-lg font-semibold">告诉 Agent 你想买什么</h1>
      <p className="mt-1 text-sm text-zinc-600">先写一份授权书划好边界：在边界内它直接买，碰到你关心的情况先问你，越界的一律拒绝。</p>
      <form action="/mandate/new" method="get" className="mt-4 flex gap-2">
        <Input name="task" placeholder={EXAMPLES[0]} maxLength={200} className="h-10" />
        <Button type="submit" size="lg" className="h-10 px-4">
          下一步：设边界
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <Link
            key={ex}
            href={`/mandate/new?task=${encodeURIComponent(ex)}`}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:border-zinc-500"
          >
            {ex}
          </Link>
        ))}
      </div>
    </div>
  );
}
