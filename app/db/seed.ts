import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { and, eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import * as schema from "./schema"
import { requireDatabaseUrl } from "../../scripts/load-env"
import { utcDateToDatabaseTimestamp, zonedDateTimeToUtc } from "../lib/time"

const sql = neon(requireDatabaseUrl("run the seed"))
const db = drizzle(sql, { schema })

async function upsertDemoTenant() {
  const existing = await db.query.tenants.findFirst({
    where: eq(schema.tenants.slug, "podologia-silvana"),
  })

  const values = {
    name: "Podologia Clinica Silvana Alvarez",
    slug: "podologia-silvana",
    plan: "pro" as const,
    status: "private_beta" as const,
    timezone: "America/Santiago",
    phone: "+56 9 8765 4321",
    email: "contacto@podologiasilvana.cl",
    address: "Av. Providencia 1234, Of. 502, Providencia, Santiago",
    description: "Clinica de podologia profesional para cuidado preventivo, tratamientos y bienestar del pie.",
    active: true,
    booking_min_notice_min: 120,
    booking_horizon_days: 45,
    slot_interval_min: 30,
    auto_confirm_appointments: false,
    cancellation_policy: "Para cancelar o reprogramar, contacta al negocio con al menos 24 horas de anticipacion.",
    booking_page_status: "published",
    brand_color: "#5b6ee1",
    post_booking_instructions: "Recibiras contacto del equipo para confirmar cualquier detalle antes de tu atencion.",
  }

  if (existing) {
    const [tenant] = await db.update(schema.tenants)
      .set(values)
      .where(eq(schema.tenants.id, existing.id))
      .returning()
    return tenant
  }

  const [tenant] = await db.insert(schema.tenants).values(values).returning()
  return tenant
}

async function upsertProfessional(tenantId: string, name: string, email: string, role: "owner" | "staff") {
  const existing = await db.query.professionals.findFirst({
    where: eq(schema.professionals.email, email),
  })

  const values = { tenant_id: tenantId, name, email, role, active: true }

  if (existing) {
    const [professional] = await db.update(schema.professionals)
      .set(values)
      .where(eq(schema.professionals.id, existing.id))
      .returning()
    return professional
  }

  const [professional] = await db.insert(schema.professionals).values(values).returning()
  return professional
}

async function upsertUser(tenantId: string, professionalId: string, name: string, email: string, role: "owner" | "staff", password: string) {
  const passwordHash = await bcrypt.hash(password, 12)
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) })
  const values = { tenant_id: tenantId, professional_id: professionalId, name, email, password_hash: passwordHash, role, active: true }

  if (existing) {
    await db.update(schema.users).set(values).where(eq(schema.users.id, existing.id))
    return
  }

  await db.insert(schema.users).values(values)
}

async function upsertService(tenantId: string, service: {
  name: string
  description: string
  duration_min: number
  price: string
  color: string
  active?: boolean
}) {
  const existing = await db.query.services.findFirst({
    where: and(eq(schema.services.tenant_id, tenantId), eq(schema.services.name, service.name)),
  })

  const { active = true, ...serviceValues } = service
  const values = { ...serviceValues, tenant_id: tenantId, active }

  if (existing) {
    const [updated] = await db.update(schema.services).set(values).where(eq(schema.services.id, existing.id)).returning()
    return updated
  }

  const [created] = await db.insert(schema.services).values(values).returning()
  return created
}

async function ensureProfessionalService(tenantId: string, professionalId: string, serviceId: string) {
  await db.insert(schema.professionalServices)
    .values({ tenant_id: tenantId, professional_id: professionalId, service_id: serviceId, active: true })
    .onConflictDoUpdate({
      target: [schema.professionalServices.professional_id, schema.professionalServices.service_id],
      set: { active: true },
    })
}

