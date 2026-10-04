import { z } from "zod";
import { requireSession } from "@/server/auth/session";
import { query, withTransaction } from "@/server/db/tx";
import { json, readJson, route } from "@/server/http";

const Address = z.object({ id: z.string().uuid().optional(), name: z.string().min(1).max(80), phone: z.string().min(5).max(30), address: z.string().min(3).max(300), isDefault: z.boolean().default(false) });
const Card = z.object({ id: z.string().uuid().optional(), bankName: z.string().min(1).max(80), cardType: z.enum(["储蓄卡", "信用卡"]), lastFour: z.string().regex(/^\d{4}$/), balanceMinor: z.string().regex(/^\d+$/).default("0") });
const Body = z.object({ action: z.enum(["saveAddress", "deleteAddress", "saveCard", "deleteCard"]), address: Address.optional(), addressId: z.string().uuid().optional(), card: Card.optional(), cardId: z.string().uuid().optional() });

export const GET = route(async (req: Request) => {
  const user = await requireSession(req);
  const [addresses, cards] = await Promise.all([
    query("SELECT id, recipient_name AS name, phone, address, is_default AS \"isDefault\" FROM user_addresses WHERE user_id=$1 ORDER BY is_default DESC, created_at DESC", [user.id]),
    query("SELECT id, bank_name AS \"bankName\", card_type AS \"cardType\", last_four AS \"lastFour\", balance_minor AS \"balanceMinor\", verified FROM user_bank_cards WHERE user_id=$1 ORDER BY created_at DESC", [user.id]),
  ]);
  return json({ addresses: addresses.rows, cards: cards.rows });
});

export const POST = route(async (req: Request) => {
  const user = await requireSession(req);
  const body = Body.parse(await readJson(req));
  if (body.action === "saveAddress") {
    return json(
      { error: { code: "NOT_APPLIED", message: "新地址不会直接写入。冷静期只在演示页面里，服务端没有待生效地址，也不能把它当成已经接上的防盗控制。" } },
      { status: 409 },
    );
  }
  await withTransaction(async (tx) => {
    if (body.action === "deleteAddress" && body.addressId) await tx.query("DELETE FROM user_addresses WHERE id=$1 AND user_id=$2", [body.addressId, user.id]);
    else if (body.action === "saveCard" && body.card) {
      const c = body.card;
      if (c.id) await tx.query("UPDATE user_bank_cards SET bank_name=$1, card_type=$2, last_four=$3, balance_minor=$4, updated_at=now() WHERE id=$5 AND user_id=$6", [c.bankName, c.cardType, c.lastFour, c.balanceMinor, c.id, user.id]);
      else await tx.query("INSERT INTO user_bank_cards (user_id, bank_name, card_type, last_four, balance_minor) VALUES ($1,$2,$3,$4,$5)", [user.id, c.bankName, c.cardType, c.lastFour, c.balanceMinor]);
    } else if (body.action === "deleteCard" && body.cardId) await tx.query("DELETE FROM user_bank_cards WHERE id=$1 AND user_id=$2", [body.cardId, user.id]);
  });
  return json({ ok: true });
});
