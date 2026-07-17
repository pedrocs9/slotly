import { neon } from "@neondatabase/serverless"
import { assertDevelopmentDatabase, requireDatabaseUrl } from "./load-env"

assertDevelopmentDatabase()
if (!process.argv.includes("--allow-test-data-reset")) {
  console.error("Refusing to cleanup E2E data without --allow-test-data-reset")
  process.exit(1)
}

const sql = neon(requireDatabaseUrl("cleanup e2e fixtures"))
const slug = process.env.E2E_TENANT_SLUG || "slotly-e2e"

async function main() {
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
  console.log(`E2E cleanup complete for ${slug}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
