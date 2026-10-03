import { requireSession } from "@/server/auth/session";
import { json, route } from "@/server/http";
import { query } from "@/server/db/tx";
import { searchTaobao } from "@/server/taobao";

export const GET = route(async (req: Request) => {
  const session = await requireSession(req);
  const url = new URL(req.url);
  const keyword = (url.searchParams.get("q") || "").trim();
  const count = Math.min(20, Math.max(1, Number(url.searchParams.get("count") || 10)));
  if (!keyword) return json({ keyword: "", items: [], source: "unavailable", message: "请输入商品名称。" }, { status: 400 });
  const result = await searchTaobao(keyword, count, session.id);
  const history = await query<{ id: string }>(
    `INSERT INTO search_history (user_id, keyword, source, result_count) VALUES ($1, $2, $3, $4) RETURNING id`,
    [session.id, keyword, result.source, result.items.length],
  );
  if (result.items.length) {
    await Promise.all(result.items.map((item, index) => query(
      `INSERT INTO search_history_items (search_id, position, item) VALUES ($1, $2, $3)`,
      [history.rows[0].id, index, JSON.stringify(item)],
    )));
  }
  return json(result);
});
