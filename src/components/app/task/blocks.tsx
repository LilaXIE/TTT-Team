"use client";

import { cn } from "cn";
import { Check, Clock, Fingerprint, ShieldX, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { hkdToMinor } from "@/contracts/money";
import { MandateCard } from "@/components/app/mandate-card";
import { MandateEditor, MandatePreview, draftError } from "@/components/app/mandate-editor";
import { Chip, Countdown, Eyebrow, Money, OutcomeChip, Panel, ProductThumb, SimNote, ZevAvatar } from "@/components/app/primitives";
import { useStepUp } from "@/components/app/step-up";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fmtDateTime, fmtMoney } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { createServerMandate } from "@/lib/live";
import { requestHigherCap, signDraft } from "@/lib/mock/agent";
import { METHODS, merchantOf, productOf } from "@/lib/mock/catalog";
import { evaluate } from "@/lib/mock/evaluate";
import { actions, useMock, useNow, useSessionMode } from "@/lib/mock/store";
import type { Block, DraftFields, MockTask, Tx } from "@/lib/mock/types";
import { RULE_TITLE, ruleText } from "@/lib/rule-text";

type B<K extends Block["kind"]> = Extract<Block, { kind: K }>;

export function UserBubble({ b }: { b: B<"user"> }) {
  const { lang } = useLang();
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[20px] rounded-br-md bg-ink px-4 py-2.5 text-[15px] leading-relaxed text-white">{typeof b.text === "string" ? b.text : b.text[lang]}</div>
    </div>
  );
}

export function ZevSays({ children, working }: { children: React.ReactNode; working?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <ZevAvatar working={working} className="mt-0.5" />
      <div className="min-w-0 flex-1 pt-1 text-[15px] leading-relaxed">{children}</div>
    </div>
  );
}

export function ZevBlock({ b }: { b: B<"zev"> }) {
  const { lang } = useLang();
  return <ZevSays>{b.text[lang]}</ZevSays>;
}

export function InScopeBlock({ b }: { b: B<"in_scope"> }) {
  const { t, lang } = useLang();
  const s = useMock();
  const m = s.mandates.find((x) => x.id === b.mandateId);
  if (!m) return null;
  return (
    <ZevSays>
      <p>
        {t(
          `这在你已经签过的「${m.title.zh}」v${m.version} 范围内：单笔不超过 ${fmtMoney(m.perTxnMinor, "zh")}，还剩 ${fmtMoney(m.remainingMinor, "zh")}，还能买 ${m.remainingPurchases} 次。不用再签，我直接去找。`,
          `This fits your signed “${m.title.en}” v${m.version}: up to ${fmtMoney(m.perTxnMinor, "en")} per order, ${fmtMoney(m.remainingMinor, "en")} left, ${m.remainingPurchases} purchase${m.remainingPurchases > 1 ? "s" : ""} left. No new signature needed, I'm on it.`,
        )}
      </p>
      <Link href={`/mandate/${m.id}`} className="mt-2 inline-flex text-[13px] text-violet hover:underline">
        {t("查看这份授权", "View this mandate")} · {m.title[lang]}
      </Link>
    </ZevSays>
  );
}

export function WorkingBlock({ b, index, task }: { b: B<"working">; index: number; task: MockTask }) {
  const { t } = useLang();
  const done = task.blocks.slice(index + 1).some((x) => x.kind === "pick" || x.kind === "denied" || x.kind === "zev" || x.kind === "hint");
  const steps = task.timeline.filter((x) => x.at >= b.at);
  return (
    <ZevSays working={!done}>
      {done ? (
        <span className="text-soft">{t(`比较完了：${steps.length} 个步骤，都记在工作记录里。`, `Done comparing: ${steps.length} steps, all in the work log.`)}</span>
      ) : (
        <span className="inline-flex items-center gap-2 text-soft">
          {t("正在两家商家里比价、按授权逐件判断", "Comparing two shops and checking each item against your mandate")}
          <span className="inline-flex gap-1">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-violet" />
            <span className="size-1.5 animate-pulse-dot rounded-full bg-violet [animation-delay:200ms]" />
            <span className="size-1.5 animate-pulse-dot rounded-full bg-violet [animation-delay:400ms]" />
          </span>
        </span>
      )}
    </ZevSays>
  );
}

