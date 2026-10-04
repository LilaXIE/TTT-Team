"use client";

import { cn } from "cn";
import { Fingerprint } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MandateEditor, MandatePreview, draftError } from "@/components/app/mandate-editor";
import { Eyebrow, PageHeader, Panel } from "@/components/app/primitives";
import { useStepUp } from "@/components/app/step-up";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtMoney } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { createServerMandate } from "@/lib/live";
import { draftFromIntent } from "@/lib/mock/agent";
import { actions, useSessionMode } from "@/lib/mock/store";
import type { DraftFields, QueryKind } from "@/lib/mock/types";

const KINDS: { k: QueryKind; zh: string; en: string }[] = [
  { k: "detergent", zh: "洗衣液", en: "Laundry liquid" },
  { k: "tissue", zh: "纸巾", en: "Tissue" },
  { k: "tumbler", zh: "保温杯", en: "Tumbler" },
];

export default function NewMandatePage() {
  const { t, lang } = useLang();
  const router = useRouter();
  const stepUp = useStepUp();
  const mode = useSessionMode();
  const [fields, setFields] = useState<DraftFields>(() => draftFromIntent({ kind: "detergent", token: null, label: null, curated: false, perTxnMinor: "15000", itemPriceCapMinor: null, minVolumeMl: 2000, allowSubstitute: true }));
  const [key, setKey] = useState(0);
  const err = draftError(fields);

  const reshape = (kind: QueryKind, curated: boolean) => {
    const next = draftFromIntent({ kind, token: null, label: null, curated, perTxnMinor: fields.perTxnMinor, itemPriceCapMinor: fields.itemPriceCapMinor ?? null, minVolumeMl: kind === "detergent" ? fields.minVolumeMl : null, allowSubstitute: fields.allowSubstituteBrand });
    setFields({ ...next, totalMinor: fields.totalMinor, methods: fields.methods, protection: fields.protection });
    setKey((k) => k + 1);
  };

  const sign = async () => {
    const ok = await stepUp({
      title: { zh: "签发授权", en: "Sign mandate" },
      detail: {
        zh: `「${fields.title.zh}」：单笔 ≤ ${fmtMoney(fields.perTxnMinor, "zh")}，总共 ≤ ${fmtMoney(fields.totalMinor, "zh")}，最多 ${fields.maxPurchases} 次，${fields.days} 天内有效。`,
        en: `“${fields.title.en}”: ≤ ${fmtMoney(fields.perTxnMinor, "en")} per order, ≤ ${fmtMoney(fields.totalMinor, "en")} total, up to ${fields.maxPurchases} purchases, ${fields.days} days.`,
      },
    });
    if (!ok) return;
    await createServerMandate(fields, fields.title.zh);
    const id = actions.signMandate(fields, "");
    router.push(`/mandate/${id}`);
  };

  return (
    <>
      <PageHeader eyebrow={t("新建授权", "New mandate")} title={t("给 Zev 划一个范围", "Draw the lines for Zev")} description={t("大多数时候你只要在对话里说一句，Zev 会起草。这里是完整表单，适合提前设好。", "Usually you just tell Zev and it drafts one. This is the full form, for setting one up ahead of time.")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel>
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[13px] text-soft">{t("名称", "Name")}</span>
              <Input value={fields.title[lang]} onChange={(e) => setFields({ ...fields, title: { ...fields.title, [lang]: e.target.value } })} />
            </label>
            <div>
              <div className="mb-1.5 text-[13px] text-soft">{t("模式", "Mode")}</div>
              <div className="inline-flex rounded-full bg-canvas p-1">
                {(
                  [
                    [false, t("极速：范围内直接买", "Quick: buys within limits")],
                    [true, t("精选：每笔都问我", "Curated: ask every time")],
                  ] as const
                ).map(([c, label]) => (
                  <button key={String(c)} type="button" onClick={() => reshape(fields.queryKind, c)} className={cn("h-8 rounded-full px-3 text-[13px]", (fields.mode === "curated") === c ? "bg-white shadow-sm" : "text-soft")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="mb-1.5 text-[13px] text-soft">{t("买什么（原型里可选的三类）", "What (three options in the prototype)")}</div>
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <button
                    key={k.k}
                    type="button"
                    onClick={() => reshape(k.k, fields.mode === "curated")}
                    className={cn("h-8 rounded-full border px-3 text-[13px]", fields.queryKind === k.k ? "border-violet bg-violet-soft text-violet" : "border-line bg-white")}
                  >
                    {k[lang]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <MandateEditor key={key} value={fields} onChange={setFields} />
        </Panel>
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Panel>
            <Eyebrow className="mb-3">{t("签之前，看看它会怎么判", "How it would decide")}</Eyebrow>
            <MandatePreview fields={fields} className="sm:grid-cols-1" />
            <Button className="mt-5 w-full" size="lg" onClick={sign} disabled={err !== null || mode === "attacker"}>
              <Fingerprint />
              {t("用通行密钥签发", "Sign with passkey")}
            </Button>
            <p className="mt-3 text-[12px] leading-relaxed text-soft">{t("签发后立刻生效。之后收紧随时生效；放宽要通行密钥加 24 小时冷静期。", "Takes effect at once. Tightening later is instant; loosening needs your passkey and a 24-hour cooling-off.")}</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
