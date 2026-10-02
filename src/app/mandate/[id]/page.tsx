import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppError } from "@/contracts/errors";
import { fmtDateTime, fmtHKD } from "@/lib/format";
import { getSession } from "@/server/auth/session";
import { getMandate } from "@/server/mandates/service";
import { RevokeButton } from "./revoke-button";

const STATUS_LABEL: Record<string, string> = { active: "生效中", revoked: "已撤销", expired: "已过期", completed: "已完成" };

export default async function MandatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { id } = await params;

  let m;
  try {
    m = await getMandate(user.id, id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const reviewItems: string[] = [];
  if (m.reviewWhen.nearCapPct !== null) reviewItems.push(`接近单笔上限 ${m.reviewWhen.nearCapPct}%`);
  if (m.reviewWhen.substituteBrand) reviewItems.push("换了品牌");
  if (m.reviewWhen.watchCategories.length) reviewItems.push(`高关注类别（${m.reviewWhen.watchCategories.join("、")}）`);
  if (m.reviewWhen.newMerchantDays !== null) reviewItems.push(`新商家（注册 < ${m.reviewWhen.newMerchantDays} 天）`);
  if (m.reviewWhen.priceAboveRefPct !== null) reviewItems.push(`价格高于参考价 ${m.reviewWhen.priceAboveRefPct}%`);

  const usedMinor = BigInt(m.caps.totalMinor) - BigInt(m.remainingMinor);
  const pct = Number((usedMinor * 100n) / BigInt(m.caps.totalMinor));

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">授权书</h1>
            <Badge variant={m.status === "active" ? "default" : "secondary"}>{STATUS_LABEL[m.status] ?? m.status}</Badge>
            <Badge variant="outline">v{m.version}</Badge>
            <Badge variant="outline">{m.protectionLevel === "enhanced" ? "加强保护" : "标准保护"}</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-600">签发于 {fmtDateTime(m.createdAt)} · 有效至 {fmtDateTime(m.expiresAt)}{m.revokedAt ? ` · 撤销于 ${fmtDateTime(m.revokedAt)}` : ""}</p>
        </div>
        <div className="flex gap-2">
          {m.status === "active" && (
            <Link href={`/task/new?mandate=${m.id}`} className={buttonVariants()}>让 Agent 去买</Link>
          )}
          <RevokeButton id={m.id} disabled={m.status !== "active"} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">要买什么</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-zinc-800">{m.taskText}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-zinc-600">
              <dt>关键词</dt><dd className="text-zinc-900">{m.task.query} ×{m.task.qty}</dd>
              <dt>最低规格</dt><dd className="text-zinc-900">{Object.entries(m.task.minSpec).map(([k, v]) => `${k} ≥ ${v}`).join("，") || "无"}</dd>
              <dt>品牌</dt><dd className="text-zinc-900">{m.task.preferredBrand ?? "不限"}{m.task.allowSubstituteBrand ? "（可换）" : "（不可换）"}</dd>
              <dt>品类</dt><dd className="text-zinc-900">{m.scope.categories.join("、")}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">额度</CardTitle>
            <CardDescription>已用 {fmtHKD(usedMinor)} / {fmtHKD(m.caps.totalMinor)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full bg-zinc-900" style={{ width: `${pct}%` }} />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-zinc-600">
              <dt>单笔最多</dt><dd className="text-zinc-900 tabular-nums">{fmtHKD(m.caps.perTxnMinor)}</dd>
              <dt>剩余额度</dt><dd className="text-zinc-900 tabular-nums">{fmtHKD(m.remainingMinor)}</dd>
              <dt>还可购买</dt><dd className="text-zinc-900">{m.remainingPurchases} / {m.caps.maxPurchases} 次</dd>
              <dt>支付方式</dt><dd className="text-zinc-900">{m.allowedMethods.join("、")}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">哪些情况先问我</CardTitle>
            <CardDescription>以下情况 Agent 会暂停等你确认（30 分钟内有效，只对当时那份购物车有效）。超上限、授权撤销/过期、凭证无效等硬规则永远拒绝。</CardDescription>
          </CardHeader>
          <CardContent>
            {reviewItems.length ? (
              <ul className="flex flex-wrap gap-2 text-sm">
                {reviewItems.map((t) => (
                  <li key={t} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">{t}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">没有设置任何先问条件。</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
