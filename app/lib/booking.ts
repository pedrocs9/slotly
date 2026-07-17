import { and, eq, gt, gte, inArray, lt, lte } from "drizzle-orm"
import { db, sql } from "../db"
import { appointments, availability, availabilityExceptions, professionalServices, professionals, services, tenants } from "../db/schema"
import { findReusableCustomer, normalizeEmail, normalizePhone } from "./customers"
import { sendBookingConfirmationToClient, sendBookingNotificationToTenant } from "./email"
import { logEvent } from "./observability"
import { databaseTimestampToUtcDate, minutesToTime, rangesOverlap, timeToMinutes, utcDateToDatabaseTimestamp, zonedDateTimeToUtc, zonedWeekday } from "./time"

const ACTIVE_APPOINTMENT_STATUSES = ["pending", "confirmed"] as const

export async function getPublicTenant(slug: string) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  })

  if (!tenant?.active || tenant.status === "inactive") return null
  return tenant
}

export function isPublicBookingEnabled(tenant: { booking_page_status?: string }) {
  return tenant.booking_page_status === "published"
}

export async function getBookableServices(tenantId: string) {
  const activeServices = await db.query.services.findMany({
    where: and(eq(services.tenant_id, tenantId), eq(services.active, true)),
  })
  const assignments = await db.query.professionalServices.findMany({
    where: and(eq(professionalServices.tenant_id, tenantId), eq(professionalServices.active, true)),
  })
  const activeProfessionals = await db.query.professionals.findMany({
    where: and(eq(professionals.tenant_id, tenantId), eq(professionals.active, true)),
  })
  const professionalIds = new Set(activeProfessionals.map((professional) => professional.id))
  const bookableServiceIds = new Set(assignments.filter((assignment) => professionalIds.has(assignment.professional_id)).map((assignment) => assignment.service_id))
  return activeServices.filter((service) => bookableServiceIds.has(service.id))
}

export async function getBookableProfessionals(tenantId: string, serviceId: string) {
  const assignments = await db.query.professionalServices.findMany({
    where: and(
      eq(professionalServices.tenant_id, tenantId),
      eq(professionalServices.service_id, serviceId),
      eq(professionalServices.active, true),
    ),
  })

  const ids = assignments.map((assignment) => assignment.professional_id)
  if (!ids.length) return []

  return db.query.professionals.findMany({
    where: and(
      eq(professionals.tenant_id, tenantId),
      eq(professionals.active, true),
      inArray(professionals.id, ids),
    ),
  })
}

export async function hasAppointmentConflict(professionalId: string, startsAt: Date, endsAt: Date) {
  const existing = await db.query.appointments.findFirst({
    where: and(
      eq(appointments.professional_id, professionalId),
      inArray(appointments.status, ACTIVE_APPOINTMENT_STATUSES),
      lt(appointments.starts_at, endsAt),
      gt(appointments.ends_at, startsAt),
    ),
  })

  if (existing) return true

  const blocked = await db.query.availabilityExceptions.findFirst({
    where: and(
      eq(availabilityExceptions.professional_id, professionalId),
      eq(availabilityExceptions.kind, "unavailable"),
      lt(availabilityExceptions.starts_at, endsAt),
      gt(availabilityExceptions.ends_at, startsAt),
    ),
  })

  return Boolean(blocked)
}

export async function isInsideWeeklyAvailability(professionalId: string, startsAt: Date, endsAt: Date, timeZone = "America/Santiago") {
  const special = await db.query.availabilityExceptions.findFirst({
    where: and(
      eq(availabilityExceptions.professional_id, professionalId),
      eq(availabilityExceptions.kind, "available"),
      lte(availabilityExceptions.starts_at, startsAt),
      gte(availabilityExceptions.ends_at, endsAt),
    ),
  })
  if (special) return true

  const weekday = zonedWeekday(startsAt, timeZone)
  const startTime = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(startsAt)
  const endTime = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(endsAt)

  const block = await db.query.availability.findFirst({
    where: and(
      eq(availability.professional_id, professionalId),
      eq(availability.weekday, weekday),
      eq(availability.active, true),
      lte(availability.start_time, startTime),
      gte(availability.end_time, endTime),
    ),
  })

  return Boolean(block)
}

