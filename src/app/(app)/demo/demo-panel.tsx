"use client";

import { cn } from "cn";
import { ExternalLink, RotateCcw, Snowflake } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Chip, Eyebrow, PageHeader, Panel, PanelTitle } from "@/components/app/primitives";
import { ZEV_POSES, ZevCharacter } from "@/components/app/zev";
import { MaxLossLine } from "@/components/app/security-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { productOf } from "@/lib/mock/catalog";
import { actions, openPending, useMock, useNow, useSessionMode } from "@/lib/mock/store";

const S1 = "帮我补一瓶洗衣液，2L 以上，HK$150 以内，可以换牌子，这周内买到。";

function Toggle({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} aria-pressed={on} className="flex w-full items-center gap-3 rounded-2xl px-1 py-2.5 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px]">{label}</span>
        {sub && <span className="block text-[12px] text-soft">{sub}</span>}
      </span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-violet" : "bg-line")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

export function DemoPanel() {
  const { t, lang } = useLang();
  const s = useMock();
  const mode = useSessionMode();
  const now = useNow(1000);
  const pending = now === null ? [] : openPending(s, now);
  const active = s.mandates.filter((m) => m.status === "active");

  const scenarios = [
    { id: "S1", title: t("范围内自动完成", "Auto-complete within limits"), body: t("一句话 → 起草授权 → 通行密钥签发 → 自动付款。", "One sentence → draft → passkey → auto-pay."), href: `/task/new?q=${encodeURIComponent(S1)}`, alt: "/task/s1" },
    { id: "S2", title: t("换牌子先问你", "Different brand asks first"), body: t("品牌甲缺货，换成品牌丙要你确认。确认前涨价 → 确认失效。", "Brand Jia sold out; Brand Bing needs approval. A price bump voids it."), href: "/task/s2", alt: "/inbox" },
    { id: "S3", title: t("超上限直接拒绝", "Over the cap is declined"), body: t("158.00 港元 > 150.00 港元，没有确认按钮，只能改授权。", "HK$158 > HK$150. No approve button; only a mandate change helps."), href: "/task/s3", alt: null },
    { id: "S4", title: t("防重复与超支", "No double-spend"), body: t("同一订单并发 10 次只扣一次；并发超支只成功一笔。由测试脚本验证。", "10 concurrent pays charge once; concurrent overspend lets one through. Verified by tests."), href: null, alt: null },
    { id: "S5", title: t("解释与追溯", "Explain & trace"), body: t("从授权版本到候选、规则、付款、收据；售后转人工。", "Mandate version → candidates → rules → payment → receipt; support goes to a person."), href: "/ledger?order=ord_1001", alt: null },
  ];

  const attackSteps = [
    t("开一个「攻击者」标签页，用被盗的密码登录。它被识别为新设备，只能查看，并短信通知 Alex。", "Open an attacker tab and sign in with the stolen password. It's a new, view-only device and Alex gets an SMS."),
    t("在攻击者页试着提高上限或签新授权：没有通行密钥，PIN 也不对，失败并记录。", "In that tab, try raising a limit or signing a mandate: no passkey, wrong PIN — it fails and is logged."),
    t("试着改收货地址：同样需要通行密钥，而且就算成功也要等 24 小时。", "Try changing the address: also needs the passkey, and would still wait 24 hours."),
    t("让 Zev 买洗衣液：候选里有一段「忽略预算」的注入文字，被当成数据忽略。", "Have Zev buy laundry liquid: one listing hides an “ignore the budget” injection, treated as plain data."),
    t("看最大损失：就算一切失守，也不超过下面这个数。", "Check max loss: even in the worst case, it's capped at the number below."),
    t("回到这里一键冻结。攻击者那页立刻失效。", "Come back and freeze. The attacker tab goes dead instantly."),
  ];

  return (
    <>
      <PageHeader
        eyebrow={t("演示控制", "Demo controls")}
        title={t("评委演示台", "Demo console")}
        description={t("只在演示模式下出现。所有开关只改本浏览器里的模拟数据。", "Only visible in demo mode. Every switch changes simulated data in this browser only.")}
        actions={
          <Button
            variant="outline"
            onClick={() => {
              actions.reset();
              toast(t("已重置演示数据", "Demo data reset"));
            }}
          >
            <RotateCcw />
            {t("重置全部", "Reset all")}
          </Button>
        }
      />

      <Panel className="mb-8">
        <PanelTitle>{t("Zev 的状态", "How Zev moves")}</PanelTitle>
        <p className="mb-4 text-[13px] text-soft">{t("五种姿态对应页面和账户状态。不能买用 ASK 再轻轻摇头；冻结用 HOLD，并变成灰色。", "Five poses follow the page and the account. A decline is ASK with a small shake. Freeze is HOLD, in grey.")}</p>
        <div className="grid grid-cols-5 gap-2">
          {ZEV_POSES.map((item) => (
            <div key={item.id} className="text-center">
              <ZevCharacter mood={item.id === "ask" ? "ask" : item.id === "look" ? "search" : item.id === "done" ? "done" : item.id === "hold" ? "wait" : "idle"} className="mx-auto size-14" />
              <div className="mt-1 text-[12px] tracking-wide">{item.zh}</div>
              <div className="text-[11px] text-soft">{item.when[lang]}</div>
            </div>
          ))}
        </div>
      </Panel>

      <section className="mb-8">
        <h2 className="mb-4 font-heading text-[22px]">{t("验收场景", "Scenarios")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {scenarios.map((sc) => (
            <Panel key={sc.id} className="flex flex-col p-4 sm:p-5">
              <Chip tone="violet" className="self-start">
                {sc.id}
              </Chip>
              <div className="mt-3 font-heading text-[17px] leading-snug">{sc.title}</div>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-soft">{sc.body}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {sc.href ? (
                  <Link href={sc.href} className={buttonVariants({ size: "sm" })}>
                    {t("打开", "Open")}
                  </Link>
                ) : (
                  <Chip>{t("测试覆盖", "In tests")}</Chip>
                )}
                {sc.alt && (
                  <Link href={sc.alt} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    {sc.alt === "/inbox" ? t("待确认", "Inbox") : t("看示例", "Example")}
                  </Link>
                )}
              </div>
            </Panel>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <Panel>
            <PanelTitle>{t("开关", "Switches")}</PanelTitle>
            <div className="divide-y divide-line">
              <Toggle
                on={s.demo.revokedMerchants.includes("m_kuaikuai")}
                onChange={() => actions.toggleMerchantRevoked("m_kuaikuai")}
                label={t("撤销快快屋的商家凭证", "Revoke KuaiKuai's merchant credential")}
                sub={t("它的商品会被判为「拒绝」", "Its items become declined")}
              />
              <Toggle on={s.demo.nextIssuerDecline} onChange={(v) => actions.setNextIssuerDecline(v)} label={t("下一笔付款被发卡方拒绝", "Next payment declined by issuer")} sub={t("不扣款，额度不动", "No charge, budget untouched")} />
              <Toggle
                on={s.demo.agentMode === "llm"}
                onChange={(v) => actions.setAgentMode(v ? "llm" : "fallback")}
                label={t("使用模型（关掉 = 规则演示模式）", "Use the model (off = rules demo mode)")}
                sub={t("只影响新任务的解释文字；结果都由规则决定", "Only changes explanation text on new tasks; rules decide either way")}
              />
            </div>
          </Panel>

          <Panel>
            <PanelTitle>{t("确认前涨价（S2）", "Bump price before approval (S2)")}</PanelTitle>
            {pending.length === 0 ? (
              <p className="text-[13px] text-soft">{t("现在没有待确认的订单。", "Nothing is waiting for approval.")}</p>
            ) : (
              <ul className="space-y-2">
                {pending.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 text-[14px]">
                    <span className="min-w-0 flex-1 truncate">
                      {productOf(p.productId).name[lang]} · v{p.cartVersion}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => actions.bumpPendingPrice(p.id)}>
                      {t("涨价 5.00 港元", "+ HK$5.00")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelTitle>{t("撤销一份授权", "Revoke a mandate")}</PanelTitle>
            {active.length === 0 ? (
              <p className="text-[13px] text-soft">{t("没有生效中的授权。", "No active mandates.")}</p>
            ) : (
              <ul className="space-y-2">
                {active.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 text-[14px]">
                    <span className="min-w-0 flex-1 truncate">
                      {m.title[lang]} · v{m.version}
                    </span>
                    <Button size="sm" variant="destructive" onClick={() => actions.revokeMandate(m.id)}>
                      {t("撤销", "Revoke")}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel className="bg-noir text-white">
          <Eyebrow className="text-white/50">{t("攻击演示", "Attack demo")}</Eyebrow>
          <h2 className="mt-1 font-heading text-[24px]">{t("密码被偷了，会怎样？", "What if the password leaks?")}</h2>
          <ol className="mt-5 space-y-3.5">
            {attackSteps.map((st, i) => (
              <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-white/80">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-[12px] tabular">{i + 1}</span>
                <span>{st}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6 rounded-2xl bg-white p-4 text-ink">
            <MaxLossLine />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => window.open("/login?attacker=1", "_blank")}>
              <ExternalLink />
              {t("打开攻击者标签页", "Open attacker tab")}
            </Button>
            {s.session.frozen ? (
              <Chip tone="dark" className="h-10 px-4">
                {t("已冻结", "Frozen")}
              </Chip>
            ) : (
              <Button variant="destructive" onClick={() => actions.freeze()} disabled={mode === "attacker"}>
                <Snowflake />
                {t("一键冻结", "Freeze")}
              </Button>
            )}
          </div>
          <p className="mt-4 text-[12px] text-white/50">
            {t(`这个标签页的身份：${mode === "attacker" ? "攻击者（新设备）" : "Alex 本人"}`, `This tab is: ${mode === "attacker" ? "the attacker (new device)" : "Alex"}`)}
          </p>
        </Panel>
      </div>
    </>
  );
}
