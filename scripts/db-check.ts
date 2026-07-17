import { neon } from "@neondatabase/serverless"
import { requireDatabaseUrl } from "./load-env"

const databaseUrl = requireDatabaseUrl("check the database")
const sql = neon(databaseUrl)

const requiredTables = [
  "tenants",
  "users",
  "professionals",
  "services",
  "professional_services",
  "availability",
  "availability_exceptions",
  "customers",
  "appointments",
  "tenant_modules",
]

async function check() {
  const protocol = new URL(databaseUrl).protocol.replace(":", "")
  console.log("Environment loaded: DATABASE_URL present")
  console.log(`Protocol: ${protocol}`)

  const ping = await sql`select 1 as ok`
  if (Number(ping[0]?.ok) !== 1) throw new Error("Database ping failed")
  console.log("Database connection: successful")
  console.log("Query result: 1")

  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `
  const tableNames = new Set(tables.map((row) => String(row.table_name)))

  for (const table of requiredTables) {
    if (!tableNames.has(table)) throw new Error(`Missing table: ${table}`)
  }

  const constraints = await sql`
    SELECT conname
    FROM pg_constraint
    WHERE conname = 'appointments_no_active_overlap'
  `

  if (constraints.length !== 1) {
    throw new Error("Missing appointments_no_active_overlap constraint")
  }

  console.log("Database check passed")
}

check().catch((error) => {
  console.error("Database check failed:", error instanceof Error ? error.message : error)
  process.exit(1)
})