async function ensureAvailability(professionalId: string) {
  const blocks = [
    { weekday: 1, start_time: "09:00", end_time: "13:00" },
    { weekday: 1, start_time: "15:00", end_time: "19:00" },
    { weekday: 2, start_time: "09:00", end_time: "13:00" },
    { weekday: 2, start_time: "15:00", end_time: "19:00" },
    { weekday: 3, start_time: "09:00", end_time: "13:00" },
    { weekday: 3, start_time: "15:00", end_time: "19:00" },
    { weekday: 4, start_time: "09:00", end_time: "13:00" },
    { weekday: 4, start_time: "15:00", end_time: "19:00" },
    { weekday: 5, start_time: "09:00", end_time: "17:00" },
    { weekday: 6, start_time: "09:00", end_time: "13:00" },
  ]

  for (const block of blocks) {
    await db.insert(schema.availability)
      .values({ ...block, professional_id: professionalId, active: true })
      .onConflictDoUpdate({
        target: [schema.availability.professional_id, schema.availability.weekday, schema.availability.start_time, schema.availability.end_time],
        set: { active: true },
      })
  }
}

async function ensureException(input: {
  tenantId: string
  professionalId: string
  kind: "unavailable" | "available"
  reason: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  allDay: boolean
}) {
  const startsAt = zonedDateTimeToUtc(input.startDate, input.startTime, "America/Santiago")
  const endsAt = zonedDateTimeToUtc(input.endDate, input.endTime, "America/Santiago")
  if (!startsAt || !endsAt) return
  const existing = await db.query.availabilityExceptions.findFirst({
    where: and(eq(schema.availabilityExceptions.tenant_id, input.tenantId), eq(schema.availabilityExceptions.professional_id, input.professionalId), eq(schema.availabilityExceptions.reason, input.reason)),
  })
  const values = {
    tenant_id: input.tenantId,
    professional_id: input.professionalId,
    kind: input.kind,
    reason: input.reason,
    starts_at: startsAt,
    ends_at: endsAt,
    all_day: input.allDay,
  }
  if (existing) await db.update(schema.availabilityExceptions).set(values).where(eq(schema.availabilityExceptions.id, existing.id))
  else await db.insert(schema.availabilityExceptions).values(values)
}

