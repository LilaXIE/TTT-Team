import { requireSession } from "@/server/auth/session";
import { json, route } from "@/server/http";
import { searchTaobao } from "@/server/taobao";

export const GET = route(async (req: Request) => {
  await requireSession(req);
  const url = new URL(req.url);
  const keyword = (url.searchParams.get("q") || "").trim();
  const count = Math.min(20, Math.max(1, Number(url.searchParams.get("count") || 10)));
  if (!keyword) return json({ keyword: "", items: [], source: "unavailable", message: "请输入商品名称。" }, { status: 400 });
  return json(await searchTaobao(keyword, count));
});
