import { and, eq, gt, lt } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "../../../db"
import { availabilityExceptions, professionals } from "../../../db/schema"
import { requirePermission, requireProfessionalAccess } from "../../../lib/authorization"
import { dateRangeDays } from "../../../lib/availability-rules"
import { getExceptionForContext } from "../../../lib/resource-access"
import { requireSessionContext } from "../../../lib/session"
import { zonedDateTimeToUtc } from "../../../lib/time"
import { cleanString, isUuid } from "../../../lib/validation"

export async function GET(req: NextRequest) {
  const context = await requireSessionContext()
  requirePermission(context, "exceptions.read")
  const params = new URL(req.url).searchParams
  const start = cleanString(params.get("start"), 10) || new Date().toISOString().slice(0, 10)
  const end = cleanString(params.get("end"), 10) || start
  const professionalId = params.get("professionalId") ?? undefined
  const startDate = zonedDateTimeToUtc(start, "00:00", "America/Santiago")
  const endDate = zonedDateTimeToUtc(end, "23:59", "America/Santiago")
  if (!startDate || !endDate) return NextResponse.json({ error: "Rango invalido" }, { status: 400 })
  const conditions = [eq(availabilityExceptions.tenant_id, context.tenantId), lt(availabilityExceptions.starts_at, endDate), gt(availabilityExceptions.ends_at, startDate)]
  if (professionalId) {
    if (!isUuid(professionalId)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
    await requireProfessionalAccess(context, professionalId, { activeOnly: true })
    conditions.push(eq(availabilityExceptions.professional_id, professionalId))
  } else if (context.role === "staff" && context.professionalId) {
    conditions.push(eq(availabilityExceptions.professional_id, context.professionalId))
  }
  const rows = await db.query.availabilityExceptions.findMany({
    where: and(...conditions),
    orderBy: (table, { asc }) => [asc(table.starts_at)],
  })
  return NextResponse.json({ exceptions: rows })
}

export async function POST(req: NextRequest) {
  const context = await requireSessionContext()
  requirePermission(context, "exceptions.write")
  const body = await req.json()
  const professionalId = body.professionalId
  const kind = body.kind === "available" ? "available" : "unavailable"
  const startDate = cleanString(body.startDate, 10)
  const endDate = cleanString(body.endDate, 10) || startDate
  const allDay = Boolean(body.allDay)
  const startTime = allDay ? "00:00" : cleanString(body.startTime, 5)
  const endTime = allDay ? "23:59" : cleanString(body.endTime, 5)
  const reason = cleanString(body.reason, 160)

  if (!isUuid(professionalId)) return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  await requireProfessionalAccess(context, professionalId, { activeOnly: true })
  if (dateRangeDays(startDate, endDate) > 90) return NextResponse.json({ error: "El rango no puede superar 90 dias" }, { status: 400 })
  const professional = await db.query.professionals.findFirst({
    where: and(eq(professionals.id, professionalId), eq(professionals.tenant_id, context.tenantId), eq(professionals.active, true)),
  })
  if (!professional) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 })
  const startsAt = zonedDateTimeToUtc(startDate, startTime, "America/Santiago")
  const endsAt = zonedDateTimeToUtc(endDate, endTime, "America/Santiago")
  if (!startsAt || !endsAt || endsAt <= startsAt) return NextResponse.json({ error: "Rango invalido" }, { status: 400 })

  const [created] = await db.insert(availabilityExceptions).values({
    tenant_id: context.tenantId,
    professional_id: professionalId,
    kind,
    reason: reason || (kind === "available" ? "Horario especial" : "Bloqueo"),
    starts_at: startsAt,
    ends_at: endsAt,
    all_day: allDay,
  }).returning()
  return NextResponse.json({ exception: created })
}

export async function DELETE(req: NextRequest) {
  const context = await requireSessionContext()
  requirePermission(context, "exceptions.write")
  const id = new URL(req.url).searchParams.get("id")
  if (!id || !isUuid(id)) return NextResponse.json({ error: "Bloqueo invalido" }, { status: 400 })
  await getExceptionForContext(context, id)
  await db.delete(availabilityExceptions).where(and(eq(availabilityExceptions.id, id), eq(availabilityExceptions.tenant_id, context.tenantId)))
  return NextResponse.json({ ok: true })
}
