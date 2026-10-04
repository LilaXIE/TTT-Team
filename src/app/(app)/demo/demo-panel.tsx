"use client";

import { cn } from "cn";
import { ExternalLink, RotateCcw, Snowflake } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Chip, Eyebrow, Money, PageHeader, Panel, PanelTitle } from "@/components/app/primitives";
import { ZEV_POSES, ZevCharacter } from "@/components/app/zev";
import { MaxLossLine } from "@/components/app/security-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { productOf } from "@/lib/mock/catalog";
import { actions, getState, openPending, useMock, useNow, useSessionMode } from "@/lib/mock/store";

const S1 = "帮我补一瓶洗衣液，2L 以上，$150 以内，可以换牌子，这周内买到。";
const SOAP = "帮我买一瓶洗洁精。";

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

function ScenarioCard({
  id,
  title,
  body,
  href,
  alt,
}: {
  id: string;
  title: string;
  body: string;
  href: string | null;
  alt?: { href: string; label: string } | null;
}) {
  const { t } = useLang();
  return (
    <Panel className="flex flex-col p-4 sm:p-5">
      <Chip tone="violet" className="self-start">
        {id}
      </Chip>
      <div className="mt-3 font-heading text-[17px] leading-snug">{title}</div>
      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-soft">{body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {href ? (
          <Link href={href} className={buttonVariants({ size: "sm" })}>
            {t("打开", "Open")}
          </Link>
        ) : (
          <Chip>{t("测试覆盖", "In tests")}</Chip>
        )}
        {alt && (
          <Link href={alt.href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {alt.label}
          </Link>
        )}
      </div>
    </Panel>
  );
}

