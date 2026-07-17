import { and, eq, ilike, inArray, sql as drizzleSql } from "drizzle-orm"
import { db, sql } from "../db"
import { appointments, availability, professionalServices, professionals, services, users } from "../db/schema"
import { requirePermission } from "./authorization"
import type { SessionContext } from "./session"
import { cleanString, isUuid } from "./validation"
import { validateProfessionalInput, validateServiceInput } from "./service-professional-rules"

export async function listServiceAdmin(context: SessionContext, filters: { q?: string; status?: string }) {
  requirePermission(context, "services.read")
  const q = cleanString(filters.q, 80)
  const conditions = [eq(services.tenant_id, context.tenantId)]
  if (q) conditions.push(ilike(services.name, `%${q}%`))
  if (filters.status === "active") conditions.push(eq(services.active, true))
  if (filters.status === "inactive") conditions.push(eq(services.active, false))

  const rows = await db.select({
    id: services.id,
    name: services.name,
    description: services.description,
    durationMin: services.duration_min,
    price: services.price,
    color: services.color,
    active: services.active,
    professionalCount: drizzleSql<number>`count(${professionalServices.id}) filter (where ${professionalServices.active} = true)::int`,
    futureAppointments: drizzleSql<number>`count(${appointments.id}) filter (where ${appointments.starts_at} >= now() and ${appointments.status} in ('pending','confirmed'))::int`,
  }).from(services)
    .leftJoin(professionalServices, and(eq(professionalServices.service_id, services.id), eq(professionalServices.tenant_id, context.tenantId)))
    .leftJoin(appointments, and(eq(appointments.service_id, services.id), eq(appointments.tenant_id, context.tenantId)))
    .where(and(...conditions))
    .groupBy(services.id)
    .orderBy(services.name)

  return rows.filter((row) => filters.status === "without-professionals" ? Number(row.professionalCount) === 0 : true)
}

export async function listProfessionalAdmin(context: SessionContext, filters: { q?: string; status?: string; serviceId?: string; schedule?: string }) {
  requirePermission(context, "professionals.read")
  const q = cleanString(filters.q, 80)
  const conditions = [eq(professionals.tenant_id, context.tenantId)]
  if (q) conditions.push(ilike(professionals.name, `%${q}%`))
  if (filters.status === "active") conditions.push(eq(professionals.active, true))
  if (filters.status === "inactive") conditions.push(eq(professionals.active, false))

  const rows = await db.select({
    id: professionals.id,
    name: professionals.name,
    email: professionals.email,
    role: professionals.role,
    active: professionals.active,
    avatarUrl: professionals.avatar_url,
    serviceCount: drizzleSql<number>`count(distinct ${professionalServices.service_id}) filter (where ${professionalServices.active} = true)::int`,
    scheduleBlocks: drizzleSql<number>`count(distinct ${availability.id}) filter (where ${availability.active} = true)::int`,
    futureAppointments: drizzleSql<number>`count(distinct ${appointments.id}) filter (where ${appointments.starts_at} >= now() and ${appointments.status} in ('pending','confirmed'))::int`,
    userCount: drizzleSql<number>`count(distinct ${users.id})::int`,
  }).from(professionals)
    .leftJoin(professionalServices, and(eq(professionalServices.professional_id, professionals.id), eq(professionalServices.tenant_id, context.tenantId)))
    .leftJoin(availability, eq(availability.professional_id, professionals.id))
    .leftJoin(appointments, and(eq(appointments.professional_id, professionals.id), eq(appointments.tenant_id, context.tenantId)))
    .leftJoin(users, and(eq(users.professional_id, professionals.id), eq(users.tenant_id, context.tenantId)))
    .where(and(...conditions))
    .groupBy(professionals.id)
    .orderBy(professionals.name)

  return rows.filter((row) => {
    if (filters.serviceId && filters.serviceId !== "all") {
      return false
    }
    if (filters.schedule === "with" && Number(row.scheduleBlocks) === 0) return false
    if (filters.schedule === "without" && Number(row.scheduleBlocks) > 0) return false
    return true
  })
}

