"use client"

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="beta-pill">Slotly</span>
        <h1>No pudimos cargar esta vista</h1>
        <p>Intenta nuevamente. Si el problema continua, contacta al equipo de soporte con el contexto de la accion que estabas realizando.</p>
        <button className="primary-action" type="button" onClick={() => reset()}>Reintentar</button>
      </section>
    </main>
  )
}