export function DraftBlock({ b, index, taskId }: { b: B<"draft">; index: number; taskId: string }) {
  const { t, lang } = useLang();
  const s = useMock();
  const stepUp = useStepUp();
  const [fields, setFields] = useState<DraftFields>(b.fields);
  const signed = b.signedMandateId ? s.mandates.find((m) => m.id === b.signedMandateId) : null;

  if (signed) {
    return (
      <ZevSays>
        <p className="mb-3">{t("签好了。这是你给我的边界，我只在里面做事：", "Signed. These are the limits I'll work within:")}</p>
        <MandateCard m={signed} href={`/mandate/${signed.id}`} compact className="max-w-sm" />
      </ZevSays>
    );
  }

  const err = draftError(fields);
  const sign = async () => {
    const ok = await stepUp({
      title: { zh: "签发授权", en: "Sign mandate" },
      detail: {
        zh: `「${fields.title.zh}」：单笔 ≤ ${fmtMoney(fields.perTxnMinor, "zh")}，总共 ≤ ${fmtMoney(fields.totalMinor, "zh")}，最多 ${fields.maxPurchases} 次，${fields.days} 天内有效。`,
        en: `“${fields.title.en}”: ≤ ${fmtMoney(fields.perTxnMinor, "en")} per order, ≤ ${fmtMoney(fields.totalMinor, "en")} total, up to ${fields.maxPurchases} purchases, valid ${fields.days} days.`,
      },
    });
    if (!ok) return;
    const first = s.tasks.find((x) => x.id === taskId)?.blocks.find((x) => x.kind === "user");
    const text = first && first.kind === "user" ? (typeof first.text === "string" ? first.text : first.text.zh) : fields.title.zh;
    await createServerMandate(fields, text);
    signDraft(taskId, index, fields);
  };

  return (
    <ZevSays>
      <p className="mb-3">{t("我理解你的意思是下面这样。金额和权限以这张卡上的数字为准，你可以直接改：", "Here's how I understood it. The numbers on this card are what count, and you can edit them:")}</p>
      <Panel className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <Eyebrow>{fields.mode === "curated" ? t("授权草稿 · 精选", "Draft mandate · Curated") : t("授权草稿 · 极速", "Draft mandate · Quick")}</Eyebrow>
            <div className="mt-1 font-heading text-xl">{fields.title[lang]}</div>
          </div>
          <Chip tone="violet">{t("未签发", "Not signed")}</Chip>
        </div>
        <MandateEditor value={fields} onChange={setFields} compact />
        <div className="mt-6">
          <Eyebrow className="mb-3">{t("签之前，看看它会怎么判", "Before you sign: how it would decide")}</Eyebrow>
          <MandatePreview fields={fields} />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <Button onClick={sign} disabled={err !== null}>
            <Fingerprint />
            {t("用通行密钥签发", "Sign with passkey")}
          </Button>
          <Link href="/mandate/new" className={buttonVariants({ variant: "ghost" })}>
            {t("在完整表单里编辑", "Open full form")}
          </Link>
          <span className="text-[12px] text-soft">{t("Zev 只负责起草，签发必须是你。", "Zev only drafts. Only you can sign.")}</span>
        </div>
      </Panel>
    </ZevSays>
  );
}

