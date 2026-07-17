import { and, eq } from "drizzle-orm"
import { db } from "../db"
import { appointments, availability, professionalServices, professionals, services, tenants } from "../db/schema"

export type OnboardingStep = {
  id: string
  label: string
  description: string
  href: string
  complete: boolean
}

export async function getOnboardingStatus(tenantId: string) {
  const [tenant, activeServices, activeProfessionals, activeAssignments, activeAvailability, firstAppointment] = await Promise.all([
    db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) }),
    db.query.services.findMany({ where: and(eq(services.tenant_id, tenantId), eq(services.active, true)) }),
    db.query.professionals.findMany({ where: and(eq(professionals.tenant_id, tenantId), eq(professionals.active, true)) }),
    db.query.professionalServices.findMany({ where: and(eq(professionalServices.tenant_id, tenantId), eq(professionalServices.active, true)) }),
    db.select({ id: availability.id })
      .from(availability)
      .innerJoin(professionals, eq(availability.professional_id, professionals.id))
      .where(and(eq(professionals.tenant_id, tenantId), eq(professionals.active, true), eq(availability.active, true))),
    db.query.appointments.findFirst({ where: eq(appointments.tenant_id, tenantId) }),
  ])

  const businessComplete = Boolean(tenant?.name && tenant.slug && (tenant.email || tenant.phone))
  const hasService = activeServices.length > 0
  const hasProfessional = activeProfessionals.length > 0
  const hasAssignment = activeAssignments.some((assignment) =>
    activeServices.some((service) => service.id === assignment.service_id) &&
    activeProfessionals.some((professional) => professional.id === assignment.professional_id)
  )
  const hasAvailability = activeAvailability.length > 0
  const published = tenant?.booking_page_status === "published"
  const hasFirstAppointment = Boolean(firstAppointment)

  const steps: OnboardingStep[] = [
    { id: "business", label: "Completa tu negocio", description: "Nombre, contacto, slug y marca basica.", href: "/dashboard/configuracion", complete: businessComplete },
    { id: "service", label: "Crea un servicio activo", description: "Define que pueden reservar tus clientes.", href: "/dashboard/servicios", complete: hasService },
    { id: "professional", label: "Agrega un profesional activo", description: "Indica quien realizara las atenciones.", href: "/dashboard/profesionales", complete: hasProfessional },
    { id: "assignment", label: "Asigna servicios", description: "Conecta servicio y profesional reservable.", href: "/dashboard/profesionales", complete: hasAssignment },
    { id: "availability", label: "Configura disponibilidad", description: "Abre horarios semanales para reservas.", href: "/dashboard/disponibilidad", complete: hasAvailability },
    { id: "published", label: "Publica la pagina", description: "Habilita la reserva publica cuando todo este listo.", href: "/dashboard/configuracion", complete: published },
    { id: "first-appointment", label: "Recibe o crea una cita", description: "Valida que el flujo llegue a Agenda.", href: "/dashboard/agenda", complete: hasFirstAppointment },
  ]

  const completed = steps.filter((step) => step.complete).length
  return {
    tenant,
    steps,
    completed,
    total: steps.length,
    complete: completed === steps.length,
    canPublish: businessComplete && hasService && hasProfessional && hasAssignment && hasAvailability,
    missingForPublish: steps.filter((step) => ["business", "service", "professional", "assignment", "availability"].includes(step.id) && !step.complete),
  }
}
