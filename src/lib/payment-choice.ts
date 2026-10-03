import type { MethodId, Tx } from "@/lib/mock/types";

/**
 * 选付款方式。不拿未核实的手续费去比价。
 * 零钱包里的钱是从 Tap & Go 充进来的，所以零钱包付得起、商家也收 Tap & Go 时用它。
 * 否则用已观测手续费为 0 的 FPS。
 */
export function choosePaymentMethod(opts: {
  allowed: MethodId[];
  accepts: MethodId[];
  pocketCovers: boolean;
}): { id: MethodId; reason: Tx } {
  const ok = (id: MethodId) => opts.allowed.includes(id) && opts.accepts.includes(id);
  if (opts.pocketCovers && ok("tapngo_mc")) {
    return {
      id: "tapngo_mc",
      reason: {
        zh: "这笔从 Agent 零钱包扣。零钱包是从 Tap & Go 充进来的，所以走 Tap & Go，不再从银行账户做一笔 FPS。Tap & Go 的消费手续费没有核实，没有把它当成 0 来和 FPS 比谁更便宜。",
        en: "This comes out of the Agent pocket. The pocket was topped up from Tap & Go, so the payment uses Tap & Go instead of a second FPS transfer from the bank. Tap & Go's spending fee is unverified, and was not treated as zero to beat FPS.",
      },
    };
  }
  if (ok("fps")) {
    return {
      id: "fps",
      reason: {
        zh: "没有用 Tap & Go：零钱包不够，或这家不收，或授权里没允许。改用 FPS。已观测到汇丰个人客户的本地港元 FPS 手续费是 0。",
        en: "Tap & Go was not used: the pocket is short, the shop does not take it, or the mandate does not allow it. FPS is used instead. The observed fee for an HSBC personal local HKD FPS transfer is 0.",
      },
    };
  }
  return {
    id: "tapngo_mc",
    reason: {
      zh: "授权和这家店只允许 Tap & Go。消费手续费仍标为未核实。",
      en: "The mandate and this shop only allow Tap & Go. Its spending fee stays unverified.",
    },
  };
}
