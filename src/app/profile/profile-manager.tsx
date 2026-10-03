"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

type Address = { id?: string; name: string; phone: string; address: string; isDefault: boolean };
type BankCard = { id?: string; bankName: string; cardType: "储蓄卡" | "信用卡"; lastFour: string; balanceMinor: string; verified?: boolean };
export function ProfileManager() {
  const [addresses, setAddresses] = useState<Address[]>([]); const [cards, setCards] = useState<BankCard[]>([]); const [address, setAddress] = useState<Address>({ name: "", phone: "", address: "", isDefault: false }); const [card, setCard] = useState<BankCard>({ bankName: "", cardType: "储蓄卡", lastFour: "", balanceMinor: "0" });
  async function load() { const data = await api<{ addresses: Address[]; cards: BankCard[] }>("/api/profile"); setAddresses(data.addresses); setCards(data.cards); }
  useEffect(() => {
    void api<{ addresses: Address[]; cards: BankCard[] }>("/api/profile")
      .then((data) => { setAddresses(data.addresses); setCards(data.cards); })
      .catch(() => toast.error("无法加载账户资料"));
  }, []);
  async function saveAddress() { try { await api("/api/profile", { method: "POST", json: { action: "saveAddress", address } }); setAddress({ name: "", phone: "", address: "", isDefault: false }); await load(); toast.success("地址已保存"); } catch (e) { toast.error(e instanceof ApiError ? e.message : "保存失败"); } }
  async function saveCard() { try { await api("/api/profile", { method: "POST", json: { action: "saveCard", card } }); setCard({ bankName: "", cardType: "储蓄卡", lastFour: "", balanceMinor: "0" }); await load(); toast.success("银行卡已保存"); } catch (e) { toast.error(e instanceof ApiError ? e.message : "保存失败"); } }
  async function remove(action: string, key: string, value: string) { await api("/api/profile", { method: "POST", json: { action, [key]: value } }); await load(); }
  return <div className="space-y-6"><div><p className="text-sm font-medium text-cyan-600">Personal Center</p><h1 className="mt-1 text-2xl font-semibold">个人中心</h1><p className="mt-2 text-sm text-zinc-600">管理 app_1902.py 中的地址、银行卡和代购资料，所有数据按账户保存。</p></div><div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>📍 收货地址</CardTitle></CardHeader><CardContent className="space-y-4">{addresses.map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm"><div className="flex justify-between"><b>{item.name} · {item.phone}</b>{item.isDefault && <span className="text-emerald-600">默认</span>}</div><p className="mt-1 text-zinc-600">{item.address}</p><Button variant="ghost" size="sm" onClick={() => void remove("deleteAddress", "addressId", item.id!)}>删除</Button></div>)}<Input placeholder="收货人姓名" value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} /><Input placeholder="手机号" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} /><Input placeholder="详细地址" value={address.address} onChange={(e) => setAddress({ ...address, address: e.target.value })} /><label className="flex gap-2 text-sm"><input type="checkbox" checked={address.isDefault} onChange={(e) => setAddress({ ...address, isDefault: e.target.checked })} />设为默认地址</label><Button onClick={() => void saveAddress()}>保存地址</Button></CardContent></Card><Card><CardHeader><CardTitle>💳 银行账户</CardTitle></CardHeader><CardContent className="space-y-4">{cards.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><div><b>{item.bankName} · 尾号 {item.lastFour}</b><p className="text-zinc-500">{item.cardType} · {item.verified ? "已校验" : "待校验"}</p></div><Button variant="ghost" size="sm" onClick={() => void remove("deleteCard", "cardId", item.id!)}>删除</Button></div>)}<Input placeholder="银行名称" value={card.bankName} onChange={(e) => setCard({ ...card, bankName: e.target.value })} /><select className="h-10 rounded-md border px-3 text-sm" value={card.cardType} onChange={(e) => setCard({ ...card, cardType: e.target.value as BankCard["cardType"] })}><option>储蓄卡</option><option>信用卡</option></select><Input placeholder="卡号后四位" maxLength={4} value={card.lastFour} onChange={(e) => setCard({ ...card, lastFour: e.target.value.replace(/\D/g, "") })} /><Button onClick={() => void saveCard()}>保存银行卡</Button></CardContent></Card></div></div>;
}
