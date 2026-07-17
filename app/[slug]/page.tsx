import type { Metadata } from "next"
import type { CSSProperties } from "react"
import { Calendar, Clock, Mail, MapPin, Phone } from "lucide-react"
import { notFound } from "next/navigation"
import { db } from "../db"
import { professionalServices, professionals, tenants } from "../db/schema"
import { and, eq, inArray } from "drizzle-orm"
import { getBookableServices } from "../lib/booking"
import { publicMetadataTitle, readableTextColor } from "../lib/business-settings"

type PageProps = { params: Promise<{ slug: string }> }

async function loadPublicBusiness(slug: string) {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, slug) })
  if (!tenant?.active || tenant.status === "inactive" || tenant.booking_page_status === "draft") return null

  const services = tenant.booking_page_status === "published" ? await getBookableServices(tenant.id) : []
  const serviceIds = services.map((service) => service.id)
  const assignments = serviceIds.length
    ? await db.query.professionalServices.findMany({
      where: and(eq(professionalServices.tenant_id, tenant.id), eq(professionalServices.active, true), inArray(professionalServices.service_id, serviceIds)),
    })
    : []
  const professionalIds = [...new Set(assignments.map((assignment) => assignment.professional_id))]
  const professionalList = professionalIds.length
    ? await db.query.professionals.findMany({
      where: and(eq(professionals.tenant_id, tenant.id), eq(professionals.active, true), inArray(professionals.id, professionalIds)),
    })
    : []

  return { tenant, services, assignments, professionalList }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const business = await loadPublicBusiness(slug)
  if (!business) return { title: "Negocio no disponible", robots: { index: false, follow: false } }
  const description = business.tenant.description ?? `Reserva horas online en ${business.tenant.name}.`
  return {
    title: publicMetadataTitle(business.tenant.name),
    description,
    alternates: { canonical: `/${business.tenant.slug}` },
    openGraph: {
      title: publicMetadataTitle(business.tenant.name),
      description,
      type: "website",
      images: business.tenant.logo_url ? [{ url: business.tenant.logo_url }] : undefined,
    },
    robots: { index: business.tenant.booking_page_status === "published", follow: business.tenant.booking_page_status === "published" },
  }
}

export default async function PublicPage({ params }: PageProps) {
  const { slug } = await params
  const business = await loadPublicBusiness(slug)
  if (!business) return notFound()

  const { tenant, services, assignments, professionalList } = business
  const brand = tenant.brand_color
  const brandText = readableTextColor(brand)
  const reservable = tenant.booking_page_status === "published"

  return (
    <main className="public-page" style={{ "--brand": brand, "--brand-text": brandText } as CSSProperties}>
      <nav className="public-nav">
        <a href={`/${tenant.slug}`} className="public-brand">
          <span style={tenant.logo_url ? { backgroundImage: `url(${tenant.logo_url})` } : undefined}>{tenant.logo_url ? "" : tenant.name.slice(0, 1)}</span>
          <strong>{tenant.name}</strong>
        </a>
        <div>
          <a href="#contacto">Contacto</a>
          {reservable && <a className="public-button" href={`/${tenant.slug}/reservar`}><Calendar size={16} /> Reservar</a>}
        </div>
      </nav>

      <section className="public-hero">
        <div>
          <p className="eyebrow">{reservable ? "Agenda online disponible" : "Reservas pausadas"}</p>
          <h1>{tenant.name}</h1>
          {tenant.description && <p>{tenant.description}</p>}
          <div className="public-contact-row">
            {tenant.address && <span><MapPin size={15} /> {tenant.address}</span>}
            {tenant.phone && <span><Phone size={15} /> {tenant.phone}</span>}
            {tenant.email && <span><Mail size={15} /> {tenant.email}</span>}
          </div>
          {reservable ? (
            <a className="public-hero-button" href={`/${tenant.slug}/reservar`}><Calendar size={18} /> Reservar hora</a>
          ) : (
            <p className="paused-notice">Las reservas online estan temporalmente pausadas. Puedes contactar al negocio por sus canales publicados.</p>
          )}
        </div>
      </section>

      <section id="servicios" className="public-section">
        <header>
          <h2>Servicios</h2>
          <p>Servicios activos con profesionales disponibles.</p>
        </header>
        <div className="public-card-grid">
          {services.map((service) => {
            const names = assignments
              .filter((assignment) => assignment.service_id === service.id)
              .map((assignment) => professionalList.find((professional) => professional.id === assignment.professional_id)?.name)
              .filter(Boolean)
            return (
              <article className="public-card" key={service.id}>
                <h3>{service.name}</h3>
                {service.description && <p>{service.description}</p>}
                <div><span><Clock size={14} /> {service.duration_min} min</span>{service.price && <strong>${Number(service.price).toLocaleString("es-CL")}</strong>}</div>
                <small>{names.join(", ")}</small>
              </article>
            )
          })}
          {!services.length && <p className="muted-copy">No hay servicios reservables publicados en este momento.</p>}
        </div>
      </section>

      {professionalList.length > 0 && (
        <section className="public-section muted-band">
          <header>
            <h2>Profesionales</h2>
            <p>Equipo disponible para reservas online.</p>
          </header>
          <div className="professional-strip">
            {professionalList.map((professional) => (
              <article key={professional.id}>
                <span>{professional.name.slice(0, 1)}</span>
                <strong>{professional.name}</strong>
              </article>
            ))}
          </div>
        </section>
      )}

      <section id="contacto" className="public-section public-info">
        <div>
          <h2>Informacion para reservar</h2>
          <p>Zona horaria: {tenant.timezone}. Las horas se muestran segun la configuracion del negocio.</p>
          {tenant.cancellation_policy && <p><strong>Politica de cancelacion:</strong> {tenant.cancellation_policy}</p>}
          {tenant.post_booking_instructions && <p><strong>Despues de reservar:</strong> {tenant.post_booking_instructions}</p>}
        </div>
        {reservable && <a className="public-button" href={`/${tenant.slug}/reservar`}>Reservar hora</a>}
      </section>

      <footer className="public-footer">Reservas gestionadas con Slotly</footer>
    </main>
  )
}
