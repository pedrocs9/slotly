import test from "node:test"
import assert from "node:assert/strict"
import "../../scripts/load-env"

const hasDatabase = Boolean(process.env.DATABASE_URL)

function unwrapModule<T>(mod: T): T {
  const candidate = mod as T & { default?: T }
  return candidate.default ?? mod
}

test("private agenda respects tenant role scope", { skip: !hasDatabase ? "DATABASE_URL is required" : false }, async () => {
  const agendaModule = await import("../../app/lib/private-appointments")
  const { dashboardStats, listAppointmentsForContext } = unwrapModule(agendaModule)
  const dbModule = await import("../../app/db")
  const { db } = unwrapModule(dbModule)
  const { eq, and } = await import("drizzle-orm")
  const schemaModule = await import("../../app/db/schema")
  const schema = unwrapModule(schemaModule)

  const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, "podologia-silvana") })
  assert.ok(tenant)

  const ownerUser = await db.query.users.findFirst({
    where: and(eq(schema.users.tenant_id, tenant.id), eq(schema.users.role, "owner")),
  })
  const staffUser = await db.query.users.findFirst({
    where: and(eq(schema.users.tenant_id, tenant.id), eq(schema.users.role, "staff")),
  })
  assert.ok(ownerUser)
  assert.ok(staffUser?.professional_id)

  const start = new Date()
  start.setUTCDate(start.getUTCDate() - 1)
  const end = new Date()
  end.setUTCDate(end.getUTCDate() + 31)

  const ownerContext = {
    userId: ownerUser.id,
    tenantId: tenant.id,
    role: "owner" as const,
    professionalId: ownerUser.professional_id,
  }
  const staffContext = {
    userId: staffUser.id,
    tenantId: tenant.id,
    role: "staff" as const,
    professionalId: staffUser.professional_id,
  }

  const ownerRows = await listAppointmentsForContext(ownerContext, { start, end })
  const staffRows = await listAppointmentsForContext(staffContext, { start, end })
  assert.ok(ownerRows.length >= staffRows.length)
  assert.equal(staffRows.every((row) => row.professionalId === staffUser.professional_id), true)

  const blockedCrossProfessional = ownerRows.find((row) => row.professionalId !== staffUser.professional_id)
  if (blockedCrossProfessional) {
    const crossRows = await listAppointmentsForContext(staffContext, {
      start,
      end,
      professionalId: blockedCrossProfessional.professionalId,
    })
    assert.equal(crossRows.length, 0)
  }

  const stats = await dashboardStats(ownerContext, start, end)
  assert.ok(stats.upcoming >= 0)
  assert.ok(stats.activeServices > 0)
  assert.ok(stats.activeProfessionals > 0)
})
