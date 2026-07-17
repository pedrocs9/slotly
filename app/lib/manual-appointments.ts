import { and, eq, ilike, or } from "drizzle-orm"
import { db, sql } from "../db"
import { customers, professionalServices, tenants } from "../db/schema"
import { requirePermission, requireProfessionalAccess } from "./authorization"
import { hasAppointmentConflict, isInsideWeeklyAvailability } from "./booking"
import { findReusableCustomer, normalizeEmail, normalizePhone } from "./customers"
import { getCustomerForContext, getProfessionalForContext, getServiceForContext } from "./resource-access"
import type { SessionContext } from "./session"
import { utcDateToDatabaseTimestamp, zonedDateTimeToUtc } from "./time"
import { cleanString, isEmail, isUuid } from "./validation"

export async function createManualAppointment(context: SessionContext, input: {
  serviceId: unknown
  professionalId: unknown
  date: unknown
  time: unknown
  customerId?: unknown
  clientName?: unknown
  clientEmail?: unknown
  clientPhone?: unknown
  notes?: unknown
}) {
  if (!sql) throw new Error("DATABASE_URL is required")
  requirePermission(context, "appointments.create")
  if (!isUuid(input.serviceId) || !isUuid(input.professionalId)) return { ok: false as const, status: 400, error: "Servicio o profesional invalido" }
  try {
    await requireProfessionalAccess(context, input.professionalId, { activeOnly: true })
  } catch {
    return { ok: false as const, status: 404, error: "Profesional no disponible" }
  }

  const date = cleanString(input.date, 10)
  const time = cleanString(input.time, 5)
  const name = cleanString(input.clientName, 100)
  const email = normalizeEmail(input.clientEmail)
  const phone = normalizePhone(input.clientPhone)
  const notes = cleanString(input.notes, 500)
  if (!date || !time || !name || !isEmail(email)) return { ok: false as const, status: 400, error: "Datos de cita invalidos" }

  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, context.tenantId) })
  if (!tenant) return { ok: false as const, status: 404, error: "Tenant no encontrado" }

  const service = await getServiceForContext(context, input.serviceId, { activeOnly: true }).catch(() => null)
  if (!service) return { ok: false as const, status: 404, error: "Servicio no disponible" }

  const professional = await getProfessionalForContext(context, input.professionalId, { activeOnly: true }).catch(() => null)
  if (!professional) return { ok: false as const, status: 404, error: "Profesional no disponible" }

  const assignment = await db.query.professionalServices.findFirst({
    where: and(eq(professionalServices.tenant_id, context.tenantId), eq(professionalServices.professional_id, professional.id), eq(professionalServices.service_id, service.id), eq(professionalServices.active, true)),
  })
  if (!assignment) return { ok: false as const, status: 400, error: "El profesional no realiza este servicio" }

  const startsAt = zonedDateTimeToUtc(date, time, tenant.timezone)
  if (!startsAt) return { ok: false as const, status: 400, error: "Fecha u hora invalida" }
  const endsAt = new Date(startsAt.getTime() + service.duration_min * 60000)
  if (!await isInsideWeeklyAvailability(professional.id, startsAt, endsAt, tenant.timezone)) {
    return { ok: false as const, status: 409, error: "Horario fuera de disponibilidad" }
  }
  if (await hasAppointmentConflict(professional.id, startsAt, endsAt)) {
    return { ok: false as const, status: 409, error: "Ese horario ya no esta disponible. Selecciona otro horario." }
  }

  const providedCustomer = isUuid(input.customerId)
    ? await getCustomerForContext(context, input.customerId).catch(() => null)
    : null
  if (isUuid(input.customerId) && !providedCustomer) {
    return { ok: false as const, status: 404, error: "Cliente no encontrado" }
  }
  const match = providedCustomer ? { conflict: false as const, customer: providedCustomer } : await findReusableCustomer(context.tenantId, email, phone)
  if (match.conflict) return { ok: false as const, status: 409, error: "Email y telefono coinciden con clientes distintos. Revisa el cliente antes de agendar." }

  try {
    const startsAtSql = utcDateToDatabaseTimestamp(startsAt)
    const endsAtSql = utcDateToDatabaseTimestamp(endsAt)
    const rows = await sql`
      WITH created_customer AS (
        INSERT INTO customers (tenant_id, name, phone, email, notes)
        SELECT ${context.tenantId}, ${name}, ${phone || null}, ${email || null}, ${notes || null}
        WHERE ${match.customer?.id ?? null}::uuid IS NULL
        RETURNING id
      ),
      selected_customer AS (
        SELECT ${match.customer?.id ?? null}::uuid AS id WHERE ${match.customer?.id ?? null}::uuid IS NOT NULL
        UNION ALL
        SELECT id FROM created_customer
        LIMIT 1
      ),
      new_appointment AS (
        INSERT INTO appointments (
          tenant_id, professional_id, service_id, customer_id, client_name,
          client_phone, client_email, starts_at, ends_at, status, source, booked_by, notes
        )
        SELECT
          ${context.tenantId}, ${professional.id}, ${service.id}, selected_customer.id, ${name},
          ${phone || null}, ${email || null}, ${startsAtSql}::timestamp, ${endsAtSql}::timestamp,
          'confirmed', 'manual', 'staff', ${notes || null}
        FROM selected_customer
        RETURNING id, status
      )
      SELECT id, status FROM new_appointment
    `
    return { ok: true as const, appointment: rows[0] }
  } catch (error) {
    const pgError = error as { code?: string, constraint?: string }
    if (pgError.code === "23P01" || pgError.constraint === "appointments_no_active_overlap") {
      return { ok: false as const, status: 409, error: "Ese horario ya no esta disponible. Selecciona otro horario." }
    }
    throw error
  }
}

export async function searchCustomers(context: SessionContext, query: string) {
  requirePermission(context, "customers.read")
  const value = cleanString(query, 80)
  if (!value) return []
  return db.query.customers.findMany({
    where: and(
      eq(customers.tenant_id, context.tenantId),
      or(ilike(customers.name, `%${value}%`), ilike(customers.email, `%${value}%`), ilike(customers.phone, `%${value}%`)),
    ),
    limit: 8,
  })
}
