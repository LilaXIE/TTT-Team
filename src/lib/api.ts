// 浏览器端 fetch 封装：统一错误形状 { code, message }。
export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const headers = new Headers(init?.headers);
  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(path, { ...init, headers, body, credentials: "same-origin" });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const e = (data as { code?: string; message?: string; details?: unknown; error?: { code?: string; message?: string; details?: unknown } }) ?? {};
    const err = e.error ?? e;
    // 401 由调用方处理（页面级 getSession 已 redirect；客户端组件收到 AUTH_REQUIRED 后 router.replace("/login")）
    throw new ApiError(res.status, err.code ?? "UNKNOWN", err.message ?? "请求失败", err.details);
  }
  return data as T;
}
