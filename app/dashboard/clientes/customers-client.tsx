"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarPlus, Search, UserRound } from "lucide-react"

type CustomerRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  createdAt: string
  total: number
  completed: number
  cancelled: number
  noShow: number
  nextAt: string | null
  lastAt: string | null
}
type Stats = { total: number; upcoming: number; newThisMonth: number; cancelled: number; noShow: number }
type Detail = { customer: CustomerRow; appointments: Array<{ id: string; startsAt: string; status: string; source: string; serviceName: string; professionalName: string }> }
type Service = { id: string; name: string; duration_min: number }
type Professional = { id: string; name: string }
type Assignment = { professional_id: string; service_id: string }

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C"
}

function formatDate(value: string | null) {
  if (!value) return "Sin registro"
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date(value))
}

export function CustomersClient() {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [query, setQuery] = useState("")
  const [upcoming, setUpcoming] = useState(false)
  const [activity, setActivity] = useState("")
  const [selectedId, setSelectedId] = useState("")
  const [detail, setDetail] = useState<Detail | null>(null)
  const [notes, setNotes] = useState("")
  const [services, setServices] = useState<Service[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [bookingOpen, setBookingOpen] = useState(false)
  const [booking, setBooking] = useState({ serviceId: "", professionalId: "", date: new Date().toISOString().slice(0, 10), time: "10:00" })
  const [message, setMessage] = useState("")
  const selected = useMemo(() => customers.find((item) => item.id === selectedId) ?? null, [customers, selectedId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: query, limit: "60" })
      if (upcoming) params.set("upcoming", "true")
      if (activity) params.set("activity", activity)
      fetch(`/api/dashboard/customers?${params.toString()}`).then((res) => res.json()).then((data) => {
        setCustomers(data.customers ?? [])
        setStats(data.stats ?? null)
      })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [activity, query, upcoming])

  useEffect(() => {
    if (!selectedId) return
    fetch(`/api/dashboard/customers/${selectedId}`).then((res) => res.json()).then((data) => {
      setDetail(data)
      setNotes(data.customer?.notes ?? "")
    })
  }, [selectedId])

  useEffect(() => {
    fetch("/api/dashboard/options").then((res) => res.json()).then((data) => {
      const serviceRows = data.services ?? []
      const professionalRows = data.professionals ?? []
      setServices(serviceRows)
      setProfessionals(professionalRows)
      setAssignments(data.assignments ?? [])
      setBooking((current) => ({ ...current, serviceId: current.serviceId || serviceRows[0]?.id || "", professionalId: current.professionalId || professionalRows[0]?.id || "" }))
    })
  }, [])

  async function saveNotes() {
    if (!detail) return
    setMessage("")
    const res = await fetch(`/api/dashboard/customers/${detail.customer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...detail.customer, notes }),
    })
    const data = await res.json()
    if (!res.ok) setMessage(data.error ?? "No se pudo guardar")
    else {
      setDetail({ ...detail, customer: data.customer })
      setMessage("Notas guardadas")
    }
  }

  async function createAppointment() {
    if (!detail) return
    setMessage("")
    const res = await fetch("/api/dashboard/manual-appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: booking.serviceId,
        professionalId: booking.professionalId,
        date: booking.date,
        time: booking.time,
        customerId: detail.customer.id,
        clientName: detail.customer.name,
        clientEmail: detail.customer.email,
        clientPhone: detail.customer.phone,
      }),
    })
    const data = await res.json()
    if (!res.ok) setMessage(data.error ?? "No se pudo crear la cita")
    else {
      setMessage("Cita creada para este cliente")
      setBookingOpen(false)
      setSelectedId(detail.customer.id)
    }
  }

  return (
    <main className="dashboard-page customers-page">
      <section className="agenda-hero">
        <div><p className="eyebrow">Clientes</p><h1>Clientes</h1><span>Historial, proximas citas y actividad de tus clientes.</span></div>
      </section>

      <section className="customer-metrics">
        <article><strong>{stats?.total ?? 0}</strong><span>Total clientes</span></article>
        <article><strong>{stats?.upcoming ?? 0}</strong><span>Con cita proxima</span></article>
        <article><strong>{stats?.newThisMonth ?? 0}</strong><span>Nuevos este mes</span></article>
        <article><strong>{stats?.cancelled ?? 0}</strong><span>Con cancelaciones</span></article>
        <article><strong>{stats?.noShow ?? 0}</strong><span>Con no-show</span></article>
      </section>

      <section className="customer-workbar">
        <label><Search size={16} /> Buscar<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, email o telefono" /></label>
        <label className="consent"><input type="checkbox" checked={upcoming} onChange={(event) => setUpcoming(event.target.checked)} /> Solo con proxima cita</label>
        <label>Actividad<select value={activity} onChange={(event) => setActivity(event.target.value)}><option value="">Todos</option><option value="issues">Cancelaciones/no-show</option></select></label>
        <button className="secondary-link compact" type="button" onClick={() => { setQuery(""); setUpcoming(false); setActivity("") }}>Limpiar</button>
        <span>{customers.length} resultados</span>
      </section>

      <section className="customers-layout">
        <div className="customers-table" role="table" aria-label="Clientes">
          <div className="customers-head" role="row"><span>Cliente</span><span>Proxima cita</span><span>Ultima cita</span><span>Actividad</span><span /></div>
          {customers.length === 0 ? <p className="muted-copy">No hay clientes que coincidan con la busqueda.</p> : customers.map((customer) => (
            <button key={customer.id} className="customer-row" type="button" onClick={() => setSelectedId(customer.id)}>
              <span className="customer-identity"><em>{initials(customer.name)}</em><strong>{customer.name}</strong><small>{customer.email ?? customer.phone ?? "Sin contacto"}</small></span>
              <span>{formatDate(customer.nextAt)}</span>
              <span>{formatDate(customer.lastAt)}</span>
              <span>{customer.total} citas · {customer.cancelled} canc. · {customer.noShow} no-show</span>
              <span>Ver</span>
            </button>
          ))}
        </div>

        <aside className="customer-detail-panel">
          {!selected && !detail ? (
            <div className="agenda-empty"><UserRound size={22} /><strong>Selecciona un cliente</strong><span>Veras historial, proximas citas y notas internas.</span></div>
          ) : detail ? (
            <>
              <header><span className="customer-avatar">{initials(detail.customer.name)}</span><div><h2>{detail.customer.name}</h2><p>{detail.customer.email ?? detail.customer.phone ?? "Sin contacto"}</p></div></header>
              <div className="compact-stats">
                <div><strong>{detail.appointments.length}</strong><span>Total citas</span></div>
                <div><strong>{detail.appointments.filter((item) => item.status === "cancelled").length}</strong><span>Canceladas</span></div>
                <div><strong>{detail.appointments.filter((item) => item.status === "no_show").length}</strong><span>No-show</span></div>
                <div><strong>{formatDate(detail.appointments.find((item) => new Date(item.startsAt) >= new Date())?.startsAt ?? null)}</strong><span>Proxima</span></div>
              </div>
              <button className="primary-link compact" type="button" onClick={() => setBookingOpen((value) => !value)}><CalendarPlus size={16} /> Agendar cita</button>
              {bookingOpen && (
                <div className="customer-booking-box">
                  <label>Servicio<select value={booking.serviceId} onChange={(event) => setBooking({ ...booking, serviceId: event.target.value })}>{services.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.duration_min} min</option>)}</select></label>
                  <label>Profesional<select value={booking.professionalId} onChange={(event) => setBooking({ ...booking, professionalId: event.target.value })}>{professionals.filter((professional) => assignments.some((assignment) => assignment.professional_id === professional.id && assignment.service_id === booking.serviceId)).map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}</select></label>
                  <div className="time-block-row"><label>Fecha<input type="date" value={booking.date} onChange={(event) => setBooking({ ...booking, date: event.target.value })} /></label><label>Hora<input type="time" value={booking.time} onChange={(event) => setBooking({ ...booking, time: event.target.value })} /></label></div>
                  <button className="secondary-link compact" type="button" onClick={createAppointment}>Crear cita</button>
                </div>
              )}
              <label>Notas internas<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
              <button className="secondary-link compact" type="button" onClick={saveNotes}>Guardar notas</button>
              {message && <p className="agenda-notice">{message}</p>}
              <section className="history-list">
                <h3>Historial</h3>
                {detail.appointments.length === 0 ? <p className="muted-copy">Este cliente todavia no tiene citas registradas.</p> : detail.appointments.map((appointment) => (
                  <article key={appointment.id}><strong>{formatDate(appointment.startsAt)}</strong><span>{appointment.serviceName} · {appointment.professionalName}</span><em>{appointment.status} · {appointment.source}</em></article>
                ))}
              </section>
            </>
          ) : null}
        </aside>
      </section>
    </main>
  )
}
