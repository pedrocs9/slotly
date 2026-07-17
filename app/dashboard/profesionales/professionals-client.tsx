"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

type ProfessionalRow = { id: string; name: string; email: string; role: string; active: boolean; serviceCount: number; scheduleBlocks: number; futureAppointments: number; userCount: number }
type Service = { id: string; name: string }
type Assignment = { professional_id: string; service_id: string }

const emptyForm = { id: "", name: "", email: "", role: "staff", active: true, serviceIds: [] as string[] }

export function ProfessionalsClient() {
  const [professionals, setProfessionals] = useState<ProfessionalRow[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState("")

  const load = useCallback(() => {
    const params = new URLSearchParams({ q, status })
    fetch(`/api/dashboard/professionals-admin?${params.toString()}`).then((res) => res.json()).then((data) => setProfessionals(data.professionals ?? []))
    fetch("/api/dashboard/options").then((res) => res.json()).then((data) => { setServices(data.services ?? []); setAssignments(data.assignments ?? []) })
  }, [q, status])

  useEffect(() => {
    const timer = window.setTimeout(load, 200)
    return () => window.clearTimeout(timer)
  }, [load])

  function edit(professional: ProfessionalRow) {
    setForm({ id: professional.id, name: professional.name, email: professional.email, role: professional.role, active: professional.active, serviceIds: assignments.filter((item) => item.professional_id === professional.id).map((item) => item.service_id) })
  }

  async function save(nextForm = form) {
    setMessage("")
    const res = await fetch("/api/dashboard/professionals-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextForm) })
    const data = await res.json()
    if (!res.ok) setMessage(data.error ?? "No se pudo guardar")
    else {
      setMessage("Profesional guardado")
      setForm(emptyForm)
      load()
    }
  }

  function toggleService(id: string) {
    setForm((current) => ({ ...current, serviceIds: current.serviceIds.includes(id) ? current.serviceIds.filter((item) => item !== id) : [...current.serviceIds, id] }))
  }

  return (
    <main className="dashboard-page admin-page">
      <section className="agenda-hero"><div><p className="eyebrow">Profesionales</p><h1>Equipo reservable</h1><span>Distingue profesionales reservables de usuarios con acceso staff.</span></div></section>
      <section className="customer-workbar"><label>Buscar<input value={q} onChange={(event) => setQ(event.target.value)} /></label><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></label><button className="secondary-link compact" type="button" onClick={() => { setQ(""); setStatus("") }}>Limpiar</button><span>{professionals.length} resultados</span></section>
      {message && <p className="agenda-notice">{message}</p>}
      <section className="admin-layout">
        <div className="admin-list">
          {professionals.length === 0 ? <p className="muted-copy">Agrega un profesional para asignar servicios y disponibilidad.</p> : professionals.map((professional) => (
            <article key={professional.id} className="admin-row">
              <span className="customer-avatar">{professional.name.slice(0, 2).toUpperCase()}</span>
              <div><strong>{professional.name}</strong><small>{professional.email}</small></div>
              <span>{professional.active ? "Activo" : "Inactivo"} · {professional.serviceCount} servicios</span>
              <span>{professional.scheduleBlocks > 0 ? "Horario configurado" : "Sin horario"} · {professional.userCount > 0 ? "Con acceso" : "Sin acceso"}</span>
              <div className="modal-actions"><button className="secondary-link compact" type="button" onClick={() => edit(professional)}>Editar</button><Link className="secondary-link compact" href={`/dashboard/disponibilidad?professionalId=${professional.id}`}>Horario</Link><button className="secondary-link compact" type="button" onClick={() => save({ ...professional, serviceIds: assignments.filter((item) => item.professional_id === professional.id).map((item) => item.service_id), active: !professional.active })}>{professional.active ? "Desactivar" : "Activar"}</button></div>
            </article>
          ))}
        </div>
        <aside className="panel admin-form">
          <h2>{form.id ? "Editar profesional" : "Nuevo profesional"}</h2>
          <label>Nombre<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Email<input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Rol reservable<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="staff">Staff</option><option value="owner">Owner</option></select></label>
          <label className="consent"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Activo para nuevas reservas</label>
          <div className="multi-select"><strong>Servicios</strong>{services.map((service) => <label className="consent" key={service.id}><input type="checkbox" checked={form.serviceIds.includes(service.id)} onChange={() => toggleService(service.id)} /> {service.name}</label>)}</div>
          {form.serviceIds.length === 0 && <p className="muted-copy">Sin servicios no aparecera en reserva publica ni cita manual.</p>}
          <button className="primary-link compact" type="button" onClick={() => save()}>Guardar profesional</button>
        </aside>
      </section>
    </main>
  )
}
