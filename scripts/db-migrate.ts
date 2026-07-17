import { neon } from "@neondatabase/serverless"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { assertDevelopmentDatabase, projectRoot, requireDatabaseUrl } from "./load-env"

assertDevelopmentDatabase()

const sql = neon(requireDatabaseUrl("run migrations"))
const migrationsDir = path.join(projectRoot, "drizzle")

function splitStatements(source: string) {
  const chunks = source.includes("--> statement-breakpoint")
    ? source.split(/-->\s*statement-breakpoint/g)
    : source.split(/;\s*(?:\r?\n|$)/g)

  return chunks
    .map((statement) => statement.trim())
    .filter(Boolean)
}

async function migrate() {
  const existingTables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort()

  for (const file of files) {
    if (file === "0000_baseline.sql" && existingTables.length > 0) {
      console.log("Skipping 0000_baseline.sql because public tables already exist")
      continue
    }

    const source = await readFile(path.join(migrationsDir, file), "utf8")
    const statements = splitStatements(source)
    console.log(`Applying ${file} (${statements.length} statements)`)

    for (const statement of statements) {
      await sql.query(statement)
    }
  }

  console.log("Migrations applied")
}

migrate().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error)
  process.exit(1)
})
