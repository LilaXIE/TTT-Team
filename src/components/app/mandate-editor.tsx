"use client";

// 授权编辑器：对话里的草稿卡和 /mandate/new 完整表单共用。
// 右侧（或下方）三种情况的预览直接调用真实引擎，所见即所判。
import { cn } from "cn";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { hkdToMinor } from "@/contracts/money";
import { Input } from "@/components/ui/input";
import { fmtMoney } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { previewDraft } from "@/lib/mock/evaluate";
import { useMock } from "@/lib/mock/store";
import type { Category, DraftFields, MethodId } from "@/lib/mock/types";
import { CATEGORY_LABEL, ruleText } from "@/lib/rule-text";
import { OutcomeChip, ProductThumb } from "./primitives";

export function draftError(f: DraftFields): { zh: string; en: string } | null {
  const per = BigInt(f.perTxnMinor);
  const total = BigInt(f.totalMinor);
  if (per <= 0n) return { zh: "单笔上限要大于 0。", en: "The per-order cap must be above zero." };
  if (total < per) return { zh: "总额度不能小于单笔上限。", en: "The total can't be less than the per-order cap." };
  if (f.categories.length === 0) return { zh: "至少选一个品类。", en: "Pick at least one category." };
  if (f.methods.length === 0) return { zh: "至少选一种支付方式。", en: "Pick at least one payment method." };
  return null;
}

function minorToInput(minor: string): string {
  const n = BigInt(minor);
  const cents = n % 100n;
  return cents === 0n ? (n / 100n).toString() : `${n / 100n}.${cents.toString().padStart(2, "0")}`;
}

function MoneyField({ label, value, onChange, hint }: { label: string; value: string; onChange: (minor: string) => void; hint?: string }) {
  const { t } = useLang();
  const [text, setText] = useState(() => minorToInput(value));
  const [bad, setBad] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] text-soft">{label}</span>
      <div className="relative">
        <Input
          inputMode="decimal"
          value={text}
          aria-invalid={bad}
          className="pr-14 tabular"
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            try {
              const m = hkdToMinor(v);
              if (m < 0n) throw new Error("neg");
              setBad(false);
              onChange(m.toString());
            } catch {
              setBad(true);
            }
          }}
        />
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-soft">$</span>
      </div>
      {bad ? <span className="mt-1 block text-xs text-no">{t("请输入金额，最多两位小数", "Enter an amount, up to 2 decimals")}</span> : hint ? <span className="mt-1 block text-xs text-soft">{hint}</span> : null}
    </label>
  );
}

function Pill({ on, onClick, children, disabled, title }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        on ? "border-violet bg-violet-soft text-violet" : "border-line bg-white text-ink hover:border-soft/50",
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-1.5 text-[13px] text-soft">{label}</div>
      {children}
    </div>
  );
}

const CATS: Category[] = ["household", "supplement", "drinkware", "electronics", "alcohol"];
const DAYS = [1, 3, 7, 14];

