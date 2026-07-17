import Link from "next/link"
import { eq } from "drizzle-orm"
import { db } from "../db"
import { tenants } from "../db/schema"
import { getOnboardingStatus } from "../lib/onboarding"
import { statusMeta } from "../lib/appointment-status"
import { dashboardStats, listAppointmentsForContext } from "../lib/private-appointments"
import { requireSessionContext } from "../lib/session"
import { databaseTimestampToUtcDate } from "../lib/time"
import { Alert, ButtonLink, EmptyState, MetricCard, PageHeader, PageLayout, SectionHeader, Surface } from "../components/ui"

function startOfChileDay() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
  return new Date(`${parts}T00:00:00.000Z`)
}

function formatWhen(value: Date | string) {
  const date = databaseTimestampToUtcDate(value)
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Santiago",
  }).format(date)
}

export default async function DashboardPage() {
  const context = await requireSessionContext()
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, context.tenantId) })
  const today = startOfChileDay()
  const tomorrow = new Date(today)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const horizon = new Date(today)
  horizon.setUTCDate(horizon.getUTCDate() + 14)

  const [stats, nextAppointments] = await Promise.all([
    dashboardStats(context, today, tomorrow),
    listAppointmentsForContext(context, { start: today, end: horizon }),
  ])
  const onboarding = context.role === "owner" ? await getOnboardingStatus(context.tenantId) : null
  const pendingAppointments = nextAppointments.filter((appointment) => appointment.status === "pending")

  return (
    <PageLayout>
      <PageHeader
        eyebrow={tenant?.name}
        title="Panel operativo"
        description="Una vista clara del dia, las reservas pendientes y el estado del negocio."
      />

      <section className="metric-grid">
        <MetricCard label="Citas hoy" value={stats.today} detail="Agenda del dia" tone="info" />
        <MetricCard label="Pendientes" value={stats.pending} detail="Requieren revision" tone={stats.pending > 0 ? "warning" : "neutral"} />
        <MetricCard label="Confirmadas" value={stats.confirmed} detail="Reservas activas" tone="success" />
        <MetricCard label="Proximas" value={stats.upcoming} detail="Desde ahora" />
      </section>

      {onboarding && (
        <Surface className="onboarding-panel" aria-labelledby="onboarding-title">
          <SectionHeader
            title="Prepara tu espacio de reservas"
            description={`${onboarding.completed} de ${onboarding.total} pasos completados`}
            action={<ButtonLink variant="secondary" size="sm" href="/dashboard/configuracion">Revisar configuracion</ButtonLink>}
          />
          <div className="onboarding-progress" aria-hidden="true"><span style={{ width: `${Math.round((onboarding.completed / onboarding.total) * 100)}%` }} /></div>
          <div className="onboarding-steps">
            {onboarding.steps.map((step) => (
              <article key={step.id} className={step.complete ? "done" : ""}>
                <div>
                  <strong>{step.label}</strong>
                  <span>{step.description}</span>
                </div>
                {step.complete ? <em>Listo</em> : <Link className="secondary-link compact" href={step.href}>Resolver</Link>}
              </article>
            ))}
          </div>
        </Surface>
      )}

      {pendingAppointments.length > 0 && (
        <Alert tone="warning" title={`${pendingAppointments.length} cita${pendingAppointments.length === 1 ? "" : "s"} pendiente${pendingAppointments.length === 1 ? "" : "s"}`}>
          Revisa solicitudes recientes para confirmar o reagendar a tiempo.
        </Alert>
      )}

      <section className="dashboard-columns">
        <Surface>
          <SectionHeader title="Proximas citas" description="Reservas programadas para los siguientes 14 dias." action={<Link href="/dashboard/citas">Ver todas</Link>} />
          {nextAppointments.length === 0 ? (
            <EmptyState
              title="No hay citas proximas"
              description="Cuando entren reservas, apareceran aqui con hora, cliente, servicio y estado."
              action={<ButtonLink size="sm" href="/dashboard/agenda">Crear cita manual</ButtonLink>}
            />
          ) : (
            <div className="appointment-list">
              {nextAppointments.slice(0, 8).map((appointment) => (
                <article key={appointment.id}>
                  <div>
                    <strong>{appointment.clientName}</strong>
                    <span>{appointment.serviceName} con {appointment.professionalName}</span>
                  </div>
                  <div>
                    <span>{formatWhen(appointment.startsAt)}</span>
                    <em className={`status-badge status-${appointment.status}`}>{statusMeta[appointment.status].label}</em>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Surface>

        <Surface>
          <SectionHeader title="Estado del negocio" description="Senales operativas disponibles hoy." />
          <div className="compact-stats">
            <div><strong>{stats.activeServices}</strong><span>Servicios activos</span></div>
            <div><strong>{stats.activeProfessionals}</strong><span>Profesionales activos</span></div>
            <div><strong>{stats.cancelledToday}</strong><span>Canceladas hoy</span></div>
            <div><strong>{context.role === "owner" ? "Owner" : "Staff"}</strong><span>Rol actual</span></div>
          </div>
        </Surface>
      </section>
    </PageLayout>
  )
}
