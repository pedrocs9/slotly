import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "../../../db"
import { professionals } from "../../../db/schema"
import { requirePermission } from "../../../lib/authorization"
import { requireSessionContext } from "../../../lib/session"

export async function GET() {
  const context = await requireSessionContext()
  requirePermission(context, "professionals.read")
  const rows = await db.query.professionals.findMany({
    where: context.role === "staff" && context.professionalId
      ? and(eq(professionals.tenant_id, context.tenantId), eq(professionals.id, context.professionalId), eq(professionals.active, true))
      : and(eq(professionals.tenant_id, context.tenantId), eq(professionals.active, true)),
  })

  return NextResponse.json({
    professionals: rows.map((professional) => ({
      id: professional.id,
      name: professional.name,
      role: professional.role,
    })),
  })
}
