"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { PageHeader, Panel, PanelTitle } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/lib/i18n";
import { actions, useMock, useSessionMode } from "@/lib/mock/store";
import type { PrefTag } from "@/lib/mock/types";
import { BackToMe } from "../back-link";

export default function PreferencesPage() {
  const { t, lang } = useLang();
  const s = useMock();
  const mode = useSessionMode();
  const [text, setText] = useState("");
  const groups: { src: PrefTag["source"]; title: string }[] = [
    { src: "chat", title: t("你在对话里说的", "From your chats") },
    { src: "orders", title: t("从订单里看出来的", "From your orders") },
    { src: "favorites", title: t("来自快快屋收藏夹", "From KuaiKuai favourites") },
  ];
  return (
    <>
      <BackToMe />
      <PageHeader eyebrow={t("偏好", "Preferences")} title={t("Zev 记住的口味", "What Zev remembers")} description={t("偏好只用于推荐，不参与风控，不对外共享。随时可以删。", "Preferences only shape recommendations. They never affect the rules and are never shared. Delete anytime.")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {groups.map((g) => {
            const list = s.prefs.filter((p) => p.source === g.src);
            return (
              <Panel key={g.src}>
                <PanelTitle>{g.title}</PanelTitle>
                {list.length === 0 ? (
                  <p className="text-[13px] text-soft">{t("暂无", "None")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {list.map((p) => (
                      <span key={p.id} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-violet-soft pr-1.5 pl-3.5 text-[14px] text-violet">
                        {p.label[lang]}
                        <button type="button" onClick={() => actions.removePref(p.id)} disabled={mode === "attacker"} className="grid size-6 place-items-center rounded-full hover:bg-violet/10" aria-label={t("删除", "Remove")}>
                          <X className="size-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
        <div className="space-y-4">
          <Panel>
            <PanelTitle>{t("加一条", "Add one")}</PanelTitle>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = text.trim();
                if (!v) return;
                actions.addPref({ zh: v, en: v });
                setText("");
              }}
            >
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("比如：不要香味太重的", "e.g. not heavily scented")} />
              <Button type="submit" size="icon" disabled={!text.trim() || mode === "attacker"} aria-label={t("添加", "Add")}>
                <Plus />
              </Button>
            </form>
          </Panel>
          <Button variant="outline" className="w-full" onClick={() => actions.clearPrefs()} disabled={s.prefs.length === 0 || mode === "attacker"}>
            {t("全部清空", "Clear everything")}
          </Button>
        </div>
      </div>
    </>
  );
}
