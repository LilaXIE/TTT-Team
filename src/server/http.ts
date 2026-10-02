// Route Handler 公共辅助：统一错误响应、JSON 读取（bigint 安全）。
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, toResponse } from "@/contracts/errors";
import { serializeBigints } from "@/contracts/money";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(serializeBigints(data), init);
}

export function handleError(e: unknown): NextResponse {
  if (e instanceof AppError) {
    const { status, body } = toResponse(e);
    return NextResponse.json(body, { status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "输入格式不正确。", details: e.issues } },
      { status: 400 },
    );
  }
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  return NextResponse.json({ error: { code: "INTERNAL", message: "服务器错误，请稍后再试。" } }, { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "请求体必须是 JSON。", { status: 400 });
  }
}

/** 包装 handler：捕获错误并统一响应 */
export function route<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      return handleError(e);
    }
  };
}
