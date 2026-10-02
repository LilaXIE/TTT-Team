import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export type ErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "IDEMPOTENCY_CONFLICT"
  | "PAYMENT_BUSY"
  | "RISK_CONFIRMATION_REQUIRED"
  | "ISSUER_DECLINED"
  | "OUT_OF_STOCK"
  | "INSUFFICIENT_FUNDS"
  | "ORDER_NOT_PENDING"
  | "MANDATE_REVOKED"
  | "MANDATE_EXPIRED"
  | "CAP_TOTAL"
  | "USES_EXHAUSTED"
  | "DECISION_DENY"
  | "INTERNAL";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly correlationId: string;
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    opts: { status?: number; retryable?: boolean; details?: unknown; correlationId?: string } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = opts.status ?? defaultStatus(code);
    this.retryable = opts.retryable ?? false;
    this.details = opts.details;
    this.correlationId = opts.correlationId ?? randomUUID();
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      correlationId: this.correlationId,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}

function defaultStatus(code: ErrorCode): number {
  switch (code) {
    case "AUTH_REQUIRED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "VALIDATION_ERROR":
      return 400;
    case "IDEMPOTENCY_CONFLICT":
      return 409;
    case "PAYMENT_BUSY":
      return 503;
    case "INTERNAL":
      return 500;
    default:
      return 422;
  }
}

export function toResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(err.toJSON(), { status: err.status });
  }
  const e = new AppError("INTERNAL", "Internal error");
  console.error(`[${e.correlationId}]`, err);
  return NextResponse.json(e.toJSON(), { status: 500 });
}
