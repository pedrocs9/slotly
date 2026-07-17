import { NextResponse } from "next/server"
import { sql } from "../../db"
import { logEvent, requestIdFromHeaders } from "../../lib/observability"

export async function GET(req: Request) {
  const requestId = await requestIdFromHeaders()
  const startedAt = Date.now()
  const release = process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version || "local"
  const detailAllowed = process.env.HEALTHCHECK_TOKEN && req.headers.get("authorization") === `Bearer ${process.env.HEALTHCHECK_TOKEN}`

  if (!sql) {
    logEvent({ event: "health_db_unavailable", severity: "error", route: "/api/health", requestId })
    return NextResponse.json({ status: "degraded", timestamp: new Date().toISOString(), release, requestId }, { status: 503, headers: { "x-request-id": requestId } })
  }

  try {
    const [dbResult, extResult, constraintResult] = await Promise.all([
      sql`select 1 as ok`,
      sql`select extname from pg_extension where extname = 'btree_gist'`,
      sql`select conname from pg_constraint where conname = 'appointments_no_active_overlap'`,
    ])
    const ready = Boolean(dbResult[0]?.ok) && extResult.length === 1 && constraintResult.length === 1
    const body = {
      status: ready ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      release,
      requestId,
      ...(detailAllowed ? {
        dbReachable: Boolean(dbResult[0]?.ok),
        btreeGist: extResult.length === 1,
        overlapConstraint: constraintResult.length === 1,
      } : {}),
    }
    logEvent({ event: "health_check", severity: ready ? "info" : "warn", route: "/api/health", requestId, durationMs: Date.now() - startedAt })
    return NextResponse.json(body, { status: ready ? 200 : 503, headers: { "x-request-id": requestId } })
  } catch (error) {
    logEvent({ event: "health_check_error", severity: "error", route: "/api/health", requestId, code: error instanceof Error ? error.name : "unknown" })
    return NextResponse.json({ status: "degraded", timestamp: new Date().toISOString(), release, requestId }, { status: 503, headers: { "x-request-id": requestId } })
  }
}
