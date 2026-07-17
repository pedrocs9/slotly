import Link from "next/link"

export default function NotFound() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="beta-pill">No disponible</span>
        <h1>Pagina no encontrada</h1>
        <p>El negocio puede estar en borrador, pausado o el enlace podria haber cambiado.</p>
        <Link className="primary-link" href="/">Volver al inicio</Link>
      </section>
    </main>
  )
}