export function MandateEditor({ value, onChange, compact }: { value: DraftFields; onChange: (f: DraftFields) => void; compact?: boolean }) {
  const { t, lang } = useLang();
  const s = useMock();
  const [more, setMore] = useState(!compact);
  const f = value;
  const set = (patch: Partial<DraftFields>) => onChange({ ...f, ...patch });
  const setReview = (patch: Partial<DraftFields["reviewWhen"]>) => set({ reviewWhen: { ...f.reviewWhen, ...patch } });
  const curatedCats = f.mode === "curated" ? f.categories.filter((c) => c !== "supplement") : [];
  const err = draftError(f);

  const toggleCat = (c: Category) => {
    const on = f.categories.includes(c);
    set({ categories: on ? f.categories.filter((x) => x !== c) : [...f.categories, c] });
  };
  const toggleMethod = (m: MethodId) => {
    const on = f.methods.includes(m);
    set({ methods: on ? f.methods.filter((x) => x !== m) : [...f.methods, m] });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("买什么", "What to buy")}>
          <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-line bg-canvas/60 px-3.5 py-2 text-sm">
            <span>{f.query[lang]}</span>
            {f.minVolumeMl ? <span className="text-soft">· {t(`至少 ${f.minVolumeMl / 1000}L`, `at least ${f.minVolumeMl / 1000}L`)}</span> : null}
            {f.preferredBrand ? <span className="text-soft">· {t(`常买 ${f.preferredBrand}`, "usual brand set")}</span> : null}
          </div>
        </Field>
        <Field label={t("能换牌子吗", "Other brands?")}>
          <div className="flex flex-wrap gap-2">
            <Pill on={f.allowSubstituteBrand} onClick={() => set({ allowSubstituteBrand: true })}>
              {t("可以，但换了要先问我", "Yes, but ask me first")}
            </Pill>
            <Pill on={!f.allowSubstituteBrand} onClick={() => set({ allowSubstituteBrand: false })}>
              {t("不换", "No")}
            </Pill>
          </div>
        </Field>
        <MoneyField label={t("单笔上限（含运费和手续费）", "Per-order cap (incl. shipping & fees)")} value={f.perTxnMinor} onChange={(v) => set({ perTxnMinor: v })} />
        <MoneyField
          label={t("这次总共最多花", "Total budget")}
          value={f.totalMinor}
          onChange={(v) => set({ totalMinor: v })}
          hint={t("用完就停，剩下的不会被花掉", "Zev stops when it's used up")}
        />
        <Field label={t("最多买几次", "Max purchases")}>
          <div className="inline-flex h-11 items-center rounded-xl border border-line bg-white">
            <button type="button" className="grid size-11 place-items-center text-soft hover:text-ink disabled:opacity-40" disabled={f.maxPurchases <= 1} onClick={() => set({ maxPurchases: f.maxPurchases - 1 })} aria-label={t("减少", "Fewer")}>
              <Minus className="size-4" />
            </button>
            <span className="w-10 text-center tabular">{f.maxPurchases}</span>
            <button type="button" className="grid size-11 place-items-center text-soft hover:text-ink disabled:opacity-40" disabled={f.maxPurchases >= 10} onClick={() => set({ maxPurchases: f.maxPurchases + 1 })} aria-label={t("增加", "More")}>
              <Plus className="size-4" />
            </button>
          </div>
        </Field>
        <Field label={t("有效期", "Valid for")}>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <Pill key={d} on={f.days === d} onClick={() => set({ days: d })}>
                {t(`${d} 天`, `${d} day${d > 1 ? "s" : ""}`)}
              </Pill>
            ))}
          </div>
        </Field>
      </div>

      {compact && (
        <button type="button" onClick={() => setMore((v) => !v)} className="inline-flex items-center gap-1 text-[13px] text-violet">
          <ChevronDown className={cn("size-4 transition-transform", more && "rotate-180")} />
          {more ? t("收起更多条件", "Fewer options") : t("更多条件：品类、先问我、保护级别、支付方式", "More: categories, ask-first, protection, payment")}
        </button>
      )}

      {more && (
        <div className="grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
          <Field label={t("允许的品类", "Allowed categories")}>
            <div className="flex flex-wrap gap-2">
              {CATS.map((c) => {
                const needAge = c === "alcohol" && !s.user.age18;
                return (
                  <Pill key={c} on={f.categories.includes(c)} onClick={() => toggleCat(c)} disabled={needAge} title={needAge ? t("需要先确认已满 18 岁", "Confirm you're 18+ first") : undefined}>
                    {CATEGORY_LABEL[c][lang]}
                    {c === "alcohol" && <span className="text-[11px] text-soft">{t("需满 18 岁", "18+")}</span>}
                  </Pill>
                );
              })}
            </div>
          </Field>
          <Field label={t("这些情况先问我", "Ask me first when")}>
            <div className="flex flex-wrap gap-2">
              <Pill on={f.reviewWhen.nearCapPct !== null} onClick={() => setReview({ nearCapPct: f.reviewWhen.nearCapPct === null ? 95 : null })}>
                {t("接近单笔上限（≥95%）", "Near the cap (≥95%)")}
              </Pill>
              <Pill on={f.reviewWhen.substituteBrand} onClick={() => setReview({ substituteBrand: !f.reviewWhen.substituteBrand })}>
                {t("换了牌子", "Different brand")}
              </Pill>
              <Pill
                on={f.reviewWhen.watchCategories.includes("supplement")}
                onClick={() =>
                  setReview({
                    watchCategories: f.reviewWhen.watchCategories.includes("supplement") ? f.reviewWhen.watchCategories.filter((x) => x !== "supplement") : [...f.reviewWhen.watchCategories, "supplement"],
                  })
                }
              >
                {t("保健品", "Supplements")}
              </Pill>
              {curatedCats.map((c) => (
                <Pill key={c} on onClick={() => undefined} disabled>
                  {t(`${CATEGORY_LABEL[c].zh}（精选，每笔都问）`, `${CATEGORY_LABEL[c].en} (curated, every time)`)}
                </Pill>
              ))}
            </div>
          </Field>
          <Field label={t("保护级别", "Protection")}>
            <div className="flex flex-wrap gap-2">
              <Pill on={f.protection === "standard"} onClick={() => onChange({ ...f, protection: "standard", reviewWhen: { ...f.reviewWhen, newMerchantDays: null, priceAboveRefPct: null } })}>
                {t("标准", "Standard")}
              </Pill>
              <Pill on={f.protection === "enhanced"} onClick={() => onChange({ ...f, protection: "enhanced", reviewWhen: { ...f.reviewWhen, newMerchantDays: 30, priceAboveRefPct: 20 } })}>
                {t("加强：新商家、高于参考价也先问", "Enhanced: also ask for new shops & high prices")}
              </Pill>
            </div>
          </Field>
          <Field label={t("付款方式", "Payment methods")}>
            <div className="flex flex-wrap gap-2">
              <Pill on={f.methods.includes("fps")} onClick={() => toggleMethod("fps")}>
                {t("转数快 FPS", "FPS")}
              </Pill>
              <Pill on={f.methods.includes("tapngo_mc")} onClick={() => toggleMethod("tapngo_mc")}>
                Tap &amp; Go Mastercard
              </Pill>
            </div>
          </Field>
        </div>
      )}

      {err && <p className="text-sm text-no">{err[lang]}</p>}
    </div>
  );
}

