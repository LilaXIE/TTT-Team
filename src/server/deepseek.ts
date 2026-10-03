import { AppError } from "@/contracts/errors";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export async function askDeepSeek(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) return "我已收到你的需求。请先完成淘宝登录，我会根据你的预算和授权规则搜索并推荐商品。";
  const response = await fetch(process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || "deepseek-chat", messages, temperature: 0.3 }),
  });
  if (!response.ok) throw new AppError("INTERNAL", "DeepSeek 服务暂时不可用。", { status: 503, retryable: true });
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() || "暂时没有生成有效回复，请换一种方式描述商品需求。";
}