function addDaysKey(days: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
  const date = new Date(`${parts}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function upsertCustomer(tenantId: string, name: string, email: string, phone: string) {
  const existing = await db.query.customers.findFirst({
    where: and(eq(schema.customers.tenant_id, tenantId), eq(schema.customers.email, email)),
  })
  const values = { tenant_id: tenantId, name, email, phone }
  if (existing) {
    const [customer] = await db.update(schema.customers).set(values).where(eq(schema.customers.id, existing.id)).returning()
    return customer
  }
  const [customer] = await db.insert(schema.customers).values(values).returning()
  return customer
}

async function ensureDemoAppointment(input: {
  tenantId: string
  professionalId: string
  serviceId: string
  customerId: string
  clientName: string
  clientEmail: string
  clientPhone: string
  date: string
  time: string
  durationMin: number
  status: "pending" | "confirmed" | "cancelled" | "no_show" | "completed"
  notes?: string
}) {
  const startsAt = zonedDateTimeToUtc(input.date, input.time, "America/Santiago")
  if (!startsAt) throw new Error(`Invalid demo appointment time: ${input.date} ${input.time}`)
  const endsAt = new Date(startsAt.getTime() + input.durationMin * 60 * 1000)
  const startsAtValue = utcDateToDatabaseTimestamp(startsAt)
  const endsAtValue = utcDateToDatabaseTimestamp(endsAt)
  const existing = await db.query.appointments.findFirst({
    where: and(eq(schema.appointments.tenant_id, input.tenantId), eq(schema.appointments.client_email, input.clientEmail)),
  })

  if (existing) {
    await sql`
      update appointments
      set professional_id = ${input.professionalId},
          service_id = ${input.serviceId},
          customer_id = ${input.customerId},
          client_name = ${input.clientName},
          client_phone = ${input.clientPhone},
          starts_at = ${startsAtValue}::timestamp,
          ends_at = ${endsAtValue}::timestamp,
          status = ${input.status}::status,
          source = 'manual',
          notes = ${input.notes ?? null},
          booked_by = 'staff',
          updated_at = now()
      where id = ${existing.id}
    `
    return
  }

  await sql`
    insert into appointments (
      tenant_id, professional_id, service_id, customer_id, client_name, client_phone,
      client_email, starts_at, ends_at, status, source, notes, booked_by, updated_at
    )
    values (
      ${input.tenantId}, ${input.professionalId}, ${input.serviceId}, ${input.customerId}, ${input.clientName}, ${input.clientPhone},
      ${input.clientEmail}, ${startsAtValue}::timestamp, ${endsAtValue}::timestamp, ${input.status}::status, 'manual', ${input.notes ?? null}, 'staff', now()
    )
  `
}

async function seed() {
  console.log("Starting idempotent Slotly demo seed...")

  const tenant = await upsertDemoTenant()
  const owner = await upsertProfessional(tenant.id, "Silvana Alvarez", "silvana@podologiasilvana.cl", "owner")
  const staff = await upsertProfessional(tenant.id, "Camila Torres", "camila@podologiasilvana.cl", "staff")
  const noSchedule = await upsertProfessional(tenant.id, "Diego Sin Horario", "diego@podologiasilvana.cl", "staff")

  await upsertUser(tenant.id, owner.id, owner.name, owner.email, "owner", process.env.SEED_OWNER_PASSWORD || "SlotlyBeta2026!")
  await upsertUser(tenant.id, staff.id, staff.name, staff.email, "staff", process.env.SEED_STAFF_PASSWORD || "SlotlyStaff2026!")

  const servicesData = [
    { name: "Podologia Clinica", description: "Tratamiento integral del pie, corte y arreglo de unas, durezas y cuidado preventivo.", duration_min: 60, price: "25000", color: "#5b6ee1" },
    { name: "Quiropodia", description: "Limpieza profunda, corte, limado, exfoliacion e hidratacion.", duration_min: 45, price: "18000", color: "#10b981" },
    { name: "Biomecanica y Estudio de la Pisada", description: "Analisis de marcha y pisada con recomendaciones de tratamiento.", duration_min: 90, price: "45000", color: "#0ea5e9" },
    { name: "Tratamiento Pie Diabetico", description: "Atencion especializada para pacientes con diabetes y pie de riesgo.", duration_min: 60, price: "30000", color: "#f59e0b" },
    { name: "Servicio Pausado Demo", description: "Servicio inactivo para validar que no aparece en reservas nuevas.", duration_min: 30, price: "12000", color: "#94a3b8", active: false },
  ]

  for (const item of servicesData) {
    const service = await upsertService(tenant.id, item)
    await ensureProfessionalService(tenant.id, owner.id, service.id)
    await ensureProfessionalService(tenant.id, staff.id, service.id)
    if (item.name === "Quiropodia") await ensureProfessionalService(tenant.id, noSchedule.id, service.id)
  }

  const services = await db.query.services.findMany({ where: eq(schema.services.tenant_id, tenant.id) })
  const podologia = services.find((service) => service.name === "Podologia Clinica") ?? services[0]
  const quiropodia = services.find((service) => service.name === "Quiropodia") ?? podologia
  const diabetico = services.find((service) => service.name === "Tratamiento Pie Diabetico") ?? podologia

  await ensureAvailability(owner.id)
  await ensureAvailability(staff.id)

  await ensureException({ tenantId: tenant.id, professionalId: owner.id, kind: "unavailable", reason: "Almuerzo demo", startDate: addDaysKey(2), endDate: addDaysKey(2), startTime: "13:00", endTime: "15:00", allDay: false })
  await ensureException({ tenantId: tenant.id, professionalId: staff.id, kind: "unavailable", reason: "Vacaciones demo", startDate: addDaysKey(14), endDate: addDaysKey(18), startTime: "00:00", endTime: "23:59", allDay: true })
  await ensureException({ tenantId: tenant.id, professionalId: owner.id, kind: "available", reason: "Horario especial demo", startDate: addDaysKey(7), endDate: addDaysKey(7), startTime: "10:00", endTime: "14:00", allDay: false })

  const demoCustomers = [
    await upsertCustomer(tenant.id, "Maria Gonzalez", "demo-pending@slotly.local", "+56 9 1111 1111"),
    await upsertCustomer(tenant.id, "Jorge Ramirez", "demo-confirmed@slotly.local", "+56 9 2222 2222"),
    await upsertCustomer(tenant.id, "Paula Soto", "demo-cancelled@slotly.local", "+56 9 3333 3333"),
    await upsertCustomer(tenant.id, "Ana Frecuente", "demo-noshow@slotly.local", "+56 9 4444 4444"),
  ]

  await ensureDemoAppointment({
    tenantId: tenant.id,
    professionalId: owner.id,
    serviceId: podologia.id,
    customerId: demoCustomers[0].id,
    clientName: demoCustomers[0].name,
    clientEmail: demoCustomers[0].email ?? "demo-pending@slotly.local",
    clientPhone: demoCustomers[0].phone ?? "",
    date: addDaysKey(0),
    time: "10:00",
    durationMin: podologia.duration_min,
    status: "pending",
    notes: "Demo beta: pendiente de confirmacion.",
  })

  await ensureDemoAppointment({
    tenantId: tenant.id,
    professionalId: staff.id,
    serviceId: podologia.id,
    customerId: demoCustomers[3].id,
    clientName: demoCustomers[3].name,
    clientEmail: demoCustomers[3].email ?? "demo-noshow@slotly.local",
    clientPhone: demoCustomers[3].phone ?? "",
    date: addDaysKey(-3),
    time: "10:00",
    durationMin: podologia.duration_min,
    status: "no_show",
    notes: "Demo CRM: cliente con no-show para metricas.",
  })

  await ensureDemoAppointment({
    tenantId: tenant.id,
    professionalId: staff.id,
    serviceId: quiropodia.id,
    customerId: demoCustomers[1].id,
    clientName: demoCustomers[1].name,
    clientEmail: demoCustomers[1].email ?? "demo-confirmed@slotly.local",
    clientPhone: demoCustomers[1].phone ?? "",
    date: addDaysKey(0),
    time: "12:00",
    durationMin: quiropodia.duration_min,
    status: "confirmed",
    notes: "Demo beta: cita confirmada.",
  })

  await ensureDemoAppointment({
    tenantId: tenant.id,
    professionalId: owner.id,
    serviceId: diabetico.id,
    customerId: demoCustomers[2].id,
    clientName: demoCustomers[2].name,
    clientEmail: demoCustomers[2].email ?? "demo-cancelled@slotly.local",
    clientPhone: demoCustomers[2].phone ?? "",
    date: addDaysKey(1),
    time: "11:00",
    durationMin: diabetico.duration_min,
    status: "cancelled",
    notes: "Demo beta: cita cancelada para validar liberacion de horario.",
  })

  for (const moduleName of ["reminders", "crm", "reports"] as const) {
    await db.insert(schema.tenantModules)
      .values({ tenant_id: tenant.id, module: moduleName, active: true, price: "0" })
      .onConflictDoNothing()
  }

  console.log("Seed complete")
  console.log("Public page: /podologia-silvana")
  console.log("Owner login: silvana@podologiasilvana.cl")
  console.log("Staff login: camila@podologiasilvana.cl")
}

seed().catch((err) => {
  console.error("Seed error:", err)
  process.exit(1)
})
