import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

const databaseUrl = process.env.DATABASE_URL

function isValidDatabaseUrl(value: string | undefined) {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return ["postgresql:", "postgres:"].includes(parsed.protocol)
  } catch {
    return false
  }
}

function missingDatabaseUrl(): never {
  throw new Error("DATABASE_URL must be a valid postgres:// or postgresql:// URL to use the database")
}

const validDatabaseUrl = isValidDatabaseUrl(databaseUrl) ? databaseUrl : null

export const db = validDatabaseUrl
  ? drizzle(neon(validDatabaseUrl), { schema })
  : new Proxy({}, {
      get() {
        return missingDatabaseUrl()
      },
    }) as ReturnType<typeof drizzle<typeof schema>>

export const sql = validDatabaseUrl ? neon(validDatabaseUrl) : null
