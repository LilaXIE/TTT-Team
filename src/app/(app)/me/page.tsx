"use client";

import { BadgeCheck, ChevronRight, Heart, Link2, LogOut, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LangToggle } from "@/components/app/lang-toggle";
import { Chip, PageHeader, Panel } from "@/components/app/primitives";
import { MaxLossLine } from "@/components/app/security-card";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { setSessionMode, useMock } from "@/lib/mock/store";

export default function MePage() {
  const { t, lang } = useLang();
  const s = useMock();
  const router = useRouter();
  const newDevice = s.devices.some((d) => d.isNew);
  const items = [
    { href: "/me/security", icon: ShieldCheck, title: t("安全", "Security"), sub: s.session.frozen ? t("已冻结", "Frozen") : newDevice ? t("有一台新设备登录", "A new device signed in") : t("通行密钥 · 设备 · 冻结", "Passkey · devices · freeze"), alert: s.session.frozen || newDevice },
    { href: "/me/verification", icon: BadgeCheck, title: t("认证等级", "Verification"), sub: s.user.walletKyc === "upgraded" ? t("已升级", "Upgraded") : t("基础 · 钱包实名", "Basic · wallet-verified") },
    { href: "/me/address", icon: MapPin, title: t("收货地址", "Address"), sub: s.address[lang] },
    { href: "/me/preferences", icon: Heart, title: t("偏好", "Preferences"), sub: t(`${s.prefs.length} 个标签，只用于推荐`, `${s.prefs.length} tags, recommendations only`) },
    { href: "/me/connections", icon: Link2, title: t("连接", "Connections"), sub: [s.connections.tapngo && "Tap & Go", s.connections.kuaikuaiFavorites && t("快快屋收藏夹", "KuaiKuai favourites")].filter(Boolean).join(" · ") || t("还没有连接", "Nothing connected") },
  ];
  return (
    <>
      <PageHeader eyebrow={t("我的", "Me")} title={s.user.name} description={s.user.phone} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel className="p-2 sm:p-2">
          <ul className="divide-y divide-line">
            {items.map((it) => (
              <li key={it.href}>
                <Link href={it.href} className="flex items-center gap-4 rounded-2xl px-4 py-4 hover:bg-canvas/60">
                  <span className="grid size-10 place-items-center rounded-xl bg-violet-soft text-violet">
                    <it.icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px]">{it.title}</div>
                    <div className="truncate text-[13px] text-soft">{it.sub}</div>
                  </div>
                  {it.alert && <Chip tone="no">{t("注意", "Check")}</Chip>}
                  <ChevronRight className="size-4 text-soft" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <div className="space-y-4">
          <Panel>
            <MaxLossLine />
          </Panel>
          <Panel className="flex items-center justify-between gap-3">
            <span className="text-[14px]">{t("语言", "Language")}</span>
            <LangToggle />
          </Panel>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setSessionMode("owner");
              router.push("/login");
            }}
          >
            <LogOut />
            {t("退出登录", "Sign out")}
          </Button>
        </div>
      </div>
    </>
  );
}