export function ReceiptBlock({ b }: { b: B<"receipt"> }) {
  const { t, lang } = useLang();
  const s = useMock();
  const o = s.orders.find((x) => x.id === b.orderId);
  if (!o) return null;
  const p = productOf(o.productId);
  const mer = merchantOf(o.merchantId);
  const m = s.mandates.find((x) => x.id === o.mandateId);
  const method = METHODS.find((x) => x.id === o.method);
  return (
    <ZevSays>
      <Panel className="border-ok/25 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-ok-soft text-ok">
              <Check className="size-5" />
            </span>
            <div>
              <div className="font-heading text-lg">{t("已付款", "Paid")}</div>
              <div className="text-[13px] text-soft">{fmtDateTime(o.paidAt, lang)}</div>
            </div>
          </div>
          <div className="text-right">
            <Money minor={o.totalMinor} className="font-heading text-[26px] leading-none" />
            <div className="mt-1 text-[12px] text-soft">{t("含运费与手续费", "incl. shipping & fees")}</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-canvas/60 p-3">
          <ProductThumb product={p} className="size-12 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{p.name[lang]}</div>
            <div className="text-[12px] text-soft">
              {mer.name[lang]} · {method?.label[lang]} <SimNote className="ml-1" />
            </div>
            {o.method === "tapngo_mc" && <p className="mt-1 text-[12px] text-soft">{t("从零钱包扣，所以用 Tap & Go。本地港元消费手续费是 0，不是因为它比 FPS 便宜。", "Paid from the pocket, so this is Tap & Go. The local-HKD fee is 0, not because it beats FPS.")}</p>}
          </div>
        </div>
        <div className="mt-3 grid gap-x-6 text-[13px] sm:grid-cols-2">
          <Row k={t("商品", "Item")} v={<Money minor={o.subtotalMinor} />} />
          <Row k={t("运费", "Shipping")} v={<Money minor={o.shippingMinor} />} />
          <Row k={t("手续费", "Fee")} v={<Money minor={o.feeMinor} />} />
          <Row k={t("订单号", "Order")} v={<span className="font-mono text-[12px]">{o.id}</span>} />
          {m && <Row k={t("用的授权", "Mandate")} v={`${m.title[lang]} v${o.mandateVersion}`} />}
          {m && <Row k={t("授权还剩", "Mandate left")} v={<span><Money minor={m.remainingMinor} /> · {t(`${m.remainingPurchases} 次`, `${m.remainingPurchases} left`)}</span>} />}
        </div>
        {o.confirmedRules.length > 0 && (
          <p className="mt-3 text-[13px] text-soft">
            {t("你确认过：", "You approved: ")}
            {o.confirmedRules.map((r) => RULE_TITLE[r][lang]).join(t("、", ", "))}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/ledger?order=${o.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {t("查看完整记录", "Full record")}
          </Link>
          <Link href="/pay-methods" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {t("为什么用这个付款方式", "Why this payment method")}
          </Link>
          {o.support === "none" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                actions.requestSupport(o.id);
                toast(t("已转人工处理（模拟）", "Sent to a person (simulated)"));
              }}
            >
              {t("申请售后", "Get help")}
            </Button>
          ) : (
            <Chip tone="ask">{t("人工处理中", "With support")}</Chip>
          )}
        </div>
      </Panel>
    </ZevSays>
  );
}

function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/70 py-2 last:border-0">
      <span className="text-soft">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}

export function AwaitingBlock({ b }: { b: B<"awaiting"> }) {
  return (
    <ZevSays>
      <PendingCard pendingId={b.pendingId} />
    </ZevSays>
  );
}

