"use client";

import { useLang } from "@/lib/i18n";
import type { MockTask } from "@/lib/mock/types";
import { Chip } from "./primitives";

export function TaskStatusChip({ status }: { status: MockTask["status"] }) {
  const { t } = useLang();
  switch (status) {
    case "completed":
      return <Chip tone="ok">{t("已完成", "Done")}</Chip>;
    case "awaiting_confirmation":
      return <Chip tone="ask">{t("等你确认", "Needs you")}</Chip>;
    case "failed":
      return <Chip tone="no">{t("没有买", "Not bought")}</Chip>;
    case "running":
      return <Chip tone="violet">{t("进行中", "Working")}</Chip>;
    case "drafting":
      return <Chip className="bg-white ring-1 ring-line">{t("起草授权", "Drafting")}</Chip>;
  }
}
