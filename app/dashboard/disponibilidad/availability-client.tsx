"use client"

import { useEffect, useMemo, useState } from "react"

type Professional = { id: string; name: string; role: string }
type Block = { id?: string; weekday: number; start_time?: string; end_time?: string; startTime?: string; endTime?: string; active?: boolean }
const days = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"]

export function AvailabilityClient() {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [professionalId, setProfessionalId] = useState("")
  const [blocks, setBlocks] = useState<Block[]>([])
  const [message, setMessage] = useState("")
  const grouped = useMemo(() => days.map((_, weekday) => blocks.filter((block) => block.weekday === weekday && block.active !== false)), [blocks])

  useEffect(() => {
    fetch("/api/dashboard/professionals").then((res) => res.json()).then((data) => {
      const rows = data.professionals ?? []
      setProfessionals(rows)
      setProfessionalId(rows[0]?.id ?? "")
    })
  }, [])

  useEffect(() => {
    if (!professionalId) return
    fetch(`/api/dashboard/availability?professionalId=${professionalId}`).then((res) => res.json()).then((data) => setBlocks(data.blocks ?? []))
  }, [professionalId])

  function updateDay(weekday: number, items: Block[]) {
    setBlocks((current) => [...current.filter((block) => block.weekday !== weekday), ...items])
  }

  async function saveDay(weekday: number, closed = false) {
    setMessage("")
    const payload = {
      professionalId,
      weekday,
      closed,
      blocks: grouped[weekday].map((block) => ({
        weekday,
        startTime: block.startTime ?? block.start_time ?? "09:00",
        endTime: block.endTime ?? block.end_time ?? "18:00",
        active: true,
      })),
    }
    const res = await fetch("/api/dashboard/availability", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (!res.ok) setMessage(data.error ?? "No se pudo guardar")
    else setMessage("Horario guardado")
  }

  async function copyDay(sourceWeekday: number, targetWeekday: number) {
    const res = await fetch("/api/dashboard/availability", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceProfessionalId: professionalId, targetProfessionalId: professionalId, sourceWeekday, targetWeekdays: [targetWeekday] }),
    })
    setMessage(res.ok ? "Horario copiado" : "No se pudo copiar")
    if (res.ok) fetch(`/api/dashboard/availability?professionalId=${professionalId}`).then((item) => item.json()).then((data) => setBlocks(data.blocks ?? []))
  }

  return (
    <main className="dashboard-page availability-page">
      <section className="agenda-hero">
        <div><p className="eyebrow">Disponibilidad</p><h1>Horarios semanales</h1><span>Los dias cerrados conservan bloques inactivos para reabrir sin perder estructura.</span></div>
        <label>Profesional<select value={professionalId} onChange={(event) => setProfessionalId(event.target.value)}>{professionals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </section>
      {message && <p className="agenda-notice">{message}</p>}
      <section className="weekly-editor">
        {days.map((day, weekday) => {
          const dayBlocks = grouped[weekday]
          return (
            <article key={day} className="day-editor">
              <header><strong>{day}</strong><button className="secondary-link compact" type="button" onClick={() => saveDay(weekday, true)}>Cerrar dia</button></header>
              {dayBlocks.length === 0 && <p className="muted-copy">Este dia esta cerrado o sin bloques.</p>}
              {dayBlocks.map((block, index) => (
                <div className="time-block-row" key={`${weekday}-${index}`}>
                  <input type="time" value={block.startTime ?? block.start_time ?? "09:00"} onChange={(event) => updateDay(weekday, dayBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, startTime: event.target.value } : item))} />
                  <input type="time" value={block.endTime ?? block.end_time ?? "18:00"} onChange={(event) => updateDay(weekday, dayBlocks.map((item, itemIndex) => itemIndex === index ? { ...item, endTime: event.target.value } : item))} />
                  <button className="icon-action" type="button" onClick={() => updateDay(weekday, dayBlocks.filter((_, itemIndex) => itemIndex !== index))}>x</button>
                </div>
              ))}
              <div className="modal-actions">
                <button className="secondary-link compact" type="button" onClick={() => updateDay(weekday, [...dayBlocks, { weekday, startTime: "09:00", endTime: "13:00", active: true }])}>Agregar bloque</button>
                <button className="primary-link compact" type="button" onClick={() => saveDay(weekday)}>Guardar</button>
                <button className="secondary-link compact" type="button" onClick={() => copyDay(weekday, (weekday + 1) % 7)}>Copiar al dia siguiente</button>
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}