export function PendingCard({ pendingId, taskLink }: { pendingId: string; taskLink?: boolean }) {
  const { t, lang } = useLang();
  const s = useMock();
  const mode = useSessionMode();
  const stepUp = useStepUp();
  const now = useNow(1000);
  const p0 = s.pending.find((x) => x.id === pendingId);
  if (!p0) return null;
  const pending = p0;
  const p = productOf(pending.productId);
  const m = s.mandates.find((x) => x.id === pending.mandateId);
  const timedOut = now !== null && Date.parse(pending.expiresAt) <= now;
  const live = pending.status === "pending" && !timedOut;
  const confirm = async () => {
    const ok = await stepUp({
      title: { zh: "确认这笔购买", en: "Approve this purchase" },
      detail: { zh: `${p.name.zh}，${fmtMoney(pending.totalMinor, "zh")}，购物车 v${pending.cartVersion}`, en: `${p.name.en}, ${fmtMoney(pending.totalMinor, "en")}, cart v${pending.cartVersion}` },
    });
    if (!ok) return;
    const r = actions.confirmPending(pending.id);
    if (!r.ok) {
      const why: Record<string, Tx> = {
        EXPIRED: { zh: "确认已过期，需要重新生成。", en: "This approval expired." },
        DENY: { zh: "结算时重新判定后被拒绝，没有扣款。", en: "Settlement re-checked and declined. Nothing was charged." },
        ISSUER_DECLINED: { zh: "发卡方拒绝了付款（演示设置），没有扣款。", en: "The issuer declined (demo setting). Nothing was charged." },
        INSUFFICIENT_POCKET: { zh: "Agent 零钱包余额不足。", en: "Not enough in the Agent pocket." },
        FROZEN: { zh: "账号已冻结。", en: "Account frozen." },
        REVIEW_REQUIRED: { zh: "规则变了，需要重新确认。", en: "Rules changed; approve again." },
      };
      toast.error(why[r.code][lang]);
    }
  };
  const statusChip = {
    pending: <Chip>{t("已过期", "Expired")}</Chip>,
    confirmed: <Chip tone="ok">{t("已确认并付款", "Approved & paid")}</Chip>,
    cancelled: <Chip>{t("已取消", "Cancelled")}</Chip>,
    expired: <Chip>{t("已过期", "Expired")}</Chip>,
    invalidated: <Chip tone="no">{t("购物车变了，已失效", "Cart changed, void")}</Chip>,
  }[pending.status];

  const task = s.tasks.find((x) => x.id === pending.taskId);

  return (
      <Panel className={cn("p-4 sm:p-5", live ? "border-ask/35" : "opacity-75")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <OutcomeChip outcome="REVIEW" />
            <span className="font-heading text-lg">{t("这笔要你点头", "This one needs your OK")}</span>
          </div>
          {live ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] text-ask">
              <Clock className="size-4" />
              <Countdown until={pending.expiresAt} />
            </span>
          ) : (
            statusChip
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <ProductThumb product={p} className="size-14 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="truncate">{p.name[lang]}</div>
            <div className="text-[13px] text-soft">
              {merchantOf(p.merchantId).name[lang]} · {t("购物车", "Cart")} v{pending.cartVersion}
            </div>
          </div>
          <Money minor={pending.totalMinor} className="font-heading text-xl" />
        </div>
        <ul className="mt-4 space-y-2">
          {pending.rules.length === 0 ? (
            <li className="rounded-xl bg-canvas/70 px-3 py-2 text-[13px]">{t("精选模式：每一笔都由你亲自确认。", "Curated mode: you approve every purchase yourself.")}</li>
          ) : (
            pending.rules.map((r) => (
              <li key={r.id} className="rounded-xl bg-ask-soft/70 px-3 py-2 text-[13px]">
                <span className="font-medium text-ask">{RULE_TITLE[r.id][lang]}</span>
                {m && <span className="text-ink"> · {ruleText(r.id, { product: p, mandate: m, now: new Date(pending.createdAt) }, lang)}</span>}
              </li>
            ))
          )}
        </ul>
        {live && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={confirm}>
              <Fingerprint />
              {t("用通行密钥确认", "Approve with passkey")}
            </Button>
            <Button variant="ghost" onClick={() => actions.cancelPending(pending.id)} disabled={mode === "attacker"}>
              {t("不买了", "Don't buy")}
            </Button>
            {taskLink && task && (
              <Link href={`/task/${task.id}`} className="ml-auto text-[13px] text-violet hover:underline">
                {t("看对话", "Open chat")} · {task.title[lang]}
              </Link>
            )}
          </div>
        )}
        <p className="mt-3 text-[12px] leading-relaxed text-soft">
          {t("这次确认只对这个购物车版本和上面这些原因有效，30 分钟后失效；价格或商品一变就要重新确认。", "This approval covers only this cart version and the reasons above, and lapses in 30 minutes. Any change to price or item needs a fresh approval.")}
        </p>
      </Panel>
  );
}

