"use client";

import { cn } from "cn";
import { ImageIcon, Link2, Plus, Upload, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Chip, Eyebrow, Money, OutcomeChip, Panel, ProductThumb, SimNote } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/lib/i18n";
import { chooseCurated, curatedShortlist, preferenceFit, rankedFor } from "@/lib/mock/agent";
import { merchantOf } from "@/lib/mock/catalog";
import { actions, useMock } from "@/lib/mock/store";
import type { Block, MockTask, Tx } from "@/lib/mock/types";
import { ZevSays } from "./blocks";

type CuratedB = Extract<Block, { kind: "curated" }>;
type ShortlistB = Extract<Block, { kind: "shortlist" }>;

const TAG_LABEL: Record<string, Tx> = {
  minimal: { zh: "极简", en: "Minimal" },
  black: { zh: "黑色", en: "Black" },
  steel: { zh: "不锈钢", en: "Steel" },
  matte: { zh: "哑光", en: "Matte" },
};

/** 演示用：只认两家模拟商家的链接 */
const MOCK_LINKS: Record<string, Tx> = {
  "kuaikuai.mock": { zh: "快快屋 · 极简保温杯 黑 500ml", en: "KuaiKuai · Minimal tumbler, black, 500ml" },
  "ririxian.mock": { zh: "日日鲜 · 哑光保温杯 450ml", en: "RiRiXian · Matte tumbler, 450ml" },
};

export function CuratedBlock({ b, index, task }: { b: CuratedB; index: number; task: MockTask }) {
  const { t, lang } = useLang();
  const s = useMock();
  const [newPref, setNewPref] = useState("");
  const [link, setLink] = useState("");
  const [linkResult, setLinkResult] = useState<{ ok: boolean; text: Tx } | null>(null);
  const [image, setImage] = useState(false);
  const [dragging, setDragging] = useState(false);
  const extraTags = image ? ["black", "matte"] : [];
  const shortlisted = task.blocks.slice(index + 1).some((x) => x.kind === "shortlist");

  const readLink = () => {
    const host = link.replace(/^https?:\/\//, "").split("/")[0];
    const hit = MOCK_LINKS[host];
    setLinkResult(hit ? { ok: true, text: hit } : { ok: false, text: { zh: "原型只读取两家模拟商家的链接（kuaikuai.mock、ririxian.mock）。", en: "The prototype only reads links from the two simulated shops (kuaikuai.mock, ririxian.mock)." } });
  };

  return (
    <ZevSays>
      <Panel className="p-4 sm:p-5">
        <Eyebrow className="mb-3">{t("精选 · 你的偏好", "Curated · Your preferences")}</Eyebrow>
        <div className="flex flex-wrap gap-2">
          {s.prefs.map((p) => (
            <span key={p.id} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-violet-soft pr-1.5 pl-3 text-[13px] text-violet">
              {p.label[lang]}
              <span className="text-[11px] text-violet/60">
                {{ chat: t("对话", "chat"), favorites: t("收藏", "favourites"), orders: t("订单", "orders") }[p.source]}
              </span>
              <button type="button" onClick={() => actions.removePref(p.id)} className="grid size-5 place-items-center rounded-full hover:bg-violet/10" aria-label={t("删除", "Remove")}>
                <X className="size-3" />
              </button>
            </span>
          ))}
          <form
            className="inline-flex"
            onSubmit={(e) => {
              e.preventDefault();
              const v = newPref.trim();
              if (!v) return;
              actions.addPref({ zh: v, en: v });
              setNewPref("");
            }}
          >
            <span className="inline-flex h-8 items-center rounded-full border border-dashed border-line bg-white pr-1 pl-3">
              <input value={newPref} onChange={(e) => setNewPref(e.target.value)} placeholder={t("加一个偏好", "Add a preference")} className="w-28 bg-transparent text-[13px] outline-none placeholder:text-soft" />
              <button type="submit" className="grid size-6 place-items-center rounded-full text-soft hover:text-ink" aria-label={t("添加", "Add")}>
                <Plus className="size-3.5" />
              </button>
            </span>
          </form>
        </div>
        <p className="mt-2.5 text-[12px] text-soft">
          {t("偏好只用于推荐，不参与风控，不对外共享。", "Preferences only shape recommendations. They never affect the rules and are never shared.")}
          {s.prefs.length > 0 && (
            <button type="button" onClick={() => actions.clearPrefs()} className="ml-2 text-violet hover:underline">
              {t("全部清空", "Clear all")}
            </button>
          )}
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            setImage(true);
          }}
          className={cn("mt-5 rounded-2xl border-2 border-dashed p-4 transition-colors", dragging ? "border-violet bg-violet-soft/50" : "border-line bg-canvas/40")}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-white text-soft">
              <Upload className="size-4" />
            </span>
            <div className="min-w-0 flex-1 text-[13px]">
              <div>{t("把喜欢的图片拖进来，或贴一个商品链接", "Drop a photo you like, or paste a product link")}</div>
              <div className="text-soft">{t("图片只用来提取风格标签，不会保存", "Photos are only used to extract style tags and aren't kept")}</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setImage(true)}>
              <ImageIcon />
              {t("用示例图片", "Use sample photo")}
            </Button>
          </div>
          {image && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-white p-2.5">
              <div className="size-12 shrink-0 rounded-lg bg-[#2a2a30]" />
              <div className="min-w-0 flex-1 text-[13px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <SimNote>{t("演示识别结果", "Demo recognition")}</SimNote>
                  {extraTags.map((tag) => (
                    <Chip key={tag} tone="violet">
                      {TAG_LABEL[tag][lang]}
                    </Chip>
                  ))}
                  <Chip tone="violet">{t("圆柱形", "Cylindrical")}</Chip>
                </div>
              </div>
              <button type="button" onClick={() => setImage(false)} className="grid size-7 place-items-center rounded-full text-soft hover:bg-canvas" aria-label={t("移除", "Remove")}>
                <X className="size-3.5" />
              </button>
            </div>
          )}
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              readLink();
            }}
          >
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-soft" />
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://kuaikuai.mock/item/…" className="h-10 pl-10" />
            </div>
            <Button type="submit" variant="outline" size="sm" className="h-10">
              {t("读取", "Read")}
            </Button>
          </form>
          {linkResult && <p className={cn("mt-2 text-[12px]", linkResult.ok ? "text-ink" : "text-no")}>{linkResult.ok ? t(`已读取：${linkResult.text.zh}`, `Read: ${linkResult.text.en}`) : linkResult.text[lang]}</p>}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-canvas/60 p-3 text-[13px]">
          {s.connections.kuaikuaiFavorites ? (
            <span className="inline-flex items-center gap-2">
              <Chip tone="ok">{t("已连接", "Connected")}</Chip>
              {t("快快屋收藏夹（只读）", "KuaiKuai favourites (read-only)")}
            </span>
          ) : (
            <>
              <span>{t("连上快快屋收藏夹，挑得更准", "Connect your KuaiKuai favourites for better picks")}</span>
              <Link href={`/consent/kuaikuai?return=/task/${task.id}`} className="text-violet hover:underline">
                {t("去授权", "Connect")}
              </Link>
            </>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={() => curatedShortlist(task.id, b.mandateId, b.query, extraTags)}>{shortlisted ? t("按新的偏好再挑一次", "Pick again with these") : t("按这些偏好挑 3 件", "Pick 3 with these")}</Button>
          <span className="text-[12px] text-soft">{t("精选模式下，每一笔都要你用通行密钥确认。", "In curated mode, every purchase needs your passkey.")}</span>
        </div>
      </Panel>
    </ZevSays>
  );
}

