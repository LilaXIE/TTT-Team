"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

type Item = { title: string; price: string; shop: string; url?: string; image?: string; description?: string };
type Result = { keyword: string; items: Item[]; source: "taobao" | "unavailable"; message?: string };

export function CompareClient({ initialQuery = "" }: { initialQuery?: string }) {
  const [keyword, setKeyword] = useState(initialQuery);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

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
    if (!initialQuery.trim()) return;
    const timer = window.setTimeout(() => { void search(initialQuery); }, 0);
    return () => window.clearTimeout(timer);
  }, [initialQuery, search]);

  return (
    <div className="space-y-5">
      <Card className="border-zinc-200 shadow-sm">
        <CardContent className="p-5">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-zinc-400" />
              <Input className="pl-9" value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} placeholder="搜索淘宝商品，例如：洗衣液" />
            </div>
            <Button onClick={() => void search()} disabled={loading}>{loading ? "搜索中…" : "开始比价"}</Button>
          </div>
          <p className="mt-3 text-xs text-zinc-500">比价结果来自真实淘宝页面；登录、验证码或网络限制可能导致暂时没有结果。</p>
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
            <Card key={`${item.url ?? item.title}-${index}`} className="overflow-hidden">
              <div className="flex gap-4 p-4">
                {item.image ? <img src={item.image} alt="" className="size-28 rounded-lg object-cover" /> : <div className="flex size-28 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-400">淘宝商品</div>}
                <div className="min-w-0 flex-1"><h3 className="line-clamp-2 font-medium">{item.title}</h3><p className="mt-1 text-xs text-zinc-500">{item.shop}</p><p className="mt-2 text-xl font-semibold text-red-600">{item.price}</p></div>
              </div>
              <CardContent className="border-t pt-3"><p className="line-clamp-2 text-sm text-zinc-600">{item.description || "淘宝商品详情以商品页面为准。"}</p>{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">打开淘宝商品 →</a>}</CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
