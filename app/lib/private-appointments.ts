import { and, eq, gte, lt, sql as drizzleSql } from "drizzle-orm"
import { db } from "../db"
import { appointments, professionals, services } from "../db/schema"
import { appointmentStatuses, type AppointmentStatus } from "./appointment-status"
import { canAccessProfessional, requirePermission } from "./authorization"
import type { SessionContext } from "./session"

export type AppointmentListFilters = {
  start: Date
  end: Date
  professionalId?: string
  status?: AppointmentStatus
}

export async function listAppointmentsForContext(context: SessionContext, filters: AppointmentListFilters) {
  requirePermission(context, "appointments.read")
  const conditions = [
    eq(appointments.tenant_id, context.tenantId),
    gte(appointments.starts_at, filters.start),
    lt(appointments.starts_at, filters.end),
  ]

  if (context.role === "staff") {
    if (!context.professionalId) return []
    conditions.push(eq(appointments.professional_id, context.professionalId))
  }

  if (filters.professionalId) {
    if (!await canAccessProfessional(context, filters.professionalId, { activeOnly: true })) return []
    conditions.push(eq(appointments.professional_id, filters.professionalId))
  }

  if (filters.status && appointmentStatuses.includes(filters.status)) conditions.push(eq(appointments.status, filters.status))

  const rows = await db
    .select({
      id: appointments.id,
      tenantId: appointments.tenant_id,
      professionalId: appointments.professional_id,
      serviceId: appointments.service_id,
      customerId: appointments.customer_id,
      clientName: appointments.client_name,
      clientPhone: appointments.client_phone,
      clientEmail: appointments.client_email,
      startsAt: appointments.starts_at,
      endsAt: appointments.ends_at,
      status: appointments.status,
      source: appointments.source,
      notes: appointments.notes,
      cancellationReason: appointments.cancellation_reason,
      createdAt: appointments.created_at,
      updatedAt: appointments.updated_at,
      serviceName: services.name,
      serviceDuration: services.duration_min,
      servicePrice: services.price,
      professionalName: professionals.name,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.service_id))
    .innerJoin(professionals, eq(professionals.id, appointments.professional_id))
    .where(and(...conditions))
    .orderBy(appointments.starts_at)
    .limit(500)

  return rows
}

export async function getAppointmentForContext(context: SessionContext, appointmentId: string) {
  const rows = await db
    .select({
      id: appointments.id,
      tenantId: appointments.tenant_id,
      professionalId: appointments.professional_id,
      serviceId: appointments.service_id,
      customerId: appointments.customer_id,
      clientName: appointments.client_name,
      clientPhone: appointments.client_phone,
      clientEmail: appointments.client_email,
      startsAt: appointments.starts_at,
      endsAt: appointments.ends_at,
      status: appointments.status,
      source: appointments.source,
      notes: appointments.notes,
      cancellationReason: appointments.cancellation_reason,
      createdAt: appointments.created_at,
      updatedAt: appointments.updated_at,
      serviceName: services.name,
      serviceDuration: services.duration_min,
      servicePrice: services.price,
      professionalName: professionals.name,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.service_id))
    .innerJoin(professionals, eq(professionals.id, appointments.professional_id))
    .where(and(eq(appointments.id, appointmentId), eq(appointments.tenant_id, context.tenantId)))
    .limit(1)

  const appointment = rows[0] ?? null
  if (!appointment) return null
  if (!await canAccessProfessional(context, appointment.professionalId)) return null
  return appointment
}

export async function dashboardStats(context: SessionContext, dayStart: Date, dayEnd: Date) {
  requirePermission(context, "appointments.read")
  const professionalFilter = context.role === "staff" && context.professionalId
    ? eq(appointments.professional_id, context.professionalId)
    : undefined

  const base = [eq(appointments.tenant_id, context.tenantId)]
  if (professionalFilter) base.push(professionalFilter)

  const todayBase = [...base, gte(appointments.starts_at, dayStart), lt(appointments.starts_at, dayEnd)]
  const upcomingBase = [...base, gte(appointments.starts_at, new Date())]

  const [today, upcoming, pending, confirmed, cancelledToday, activeServices, activeProfessionals] = await Promise.all([
    db.select({ count: drizzleSql<number>`count(*)::int` }).from(appointments).where(and(...todayBase)),
    db.select({ count: drizzleSql<number>`count(*)::int` }).from(appointments).where(and(...upcomingBase)),
    db.select({ count: drizzleSql<number>`count(*)::int` }).from(appointments).where(and(...base, eq(appointments.status, "pending"))),
    db.select({ count: drizzleSql<number>`count(*)::int` }).from(appointments).where(and(...base, eq(appointments.status, "confirmed"))),
    db.select({ count: drizzleSql<number>`count(*)::int` }).from(appointments).where(and(...todayBase, eq(appointments.status, "cancelled"))),
    db.select({ count: drizzleSql<number>`count(*)::int` }).from(services).where(and(eq(services.tenant_id, context.tenantId), eq(services.active, true))),
    db.select({ count: drizzleSql<number>`count(*)::int` }).from(professionals).where(and(eq(professionals.tenant_id, context.tenantId), eq(professionals.active, true))),
  ])

  return {
    today: Number(today[0]?.count ?? 0),
    upcoming: Number(upcoming[0]?.count ?? 0),
    pending: Number(pending[0]?.count ?? 0),
    confirmed: Number(confirmed[0]?.count ?? 0),
    cancelledToday: Number(cancelledToday[0]?.count ?? 0),
    activeServices: Number(activeServices[0]?.count ?? 0),
    activeProfessionals: Number(activeProfessionals[0]?.count ?? 0),
  }
}
