import { NextRequest, NextResponse } from "next/server"
import { createManualAppointment } from "../../../lib/manual-appointments"
import { logEvent, requestIdFromHeaders } from "../../../lib/observability"
import { requireSessionContext } from "../../../lib/session"

export async function POST(req: NextRequest) {
  const requestId = await requestIdFromHeaders()
  const context = await requireSessionContext()
  const result = await createManualAppointment(context, await req.json())
  if (!result.ok) {
    logEvent({ event: result.status === 409 ? "manual_appointment_conflict" : "manual_appointment_rejected", severity: "warn", route: "/api/dashboard/manual-appointments", requestId, tenantId: context.tenantId, actorId: context.userId, role: context.role, status: result.status })
    return NextResponse.json({ error: result.error, requestId }, { status: result.status, headers: { "x-request-id": requestId } })
  }
  logEvent({ event: "manual_appointment_created", severity: "info", route: "/api/dashboard/manual-appointments", requestId, tenantId: context.tenantId, actorId: context.userId, role: context.role })
  return NextResponse.json({ ...result, requestId }, { headers: { "x-request-id": requestId } })
}