export function DemoPanel() {
  const { t, lang } = useLang();
  const router = useRouter();
  const s = useMock();
  const mode = useSessionMode();
  const now = useNow(1000);
  const pending = now === null ? [] : openPending(s, now);
  const active = s.mandates.filter((m) => m.status === "active");
  const pocketLow = BigInt(s.pocketMinor) < 2000n;

  function openFilters() {
    const task = getState().tasks.find((x) => x.id === "s2");
    if (task && !task.blocks.some((b) => b.kind === "hint")) {
      actions.appendBlocks("s2", [{ kind: "hint", at: new Date().toISOString() }]);
    }
    router.push("/task/s2");
  }

  const core = [
    {
      id: "S1",
      title: t("范围内自动完成", "Auto-complete within limits"),
      body: t("一句话起草授权，通行密钥签发后直接付款。含运费 $138.00 的那笔已经入账。", "One sentence drafts a mandate. After the passkey it pays. The $138.00 order, shipping included, is already paid."),
      href: `/task/new?q=${encodeURIComponent(S1)}`,
      alt: { href: "/task/s1", label: t("已入账的例子", "Paid example") },
    },
    {
      id: "S2",
      title: t("换牌子先问你", "Different brand asks first"),
      body: t("品牌甲缺货，换成品牌丙要你确认。确认前可以在下面把价格涨 $5.00，旧确认会失效。", "Brand Jia is sold out, so Brand Bing asks first. Bump the price by $5.00 below and the old approval dies."),
      href: "/task/s2",
      alt: { href: "/inbox", label: t("待确认", "Inbox") },
    },
    {
      id: "S3",
      title: t("超上限直接拒绝", "Over the cap is declined"),
      body: t("$158.00 超过单笔 $150.00。没有确认按钮，拒绝不能被放行。", "$158.00 is over the $150.00 cap. There is no approve button. A refusal cannot be waved through."),
      href: "/task/s3",
      alt: { href: "/inbox", label: t("待确认里的拒绝", "Refusal in inbox") },
    },
    {
      id: "S4",
      title: t("防重复与超支", "No double-spend"),
      body: t("同一订单并发 10 次只扣一次；并发超支只成功一笔。这一条由测试脚本验证，页面上不模拟并发。", "10 concurrent pays charge once; concurrent overspend lets one through. Tests cover this. The page does not simulate concurrency."),
      href: null,
      alt: null,
    },
    {
      id: "S5",
      title: t("解释与追溯", "Explain and trace"),
      body: t("从授权版本、候选、规则到付款和收据。申请售后可以自己写原因，之后转人工。", "Mandate version, candidates, rules, payment and receipt. Support lets you type a reason, then a person takes it."),
      href: "/ledger?order=ord_1001",
      alt: { href: "/task/s1", label: t("工作记录", "Work log") },
    },
    {
      id: "S6",
      title: t("精选，每笔先问", "Curated, ask every time"),
      body: t("黑色极简保温杯先给你三件再问。这份授权只允许 FPS，偏好只用来排序。", "A black minimal tumbler shows three choices, then asks. This mandate allows only FPS. Preferences only rank."),
      href: "/task/c1",
      alt: { href: "/mandate/md_curated", label: t("这份授权", "This mandate") },
    },
  ];

  const more = [
    {
      id: t("目录", "Catalog"),
      title: t("按商品词搜目录", "Search the catalogue"),
      body: t("说「洗洁精」不会走进洗衣液脚本。DeepSeek 只读这句话，金额仍由规则定。", "“Dish soap” does not enter the laundry script. DeepSeek only reads the sentence. Rules still set the amount."),
      href: `/task/new?q=${encodeURIComponent(SOAP)}`,
      alt: null,
    },
    {
      id: t("追问", "Follow-up"),
      title: t("补充要求留在这一单", "A follow-up stays on this order"),
      body: t("在待确认那单输入「要今天到」。没有今日达，标题仍是洗衣液，不会另开一个空任务。", "On the pending order, type “arrives today”. Nothing delivers today. The title stays laundry liquid. No empty new task."),
      href: "/task/s2",
      alt: null,
    },
    {
      id: t("条件", "Filters"),
      title: t("自己填规格和预算", "Type your own size and budget"),
      body: t("打开后点「帮我把需求说清楚」。规格和预算最后一项是自定义。", "Then tap “Help me say what I want”. Size and budget end with a custom box."),
      href: null,
      alt: null,
      onOpen: openFilters,
    },
    {
      id: t("付款", "Pay"),
      title: t("零钱包走 Tap & Go", "The pocket pays with Tap & Go"),
      body: t("本地港元消费两边手续费都是 0。零钱包够、商家也收，就用 Tap & Go。", "Local HKD spending is 0 on both rails. When the pocket covers it and the shop accepts it, use Tap & Go."),
      href: "/pay-methods",
      alt: { href: "/wallet", label: t("零钱包", "Pocket") },
    },
    {
      id: "FPS",
      title: t("授权只允许 FPS", "Mandate allows only FPS"),
      body: t("纸巾那份授权收紧成只能用 FPS，所以收据是 FPS。钱仍从零钱包扣。", "The tissue mandate was tightened to FPS only, so the receipt says FPS. The money still leaves the pocket."),
      href: "/task/t0",
      alt: { href: "/mandate/md_tissue", label: t("这份授权", "This mandate") },
    },
    {
      id: t("注入", "Injection"),
      title: t("商品描述当数据", "Descriptions stay data"),
      body: t("洗衣液候选里有一句「忽略预算」。工作记录写明没有照做，规则照常判断。", "One laundry listing says “ignore the budget”. The work log says it was not followed. The rules still apply."),
      href: "/task/s1",
      alt: null,
    },
    {
      id: t("地址", "Address"),
      title: t("改地址等 24 小时", "Address changes wait 24 hours"),
      body: t("要通行密钥。就算通过，也要等冷静期。攻击者页同样过不了。", "It needs the passkey. Even then it waits out the cooling-off. The attacker tab cannot skip it."),
      href: "/me/address",
      alt: null,
    },
    {
      id: t("偏好", "Prefs"),
      title: t("偏好只影响排序", "Preferences only rank"),
      body: t("极简、黑色、常买牌子不参与能不能买。", "Minimal, black and usual brand never decide whether a purchase is allowed."),
      href: "/me/preferences",
      alt: { href: "/me/connections", label: t("已连接 Tap & Go", "Tap & Go linked") },
    },
  ];

  const attackSteps = [
    t("开一个「攻击者」标签页，用被盗的密码登录。它被识别为新设备，只能查看，并短信通知 Alex。", "Open an attacker tab and sign in with the stolen password. It's a new, view-only device and Alex gets an SMS."),
    t("在攻击者页试着提高上限或签新授权：没有通行密钥，PIN 也不对，失败并记录。", "In that tab, try raising a limit or signing a mandate: no passkey, wrong PIN — it fails and is logged."),
    t("试着改收货地址：同样需要通行密钥，而且就算成功也要等 24 小时。", "Try changing the address: also needs the passkey, and would still wait 24 hours."),
    t("看洗衣液那单的工作记录：候选描述里的「忽略预算」被当成数据，没有改规则。", "Open the laundry work log: “ignore the budget” in a listing is data and does not change the rules."),
    t("看最大损失：就算一切失守，也不超过下面这个数。零钱包不够时付款会停，不会改从银行扣。", "Check max loss: even in the worst case, it's capped at the number below. A short pocket stops the payment. It does not switch to the bank."),
    t("回到这里一键冻结。攻击者那页立刻失效。", "Come back and freeze. The attacker tab goes dead instantly."),
  ];

  return (
    <>
      <PageHeader
        eyebrow={t("演示控制", "Demo controls")}
        title={t("评委演示台", "Demo console")}
        description={t("先讲上面六条。下面是这次加上的、以及边界情景，都可以直接打开。开关只改本浏览器里的模拟数据。", "Tell the six above first. The rest are the additions and the edge cases, each with a link. Switches change simulated data in this browser only.")}
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
        <h2 className="mb-1 font-heading text-[22px]">{t("主线", "Core")}</h2>
        <p className="mb-4 text-[13px] text-soft">{t("按这个顺序讲。S4 没有页面，测试里已经覆盖。", "Go in this order. S4 has no page; the tests cover it.")}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {core.map((sc) => (
            <ScenarioCard key={sc.id} {...sc} />
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 font-heading text-[22px]">{t("也可以点开", "Also open these")}</h2>
        <p className="mb-4 text-[13px] text-soft">{t("大目录、追问、自定义条件、两条付款轨道，以及注入、地址冷静期、偏好。", "The larger catalogue, follow-ups, custom filters, both payment rails, plus injection, address cooling-off and preferences.")}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {more.map((sc) =>
            sc.onOpen ? (
              <Panel key={sc.id} className="flex flex-col p-4 sm:p-5">
                <Chip tone="violet" className="self-start">
                  {sc.id}
                </Chip>
                <div className="mt-3 font-heading text-[17px] leading-snug">{sc.title}</div>
                <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-soft">{sc.body}</p>
                <div className="mt-4">
                  <Button size="sm" onClick={sc.onOpen}>
                    {t("打开", "Open")}
                  </Button>
                </div>
              </Panel>
            ) : (
              <ScenarioCard key={sc.id} id={sc.id} title={sc.title} body={sc.body} href={sc.href} alt={sc.alt} />
            ),
          )}
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
                sub={t("再买洗衣液时，这家的商品会被判为拒绝。康康保健的凭证本来就是撤销的。", "Its items are declined on the next laundry search. KangKang Health is already revoked.")}
              />
              <Toggle
                on={s.demo.nextIssuerDecline}
                onChange={(v) => actions.setNextIssuerDecline(v)}
                label={t("下一笔付款被发卡方拒绝", "Next payment declined by issuer")}
                sub={t("打开后去 S2 确认付款。不扣款，额度不动，开关用过即关。", "Then approve S2. No charge, budget untouched, and this switch turns itself off.")}
              />
              <Toggle
                on={s.demo.agentMode === "llm"}
                onChange={(v) => actions.setAgentMode(v ? "llm" : "fallback")}
                label={t("新任务的推荐理由用模型口吻", "New tasks explain picks in the model’s voice")}
                sub={t("只改解释文字。首页仍会调用 DeepSeek。金额和能不能买不看这个开关。", "Explanation text only. The home page still calls DeepSeek. Amounts and approval ignore this switch.")}
              />
            </div>
            <div className="mt-3 border-t border-line pt-3">
              <div className="text-[14px]">{t("零钱包余额", "Pocket balance")}</div>
              <Money minor={s.pocketMinor} className="mt-1 block font-heading text-[22px]" />
              <p className="mt-1 text-[12px] text-soft">{t("调到 $10.00后再去付款，会停住并让你充值。不会改走银行账户的 FPS。", "Set it to $10.00 and the next payment stops and asks for a top-up. It does not switch to a bank FPS transfer.")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant={pocketLow ? "default" : "outline"} onClick={() => actions.setPocketForDemo("1000")}>
                  {t("改成 $10.00", "Set to $10.00")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => actions.setPocketForDemo("30000")}>
                  {t("恢复 $300.00", "Restore $300.00")}
                </Button>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelTitle>{t("确认前涨价（S2）", "Bump price before approval (S2)")}</PanelTitle>
            {pending.length === 0 ? (
              <p className="text-[13px] text-soft">
                {t("现在没有待确认的订单。", "Nothing is waiting for approval.")}{" "}
                <Link href="/task/s2" className="text-violet hover:underline">
                  {t("打开换牌子那一单", "Open the brand-change order")}
                </Link>
              </p>
            ) : (
              <ul className="space-y-2">
                {pending.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 text-[14px]">
                    <span className="min-w-0 flex-1 truncate">
                      {productOf(p.productId).name[lang]} · v{p.cartVersion}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => actions.bumpPendingPrice(p.id)}>
                      {t("涨价 $5.00", "+ $5.00")}
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
            <Link href="/task/s1" className={buttonVariants({ variant: "secondary", size: "default" })}>
              {t("看被忽略的描述", "See the ignored text")}
            </Link>
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
