import { neon } from "@neondatabase/serverless"
import bcrypt from "bcryptjs"
import { assertDevelopmentDatabase, requireDatabaseUrl } from "./load-env"

assertDevelopmentDatabase()
if (!process.argv.includes("--allow-test-data-reset")) {
  console.error("Refusing to reset E2E data without --allow-test-data-reset")
  process.exit(1)
}

const sql = neon(requireDatabaseUrl("prepare e2e fixtures"))
const slug = process.env.E2E_TENANT_SLUG || "slotly-e2e"
const ownerEmail = process.env.E2E_OWNER_EMAIL || "owner@slotly-e2e.test"
const staffEmail = process.env.E2E_STAFF_EMAIL || "staff@slotly-e2e.test"
const password = process.env.E2E_PASSWORD || "SlotlyE2E2026!"

async function cleanup() {
  const tenants = await sql`select id from tenants where slug = ${slug}`
  for (const tenant of tenants as Array<{ id: string }>) {
    await sql`delete from appointments where tenant_id = ${tenant.id}`
    await sql`delete from customers where tenant_id = ${tenant.id}`
    await sql`delete from availability_exceptions where tenant_id = ${tenant.id}`
    await sql`delete from availability where professional_id in (select id from professionals where tenant_id = ${tenant.id})`
    await sql`delete from professional_services where tenant_id = ${tenant.id}`
    await sql`delete from users where tenant_id = ${tenant.id}`
    await sql`delete from tenant_modules where tenant_id = ${tenant.id}`
    await sql`delete from services where tenant_id = ${tenant.id}`
    await sql`delete from professionals where tenant_id = ${tenant.id}`
    await sql`delete from tenants where id = ${tenant.id}`
  }
}

async function main() {
  await cleanup()
  const passwordHash = await bcrypt.hash(password, 12)
  const [tenant] = await sql`
    insert into tenants (
      name, slug, plan, timezone, phone, email, address, description, active, status,
      booking_min_notice_min, booking_horizon_days, slot_interval_min, auto_confirm_appointments,
      cancellation_policy, booking_page_status, brand_color, post_booking_instructions
    )
    values (
      'Slotly E2E Studio', ${slug}, 'pro', 'America/Santiago', '+56 9 1000 0000',
      'contacto@slotly-e2e.test', 'Av. Test 123, Santiago', 'Negocio ficticio para pruebas E2E.',
      true, 'private_beta', 0, 30, 30, false, 'Cancela contactando al negocio.',
      'published', '#5b6ee1', 'Mensaje ficticio posterior a la reserva.'
    )
    returning id
  ` as Array<{ id: string }>
  const [owner] = await sql`insert into professionals (tenant_id, name, email, role, active) values (${tenant.id}, 'Owner E2E', ${ownerEmail}, 'owner', true) returning id` as Array<{ id: string }>
  const [staff] = await sql`insert into professionals (tenant_id, name, email, role, active) values (${tenant.id}, 'Staff E2E', ${staffEmail}, 'staff', true) returning id` as Array<{ id: string }>
  const [service] = await sql`insert into services (tenant_id, name, description, duration_min, price, color, active) values (${tenant.id}, 'Consulta E2E', 'Servicio ficticio para reservas E2E.', 30, 10000, '#5b6ee1', true) returning id` as Array<{ id: string }>
  await sql`insert into professional_services (tenant_id, professional_id, service_id, active) values (${tenant.id}, ${owner.id}, ${service.id}, true), (${tenant.id}, ${staff.id}, ${service.id}, true)`
  await sql`insert into availability (professional_id, weekday, start_time, end_time, active) values (${owner.id}, 0, '09:00', '18:00', true), (${owner.id}, 1, '09:00', '18:00', true), (${owner.id}, 2, '09:00', '18:00', true), (${owner.id}, 3, '09:00', '18:00', true), (${owner.id}, 4, '09:00', '18:00', true), (${owner.id}, 5, '09:00', '18:00', true), (${owner.id}, 6, '09:00', '18:00', true)`
  await sql`insert into users (tenant_id, professional_id, name, email, password_hash, role, active) values (${tenant.id}, ${owner.id}, 'Owner E2E', ${ownerEmail}, ${passwordHash}, 'owner', true), (${tenant.id}, ${staff.id}, 'Staff E2E', ${staffEmail}, ${passwordHash}, 'staff', true)`
  await sql`insert into customers (tenant_id, name, email, phone) values (${tenant.id}, 'Cliente E2E', 'cliente@slotly-e2e.test', '+56 9 2000 0000')`
  console.log(`E2E fixtures ready for /${slug}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
