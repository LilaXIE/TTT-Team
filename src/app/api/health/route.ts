import { NextResponse } from "next/server";
import { getPool } from "@/server/db/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  if (process.env.DATABASE_URL) {
    try {
      await getPool().query("SELECT 1");
      db = true;
    } catch {
      db = false;
    }
  }
  return NextResponse.json({ ok: true, db, demoMode: process.env.DEMO_MODE === "true" });
}
