"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

type Item = { title: string; price: string; shop: string; url?: string; image?: string; description?: string };
type Result = { keyword: string; items: Item[]; source: "taobao" | "unavailable"; message?: string };

export function CompareClient({
  initialQuery = "",
  taskId = "",
  mandateId = "",
  isRisk = false,
}: {
  initialQuery?: string;
  taskId?: string;
  mandateId?: string;
  isRisk?: boolean;
}) {
  const router = useRouter();
  const [keyword, setKeyword] = useState(initialQuery);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [taobaoLoggedIn, setTaobaoLoggedIn] = useState<boolean | null>(null);
  const [pendingItemIndex, setPendingItemIndex] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const search = useCallback(async (query = keyword) => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      setResult(await api<Result>(`/api/compare?q=${encodeURIComponent(query.trim())}&count=10`));
    } catch (e) {
      setResult({ keyword, items: [], source: "unavailable", message: e instanceof ApiError ? e.message : "搜索失败" });
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    void api<{ loggedIn: boolean }>("/api/taobao/login").then((res) => setTaobaoLoggedIn(res.loggedIn)).catch(() => setTaobaoLoggedIn(false));
  }, []);

  async function loginTaobao() {
    setLoading(true);
    try {
      await api<{ loggedIn: boolean }>("/api/taobao/login", { method: "POST" });
      setTaobaoLoggedIn(true);
      toast.success("淘宝登录态已保存，可以开始比价。");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "淘宝登录失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initialQuery.trim()) return;
    const timer = window.setTimeout(() => { void search(initialQuery); }, 0);
    return () => window.clearTimeout(timer);
  }, [initialQuery, search]);

  function handleConfirmItem(item: Item, index: number) {
    if (!taskId || !mandateId) {
      toast.error("当前未关联任何代购任务，请先发起代购任务。");
      return;
    }
    setPendingItemIndex(index);
    start(async () => {
      try {
        await api<{ status: string; orderId: string; totalMinor: string }>("/api/tasks/confirm-item", {
          method: "POST",
          json: { taskId, mandateId, item },
        });
        toast.success(`🎉 代理下单成功！已为您自动扣款完成交易。`);
        router.push("/ledger");
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "代理下单失败，请重试。");
      } finally {
        setPendingItemIndex(null);
      }
    });
  }

  return (
    <div className="space-y-5">
      {isRisk && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="flex items-center gap-2 font-medium">
            <span>⚠️ 代理风险评价提示</span>
          </div>
          <p className="mt-1 text-sm text-amber-800">
            当前代购任务经过评估触发了风险确认规则（例如：换品牌/接近上限/高关注类别）。已暂停自动划款，请在下方选择任意一款商品点击【🤖 委托 Agent 代理下单】完成购买。
          </p>
        </div>
      )}

      <Card className="border-zinc-200 shadow-sm">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3 border-b pb-4">
            <div><p className="font-medium">淘宝账户</p><p className="text-xs text-zinc-500">首次使用时会打开 Edge，请扫码登录；登录态只保存在服务器端。</p></div>
            <Button variant="outline" onClick={() => void loginTaobao()} disabled={loading}>{taobaoLoggedIn ? "重新登录淘宝" : "首次登录淘宝"}</Button>
          </div>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-zinc-400" />
              <Input className="pl-9" value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} placeholder="搜索淘宝商品，例如：洗衣液" />
            </div>
            <Button onClick={() => void search()} disabled={loading}>{loading ? "搜索中…" : "开始比价"}</Button>
          </div>
          <p className="mt-3 text-xs text-zinc-500">比价结果来自真实淘宝页面。若出现登录或安全验证，请在自动打开的 Edge 窗口中手动完成，脚本会等待并继续。</p>
        </CardContent>
      </Card>

      {result?.source === "taobao" && (
        <div className="flex items-center justify-between">
          <div><h2 className="text-lg font-semibold">“{result.keyword}”的淘宝结果</h2><p className="text-sm text-zinc-500">共找到 {result.items.length} 件</p></div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">实时抓取</span>
        </div>
      )}

      {result?.source === "unavailable" && (
        <Card><CardContent className="py-10 text-center"><p className="font-medium">暂时无法取得淘宝结果</p><p className="mt-2 text-sm text-zinc-500">{result.message}</p><p className="mt-3 text-xs text-zinc-400">请确认本机已安装 Python、Playwright 和 Edge，并完成淘宝登录。</p></CardContent></Card>
      )}

      {!!result?.items.length && (
        <div className="grid gap-4 md:grid-cols-2">
          {result.items.map((item, index) => (
            <Card key={`${item.url ?? item.title}-${index}`} className="flex flex-col overflow-hidden justify-between">
              <div>
                <div className="flex gap-4 p-4">
                  {item.image ? <img src={item.image} alt="" className="size-28 rounded-lg object-cover" /> : <div className="flex size-28 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-400">淘宝商品</div>}
                  <div className="min-w-0 flex-1"><h3 className="line-clamp-2 font-medium">{item.title}</h3><p className="mt-1 text-xs text-zinc-500">{item.shop}</p><p className="mt-2 text-xl font-semibold text-red-600">{item.price}</p></div>
                </div>
                <CardContent className="border-t pt-3">
                  <p className="line-clamp-2 text-sm text-zinc-600">{item.description || "淘宝商品详情以商品页面为准。"}</p>
                </CardContent>
              </div>
              <div className="flex items-center justify-between border-t bg-zinc-50/50 px-4 py-3">
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-zinc-500 hover:text-zinc-900 underline">
                    打开淘宝商品 ↗
                  </a>
                ) : <span />}
                {taskId && mandateId && (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => handleConfirmItem(item, index)}
                  >
                    {pending && pendingItemIndex === index ? "代理下单中…" : "🤖 委托 Agent 代理下单"}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