/** 三种情况的实时预览：低价熟悉商家 / 高关注类别 / 含运费超上限 */
export function MandatePreview({ fields, className }: { fields: DraftFields; className?: string }) {
  const { t, lang } = useLang();
  const now = useMemo(() => new Date(), []);
  const valid = draftError(fields) === null;
  const rows = useMemo(() => (valid ? previewDraft(fields, now) : []), [fields, now, valid]);
  const titles: Record<string, string> = {
    familiar: t("熟悉商家、价格正常", "Familiar shop, normal price"),
    watch: t("保健品（高关注）", "Supplement (sensitive)"),
    over_cap: t("加上运费超过上限", "Over the cap with shipping"),
  };
  if (!valid) return null;
  return (
    <div className={cn("grid gap-3 sm:grid-cols-3", className)}>
      {rows.map((r) => {
        const m = { ...fields, remainingMinor: fields.totalMinor, minVolumeMl: null };
        return (
          <div key={r.id} className="rounded-2xl border border-line bg-canvas/50 p-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="text-[12px] text-soft">{titles[r.id]}</span>
              <OutcomeChip outcome={r.evaluation.outcome} mode="preview" />
            </div>
            <div className="flex items-center gap-2.5">
              <ProductThumb product={r.product} className="size-10 rounded-xl" />
              <div className="min-w-0">
                <div className="truncate text-[13px]">{r.product.name[lang]}</div>
                <div className="text-[12px] text-soft tabular">
                  {t("含运费", "with shipping")} {fmtMoney(r.evaluation.total, lang)}
                </div>
              </div>
            </div>
            {r.evaluation.rules.length > 0 && (
              <p className="mt-2.5 text-[12px] leading-relaxed text-soft">{ruleText(r.evaluation.rules[0].id, { product: r.product, mandate: m, now }, lang)}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
