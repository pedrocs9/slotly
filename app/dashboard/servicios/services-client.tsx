"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

type ServiceRow = { id: string; name: string; description: string | null; durationMin: number; price: string | null; color: string | null; active: boolean; professionalCount: number; futureAppointments: number }
type Professional = { id: string; name: string }
type Assignment = { professional_id: string; service_id: string }

const emptyForm = { id: "", name: "", description: "", durationMin: 60, price: "", color: "#5b6ee1", active: true, professionalIds: [] as string[] }

export function ServicesClient() {
  const [services, setServices] = useState<ServiceRow[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState("")
  const stats = useMemo(() => ({
    total: services.length,
    active: services.filter((item) => item.active).length,
    inactive: services.filter((item) => !item.active).length,
    withoutProfessionals: services.filter((item) => Number(item.professionalCount) === 0).length,
    averageDuration: services.length ? Math.round(services.reduce((sum, item) => sum + Number(item.durationMin), 0) / services.length) : 0,
  }), [services])

  const load = useCallback(() => {
    const params = new URLSearchParams({ q, status })
    fetch(`/api/dashboard/services?${params.toString()}`).then((res) => res.json()).then((data) => setServices(data.services ?? []))
    fetch("/api/dashboard/options").then((res) => res.json()).then((data) => { setProfessionals(data.professionals ?? []); setAssignments(data.assignments ?? []) })
  }, [q, status])

  useEffect(() => {
    const timer = window.setTimeout(load, 200)
    return () => window.clearTimeout(timer)
  }, [load])

  function edit(service: ServiceRow) {
    setForm({
      id: service.id,
      name: service.name,
      description: service.description ?? "",
      durationMin: service.durationMin,
      price: service.price ?? "",
      color: service.color ?? "#5b6ee1",
      active: service.active,
      professionalIds: assignments.filter((item) => item.service_id === service.id).map((item) => item.professional_id),
    })
  }

  async function save(nextForm = form) {
    setMessage("")
    const res = await fetch("/api/dashboard/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextForm) })
    const data = await res.json()
    if (!res.ok) setMessage(data.error ?? "No se pudo guardar")
    else {
      setMessage("Servicio guardado")
      setForm(emptyForm)
      load()
    }
  }

  function toggleProfessional(id: string) {
    setForm((current) => ({ ...current, professionalIds: current.professionalIds.includes(id) ? current.professionalIds.filter((item) => item !== id) : [...current.professionalIds, id] }))
  }

  return (
    <main className="dashboard-page admin-page">
      <section className="agenda-hero"><div><p className="eyebrow">Servicios</p><h1>Servicios del negocio</h1><span>Define que se puede reservar y que profesionales lo realizan.</span></div></section>
      <section className="customer-metrics">
        <article><strong>{stats.total}</strong><span>Total</span></article><article><strong>{stats.active}</strong><span>Activos</span></article><article><strong>{stats.inactive}</strong><span>Inactivos</span></article><article><strong>{stats.withoutProfessionals}</strong><span>Sin profesionales</span></article><article><strong>{stats.averageDuration}</strong><span>Min promedio</span></article>
      </section>
      <section className="customer-workbar"><label>Buscar<input value={q} onChange={(event) => setQ(event.target.value)} /></label><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="without-professionals">Sin profesionales</option></select></label><button className="secondary-link compact" type="button" onClick={() => { setQ(""); setStatus("") }}>Limpiar</button><span>{services.length} resultados</span></section>
      {message && <p className="agenda-notice">{message}</p>}
      <section className="admin-layout">
        <div className="admin-list">
          {services.length === 0 ? <p className="muted-copy">Crea el primer servicio para comenzar a recibir reservas.</p> : services.map((service) => (
            <article key={service.id} className="admin-row">
              <span className="service-color" style={{ background: service.color ?? "#5b6ee1" }} />
              <div><strong>{service.name}</strong><small>{service.description ?? "Sin descripcion"}</small></div>
              <span>{service.durationMin} min · {service.price ? `$${service.price}` : "Sin precio"}</span>
              <span>{service.active ? "Activo" : "Inactivo"} · {service.professionalCount} profesionales</span>
              <div className="modal-actions"><button className="secondary-link compact" type="button" onClick={() => edit(service)}>Editar</button><button className="secondary-link compact" type="button" onClick={() => save({ id: service.id, name: service.name, description: service.description ?? "", durationMin: service.durationMin, price: service.price ?? "", color: service.color ?? "#5b6ee1", professionalIds: assignments.filter((item) => item.service_id === service.id).map((item) => item.professional_id), active: !service.active })}>{service.active ? "Desactivar" : "Activar"}</button></div>
            </article>
          ))}
        </div>
        <aside className="panel admin-form">
          <h2>{form.id ? "Editar servicio" : "Nuevo servicio"}</h2>
          <label>Nombre<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Descripcion<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <div className="time-block-row"><label>Duracion<input type="number" value={form.durationMin} onChange={(event) => setForm({ ...form, durationMin: Number(event.target.value) })} /></label><label>Precio<input value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label><label>Color<input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></label></div>
          <label className="consent"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Activo para nuevas reservas</label>
          <div className="multi-select"><strong>Profesionales</strong>{professionals.map((professional) => <label className="consent" key={professional.id}><input type="checkbox" checked={form.professionalIds.includes(professional.id)} onChange={() => toggleProfessional(professional.id)} /> {professional.name}</label>)}</div>
          {form.professionalIds.length === 0 && <p className="muted-copy">Sin profesionales asociados no aparecera publicamente.</p>}
          <button className="primary-link compact" type="button" onClick={() => save()}>Guardar servicio</button>
        </aside>
      </section>
    </main>
  )
}
