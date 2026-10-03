"use client";

import { Inbox } from "lucide-react";
import Link from "next/link";
import { Chip, Money, OutcomeChip, PageHeader, Panel, PanelTitle, ProductThumb } from "@/components/app/primitives";
import { PendingCard } from "@/components/app/task/blocks";
import { fmtDateTime } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { productOf } from "@/lib/mock/catalog";
import { useMock, useNow } from "@/lib/mock/store";
import { RULE_TITLE } from "@/lib/rule-text";
import { evaluate } from "@/lib/mock/evaluate";

export default function InboxPage() {
  const { t, lang } = useLang();
  const s = useMock();
  const now = useNow(1000);
  const live = now === null ? [] : s.pending.filter((p) => p.status === "pending" && Date.parse(p.expiresAt) > now);
  const done = s.pending.filter((p) => !live.includes(p));
  const denied = s.tasks.flatMap((task) =>
    task.blocks.flatMap((b) => {
      if (b.kind !== "denied") return [];
      const m = s.mandates.find((x) => x.id === b.mandateId);
      if (!m) return [];
      const ev = evaluate(m, productOf(b.productId), { now: new Date(b.at) });
      return [{ task, productId: b.productId, at: b.at, rules: b.rules, total: ev.total }];
    }),
  );
  const statusLabel = {
    pending: t("已过期", "Expired"),
    confirmed: t("已确认", "Approved"),
    cancelled: t("已取消", "Cancelled"),
    expired: t("已过期", "Expired"),
    invalidated: t("购物车变了，已失效", "Cart changed"),
  };

  return (
    <>
      <PageHeader
        eyebrow={t("待确认", "Inbox")}
        title={t("等你点头的", "Waiting for you")}
        description={t("命中了你设的「先问我」条件，Zev 就停在这里。确认只对当时的购物车有效，30 分钟后自动失效。", "When something hits one of your ask-first conditions, Zev stops here. An approval covers only that exact cart and lapses after 30 minutes.")}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {now === null ? (
            <div className="h-48 animate-pulse rounded-[20px] bg-white/60" />
          ) : live.length === 0 ? (
            <Panel className="flex flex-col items-center py-14 text-center">
              <span className="mb-4 grid size-14 place-items-center rounded-full bg-violet-soft text-violet">
                <Inbox className="size-6" />
              </span>
              <p className="font-heading text-xl">{t("没有需要你确认的", "Nothing needs you")}</p>
              <p className="mt-1.5 text-sm text-soft">{t("范围内的 Zev 会直接办完。", "Inside your limits, Zev just gets it done.")}</p>
            </Panel>
          ) : (
            live.map((p) => <PendingCard key={p.id} pendingId={p.id} taskLink />)
          )}

          {done.length > 0 && (
            <Panel>
              <PanelTitle>{t("已处理", "Handled")}</PanelTitle>
              <ul className="divide-y divide-line">
                {done.map((p) => {
                  const prod = productOf(p.productId);
                  return (
                    <li key={p.id} className="flex items-center gap-3 py-3">
                      <ProductThumb product={prod} className="size-10 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px]">{prod.name[lang]}</div>
                        <div className="text-[12px] text-soft">
                          {t("购物车", "Cart")} v{p.cartVersion} · {fmtDateTime(p.createdAt, lang)}
                        </div>
                      </div>
                      <Money minor={p.totalMinor} className="text-[14px]" />
                      <Chip tone={p.status === "confirmed" ? "ok" : p.status === "invalidated" ? "no" : "neutral"}>{statusLabel[p.status]}</Chip>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelTitle>{t("三种结果", "Three outcomes")}</PanelTitle>
            <ul className="space-y-3 text-[13px] leading-relaxed">
              <li className="flex gap-3">
                <OutcomeChip outcome="ALLOW" />
                <span className="text-soft">{t("在范围内，Zev 直接付款，不会来这里。", "Within limits. Zev pays and never comes here.")}</span>
              </li>
              <li className="flex gap-3">
                <OutcomeChip outcome="REVIEW" />
                <span className="text-soft">{t("命中「先问我」，等你用通行密钥确认。", "Hit an ask-first rule. Waits for your passkey.")}</span>
              </li>
              <li className="flex gap-3">
                <OutcomeChip outcome="DENY" />
                <span className="text-soft">{t("越过了边界。不能确认放行，只能先改授权。", "Crossed a limit. Can't be approved; only a mandate change can help.")}</span>
              </li>
            </ul>
          </Panel>
          {denied.length > 0 && (
            <Panel>
              <PanelTitle>{t("被拒绝的", "Declined")}</PanelTitle>
              <ul className="space-y-3">
                {denied.map((d) => (
                  <li key={d.task.id + d.at}>
                    <Link href={`/task/${d.task.id}`} className="flex items-center gap-3 rounded-2xl p-1 hover:bg-canvas/60">
                      <ProductThumb product={productOf(d.productId)} className="size-10 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px]">{productOf(d.productId).name[lang]}</div>
                        <div className="truncate text-[12px] text-no">{d.rules.map((r) => RULE_TITLE[r.id][lang]).join(t("、", ", "))}</div>
                      </div>
                      <Money minor={d.total} className="text-[13px]" />
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] text-soft">{t("这里没有确认按钮，这是故意的。", "There's no approve button here, on purpose.")}</p>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
