"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

export interface PreferenceFormValue {
  perTxnHKD: string;
  totalHKD: string;
  maxPurchases: number;
  reviewWhen: { nearCapPct: number | null; substituteBrand: boolean; watchCategories: string[]; newMerchantDays: number | null; priceAboveRefPct: number | null };
  protectionLevel: "standard" | "enhanced";
  allowedMethods: string[];
}

export function PreferencesForm({ initial, methods }: { initial: PreferenceFormValue; methods: { id: string; label: string }[] }) {
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const patchReview = (patch: Partial<PreferenceFormValue["reviewWhen"]>) => setValue((current) => ({ ...current, reviewWhen: { ...current.reviewWhen, ...patch } }));
  const toggleMethod = (id: string) => setValue((current) => ({ ...current, allowedMethods: current.allowedMethods.includes(id) ? current.allowedMethods.filter((item) => item !== id) : [...current.allowedMethods, id] }));
  function save() { start(async () => { try { await api("/api/preferences", { method: "PUT", json: value }); toast.success("下单偏好已保存"); } catch (e) { toast.error(e instanceof ApiError ? e.message : "保存失败"); } }); }
  return <Card className="border-zinc-200 shadow-sm"><CardHeader><CardTitle>下单偏好</CardTitle><CardDescription>这些设置只需填写一次。签发新授权时会自动带入，并保存为当时的授权快照。</CardDescription></CardHeader><CardContent className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-3"><Field label="单笔免确认上限（HK$）"><Input inputMode="decimal" value={value.perTxnHKD} onChange={(e) => setValue({ ...value, perTxnHKD: e.target.value.replace(/[^\d.]/g, "") })} /></Field><Field label="本次授权总额（HK$）"><Input inputMode="decimal" value={value.totalHKD} onChange={(e) => setValue({ ...value, totalHKD: e.target.value.replace(/[^\d.]/g, "") })} /></Field><Field label="最多成功购买次数"><Input type="number" min="1" max="20" value={value.maxPurchases} onChange={(e) => setValue({ ...value, maxPurchases: Number(e.target.value) || 1 })} /></Field></div>
    <div><Label>需要先确认的情况</Label><div className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><Check label="接近单笔上限" checked={value.reviewWhen.nearCapPct !== null} onChange={(checked) => patchReview({ nearCapPct: checked ? 95 : null })} /><Check label="更换品牌" checked={value.reviewWhen.substituteBrand} onChange={(checked) => patchReview({ substituteBrand: checked })} /><Check label="高关注类别（保健品）" checked={value.reviewWhen.watchCategories.includes("supplement")} onChange={(checked) => patchReview({ watchCategories: checked ? ["supplement"] : [] })} /><Check label="新商家（注册少于30天）" checked={value.reviewWhen.newMerchantDays !== null} onChange={(checked) => patchReview({ newMerchantDays: checked ? 30 : null })} /></div></div>
    <div><Label>默认保护级别</Label><div className="mt-2 flex gap-2">{(["standard", "enhanced"] as const).map((level) => <button key={level} type="button" onClick={() => setValue({ ...value, protectionLevel: level })} className={`rounded-lg border px-4 py-2 text-sm ${value.protectionLevel === level ? "border-zinc-900 bg-zinc-900 text-white" : "bg-white"}`}>{level === "standard" ? "标准" : "加强"}</button>)}</div></div>
    <div><Label>允许的支付方式</Label><div className="mt-2 flex flex-wrap gap-2">{methods.map((method) => <button key={method.id} type="button" onClick={() => toggleMethod(method.id)} className={`rounded-full border px-3 py-1.5 text-sm ${value.allowedMethods.includes(method.id) ? "border-zinc-900 bg-zinc-900 text-white" : "bg-white"}`}>{method.label}</button>)}</div></div>
    <div className="flex justify-end"><Button type="button" onClick={save} disabled={pending || Number(value.totalHKD) < Number(value.perTxnHKD)}>{pending ? "保存中…" : "保存偏好"}</Button></div>
  </CardContent></Card>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label className="text-xs text-zinc-600">{label}</Label>{children}</div>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex items-center gap-2 rounded-lg border p-3"><input type="checkbox" className="size-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>; }
