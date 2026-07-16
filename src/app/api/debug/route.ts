import { NextResponse } from "next/server";
import db from "@/lib/db";

/**
 * GET /api/debug
 * Quick health-check / debug endpoint.
 * Returns basic DB connectivity status and environment info.
 */
export async function GET() {
  try {
    // Simple connectivity probe
    const userCount = await db.user.count();
    return NextResponse.json({
      status: "ok",
      db: "connected",
      userCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err.message },
      { status: 500 }
    );
  }
}
