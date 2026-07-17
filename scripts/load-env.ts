import { loadEnvConfig } from "@next/env"
import path from "node:path"
import { fileURLToPath } from "node:url"

const currentFile = fileURLToPath(import.meta.url)
const scriptsDirectory = path.dirname(currentFile)
export const projectRoot = path.resolve(scriptsDirectory, "..")

loadEnvConfig(projectRoot)

export function requireDatabaseUrl(action: string) {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    console.error(`DATABASE_URL is required to ${action}`)
    process.exit(1)
  }

  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    console.error("DATABASE_URL is present but is not a valid URL")
    process.exit(1)
  }

  if (!["postgresql:", "postgres:"].includes(parsed.protocol)) {
    console.error("DATABASE_URL must use postgres: or postgresql:")
    process.exit(1)
  }

  return databaseUrl
}

export function assertDevelopmentDatabase() {
  const environment = process.env.NODE_ENV
  const slotlyDbEnvironment = process.env.SLOTLY_DB_ENV

  if (environment === "production" || slotlyDbEnvironment === "production") {
    console.error("Refusing to run database migration against a production environment")
    process.exit(1)
  }
}
