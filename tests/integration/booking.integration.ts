import test from "node:test"
import assert from "node:assert/strict"
import "../../scripts/load-env"

const hasDatabase = Boolean(process.env.DATABASE_URL)

function unwrapModule<T>(mod: T): T {
  const candidate = mod as T & { default?: T }
  return candidate.default ?? mod
}

function nextBookableDate(offsetDays: number) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  while (date.getDay() === 0) date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

test("booking integrity against PostgreSQL", { skip: !hasDatabase ? "DATABASE_URL is required" : false }, async () => {
  const bookingModule = await import("../../app/lib/booking")
  const { createPublicAppointment, getAvailableSlots } = unwrapModule(bookingModule)
  const timeModule = await import("../../app/lib/time")
  const { utcDateToDatabaseTimestamp } = unwrapModule(timeModule)
  const dbModule = await import("../../app/db")
  const { db, sql } = unwrapModule(dbModule)
  const { eq, and } = await import("drizzle-orm")
  const schemaModule = await import("../../app/db/schema")
  const schema = unwrapModule(schemaModule)

  assert.ok(sql, "sql client is required")

  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.slug, "podologia-silvana"),
  })
  assert.ok(tenant)

  const assignment = await db.query.professionalServices.findFirst({
    where: and(eq(schema.professionalServices.tenant_id, tenant.id), eq(schema.professionalServices.active, true)),
  })
  assert.ok(assignment)

  const service = await db.query.services.findFirst({
    where: and(eq(schema.services.id, assignment.service_id), eq(schema.services.active, true)),
  })
  assert.ok(service)

  const professional = await db.query.professionals.findFirst({
    where: and(eq(schema.professionals.id, assignment.professional_id), eq(schema.professionals.active, true)),
  })
  assert.ok(professional)

  let date = nextBookableDate(20)
  let slots = [] as Awaited<ReturnType<typeof getAvailableSlots>>
  for (let offset = 20; offset < 43 && slots.length === 0; offset++) {
    date = nextBookableDate(offset)
    slots = await getAvailableSlots({
      tenantId: tenant.id,
      serviceId: service.id,
      professionalId: professional.id,
      date,
    })
  }
  assert.ok(slots.length > 0, "expected generated slots")

  const firstSlot = slots.find((slot) => slot.label >= "10:00") ?? slots[0]
  const concurrentInput = {
    slug: tenant.slug,
    serviceId: service.id,
    professionalId: professional.id,
    date,
    time: firstSlot.label,
    clientName: "Cliente Concurrencia",
    clientPhone: "+56911111111",
    clientEmail: "concurrencia@example.com",
  }

  const concurrentResults = await Promise.all([
    createPublicAppointment(concurrentInput),
    createPublicAppointment({ ...concurrentInput, clientPhone: "+56922222222" }),
  ])

  const created = concurrentResults.filter((result) => result.ok)
  const rejected = concurrentResults.filter((result) => !result.ok)

  assert.equal(created.length, 1)
  assert.equal(rejected.length, 1)
  assert.equal(rejected[0].status, 409)

  const activeAtSlot = await sql`
    SELECT count(*)::int AS count
    FROM appointments
    WHERE professional_id = ${professional.id}
      AND starts_at = ${utcDateToDatabaseTimestamp(firstSlot.startsAt)}::timestamp
      AND status IN ('pending', 'confirmed')
  `
  assert.equal(Number(activeAtSlot[0].count), 1)

  await sql`
    UPDATE appointments
    SET status = 'cancelled'
    WHERE id = ${(created[0] as { appointment: { id: string } }).appointment.id}
  `

  const retry = await createPublicAppointment({
    ...concurrentInput,
    clientName: "Cliente Reintento",
    clientPhone: "+56933333333",
    clientEmail: "reintento@example.com",
  })
  assert.equal(retry.ok, true)

  const consecutive = slots.find((slot) => slot.startsAt.getTime() === firstSlot.endsAt.getTime())
  if (consecutive) {
    const consecutiveResult = await createPublicAppointment({
      ...concurrentInput,
      time: consecutive.label,
      clientName: "Cliente Consecutivo",
      clientPhone: "+56944444444",
      clientEmail: "consecutivo@example.com",
    })
    assert.equal(consecutiveResult.ok, true)
  }

  const otherTenant = await db.insert(schema.tenants).values({
    name: "Tenant Isolation Test",
    slug: `tenant-isolation-${Date.now()}`,
    timezone: "America/Santiago",
    active: true,
  }).returning()

  const crossTenantAttempt = await createPublicAppointment({
    slug: otherTenant[0].slug,
    serviceId: service.id,
    professionalId: professional.id,
    date,
    time: firstSlot.label,
    clientName: "Cliente Cruzado",
    clientPhone: "+56955555555",
    clientEmail: "cruzado@example.com",
  })
  assert.equal(crossTenantAttempt.ok, false)
  assert.equal(crossTenantAttempt.status, 404)
})
