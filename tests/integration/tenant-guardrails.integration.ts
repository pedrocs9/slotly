import test from "node:test"
import assert from "node:assert/strict"
import "../../scripts/load-env"

const hasDatabase = Boolean(process.env.DATABASE_URL)

function nextDate() {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + 21)
  while (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

test("tenant guardrails reject cross-tenant resources and keep allowed operations working", { skip: !hasDatabase ? "DATABASE_URL is required" : false }, async () => {
  const dbModule = await import("../../app/db")
  const { sql } = dbModule
  assert.ok(sql)

  const { createManualAppointment } = await import("../../app/lib/manual-appointments")
  const { canAccessProfessional } = await import("../../app/lib/authorization")
  const { zonedDateTimeToUtc, utcDateToDatabaseTimestamp } = await import("../../app/lib/time")

  const suffix = `${Date.now()}`
  const tenantA = (await sql`insert into tenants (name, slug, timezone, active, booking_page_status) values ('Guard A', ${`guard-a-${suffix}`}, 'America/Santiago', true, 'published') returning id`)[0] as { id: string }
  const tenantB = (await sql`insert into tenants (name, slug, timezone, active, booking_page_status) values ('Guard B', ${`guard-b-${suffix}`}, 'America/Santiago', true, 'published') returning id`)[0] as { id: string }

  try {
    const ownerA = { userId: "owner-a", tenantId: tenantA.id, role: "owner" as const, professionalId: null }
    const staffA = { userId: "staff-a", tenantId: tenantA.id, role: "staff" as const, professionalId: "" }

    const professionalA = (await sql`insert into professionals (tenant_id, name, email, role, active) values (${tenantA.id}, 'Pro A', ${`pro-a-${suffix}@slotly.test`}, 'owner', true) returning id`)[0] as { id: string }
    const professionalA2 = (await sql`insert into professionals (tenant_id, name, email, role, active) values (${tenantA.id}, 'Pro A2', ${`pro-a2-${suffix}@slotly.test`}, 'staff', true) returning id`)[0] as { id: string }
    const professionalB = (await sql`insert into professionals (tenant_id, name, email, role, active) values (${tenantB.id}, 'Pro B', ${`pro-b-${suffix}@slotly.test`}, 'owner', true) returning id`)[0] as { id: string }
    staffA.professionalId = professionalA.id

    const serviceA = (await sql`insert into services (tenant_id, name, duration_min, price, active) values (${tenantA.id}, 'Service A', 30, 10000, true) returning id`)[0] as { id: string }
    const serviceB = (await sql`insert into services (tenant_id, name, duration_min, price, active) values (${tenantB.id}, 'Service B', 30, 10000, true) returning id`)[0] as { id: string }
    const customerA = (await sql`insert into customers (tenant_id, name, email, phone) values (${tenantA.id}, 'Customer A', ${`customer-a-${suffix}@slotly.test`}, '+56910000001') returning id`)[0] as { id: string }
    const customerB = (await sql`insert into customers (tenant_id, name, email, phone) values (${tenantB.id}, 'Customer B', ${`customer-b-${suffix}@slotly.test`}, '+56910000002') returning id`)[0] as { id: string }
    await sql`insert into professional_services (tenant_id, professional_id, service_id, active) values (${tenantA.id}, ${professionalA.id}, ${serviceA.id}, true), (${tenantB.id}, ${professionalB.id}, ${serviceB.id}, true)`

    const date = nextDate()
    const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay()
    await sql`insert into availability (professional_id, weekday, start_time, end_time, active) values (${professionalA.id}, ${weekday}, '09:00', '18:00', true)`

    assert.equal(await canAccessProfessional(ownerA, professionalB.id), false)
    assert.equal(await canAccessProfessional(staffA, professionalA2.id), false)
    assert.equal(await canAccessProfessional(staffA, professionalB.id), false)

    const crossProfessional = await createManualAppointment(ownerA, {
      serviceId: serviceA.id,
      professionalId: professionalB.id,
      date,
      time: "10:00",
      clientName: "Cross Pro",
      clientEmail: `cross-pro-${suffix}@slotly.test`,
      clientPhone: "+56910000003",
    })
    assert.equal(crossProfessional.ok, false)
    assert.equal(crossProfessional.status, 404)

    const crossService = await createManualAppointment(ownerA, {
      serviceId: serviceB.id,
      professionalId: professionalA.id,
      date,
      time: "10:00",
      clientName: "Cross Service",
      clientEmail: `cross-service-${suffix}@slotly.test`,
      clientPhone: "+56910000004",
    })
    assert.equal(crossService.ok, false)
    assert.equal(crossService.status, 404)

    const crossCustomer = await createManualAppointment(ownerA, {
      serviceId: serviceA.id,
      professionalId: professionalA.id,
      customerId: customerB.id,
      date,
      time: "10:00",
      clientName: "Cross Customer",
      clientEmail: `cross-customer-${suffix}@slotly.test`,
      clientPhone: "+56910000005",
    })
    assert.equal(crossCustomer.ok, false)
    assert.equal(crossCustomer.status, 404)

    const allowed = await createManualAppointment(ownerA, {
      serviceId: serviceA.id,
      professionalId: professionalA.id,
      customerId: customerA.id,
      date,
      time: "10:30",
      clientName: "Allowed",
      clientEmail: `allowed-${suffix}@slotly.test`,
      clientPhone: "+56910000006",
    })
    assert.equal(allowed.ok, true)

    const startsAt = zonedDateTimeToUtc(date, "11:00", "America/Santiago")
    assert.ok(startsAt)
    const endsAt = new Date(startsAt.getTime() + 30 * 60000)
    await assert.rejects(
      () => sql`
        insert into appointments (
          tenant_id, professional_id, service_id, customer_id, client_name,
          client_phone, client_email, starts_at, ends_at, status, source, booked_by
        )
        values (
          ${tenantA.id}, ${professionalA.id}, ${serviceB.id}, ${customerA.id}, 'Bad FK',
          '+56910000007', ${`bad-fk-${suffix}@slotly.test`}, ${utcDateToDatabaseTimestamp(startsAt)}::timestamp,
          ${utcDateToDatabaseTimestamp(endsAt)}::timestamp, 'pending', 'manual', 'staff'
        )
      `,
    )
  } finally {
    await sql`delete from appointments where tenant_id in (${tenantA.id}, ${tenantB.id})`
    await sql`delete from customers where tenant_id in (${tenantA.id}, ${tenantB.id})`
    await sql`delete from availability_exceptions where tenant_id in (${tenantA.id}, ${tenantB.id})`
    await sql`delete from availability where professional_id in (select id from professionals where tenant_id in (${tenantA.id}, ${tenantB.id}))`
    await sql`delete from professional_services where tenant_id in (${tenantA.id}, ${tenantB.id})`
    await sql`delete from users where tenant_id in (${tenantA.id}, ${tenantB.id})`
    await sql`delete from services where tenant_id in (${tenantA.id}, ${tenantB.id})`
    await sql`delete from professionals where tenant_id in (${tenantA.id}, ${tenantB.id})`
    await sql`delete from tenants where id in (${tenantA.id}, ${tenantB.id})`
  }
})