export function ShortlistBlock({ b, index, task }: { b: ShortlistB; index: number; task: MockTask }) {
  const { t, lang } = useLang();
  const s = useMock();
  const m = s.mandates.find((x) => x.id === b.mandateId);
  const ranked = m ? rankedFor(m.id, m.queryKind) : [];
  const decided = task.blocks.slice(index + 1).some((x) => x.kind === "awaiting");
  return (
    <ZevSays>
      <div className="grid gap-3 sm:grid-cols-3">
        {b.productIds.map((id, i) => {
          const r = ranked.find((x) => x.product.id === id);
          if (!r) return null;
          const fit = preferenceFit(id);
          return (
            <Panel key={id} className="flex flex-col p-3.5">
              <ProductThumb product={r.product} className="h-28 w-full rounded-2xl" />
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[11px] text-soft">{t(`第 ${i + 1} 选`, `Option ${i + 1}`)}</span>
                <OutcomeChip outcome="REVIEW" mode="preview" className="h-5 px-2 text-[11px]" />
              </div>
              <div className="mt-1.5 text-[14px] leading-snug">{r.product.name[lang]}</div>
              <div className="text-[12px] text-soft">{merchantOf(r.product.merchantId).name[lang]}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {fit.length > 0 ? (
                  fit.map((tag) => (
                    <Chip key={tag} tone="violet" className="h-5 px-2 text-[11px]">
                      {TAG_LABEL[tag]?.[lang] ?? tag}
                    </Chip>
                  ))
                ) : (
                  <span className="text-[11px] text-soft">{t("偏好里没有对应项", "No preference match")}</span>
                )}
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                <Money minor={r.evaluation.total} className="text-[15px]" />
                <Button size="sm" variant="outline" disabled={decided || m?.status !== "active"} onClick={() => chooseCurated(task.id, b.mandateId, id)}>
                  {t("选这件", "Choose")}
                </Button>
              </div>
            </Panel>
          );
        })}
      </div>
    </ZevSays>
  );
}