export async function saveService(context: SessionContext, input: Record<string, unknown>) {
  try {
    requirePermission(context, "services.write")
  } catch {
    return { ok: false as const, status: 403, error: "Solo owner puede modificar servicios" }
  }
  if (!sql) throw new Error("DATABASE_URL is required")
  const parsed = validateServiceInput({ name: input.name, durationMin: input.durationMin, price: input.price, color: input.color })
  if (!parsed.ok) return { ok: false as const, status: 400, error: parsed.error }
  const id = cleanString(input.id, 80)
  const professionalIds = Array.isArray(input.professionalIds) ? input.professionalIds.filter(isUuid) : []
  const description = cleanString(input.description, 500)
  const active = Boolean(input.active)

  if (professionalIds.length) {
    const owned = await db.query.professionals.findMany({ where: and(eq(professionals.tenant_id, context.tenantId), inArray(professionals.id, professionalIds)) })
    if (owned.length !== professionalIds.length) return { ok: false as const, status: 403, error: "Profesional fuera del tenant" }
  }

  try {
    const professionalIdsJson = JSON.stringify(professionalIds)
    const rows = id && isUuid(id)
      ? await sql`
        WITH saved_service AS (
          UPDATE services
          SET name=${parsed.values.name}, description=${description || null}, duration_min=${parsed.values.durationMin},
              price=${parsed.values.price}, color=${parsed.values.color}, active=${active}
          WHERE id=${id} AND tenant_id=${context.tenantId}
          RETURNING id
        ),
        disabled AS (
          UPDATE professional_services
          SET active=false
          WHERE tenant_id=${context.tenantId} AND service_id=(SELECT id FROM saved_service)
        ),
        requested_professionals AS (
          SELECT value::uuid AS professional_id FROM jsonb_array_elements_text(${professionalIdsJson}::jsonb)
        ),
        inserted AS (
          INSERT INTO professional_services (tenant_id, professional_id, service_id, active)
          SELECT ${context.tenantId}, professional_id, (SELECT id FROM saved_service), true
          FROM requested_professionals
          ON CONFLICT (professional_id, service_id) DO UPDATE SET active=true
        )
        SELECT id FROM saved_service
      `
      : await sql`
        WITH saved_service AS (
          INSERT INTO services (tenant_id, name, description, duration_min, price, color, active)
          VALUES (${context.tenantId}, ${parsed.values.name}, ${description || null}, ${parsed.values.durationMin}, ${parsed.values.price}, ${parsed.values.color}, ${active})
          RETURNING id
        ),
        requested_professionals AS (
          SELECT value::uuid AS professional_id FROM jsonb_array_elements_text(${professionalIdsJson}::jsonb)
        ),
        inserted AS (
          INSERT INTO professional_services (tenant_id, professional_id, service_id, active)
          SELECT ${context.tenantId}, professional_id, (SELECT id FROM saved_service), true
          FROM requested_professionals
          ON CONFLICT (professional_id, service_id) DO UPDATE SET active=true
        )
        SELECT id FROM saved_service
      `
    const serviceId = rows[0]?.id as string | undefined
    if (!serviceId) throw new Error("Service not found")
    return { ok: true as const, id: serviceId }
  } catch (error) {
    throw error
  }
}

export async function saveProfessional(context: SessionContext, input: Record<string, unknown>) {
  try {
    requirePermission(context, "professionals.write")
  } catch {
    return { ok: false as const, status: 403, error: "Solo owner puede modificar profesionales" }
  }
  if (!sql) throw new Error("DATABASE_URL is required")
  const parsed = validateProfessionalInput({ name: input.name, email: input.email })
  if (!parsed.ok) return { ok: false as const, status: 400, error: parsed.error }
  const id = cleanString(input.id, 80)
  const serviceIds = Array.isArray(input.serviceIds) ? input.serviceIds.filter(isUuid) : []
  const role = input.role === "owner" ? "owner" : "staff"
  const active = Boolean(input.active)

  if (serviceIds.length) {
    const owned = await db.query.services.findMany({ where: and(eq(services.tenant_id, context.tenantId), inArray(services.id, serviceIds)) })
    if (owned.length !== serviceIds.length) return { ok: false as const, status: 403, error: "Servicio fuera del tenant" }
  }

  try {
    const serviceIdsJson = JSON.stringify(serviceIds)
    const rows = id && isUuid(id)
      ? await sql`
        WITH saved_professional AS (
          UPDATE professionals
          SET name=${parsed.values.name}, email=${parsed.values.email}, role=${role}, active=${active}
          WHERE id=${id} AND tenant_id=${context.tenantId}
          RETURNING id
        ),
        disabled AS (
          UPDATE professional_services
          SET active=false
          WHERE tenant_id=${context.tenantId} AND professional_id=(SELECT id FROM saved_professional)
        ),
        requested_services AS (
          SELECT value::uuid AS service_id FROM jsonb_array_elements_text(${serviceIdsJson}::jsonb)
        ),
        inserted AS (
          INSERT INTO professional_services (tenant_id, professional_id, service_id, active)
          SELECT ${context.tenantId}, (SELECT id FROM saved_professional), service_id, true
          FROM requested_services
          ON CONFLICT (professional_id, service_id) DO UPDATE SET active=true
        )
        SELECT id FROM saved_professional
      `
      : await sql`
        WITH saved_professional AS (
          INSERT INTO professionals (tenant_id, name, email, role, active)
          VALUES (${context.tenantId}, ${parsed.values.name}, ${parsed.values.email}, ${role}, ${active})
          RETURNING id
        ),
        requested_services AS (
          SELECT value::uuid AS service_id FROM jsonb_array_elements_text(${serviceIdsJson}::jsonb)
        ),
        inserted AS (
          INSERT INTO professional_services (tenant_id, professional_id, service_id, active)
          SELECT ${context.tenantId}, (SELECT id FROM saved_professional), service_id, true
          FROM requested_services
          ON CONFLICT (professional_id, service_id) DO UPDATE SET active=true
        )
        SELECT id FROM saved_professional
      `
    const professionalId = rows[0]?.id as string | undefined
    if (!professionalId) throw new Error("Professional not found")
    return { ok: true as const, id: professionalId }
  } catch (error) {
    throw error
  }
}
