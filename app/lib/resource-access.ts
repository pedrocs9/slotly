import { and, eq } from "drizzle-orm"
import { db } from "../db"
import { appointments, availability, availabilityExceptions, customers, professionals, services, tenants } from "../db/schema"
import { AuthorizationError, type SessionContext, canAccessProfessional } from "./authorization"

export async function getTenantSettingsForContext(context: SessionContext) {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, context.tenantId) })
  if (!tenant) throw new AuthorizationError(404, "Negocio no encontrado")
  return tenant
}

export async function getProfessionalForContext(context: SessionContext, professionalId: string, options: { activeOnly?: boolean } = {}) {
  const professional = await db.query.professionals.findFirst({
    where: and(
      eq(professionals.id, professionalId),
      eq(professionals.tenant_id, context.tenantId),
      ...(options.activeOnly ? [eq(professionals.active, true)] : []),
    ),
  })
  if (!professional || !await canAccessProfessional(context, professional.id, options)) {
    throw new AuthorizationError(404, "Profesional no encontrado")
  }
  return professional
}

export async function getServiceForContext(context: SessionContext, serviceId: string, options: { activeOnly?: boolean } = {}) {
  const service = await db.query.services.findFirst({
    where: and(
      eq(services.id, serviceId),
      eq(services.tenant_id, context.tenantId),
      ...(options.activeOnly ? [eq(services.active, true)] : []),
    ),
  })
  if (!service) throw new AuthorizationError(404, "Servicio no encontrado")
  return service
}

export async function getCustomerForContext(context: SessionContext, customerId: string) {
  const customer = await db.query.customers.findFirst({
    where: and(eq(customers.id, customerId), eq(customers.tenant_id, context.tenantId)),
  })
  if (!customer) throw new AuthorizationError(404, "Cliente no encontrado")
  return customer
}

export async function getAppointmentForContextOrThrow(context: SessionContext, appointmentId: string) {
  const appointment = await db.query.appointments.findFirst({
    where: and(eq(appointments.id, appointmentId), eq(appointments.tenant_id, context.tenantId)),
  })
  if (!appointment || !await canAccessProfessional(context, appointment.professional_id)) {
    throw new AuthorizationError(404, "Cita no encontrada")
  }
  return appointment
}

export async function getAvailabilityBlockForContext(context: SessionContext, availabilityId: string) {
  const rows = await db
    .select({ block: availability })
    .from(availability)
    .innerJoin(professionals, eq(professionals.id, availability.professional_id))
    .where(and(
      eq(availability.id, availabilityId),
      eq(professionals.tenant_id, context.tenantId),
    ))
    .limit(1)
  const block = rows[0]?.block
  if (!block || !await canAccessProfessional(context, block.professional_id)) {
    throw new AuthorizationError(404, "Horario no encontrado")
  }
  return block
}

export async function getExceptionForContext(context: SessionContext, exceptionId: string) {
  const exception = await db.query.availabilityExceptions.findFirst({
    where: and(eq(availabilityExceptions.id, exceptionId), eq(availabilityExceptions.tenant_id, context.tenantId)),
  })
  if (!exception || !await canAccessProfessional(context, exception.professional_id)) {
    throw new AuthorizationError(404, "Bloqueo no encontrado")
  }
  return exception
}
