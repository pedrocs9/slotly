import { requireSessionContext } from "../../lib/session"

const ownerOnlyModules = new Set(["negocio", "pagina-publica", "cuenta"])

export default async function ComingSoonPage({ searchParams }: { searchParams: Promise<{ modulo?: string }> }) {
  const context = await requireSessionContext()
  const params = await searchParams
  const moduleName = params.modulo ?? "Modulo"

  if (ownerOnlyModules.has(moduleName) && context.role !== "owner") {
    return (
      <main className="dashboard-page">
        <section className="panel">
          <p className="eyebrow">Sin permisos</p>
          <h1>Este modulo es exclusivo para owner</h1>
          <p className="muted-copy">La sesion staff mantiene acceso a agenda y citas operativas.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="dashboard-page">
      <section className="panel">
        <p className="eyebrow">Proximamente</p>
        <h1>{moduleName} estara disponible en un proximo sprint</h1>
        <p className="muted-copy">Este acceso queda visible para mostrar la estructura operativa, sin simular CRUD ni funciones fuera del alcance actual.</p>
      </section>
    </main>
  )
}
