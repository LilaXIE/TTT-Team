import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    try {
      await pool.query("SELECT 1");
      db = true;
    } catch {
      db = false;
    } finally {
      await pool.end();
    }
  }
  return NextResponse.json({ ok: true, db, demoMode: process.env.DEMO_MODE === "true" });
}
