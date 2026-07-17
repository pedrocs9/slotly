import { and, eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "../../../db"
import { professionalServices, professionals, services } from "../../../db/schema"
import { requirePermission } from "../../../lib/authorization"
import { requireSessionContext } from "../../../lib/session"

export async function GET() {
  const context = await requireSessionContext()
  requirePermission(context, "appointments.create")
  const serviceRows = await db.query.services.findMany({
    where: and(eq(services.tenant_id, context.tenantId), eq(services.active, true)),
  })
  const professionalRows = await db.query.professionals.findMany({
    where: context.role === "staff" && context.professionalId
      ? and(eq(professionals.tenant_id, context.tenantId), eq(professionals.id, context.professionalId), eq(professionals.active, true))
      : and(eq(professionals.tenant_id, context.tenantId), eq(professionals.active, true)),
  })
  const assignments = professionalRows.length
    ? await db.query.professionalServices.findMany({
      where: and(eq(professionalServices.tenant_id, context.tenantId), eq(professionalServices.active, true), inArray(professionalServices.professional_id, professionalRows.map((item) => item.id))),
    })
    : []
  return NextResponse.json({ services: serviceRows, professionals: professionalRows, assignments })
}
