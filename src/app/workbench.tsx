"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, ShoppingBag, UserRound, WalletCards, MapPin, History, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { LogoutButton } from "@/components/logout-button";

type Message = { role: "user" | "assistant"; content: string };
type Item = { title: string; price: string; shop: string; url?: string; image?: string; description?: string };

type Props = { initialBalance: string; orderCount: number; defaultRecipient: string; taobaoLoggedIn: boolean; userName: string };

const quickPrompts = ["帮我买一个 20000 毫安快充充电宝", "帮我找适合办公室的无线耳机", "帮我买一款性价比高的洗衣液"];

export function Workbench({ initialBalance, orderCount, defaultRecipient, taobaoLoggedIn: initialTaobao, userName }: Props) {
  const router = useRouter();
  const [active, setActive] = useState("chat");
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "👋 你好！我是你的 DeepSeek 全网 AI 智能代购 Agent。\n\n告诉我你想买什么，我会结合预算、授权额度和淘宝实时商品为你推荐。" }]);
  const [items, setItems] = useState<Item[]>([]);
  const [searching, setSearching] = useState(false);
  const [taobaoLoggedIn, setTaobaoLoggedIn] = useState(initialTaobao);
  const [pending, start] = useTransition();

  async function send(text = message) {
    const clean = text.trim();
    if (!clean) return;
    setMessage("");
    setMessages((current) => [...current, { role: "user", content: clean }]);
    start(async () => {
      try {
        const result = await api<{ sessionId: string; message: string }>("/api/chat", { method: "POST", json: { sessionId, message: clean } });
        setSessionId(result.sessionId);
        setMessages((current) => [...current, { role: "assistant", content: result.message }]);
        if (taobaoLoggedIn) await search(clean);
      } catch (error) { toast.error(error instanceof ApiError ? error.message : "Agent 暂时不可用"); }
    });
  }

  async function search(query: string) {
    setSearching(true);
    try {
      const result = await api<{ items: Item[]; message?: string }>(`/api/compare?q=${encodeURIComponent(query)}&count=6`);
      setItems(result.items);
      if (!result.items.length && result.message) toast.info(result.message);
    } catch (error) { toast.error(error instanceof ApiError ? error.message : "淘宝搜索失败"); }
    finally { setSearching(false); }
  }

  async function loginTaobao() {
    try {
      await api("/api/taobao/login", { method: "POST" });
      setTaobaoLoggedIn(true);
      toast.success("淘宝登录态已保存");
    } catch (error) { toast.error(error instanceof ApiError ? error.message : "淘宝登录失败"); }
  }

  const nav = [
    ["chat", "智能代购", ShoppingBag], ["profile", "个人中心", UserRound], ["wallet", "我的钱包", WalletCards], ["address", "我的地址", MapPin], ["records", "我的记录", History], ["settings", "系统设置", Settings],
  ] as const;

  return <div className="min-h-screen bg-[#10131a] text-zinc-100">
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/10 bg-[#171b24] p-5 lg:block">
      <div className="mb-10 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-xl">🛍️</div><div><p className="font-bold">AI 代购 Agent</p><p className="text-xs text-zinc-500">DeepSeek Powered</p></div></div>
      <nav className="space-y-2">{nav.map(([id, label, Icon]) => <button key={id} onClick={() => setActive(id)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition ${active === id ? "bg-cyan-400/15 text-cyan-300" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}><Icon className="size-4" />{label}</button>)}</nav>
      <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between border-t border-white/10 pt-4"><div className="min-w-0"><p className="truncate text-sm">{userName}</p><p className="truncate text-xs text-zinc-500">个人账户</p></div><LogoutButton /></div>
    </aside>
    <main className="min-h-screen lg:ml-64">
      <header className="flex items-center justify-between border-b border-white/10 bg-[#141821] px-5 py-4 lg:px-10"><div><p className="text-sm text-cyan-300">AI 智能购物工作台</p><h1 className="text-xl font-bold">{active === "chat" ? "今天想买点什么？" : nav.find(([id]) => id === active)?.[1]}</h1></div><div className="flex items-center gap-3"><span className="hidden text-sm text-zinc-400 sm:inline">🟢 Agent 在线</span><Button size="sm" variant="outline" className="border-white/20 bg-transparent text-zinc-200 lg:hidden" onClick={() => setActive("chat")}>首页</Button></div></header>
      <div className="mx-auto max-w-6xl space-y-6 p-5 lg:p-10">
        {active === "chat" && <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric title="Agent 状态" value="🟢 DeepSeek 在线" /><Metric title="钱包余额" value={`HK$${(Number(initialBalance) / 100).toFixed(2)}`} /><Metric title="已成功代购" value={`${orderCount} 笔`} /><Metric title="默认收货人" value={defaultRecipient || "未设置"} /></div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
            <Card className="border-white/10 bg-[#171b24] text-zinc-100"><CardContent className="flex min-h-[430px] flex-col p-5"><div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4"><div><p className="font-semibold">🤖 自动付款 AI 购物 Agent</p><p className="text-xs text-zinc-500">DeepSeek 驱动 · 淘宝实时比价 · 授权边界保护</p></div><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">安全运行中</span></div><div className="flex-1 space-y-4 overflow-auto pr-1">{messages.map((item, index) => <div key={index} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${item.role === "user" ? "bg-cyan-500 text-white" : "bg-white/5 text-zinc-300"}`}>{item.content}</div></div>)}</div><div className="mt-5 flex gap-2"><Input className="border-white/10 bg-black/20 text-white placeholder:text-zinc-600" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void send(); }} placeholder="请告诉我你想购买的商品…" /><Button onClick={() => void send()} disabled={pending || !message.trim()} className="bg-cyan-500 text-white hover:bg-cyan-400"><Send className="size-4" /></Button></div></CardContent></Card>
            <div className="space-y-4"><Card className="border-white/10 bg-gradient-to-br from-blue-600 to-cyan-500 text-white"><CardHeader><CardTitle className="text-base">淘宝账户</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-white/80">{taobaoLoggedIn ? "已完成淘宝登录，可以实时比价" : "首次使用请扫码登录淘宝"}</p><Button onClick={() => void loginTaobao()} variant="secondary" className="w-full">{taobaoLoggedIn ? "重新登录淘宝" : "首次扫码登录"}</Button></CardContent></Card><Card className="border-white/10 bg-[#171b24] text-zinc-100"><CardHeader><CardTitle className="text-base">快捷需求</CardTitle></CardHeader><CardContent className="space-y-2">{quickPrompts.map((prompt) => <button key={prompt} onClick={() => void send(prompt)} className="w-full rounded-lg bg-white/5 p-3 text-left text-xs text-zinc-400 hover:bg-cyan-400/10 hover:text-cyan-300">{prompt}</button>)}</CardContent></Card></div>
          </div>
          {items.length > 0 && <section><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">🛒 为你找到的淘宝商品</h2><Button variant="ghost" className="text-cyan-300" onClick={() => void search(message || "热门商品")}>{searching ? "搜索中…" : "刷新结果"}</Button></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{items.map((item, index) => <Card key={`${item.title}-${index}`} className="overflow-hidden border-white/10 bg-[#171b24] text-zinc-100"><CardContent className="p-4">{item.image ? <img src={item.image} alt="" className="mb-3 h-40 w-full rounded-lg object-cover" /> : <div className="mb-3 grid h-40 place-items-center rounded-lg bg-white/5 text-zinc-600">淘宝商品</div>}<p className="line-clamp-2 text-sm font-medium">{item.title}</p><p className="mt-2 text-lg font-bold text-red-400">{item.price}</p><p className="mt-1 line-clamp-2 text-xs text-zinc-500">{item.description || item.shop}</p>{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-3 block text-xs text-cyan-300 underline">查看淘宝商品 ↗</a>}</CardContent></Card>)}</div></section>}
        </>}
        {active !== "chat" && <PlaceholderSection active={active} router={router} />}
      </div>
    </main>
  </div>;
}

function Metric({ title, value }: { title: string; value: string }) { return <Card className="border-white/10 bg-[#171b24] text-zinc-100"><CardContent className="p-4"><p className="text-xs text-zinc-500">{title}</p><p className="mt-2 truncate text-lg font-semibold">{value}</p></CardContent></Card>; }
function PlaceholderSection({ active, router }: { active: string; router: ReturnType<typeof useRouter> }) { const labels: Record<string, string> = { profile: "个人中心", wallet: "我的钱包", address: "我的地址", records: "我的记录", settings: "系统设置" }; return <Card className="border-white/10 bg-[#171b24] text-zinc-100"><CardContent className="p-10 text-center"><div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-cyan-400/10 text-2xl">{active === "wallet" ? "👛" : active === "address" ? "📍" : active === "records" ? "📜" : "⚙️"}</div><h2 className="text-xl font-semibold">{labels[active]}</h2><p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">该模块将使用数据库保存你的配置和历史记录。进入完整管理页面继续操作。</p><Button className="mt-6 bg-cyan-500" onClick={() => router.push(active === "records" ? "/ledger" : active === "settings" ? "/settings" : "/settings")}>打开管理页面</Button></CardContent></Card>; }
