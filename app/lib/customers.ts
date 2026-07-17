import { and, desc, eq, gte, ilike, inArray, or, sql as drizzleSql } from "drizzle-orm"
import { db } from "../db"
import { appointments, customers, professionals, services } from "../db/schema"
import { requirePermission } from "./authorization"
import type { SessionContext } from "./session"
import { cleanString, isEmail } from "./validation"

export function normalizeEmail(value: unknown) {
  return cleanString(value, 100).toLowerCase()
}

export function normalizePhone(value: unknown) {
  const raw = cleanString(value, 30)
  return raw.replace(/[^\d+]/g, "")
}

export async function findReusableCustomer(tenantId: string, email: string, phone: string) {
  const emailValue = normalizeEmail(email)
  const phoneValue = normalizePhone(phone)
  if (!emailValue && !phoneValue) return { conflict: false as const, customer: null }
  const matches = await db.query.customers.findMany({
    where: and(
      eq(customers.tenant_id, tenantId),
      or(
        emailValue ? eq(customers.email, emailValue) : undefined,
        phoneValue ? eq(customers.phone, phoneValue) : undefined,
      ),
    ),
    limit: 3,
  })
  const byEmail = emailValue ? matches.find((customer) => customer.email === emailValue) : undefined
  const byPhone = phoneValue ? matches.find((customer) => customer.phone === phoneValue) : undefined
  if (byEmail && byPhone && byEmail.id !== byPhone.id) return { conflict: true as const }
  return { conflict: false as const, customer: byEmail ?? byPhone ?? null }
}

export async function listCustomers(context: SessionContext, filters: { q?: string; upcoming?: boolean; activity?: string; limit?: number }) {
  requirePermission(context, "customers.read")
  const q = cleanString(filters.q, 80)
  const limit = Math.min(filters.limit ?? 50, 100)
  const conditions = [eq(customers.tenant_id, context.tenantId)]
  if (q) conditions.push(or(ilike(customers.name, `%${q}%`), ilike(customers.email, `%${q}%`), ilike(customers.phone, `%${q}%`))!)

  const rows = await db.select({
    id: customers.id,
    name: customers.name,
    email: customers.email,
    phone: customers.phone,
    notes: customers.notes,
    createdAt: customers.created_at,
    updatedAt: customers.updated_at,
    total: drizzleSql<number>`count(${appointments.id})::int`,
    completed: drizzleSql<number>`count(${appointments.id}) filter (where ${appointments.status} in ('completed','done'))::int`,
    cancelled: drizzleSql<number>`count(${appointments.id}) filter (where ${appointments.status} = 'cancelled')::int`,
    noShow: drizzleSql<number>`count(${appointments.id}) filter (where ${appointments.status} = 'no_show')::int`,
    nextAt: drizzleSql<Date | null>`min(${appointments.starts_at}) filter (where ${appointments.starts_at} >= now() and ${appointments.status} in ('pending','confirmed'))`,
    lastAt: drizzleSql<Date | null>`max(${appointments.starts_at}) filter (where ${appointments.starts_at} < now())`,
  }).from(customers)
    .leftJoin(appointments, and(eq(appointments.customer_id, customers.id), eq(appointments.tenant_id, context.tenantId)))
    .where(and(...conditions))
    .groupBy(customers.id)
    .orderBy(desc(customers.created_at))
    .limit(limit)

  return rows.filter((row) => {
    if (filters.upcoming && !row.nextAt) return false
    if (filters.activity === "issues" && Number(row.cancelled) + Number(row.noShow) === 0) return false
    return true
  })
}

export async function customerStats(context: SessionContext) {
  requirePermission(context, "customers.read")
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const [total, upcoming, newThisMonth, cancelled, noShow] = await Promise.all([
    db.select({ count: drizzleSql<number>`count(*)::int` }).from(customers).where(eq(customers.tenant_id, context.tenantId)),
    db.select({ count: drizzleSql<number>`count(distinct ${appointments.customer_id})::int` }).from(appointments).where(and(eq(appointments.tenant_id, context.tenantId), gte(appointments.starts_at, new Date()), inArray(appointments.status, ["pending", "confirmed"]))),
    db.select({ count: drizzleSql<number>`count(*)::int` }).from(customers).where(and(eq(customers.tenant_id, context.tenantId), gte(customers.created_at, monthStart))),
    db.select({ count: drizzleSql<number>`count(distinct ${appointments.customer_id})::int` }).from(appointments).where(and(eq(appointments.tenant_id, context.tenantId), eq(appointments.status, "cancelled"))),
    db.select({ count: drizzleSql<number>`count(distinct ${appointments.customer_id})::int` }).from(appointments).where(and(eq(appointments.tenant_id, context.tenantId), eq(appointments.status, "no_show"))),
  ])
  return {
    total: Number(total[0]?.count ?? 0),
    upcoming: Number(upcoming[0]?.count ?? 0),
    newThisMonth: Number(newThisMonth[0]?.count ?? 0),
    cancelled: Number(cancelled[0]?.count ?? 0),
    noShow: Number(noShow[0]?.count ?? 0),
  }
}

export async function getCustomerDetail(context: SessionContext, id: string) {
  requirePermission(context, "customers.read")
  const customer = await db.query.customers.findFirst({ where: and(eq(customers.id, id), eq(customers.tenant_id, context.tenantId)) })
  if (!customer) return null
  const appointmentRows = await db.select({
    id: appointments.id,
    startsAt: appointments.starts_at,
    endsAt: appointments.ends_at,
    status: appointments.status,
    source: appointments.source,
    serviceName: services.name,
    professionalName: professionals.name,
  }).from(appointments)
    .innerJoin(services, eq(services.id, appointments.service_id))
    .innerJoin(professionals, eq(professionals.id, appointments.professional_id))
    .where(and(eq(appointments.tenant_id, context.tenantId), eq(appointments.customer_id, id)))
    .orderBy(desc(appointments.starts_at))
    .limit(40)

  return { customer, appointments: appointmentRows }
}

export async function updateCustomer(context: SessionContext, id: string, input: { name?: unknown; email?: unknown; phone?: unknown; notes?: unknown }) {
  requirePermission(context, "customers.write")
  const existing = await db.query.customers.findFirst({ where: and(eq(customers.id, id), eq(customers.tenant_id, context.tenantId)) })
  if (!existing) return { ok: false as const, status: 404, error: "Cliente no encontrado" }
  const name = cleanString(input.name ?? existing.name, 100)
  const email = normalizeEmail(input.email ?? existing.email ?? "")
  const phone = normalizePhone(input.phone ?? existing.phone ?? "")
  const notes = cleanString(input.notes ?? existing.notes ?? "", 2000)
  if (!name || !isEmail(email)) return { ok: false as const, status: 400, error: "Datos invalidos" }
  const match = await findReusableCustomer(context.tenantId, email, phone)
  if (match.conflict || (match.customer && match.customer.id !== id)) return { ok: false as const, status: 409, error: "Existe otro cliente con ese email o telefono" }
  const [customer] = await db.update(customers).set({ name, email: email || null, phone: phone || null, notes: notes || null, updated_at: new Date() }).where(and(eq(customers.id, id), eq(customers.tenant_id, context.tenantId))).returning()
  return { ok: true as const, customer }
}
