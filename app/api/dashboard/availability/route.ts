import { and, eq, inArray } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db, sql } from "../../../db"
import { availability, professionals } from "../../../db/schema"
import { requirePermission, requireProfessionalAccess } from "../../../lib/authorization"
import { validateTimeBlocks, type TimeBlockInput } from "../../../lib/availability-rules"
import { requireSessionContext } from "../../../lib/session"
import { isUuid } from "../../../lib/validation"

export async function GET(req: NextRequest) {
  const context = await requireSessionContext()
  requirePermission(context, "availability.read")
  const professionalId = new URL(req.url).searchParams.get("professionalId") ?? context.professionalId
  if (!professionalId || !isUuid(professionalId)) {
    return NextResponse.json({ error: "Profesional invalido" }, { status: 403 })
  }
  await requireProfessionalAccess(context, professionalId, { activeOnly: true })
  const professional = await db.query.professionals.findFirst({
    where: and(eq(professionals.id, professionalId), eq(professionals.tenant_id, context.tenantId), eq(professionals.active, true)),
  })
  if (!professional) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 })
  const blocks = await db.query.availability.findMany({
    where: eq(availability.professional_id, professionalId),
    orderBy: (table, { asc }) => [asc(table.weekday), asc(table.start_time)],
  })
  return NextResponse.json({ blocks, professional })
}

export async function PUT(req: NextRequest) {
  const context = await requireSessionContext()
  try {
    requirePermission(context, "availability.write")
  } catch {
    return NextResponse.json({ error: "Staff no puede editar horarios estructurales" }, { status: 403 })
  }
  const body = await req.json()
  const professionalId = body.professionalId
  const weekday = Number(body.weekday)
  const blocks = Array.isArray(body.blocks) ? body.blocks as TimeBlockInput[] : []
  const closed = Boolean(body.closed)

  if (!isUuid(professionalId) || weekday < 0 || weekday > 6) {
    return NextResponse.json({ error: "Sin permisos para modificar este horario" }, { status: 403 })
  }
  await requireProfessionalAccess(context, professionalId, { activeOnly: true })

  const professional = await db.query.professionals.findFirst({
    where: and(eq(professionals.id, professionalId), eq(professionals.tenant_id, context.tenantId), eq(professionals.active, true)),
  })
  if (!professional) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 })

  const dayBlocks = closed ? [] : blocks.map((block) => ({ ...block, weekday, active: true }))
  const errors = validateTimeBlocks(dayBlocks)
  if (errors.length) return NextResponse.json({ error: errors[0] }, { status: 400 })
  if (!sql) return NextResponse.json({ error: "Base de datos no disponible" }, { status: 500 })

  try {
    const blocksJson = JSON.stringify(dayBlocks.map((block) => ({ startTime: block.startTime, endTime: block.endTime })))
    await sql`
      WITH disabled AS (
        UPDATE availability
        SET active = false
        WHERE professional_id = ${professionalId} AND weekday = ${weekday}
      ),
      requested_blocks AS (
        SELECT * FROM jsonb_to_recordset(${blocksJson}::jsonb) AS block("startTime" text, "endTime" text)
      ),
      inserted AS (
        INSERT INTO availability (professional_id, weekday, start_time, end_time, active)
        SELECT ${professionalId}, ${weekday}, "startTime"::time, "endTime"::time, true
        FROM requested_blocks
        WHERE ${closed} = false
        ON CONFLICT (professional_id, weekday, start_time, end_time)
        DO UPDATE SET active = true
      )
      SELECT 1
    `
  } catch (error) {
    throw error
  }

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const context = await requireSessionContext()
  try {
    requirePermission(context, "availability.write")
  } catch {
    return NextResponse.json({ error: "Solo owner puede copiar horarios" }, { status: 403 })
  }
  const body = await req.json()
  const sourceProfessionalId = body.sourceProfessionalId
  const targetProfessionalId = body.targetProfessionalId
  const sourceWeekday = Number(body.sourceWeekday)
  const targetWeekdays = Array.isArray(body.targetWeekdays) ? body.targetWeekdays.map(Number).filter((day: number) => day >= 0 && day <= 6) : []

  if (!isUuid(sourceProfessionalId) || !isUuid(targetProfessionalId) || sourceWeekday < 0 || sourceWeekday > 6 || !targetWeekdays.length || !sql) {
    return NextResponse.json({ error: "Datos de copia invalidos" }, { status: 400 })
  }

  const validProfessionals = await db.query.professionals.findMany({
    where: and(eq(professionals.tenant_id, context.tenantId), inArray(professionals.id, [sourceProfessionalId, targetProfessionalId])),
  })
  if (validProfessionals.length < 2 && sourceProfessionalId !== targetProfessionalId) {
    return NextResponse.json({ error: "Profesional fuera del tenant" }, { status: 403 })
  }

  try {
    const targetWeekdaysJson = JSON.stringify(targetWeekdays)
    await sql`
      WITH target_days AS (
        SELECT value::int AS weekday FROM jsonb_array_elements_text(${targetWeekdaysJson}::jsonb)
      ),
      source_blocks AS (
        SELECT start_time, end_time
        FROM availability
        WHERE professional_id=${sourceProfessionalId} AND weekday=${sourceWeekday} AND active=true
      ),
      disabled AS (
        UPDATE availability
        SET active=false
        WHERE professional_id=${targetProfessionalId}
          AND weekday IN (SELECT weekday FROM target_days)
      ),
      inserted AS (
        INSERT INTO availability (professional_id, weekday, start_time, end_time, active)
        SELECT ${targetProfessionalId}, target_days.weekday, source_blocks.start_time, source_blocks.end_time, true
        FROM target_days
        CROSS JOIN source_blocks
        ON CONFLICT (professional_id, weekday, start_time, end_time)
        DO UPDATE SET active=true
      )
      SELECT 1
    `
  } catch (error) {
    throw error
  }

  return NextResponse.json({ ok: true })
}
