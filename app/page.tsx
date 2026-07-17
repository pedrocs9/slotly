import { CalendarDays, Clock, ShieldCheck, Users } from "lucide-react"
import Link from "next/link"

export default function Home() {
  return (
    <main className="marketing-page">
      <section className="marketing-hero">
        <span className="beta-pill">Beta privada para negocios de servicios</span>
        <h1>Slotly</h1>
        <p>
          Agenda online para publicar disponibilidad, recibir solicitudes y operar reservas
          con claridad desde un panel privado.
        </p>
        <div className="hero-actions">
          <a className="primary-link" href="mailto:contacto@pgstudio.cl?subject=Solicitar acceso a Slotly">Solicitar acceso</a>
          <Link className="secondary-link" href="/demo">Ver demo publica</Link>
        </div>
      </section>

      <section className="feature-grid" aria-label="Funciones principales">
        {[
          { icon: CalendarDays, title: "Reservas sin friccion", text: "Pagina publica por negocio con servicios, profesionales y solicitud de hora." },
          { icon: Clock, title: "Agenda bajo control", text: "Disponibilidad semanal, excepciones y validacion de conflictos antes de confirmar." },
          { icon: Users, title: "Operacion diaria", text: "Panel privado para revisar citas, clientes, profesionales y bloqueos." },
          { icon: ShieldCheck, title: "Acceso protegido", text: "Roles owner/staff y datos aislados por negocio para operar con confianza." },
        ].map(({ icon: Icon, title, text }) => (
          <article key={title} className="feature-card">
            <Icon size={22} />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section className="roadmap-band">
        <h2>Construido para una beta guiada</h2>
        <p>
          Slotly esta preparado como base de beta privada. Pagos online, WhatsApp,
          SMS, Google Calendar bidireccional, marketplace y automatizaciones avanzadas
          quedan como roadmap, no como funciones disponibles.
        </p>
      </section>
    </main>
  )
}