export function DeniedBlock({ b, taskId }: { b: B<"denied">; taskId: string }) {
  const { t, lang } = useLang();
  const s = useMock();
  const mode = useSessionMode();
  const stepUp = useStepUp();
  const [raising, setRaising] = useState(false);
  const m = s.mandates.find((x) => x.id === b.mandateId);
  const p = productOf(b.productId);
  const ev = m ? evaluate(m, p, { now: new Date(b.at), revokedMerchants: s.demo.revokedMerchants }) : null;
  const [text, setText] = useState(() => (ev ? ((ev.total / 1000n + 1n) * 10n).toString() : "200"));
  if (!m || !ev) return null;
  const denies = b.rules;
  const capHit = denies.some((r) => r.id === "CAP_PER_TXN");
  const waiting = s.cooling.find((c) => c.kind === "raise_cap" && c.mandateId === m.id && c.status === "waiting");

  const submit = async () => {
    let to: bigint;
    try {
      to = hkdToMinor(text);
    } catch {
      toast.error(t("请输入金额", "Enter an amount"));
      return;
    }
    if (to <= BigInt(m.perTxnMinor)) {
      toast.error(t("新上限要比现在高", "The new cap must be higher"));
      return;
    }
    const ok = await stepUp({
      title: { zh: "提高单笔上限", en: "Raise per-order cap" },
      detail: { zh: `「${m.title.zh}」${fmtMoney(m.perTxnMinor, "zh")} → ${fmtMoney(to, "zh")}，24 小时后生效`, en: `“${m.title.en}” ${fmtMoney(m.perTxnMinor, "en")} → ${fmtMoney(to, "en")}, effective in 24 hours` },
    });
    if (!ok) return;
    requestHigherCap(taskId, m.id, to.toString());
    setRaising(false);
  };

  return (
    <ZevSays>
      <Panel className="border-no/25 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldX className="size-5 text-no" />
            <span className="font-heading text-lg">{t("这笔不能买", "Can't buy this")}</span>
          </div>
          <OutcomeChip outcome="DENY" />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <ProductThumb product={p} className="size-14 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="truncate">{p.name[lang]}</div>
            <div className="text-[13px] text-soft">{merchantOf(p.merchantId).name[lang]}</div>
          </div>
          <Money minor={ev.total} className="font-heading text-xl" />
        </div>
        <ul className="mt-4 space-y-2">
          {denies.map((r) => (
            <li key={r.id} className="rounded-xl bg-no-soft/70 px-3 py-2 text-[13px]">
              <span className="font-medium text-no">{RULE_TITLE[r.id][lang]}</span>
              <span> · {ruleText(r.id, { product: p, mandate: m, now: new Date(b.at) }, lang)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-soft">{t("「拒绝」不能靠确认绕过。要买，只能先改授权本身。", "A decline can't be approved away. To buy it, the mandate itself has to change.")}</p>
        {capHit && m.status === "active" && (
          <div className="mt-4 border-t border-line pt-4">
            {waiting ? (
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <Chip tone="ask">{t("冷静期中", "Cooling off")}</Chip>
                {t(`提高到 ${fmtMoney(waiting.toMinor ?? "0", "zh")}，还剩`, `Raising to ${fmtMoney(waiting.toMinor ?? "0", "en")} in`)} <Countdown until={waiting.effectiveAt} />
                <Link href="/wallet" className="text-violet hover:underline">
                  {t("去钱包取消", "Cancel in Wallet")}
                </Link>
              </div>
            ) : raising ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="block">
                  <span className="mb-1.5 block text-[13px] text-soft">{t("新的单笔上限（港元）", "New per-order cap (HKD)")}</span>
                  <Input value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" className="w-36 tabular" />
                </label>
                <Button onClick={submit}>
                  <Fingerprint />
                  {t("用通行密钥申请", "Request with passkey")}
                </Button>
                <Button variant="ghost" onClick={() => setRaising(false)}>
                  {t("算了", "Never mind")}
                </Button>
                <p className="w-full text-[12px] text-soft">{t("放宽权限要等 24 小时冷静期（演示 2 分钟），并短信通知你。账号被盗时，这段时间足够你发现并取消。", "Loosening a limit waits 24 hours (2 min in the demo) and sends you an SMS, so a thief can't do it quietly.")}</p>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setRaising(true)} disabled={mode === "attacker"}>
                {t("提高单笔上限…", "Raise the cap…")}
              </Button>
            )}
          </div>
        )}
      </Panel>
    </ZevSays>
  );
}

export function fillComposer(text: string) {
  window.dispatchEvent(new CustomEvent("zev-fill", { detail: text }));
  document.getElementById("task-composer")?.focus();
}

const GUIDE = [
  {
    key: "what",
    zh: "买什么",
    en: "What",
    options: [
      ["洗衣液", "laundry liquid"],
      ["抽纸", "tissue"],
      ["水杯", "a cup"],
      ["洗洁精", "dish soap"],
      ["维生素", "vitamins"],
    ],
  },
  {
    key: "size",
    zh: "规格",
    en: "Size",
    options: [
      ["2L 以上", "2L or more"],
      ["小包装", "a small pack"],
      ["不限规格", "any size"],
    ],
  },
  {
    key: "budget",
    zh: "预算",
    en: "Budget",
    options: [
      ["100 以内", "under 100"],
      ["150 以内", "under 150"],
      ["不限预算", "no budget cap"],
    ],
  },
  {
    key: "when",
    zh: "什么时候要",
    en: "When",
    options: [
      ["今天到", "today"],
      ["这周内", "this week"],
      ["不急", "no rush"],
    ],
  },
] as const;

const CUSTOM_KEYS = new Set(["size", "budget"]);

export function NeedGuide({ onApply }: { onApply?: (text: string) => void }) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  const valueOf = (key: string) => {
    if (picked[key] !== "自定义") return picked[key] ?? "";
    const raw = (custom[key] ?? "").trim();
    if (!raw) return "";
    if (key === "budget") return `HK$${raw.replace(/^HK\$/i, "")} 以内`;
    return raw;
  };
  const sentence = GUIDE.map((g) => valueOf(g.key)).filter((v) => v && !v.startsWith("不")).join("，");
  const apply = () => {
    const text = sentence ? t(`帮我买${sentence}`, `Get me ${sentence}`) : t("帮我买日用品", "Get me household supplies");
    if (onApply) onApply(text);
    else fillComposer(text);
    setOpen(false);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto flex items-center gap-2 rounded-full border border-dashed border-line px-4 py-2 text-[13px] text-soft transition-colors hover:border-violet hover:text-violet"
      >
        <Sparkles className="size-4" />
        {t("帮我把需求说清楚", "Help me say what I want")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-[24px] p-6 sm:max-w-md">
          <DialogTitle className="font-heading text-xl">{t("先选几个条件", "Pick a few filters")}</DialogTitle>
          <DialogDescription>{t("选完我会写成一句话放进对话框。这只改搜索，不改你已经签过的金额上限。", "I'll turn this into one sentence in the box. It only changes the search, not a cap you already signed.")}</DialogDescription>
          <div className="space-y-3">
            {GUIDE.map((g) => (
              <div key={g.key}>
                <div className="mb-1.5 text-[12px] text-soft">{lang === "zh" ? g.zh : g.en}</div>
                <div className="flex flex-wrap gap-1.5">
                  {g.options.map(([zh, en]) => {
                    const label = lang === "zh" ? zh : en;
                    const on = picked[g.key] === zh;
                    return (
                      <button
                        key={zh}
                        type="button"
                        onClick={() => setPicked((p) => ({ ...p, [g.key]: on ? "" : zh }))}
                        className={cn("rounded-full border px-3 py-1 text-[13px]", on ? "border-violet bg-violet-soft/60 text-violet" : "border-line text-ink/80 hover:border-violet")}
                      >
                        {label}
                      </button>
                    );
                  })}
                  {CUSTOM_KEYS.has(g.key) && (
                    <button
                      type="button"
                      onClick={() => setPicked((p) => ({ ...p, [g.key]: p[g.key] === "自定义" ? "" : "自定义" }))}
                      className={cn("rounded-full border px-3 py-1 text-[13px]", picked[g.key] === "自定义" ? "border-violet bg-violet-soft/60 text-violet" : "border-line text-ink/80 hover:border-violet")}
                    >
                      {t("自定义", "Custom")}
                    </button>
                  )}
                </div>
                {CUSTOM_KEYS.has(g.key) && picked[g.key] === "自定义" && (
                  <input
                    value={custom[g.key] ?? ""}
                    onChange={(e) => setCustom((c) => ({ ...c, [g.key]: e.target.value }))}
                    placeholder={g.key === "budget" ? t("例如 80", "e.g. 80") : t("例如 500ml、3 包", "e.g. 500ml, 3 packs")}
                    className="mt-2 h-9 w-full rounded-xl border border-line bg-white px-3 text-[13px] outline-none focus:border-violet"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("取消", "Cancel")}
            </Button>
            <Button onClick={apply}>{t("写进对话框", "Put it in the box")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function HintBlock() {
  const { t } = useLang();
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <button
        type="button"
        onClick={() => document.getElementById("task-composer")?.focus()}
        className="flex items-center gap-2 rounded-full border border-dashed border-line px-4 py-2 text-[13px] text-soft transition-colors hover:border-violet hover:text-violet"
      >
        <Sparkles className="size-4" />
        {t("没有想要的？详细描述你的需求。", "Not quite right? Describe what you want in more detail.")}
      </button>
      <NeedGuide />
    </div>
  );
}
