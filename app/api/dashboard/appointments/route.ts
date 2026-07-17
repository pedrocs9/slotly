import { and, eq, gt, lt } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "../../../db"
import { appointments, availabilityExceptions } from "../../../db/schema"
import { appointmentStatuses, canTransition, type AppointmentStatus } from "../../../lib/appointment-status"
import { requirePermission } from "../../../lib/authorization"
import { logEvent, requestIdFromHeaders } from "../../../lib/observability"
import { getAppointmentForContext, listAppointmentsForContext } from "../../../lib/private-appointments"
import { requireSessionContext } from "../../../lib/session"
import { cleanString, isUuid } from "../../../lib/validation"

const maxRangeDays = 31

function parseDateParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(req: NextRequest) {
  const context = await requireSessionContext()
  requirePermission(context, "appointments.read")
  const { searchParams } = new URL(req.url)
  const start = parseDateParam(searchParams.get("start"))
  const end = parseDateParam(searchParams.get("end"))
  const professionalId = searchParams.get("professionalId") ?? undefined
  const rawStatus = searchParams.get("status")
  const status = rawStatus && appointmentStatuses.includes(rawStatus as AppointmentStatus)
    ? rawStatus as AppointmentStatus
    : undefined

  if (!start || !end || end <= start) {
    return NextResponse.json({ error: "Rango invalido" }, { status: 400 })
  }

  const rangeDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  if (rangeDays > maxRangeDays) {
    return NextResponse.json({ error: "El rango no puede superar 31 dias" }, { status: 400 })
  }

  if (professionalId && !isUuid(professionalId)) {
    return NextResponse.json({ error: "Profesional invalido" }, { status: 400 })
  }

  const rows = await listAppointmentsForContext(context, { start, end, professionalId, status })
  const blockConditions = [
    eq(availabilityExceptions.tenant_id, context.tenantId),
    lt(availabilityExceptions.starts_at, end),
    gt(availabilityExceptions.ends_at, start),
  ]
  if (professionalId) blockConditions.push(eq(availabilityExceptions.professional_id, professionalId))
  if (context.role === "staff" && context.professionalId) blockConditions.push(eq(availabilityExceptions.professional_id, context.professionalId))
  const blocks = await db.query.availabilityExceptions.findMany({ where: and(...blockConditions) })
  return NextResponse.json({ appointments: rows, blocks })
}

export async function PATCH(req: NextRequest) {
  const requestId = await requestIdFromHeaders()
  const context = await requireSessionContext()
  requirePermission(context, "appointments.update")
  const body = await req.json()
  const appointmentId = body.appointmentId
  const nextStatus = cleanString(body.status, 20) as AppointmentStatus
  const cancellationReason = cleanString(body.cancellationReason, 240)

  if (!isUuid(appointmentId)) return NextResponse.json({ error: "Cita invalida" }, { status: 400 })
  if (!appointmentStatuses.includes(nextStatus)) {
    return NextResponse.json({ error: "Estado invalido" }, { status: 400 })
  }

  const appointment = await getAppointmentForContext(context, appointmentId)
  if (!appointment) return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 })

  if (!canTransition(appointment.status as AppointmentStatus, nextStatus)) {
    return NextResponse.json({ error: "Transicion de estado no permitida" }, { status: 400 })
  }

  await db.update(appointments)
    .set({
      status: nextStatus,
      cancellation_reason: nextStatus === "cancelled" ? cancellationReason || null : appointment.cancellationReason,
      updated_at: new Date(),
    })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.tenant_id, context.tenantId)))

  logEvent({ event: "appointment_status_changed", severity: "info", route: "/api/dashboard/appointments", requestId, tenantId: context.tenantId, actorId: context.userId, role: context.role, metadata: { from: appointment.status, to: nextStatus } })
  return NextResponse.json({ ok: true, requestId }, { headers: { "x-request-id": requestId } })
}
