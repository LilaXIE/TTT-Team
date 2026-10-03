"use client";

import { Heart, Wallet } from "lucide-react";
import Link from "next/link";
import { Chip, PageHeader, Panel } from "@/components/app/primitives";
import { Button, buttonVariants } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { actions, useMock, useSessionMode } from "@/lib/mock/store";
import { BackToMe } from "../back-link";

export default function ConnectionsPage() {
  const { t } = useLang();
  const s = useMock();
  const mode = useSessionMode();
  const items = [
    {
      key: "tapngo" as const,
      icon: Wallet,
      name: "Tap & Go",
      on: s.connections.tapngo,
      scope: t("给 Agent 零钱包充值，单次最多 500.00 港元；读取实名认证状态", "Top up the Agent pocket (≤ HK$500.00 each); read identity status"),
      href: "/consent/tapngo?return=/me/connections",
    },
    {
      key: "kuaikuaiFavorites" as const,
      icon: Heart,
      name: t("快快屋收藏夹", "KuaiKuai favourites"),
      on: s.connections.kuaikuaiFavorites,
      scope: t("只读收藏夹，用于精选推荐", "Read-only favourites for curated picks"),
      href: "/consent/kuaikuai?return=/me/connections",
    },
  ];
  return (
    <>
      <BackToMe />
      <PageHeader eyebrow={t("连接", "Connections")} title={t("你授权过的第三方", "Things you've connected")} description={t("每个连接只拿到写明的权限，随时可以撤销。", "Each connection gets only the stated scope. Revoke anytime.")} />
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((it) => (
          <Panel key={it.key}>
            <div className="flex items-start gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-canvas">
                <it.icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[16px]">
                  {it.name}
                  {it.on ? <Chip tone="ok">{t("已连接", "Connected")}</Chip> : <Chip>{t("未连接", "Off")}</Chip>}
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-soft">{it.scope}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              {it.on ? (
                <Button variant="outline" size="sm" onClick={() => actions.setConnection(it.key, false)} disabled={mode === "attacker"}>
                  {t("撤销", "Revoke")}
                </Button>
              ) : (
                <Link href={it.href} className={buttonVariants({ size: "sm" })}>
                  {t("连接", "Connect")}
                </Link>
              )}
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
