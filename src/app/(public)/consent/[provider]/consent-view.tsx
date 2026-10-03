"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dot, SimNote } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { actions } from "@/lib/mock/store";
import type { Tx } from "@/lib/mock/types";

export type Provider = "tapngo" | "kuaikuai";

const COPY: Record<Provider, { name: Tx; mark: string; title: Tx; can: Tx[]; cannot: Tx[]; key: "tapngo" | "kuaikuaiFavorites" }> = {
  tapngo: {
    name: { zh: "Tap & Go", en: "Tap & Go" },
    mark: "#1C1B1F",
    title: { zh: "授权钱包 请求连接你的 Tap\u00a0&\u00a0Go", en: "Mandate Wallet wants to connect to your Tap\u00a0&\u00a0Go" },
    can: [
      { zh: "允许向 Agent 零钱包充值，单次最多 HK$500", en: "Top up your Agent pocket, up to HK$500 each time" },
      { zh: "读取你的实名认证状态（是 / 否）", en: "See whether your identity is verified (yes / no)" },
    ],
    cannot: [
      { zh: "看到你的余额和交易记录", en: "See your balance or transactions" },
      { zh: "在你不确认的情况下扣款", en: "Charge you without your confirmation" },
    ],
    key: "tapngo",
  },
  kuaikuai: {
    name: { zh: "快快屋", en: "KuaiKuai" },
    mark: "#5C4DFF",
    title: { zh: "授权 快快屋 读取你的收藏夹", en: "Let KuaiKuai share your favourites" },
    can: [
      { zh: "读取收藏夹里的商品（名称、品类、风格）", en: "Read items in your favourites (name, category, style)" },
      { zh: "只用于精选推荐", en: "Use them only for curated picks" },
    ],
    cannot: [
      { zh: "看到你的订单和地址", en: "See your orders or address" },
      { zh: "影响规则判断或付款", en: "Affect rule decisions or payments" },
    ],
    key: "kuaikuaiFavorites",
  },
};

export function ConsentView({ provider, returnTo }: { provider: Provider; returnTo: string }) {
  const { t, lang } = useLang();
  const router = useRouter();
  const c = COPY[provider];
  const back = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/me/connections";
  return (
    <div className="mx-auto w-full max-w-[460px] flex-1 px-5 py-10">
      <div className="rounded-[28px] border border-line bg-white p-6 shadow-[0_24px_60px_-30px_rgba(28,27,31,0.25)] sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl text-[13px] font-semibold text-white" style={{ background: c.mark }}>
              {c.name.en.slice(0, 1)}
            </span>
            <span className="text-[13px] text-soft">···</span>
            <span className="grid size-11 place-items-center rounded-2xl bg-violet-soft">
              <Dot className="size-3.5" />
            </span>
          </div>
          <SimNote>{t("模拟授权页", "Simulated consent")}</SimNote>
        </div>
        <h1 className="font-heading text-[24px] leading-snug">{c.title[lang]}</h1>
        <div className="mt-6">
          <div className="mb-2 text-[12px] tracking-[0.12em] text-soft uppercase">{t("可以", "It can")}</div>
          <ul className="space-y-2">
            {c.can.map((x) => (
              <li key={x.en} className="flex items-start gap-2.5 text-[14px]">
                <Check className="mt-0.5 size-4 shrink-0 text-ok" />
                {x[lang]}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-5">
          <div className="mb-2 text-[12px] tracking-[0.12em] text-soft uppercase">{t("不能", "It can't")}</div>
          <ul className="space-y-2">
            {c.cannot.map((x) => (
              <li key={x.en} className="flex items-start gap-2.5 text-[14px] text-soft">
                <X className="mt-0.5 size-4 shrink-0" />
                {x[lang]}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-6 text-[12px] leading-relaxed text-soft">{t("随时可以在「我的 › 连接」里撤销。", "Revoke anytime under Me › Connections.")}</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={() => router.push(back)}>
            {t("拒绝", "Deny")}
          </Button>
          <Button
            variant="ink"
            size="lg"
            onClick={() => {
              actions.setConnection(c.key, true);
              router.push(back);
            }}
          >
            {t("允许", "Allow")}
          </Button>
        </div>
      </div>
    </div>
  );
}
