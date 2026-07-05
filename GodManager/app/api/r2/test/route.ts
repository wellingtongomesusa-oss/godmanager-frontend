import { NextResponse } from "next/server";
import { r2HealthCheck } from "@/lib/r2";
import { requireSuperAdmin } from "@/lib/requireSuperAdmin";

/**
 * GET /api/r2/test
 *
 * Diagnostic endpoint — checks if R2 is reachable with current credentials.
 * Returns 200 + { ok: true, ... } if connection works.
 * Returns 500 + { ok: false, error: "..." } if it fails.
 *
 * NOTE: This endpoint is for development/admin only. Once verified, you may
 * remove or restrict it.
 */
export async function GET() {
  const gate = await requireSuperAdmin();
  if (gate.error) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  const result = await r2HealthCheck();
  const status = result.ok ? 200 : 500;
  return NextResponse.json(result, { status });
}
