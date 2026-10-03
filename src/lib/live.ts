// 把 Zev 草稿接到真实授权和任务接口。接口失败时调用方继续用模拟数据。
import { api } from "@/lib/api";
import type { DraftFields } from "@/lib/mock/types";

const MANDATE_KEY = "mw.serverMandateId";

export function rememberMandate(id: string) {
  sessionStorage.setItem(MANDATE_KEY, id);
}

function minorToHkd(minor: string): string {
  const v = BigInt(minor);
  return `${v / 100n}.${(v % 100n).toString().padStart(2, "0")}`;
}

export function draftFieldsToApi(fields: DraftFields, taskText: string) {
  const expires = new Date(Date.now() + fields.days * 24 * 60 * 60 * 1000);
  return {
    taskText: taskText.slice(0, 200),
    task: {
      query: fields.query.zh.slice(0, 60),
      qty: 1,
      minSpec: fields.minVolumeMl ? { volumeMl: fields.minVolumeMl } : {},
      allowSubstituteBrand: fields.allowSubstituteBrand,
      preferredBrand: fields.preferredBrand,
    },
    categories: fields.categories,
    merchantDeny: [],
    perTxnHKD: minorToHkd(fields.perTxnMinor),
    totalHKD: minorToHkd(fields.totalMinor),
    maxPurchases: fields.maxPurchases,
    expiresAt: expires.toISOString(),
    reviewWhen: fields.reviewWhen,
    protectionLevel: fields.protection,
    allowedMethods: fields.methods,
  };
}

export async function createServerMandate(fields: DraftFields, taskText: string): Promise<string | null> {
  try {
    const res = await api<{ mandate: { id: string } }>("/api/mandates", {
      method: "POST",
      json: draftFieldsToApi(fields, taskText || fields.title.zh),
    });
    rememberMandate(res.mandate.id);
    return res.mandate.id;
  } catch {
    return null;
  }
}

type MandateRow = { id: string; status: string };

export async function activeServerMandateId(): Promise<string | null> {
  try {
    const res = await api<{ mandates: MandateRow[] }>("/api/mandates");
    const saved = sessionStorage.getItem(MANDATE_KEY);
    const active = res.mandates.filter((m) => m.status === "active");
    return active.find((m) => m.id === saved)?.id ?? active[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function startLiveTask(text: string, mandateId?: string | null): Promise<string | null> {
  const preferred = mandateId && /^[0-9a-f]{8}-/i.test(mandateId) ? mandateId : null;
  const id = preferred ?? (await activeServerMandateId());
  if (!id) return null;
  const res = await api<{ taskId: string }>("/api/tasks", { method: "POST", json: { mandateId: id, text } });
  return res.taskId;
}
