import { neon } from "@neondatabase/serverless"
import { requireDatabaseUrl } from "./load-env"

const sql = neon(requireDatabaseUrl("validate Sprint 3"))

const requiredTables = ["users", "customers", "professional_services", "availability_exceptions"]
const tenantColumns = ["status", "booking_min_notice_min", "booking_horizon_days", "slot_interval_min", "auto_confirm_appointments", "cancellation_policy"]
const appointmentColumns = ["customer_id", "source", "cancellation_reason", "updated_at"]

async function exists(query: TemplateStringsArray, ...values: unknown[]) {
  const rows = await sql(query, ...values)
  return Number(rows[0]?.count ?? 0) > 0
}

async function main() {
  const checks: Array<[string, boolean]> = []

  for (const table of requiredTables) {
    checks.push([`table:${table}`, await exists`select count(*)::int as count from information_schema.tables where table_schema = 'public' and table_name = ${table}`])
  }

  for (const column of tenantColumns) {
    checks.push([`tenants.${column}`, await exists`select count(*)::int as count from information_schema.columns where table_schema = 'public' and table_name = 'tenants' and column_name = ${column}`])
  }

  for (const column of appointmentColumns) {
    checks.push([`appointments.${column}`, await exists`select count(*)::int as count from information_schema.columns where table_schema = 'public' and table_name = 'appointments' and column_name = ${column}`])
  }

  checks.push(["extension:btree_gist", await exists`select count(*)::int as count from pg_extension where extname = 'btree_gist'`])
  checks.push(["constraint:appointments_no_active_overlap", await exists`select count(*)::int as count from pg_constraint where conname = 'appointments_no_active_overlap'`])
  checks.push(["owner login row", await exists`select count(*)::int as count from users where email = 'silvana@podologiasilvana.cl' and role = 'owner' and active = true`])
  checks.push(["staff login row", await exists`select count(*)::int as count from users where email = 'camila@podologiasilvana.cl' and role = 'staff' and active = true`])
  checks.push(["demo appointments", await exists`select count(*)::int as count from appointments where client_email like 'demo-%@slotly.local'`])

  const failed = checks.filter(([, ok]) => !ok)
  for (const [name, ok] of checks) {
    console.log(`${ok ? "OK" : "FAIL"} ${name}`)
  }

  if (failed.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error("Sprint 3 validation failed:", error)
  process.exit(1)
})
