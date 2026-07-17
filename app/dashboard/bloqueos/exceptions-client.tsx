"use client"

import { useEffect, useState } from "react"

type Professional = { id: string; name: string }
type ExceptionRow = { id: string; professional_id: string; kind: "available" | "unavailable"; reason: string | null; starts_at: string; ends_at: string; all_day: boolean }

export function ExceptionsClient() {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [professionalId, setProfessionalId] = useState("")
  const [rows, setRows] = useState<ExceptionRow[]>([])
  const [form, setForm] = useState({ kind: "unavailable", startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10), allDay: true, startTime: "09:00", endTime: "10:00", reason: "Bloqueo" })
  const [message, setMessage] = useState("")

  function loadRows(id = professionalId) {
    if (!id) return
    fetch(`/api/dashboard/exceptions?professionalId=${id}&start=${form.startDate}&end=2099-12-31`).then((res) => res.json()).then((data) => setRows(data.exceptions ?? []))
  }

  useEffect(() => {
    fetch("/api/dashboard/professionals").then((res) => res.json()).then((data) => {
      const items = data.professionals ?? []
      setProfessionals(items)
      setProfessionalId(items[0]?.id ?? "")
      if (items[0]?.id) fetch(`/api/dashboard/exceptions?professionalId=${items[0].id}&start=${form.startDate}&end=2099-12-31`).then((res) => res.json()).then((data2) => setRows(data2.exceptions ?? []))
    })
  }, [form.startDate])

  async function createException() {
    setMessage("")
    const res = await fetch("/api/dashboard/exceptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, professionalId }) })
    const data = await res.json()
    if (!res.ok) setMessage(data.error ?? "No se pudo crear")
    else {
      setMessage("Excepcion creada")
      loadRows()
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/dashboard/exceptions?id=${id}`, { method: "DELETE" })
    setMessage(res.ok ? "Excepcion eliminada" : "No se pudo eliminar")
    if (res.ok) loadRows()
  }

  return (
    <main className="dashboard-page availability-page">
      <section className="agenda-hero">
        <div><p className="eyebrow">Bloqueos</p><h1>Excepciones y vacaciones</h1><span>Los bloqueos impiden slots y aparecen en Agenda sin crear citas ficticias.</span></div>
      </section>
      {message && <p className="agenda-notice">{message}</p>}
      <section className="availability-grid">
        <article className="panel exception-form">
          <label>Profesional<select value={professionalId} onChange={(event) => { setProfessionalId(event.target.value); loadRows(event.target.value) }}>{professionals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Tipo<select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}><option value="unavailable">No disponible</option><option value="available">Horario especial</option></select></label>
          <label>Fecha inicio<input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
          <label>Fecha fin<input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label>
          <label className="consent"><input type="checkbox" checked={form.allDay} onChange={(event) => setForm({ ...form, allDay: event.target.checked })} /> Dia completo</label>
          {!form.allDay && <div className="time-block-row"><input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /><input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></div>}
          <label>Motivo<input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
          <button className="primary-link compact" type="button" onClick={createException}>Crear excepcion</button>
        </article>
        <article className="panel exception-list">
          <h2>Proximas excepciones</h2>
          {rows.length === 0 ? <p className="muted-copy">No hay bloqueos ni excepciones proximas.</p> : rows.map((row) => <div key={row.id} className="exception-card"><strong>{row.reason ?? "Sin motivo"}</strong><span>{row.kind} · {new Date(row.starts_at).toLocaleString("es-CL")} - {new Date(row.ends_at).toLocaleString("es-CL")}</span><button className="secondary-link compact" type="button" onClick={() => remove(row.id)}>Eliminar</button></div>)}
        </article>
      </section>
    </main>
  )
}