export async function getAvailableSlots(input: {
  tenantId: string
  serviceId: string
  professionalId: string
  date: string
}) {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, input.tenantId) })
  const service = await db.query.services.findFirst({
    where: and(eq(services.id, input.serviceId), eq(services.tenant_id, input.tenantId), eq(services.active, true)),
  })
  const professional = await db.query.professionals.findFirst({
    where: and(eq(professionals.id, input.professionalId), eq(professionals.tenant_id, input.tenantId), eq(professionals.active, true)),
  })

  if (!tenant || tenant.booking_page_status !== "published" || !service || !professional) return []

  const noon = zonedDateTimeToUtc(input.date, "12:00", tenant.timezone)
  if (!noon) return []

  const weekday = zonedWeekday(noon, tenant.timezone)
  const blocks: Array<{ id: string, professional_id: string, weekday: number, start_time: string, end_time: string, active: boolean }> = await db.query.availability.findMany({
    where: and(eq(availability.professional_id, professional.id), eq(availability.weekday, weekday), eq(availability.active, true)),
  })

  const dayStart = zonedDateTimeToUtc(input.date, "00:00", tenant.timezone)
  const dayEnd = zonedDateTimeToUtc(input.date, "23:59", tenant.timezone)
  if (!dayStart || !dayEnd) return []

  const [busyAppointments, exceptions] = await Promise.all([
    db.query.appointments.findMany({
      where: and(
        eq(appointments.professional_id, professional.id),
        inArray(appointments.status, ACTIVE_APPOINTMENT_STATUSES),
        lt(appointments.starts_at, dayEnd),
        gt(appointments.ends_at, dayStart),
      ),
    }),
    db.query.availabilityExceptions.findMany({
      where: and(
        eq(availabilityExceptions.professional_id, professional.id),
        lt(availabilityExceptions.starts_at, dayEnd),
        gt(availabilityExceptions.ends_at, dayStart),
      ),
    }),
  ])

  const availableExceptions = exceptions.filter((exception) => exception.kind === "available")
  for (const exception of availableExceptions) {
    const startParts = new Intl.DateTimeFormat("en-GB", { timeZone: tenant.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(databaseTimestampToUtcDate(exception.starts_at))
    const endParts = new Intl.DateTimeFormat("en-GB", { timeZone: tenant.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(databaseTimestampToUtcDate(exception.ends_at))
    blocks.push({ id: exception.id, professional_id: professional.id, weekday, start_time: startParts, end_time: endParts, active: true })
  }

  const now = new Date()
  const minStart = new Date(now.getTime() + tenant.booking_min_notice_min * 60 * 1000)
  const maxStart = new Date(now.getTime() + tenant.booking_horizon_days * 24 * 60 * 60 * 1000)
  const slots = []

  for (const block of blocks) {
    const start = timeToMinutes(block.start_time)
    const end = timeToMinutes(block.end_time)

    for (let cursor = start; cursor + service.duration_min <= end; cursor += tenant.slot_interval_min) {
      const label = minutesToTime(cursor)
      const startsAt = zonedDateTimeToUtc(input.date, label, tenant.timezone)
      if (!startsAt) continue
      const endsAt = new Date(startsAt.getTime() + service.duration_min * 60 * 1000)

      if (startsAt < minStart || startsAt > maxStart) continue

      const hasBusyAppointment = busyAppointments.some((appointment) => rangesOverlap(
        startsAt,
        endsAt,
        databaseTimestampToUtcDate(appointment.starts_at),
        databaseTimestampToUtcDate(appointment.ends_at),
      ))
      const unavailable = exceptions.some((exception) => exception.kind === "unavailable" && rangesOverlap(
        startsAt,
        endsAt,
        databaseTimestampToUtcDate(exception.starts_at),
        databaseTimestampToUtcDate(exception.ends_at),
      ))

      if (!hasBusyAppointment && !unavailable) slots.push({ label, startsAt, endsAt })
    }
  }

  return slots
}

export async function createPublicAppointment(input: {
  slug: string
  serviceId: string
  professionalId: string
  date: string
  time: string
  clientName: string
  clientPhone: string
  clientEmail: string | null
}) {
  if (!sql) throw new Error("DATABASE_URL is required to create appointments")

  const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, input.slug),
    })

    if (!tenant?.active || tenant.status === "inactive" || tenant.booking_page_status === "draft") {
      return { ok: false as const, status: 404, error: "Negocio no disponible" }
    }

    if (tenant.booking_page_status !== "published") {
      return { ok: false as const, status: 409, error: "Las reservas online estan temporalmente pausadas" }
    }

  const clientEmail = normalizeEmail(input.clientEmail)
  const clientPhone = normalizePhone(input.clientPhone)
  const startsAt = zonedDateTimeToUtc(input.date, input.time, tenant.timezone)
  if (!startsAt) return { ok: false as const, status: 400, error: "Fecha u hora inválida" }

  const service = await db.query.services.findFirst({
      where: and(eq(services.id, input.serviceId), eq(services.tenant_id, tenant.id), eq(services.active, true)),
    })

    if (!service) return { ok: false as const, status: 404, error: "Servicio no disponible" }

  const professional = await db.query.professionals.findFirst({
      where: and(eq(professionals.id, input.professionalId), eq(professionals.tenant_id, tenant.id), eq(professionals.active, true)),
    })

    if (!professional) return { ok: false as const, status: 404, error: "Profesional no disponible" }

  const assignment = await db.query.professionalServices.findFirst({
      where: and(
        eq(professionalServices.tenant_id, tenant.id),
        eq(professionalServices.professional_id, professional.id),
        eq(professionalServices.service_id, service.id),
        eq(professionalServices.active, true),
      ),
    })

    if (!assignment) return { ok: false as const, status: 400, error: "El profesional no realiza este servicio" }

  const endsAt = new Date(startsAt.getTime() + service.duration_min * 60 * 1000)
    const now = new Date()
    const minStart = new Date(now.getTime() + tenant.booking_min_notice_min * 60 * 1000)
    const maxStart = new Date(now.getTime() + tenant.booking_horizon_days * 24 * 60 * 60 * 1000)

  if (startsAt < minStart || startsAt > maxStart) {
      return { ok: false as const, status: 400, error: "Horario fuera del rango de reserva permitido" }
    }

  const weekdayOk = await isInsideWeeklyAvailability(professional.id, startsAt, endsAt, tenant.timezone)
    if (!weekdayOk) return { ok: false as const, status: 409, error: "Horario no disponible" }

  const conflict = await hasAppointmentConflict(professional.id, startsAt, endsAt)
    if (conflict) return { ok: false as const, status: 409, error: "Ese horario acaba de ser tomado" }

  try {
    const match = await findReusableCustomer(tenant.id, clientEmail, clientPhone)
    if (match.conflict) return { ok: false as const, status: 409, error: "No pudimos completar la reserva. Contacta al negocio." }
    const startsAtSql = utcDateToDatabaseTimestamp(startsAt)
    const endsAtSql = utcDateToDatabaseTimestamp(endsAt)

    const rows = await sql`
      WITH new_customer AS (
        INSERT INTO customers (tenant_id, name, phone, email)
        SELECT ${tenant.id}, ${input.clientName}, ${clientPhone || null}, ${clientEmail || null}
        WHERE ${match.customer?.id ?? null}::uuid IS NULL
        RETURNING id
      ),
      selected_customer AS (
        SELECT ${match.customer?.id ?? null}::uuid AS id WHERE ${match.customer?.id ?? null}::uuid IS NOT NULL
        UNION ALL
        SELECT id FROM new_customer
        LIMIT 1
      ),
      new_appointment AS (
        INSERT INTO appointments (
          tenant_id, professional_id, service_id, customer_id, client_name,
          client_phone, client_email, starts_at, ends_at, status, source, booked_by
        )
        SELECT
          ${tenant.id}, ${professional.id}, ${service.id}, selected_customer.id, ${input.clientName},
          ${clientPhone || null}, ${clientEmail || null}, ${startsAtSql}::timestamp, ${endsAtSql}::timestamp,
          ${tenant.auto_confirm_appointments ? "confirmed" : "pending"}, 'public', 'client'
        FROM selected_customer
        RETURNING id, status
      )
      SELECT id, status FROM new_appointment
    `

    const appointment = rows[0] as { id: string, status: "pending" | "confirmed" }
    const emailInput = {
      tenantName: tenant.name,
      tenantEmail: tenant.email,
      tenantSlug: tenant.slug,
      tenantPhone: tenant.phone,
      clientName: input.clientName,
      clientEmail,
      serviceName: service.name,
      professionalName: professional.name,
      date: input.date,
      time: input.time,
      timezone: tenant.timezone,
      status: appointment.status,
      cancellationPolicy: tenant.cancellation_policy,
      postBookingInstructions: tenant.post_booking_instructions,
    }

    try {
      await Promise.all([
        sendBookingConfirmationToClient(emailInput),
        sendBookingNotificationToTenant({ ...emailInput, appointmentId: appointment.id }),
      ])
    } catch (emailError) {
      logEvent({
        event: "booking_email_failed",
        severity: "error",
        route: "/api/appointments",
        tenantId: tenant.id,
        code: emailError instanceof Error ? emailError.message : "unknown",
      })
    }

    return { ok: true as const, appointment, status: appointment.status }
  } catch (error) {
    const pgError = error as { code?: string, constraint?: string }
    if (pgError.code === "23P01" || pgError.constraint === "appointments_no_active_overlap") {
      return { ok: false as const, status: 409, error: "El horario acaba de ser reservado. Selecciona otro horario." }
    }

    console.error("slotly.booking_db_error", { tenantId: tenant.id, professionalId: professional.id, code: pgError.code })
    throw error
  }
}
