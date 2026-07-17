"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Filter, Mail, Phone, Plus, RotateCcw, UserCheck, X } from "lucide-react"
import { allowedTransitions, statusMeta, type AppointmentStatus } from "../../lib/appointment-status"
import { databaseTimestampToUtcDate } from "../../lib/time"

type Professional = { id: string; name: string; role: string }
type ViewMode = "day" | "week" | "list"

type Appointment = {
  id: string
  professionalId: string
  serviceName: string
  serviceDuration: number
  servicePrice: string | null
  professionalName: string
  clientName: string
  clientPhone: string | null
  clientEmail: string | null
  startsAt: string
  endsAt: string
  status: AppointmentStatus
  source: string
  notes: string | null
  cancellationReason: string | null
}

type AgendaBlock = {
  id: string
  professional_id: string
  kind: "unavailable" | "available"
  reason: string | null
  starts_at: string
  ends_at: string
  all_day: boolean
}

type ManualSeed = { date: string; time: string; professionalId: string }
type OptionService = { id: string; name: string; duration_min: number; price: string | null }
type OptionProfessional = { id: string; name: string }
type OptionAssignment = { professional_id: string; service_id: string }
type CustomerOption = { id: string; name: string; email: string | null; phone: string | null }

const timezone = "America/Santiago"
const dayStartHour = 8
const dayEndHour = 20
const slotHeight = 48
const statuses: Array<AppointmentStatus | "all"> = ["all", "pending", "confirmed", "completed", "cancelled", "no_show"]
const statusLabel = { all: "Todos", ...Object.fromEntries(Object.entries(statusMeta).map(([key, value]) => [key, value.label])) } as Record<string, string>

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return dateKey(date)
}

function localTodayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
}

function displayDay(value: string, format: "short" | "long" = "short") {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: format === "long" ? "long" : "short",
    day: "2-digit",
    month: format === "long" ? "long" : "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`))
}

function displayTime(value: string) {
  const date = databaseTimestampToUtcDate(value)
  return new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(date)
}

function appointmentDateKey(value: string) {
  const date = databaseTimestampToUtcDate(value)
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
}

function localMinutes(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(databaseTimestampToUtcDate(value))
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return Number(map.hour) * 60 + Number(map.minute)
}

function durationMinutes(appointment: Appointment) {
  return Math.max(15, Math.round((databaseTimestampToUtcDate(appointment.endsAt).getTime() - databaseTimestampToUtcDate(appointment.startsAt).getTime()) / 60000))
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "S"
}

function professionalTone(id: string) {
  const tones = ["blue", "cyan", "violet", "green", "amber"]
  return tones[id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length]
}

function formatRange(start: string, view: ViewMode) {
  if (view === "week") return `${displayDay(start)} - ${displayDay(addDays(start, 6))}`
  if (view === "list") return `${displayDay(start)} - ${displayDay(addDays(start, 30))}`
  return displayDay(start, "long")
}

function formatMachineDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`))
}

function viewLabel(view: ViewMode) {
  if (view === "day") return "Dia"
  if (view === "week") return "Semana"
  return "Lista"
}

function ActionIcon({ status }: { status: AppointmentStatus }) {
  if (status === "confirmed") return <Check size={15} />
  if (status === "cancelled") return <X size={15} />
  if (status === "completed") return <UserCheck size={15} />
  if (status === "no_show") return <AlertCircle size={15} />
  return <Clock size={15} />
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <em className={`status-badge status-${status}`}>{statusMeta[status].label}</em>
}

function ProfessionalAvatar({ professional }: { professional: string }) {
  return <span className={`professional-avatar tone-${professionalTone(professional)}`}>{initials(professional)}</span>
}

function AgendaSkeleton({ view }: { view: ViewMode }) {
  const rows = view === "week" ? 7 : 5
  return (
    <div className={`agenda-skeleton agenda-skeleton-${view}`} aria-label="Cargando agenda">
      {Array.from({ length: rows }, (_, index) => <span key={index} />)}
    </div>
  )
}

function EmptyAgenda({ filtered, view, onCreate }: { filtered: boolean; view: ViewMode; onCreate?: () => void }) {
  const copy = filtered
    ? { title: "Sin resultados para estos filtros.", detail: "Prueba limpiando filtros o cambiando profesional." }
    : view === "week"
      ? { title: "No hay citas esta semana.", detail: "La estructura semanal sigue disponible para revisar disponibilidad y crear citas." }
      : view === "day"
        ? { title: "No hay citas para este dia.", detail: "Puedes crear una cita manual desde un espacio libre o con el boton principal." }
        : { title: "No hay citas en este rango.", detail: "La lista mostrara las proximas reservas cuando existan." }
  return (
    <div className="agenda-empty">
      <CalendarDays size={22} aria-hidden="true" />
      <strong>{copy.title}</strong>
      <span>{copy.detail}</span>
      {onCreate && <button className="secondary-link compact" type="button" onClick={onCreate}><Plus size={14} aria-hidden="true" />Nueva cita</button>}
    </div>
  )
}

function AppointmentCard({ appointment, compact, next, onOpen }: { appointment: Appointment; compact?: boolean; next?: boolean; onOpen: (appointment: Appointment) => void }) {
  const duration = durationMinutes(appointment)
  const label = `Cita de ${appointment.clientName}, ${appointment.serviceName}, ${displayTime(appointment.startsAt)}.`
  const hasNotes = Boolean(appointment.notes || appointment.cancellationReason)
  return (
    <button
      className={`premium-appointment status-edge-${appointment.status} ${compact ? "compact-card" : ""} ${next ? "next-appointment" : ""}`}
      type="button"
      onClick={() => onOpen(appointment)}
      aria-label={label}
      title={`${appointment.clientName} - ${appointment.serviceName} - ${appointment.professionalName}`}
    >
      <span className="appointment-clock">{displayTime(appointment.startsAt)}<small>{duration} min</small></span>
      <span className="appointment-main">
        {next && <mark>Proxima cita</mark>}
        <strong>{appointment.clientName}</strong>
        <span>{appointment.serviceName}</span>
      </span>
      <span className="appointment-professional"><ProfessionalAvatar professional={appointment.professionalName} />{appointment.professionalName}</span>
      <span className="appointment-state-stack"><StatusBadge status={appointment.status} />{hasNotes && <small>Nota</small>}</span>
    </button>
  )
}

function CurrentTimeIndicator({ day }: { day: string }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const today = localTodayKey()
  if (day !== today) return null

  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const minutes = Number(map.hour) * 60 + Number(map.minute)
  const start = dayStartHour * 60
  const end = dayEndHour * 60
  if (minutes < start || minutes > end) return null

  const top = ((minutes - start) / 30) * slotHeight
  return (
    <div className="current-time-line" style={{ top }} aria-label={`Hora actual ${map.hour}:${map.minute}`}>
      <span>{map.hour}:{map.minute}</span>
    </div>
  )
}

function DayView({ appointments, blocks, date, selectedProfessionalId, onOpen, onBlockOpen, onFreeSlot }: { appointments: Appointment[]; blocks: AgendaBlock[]; date: string; selectedProfessionalId: string; onOpen: (appointment: Appointment) => void; onBlockOpen: (block: AgendaBlock) => void; onFreeSlot: (seed: ManualSeed) => void }) {
  const rows = Array.from({ length: (dayEndHour - dayStartHour) * 2 }, (_, index) => dayStartHour * 60 + index * 30)
  const totalHeight = rows.length * slotHeight
  const sorted = [...appointments].sort((a, b) => databaseTimestampToUtcDate(a.startsAt).getTime() - databaseTimestampToUtcDate(b.startsAt).getTime())
  const nextId = sorted.find((item) => databaseTimestampToUtcDate(item.startsAt) >= new Date() && item.status !== "cancelled")?.id

  const canCreateFromTimeline = selectedProfessionalId !== "all"

  return (
    <section className="premium-day" aria-label={`Agenda diaria ${displayDay(date, "long")}`}>
      <div className="time-rail" aria-hidden="true">
        {rows.map((minutes) => {
          const hour = Math.floor(minutes / 60)
          const minute = minutes % 60
          return (
            <span key={minutes} className={minute === 0 ? "hour-label" : "half-label"}>
              {minute === 0 ? `${String(hour).padStart(2, "0")}:00` : ""}
            </span>
          )
        })}
      </div>
      <div className="day-timeline" style={{ minHeight: totalHeight }}>
        {!canCreateFromTimeline && (
          <div className="day-timeline-hint" role="note">Selecciona un profesional para crear citas desde la agenda.</div>
        )}
        {rows.map((minutes) => {
          const label = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
          return (
            <button
              key={minutes}
              className="time-slot free-slot"
              type="button"
              onClick={() => canCreateFromTimeline && onFreeSlot({ date, time: label, professionalId: selectedProfessionalId })}
              disabled={!canCreateFromTimeline}
              aria-label={canCreateFromTimeline ? `Crear cita a las ${label}` : `Espacio libre ${label}. Selecciona un profesional para crear una cita`}
            >
              {canCreateFromTimeline && <span>Crear cita</span>}
            </button>
          )
        })}
        <CurrentTimeIndicator day={date} />
        {blocks.map((block) => {
          const top = Math.max(0, ((localMinutes(block.starts_at) - dayStartHour * 60) / 30) * slotHeight)
          const height = block.all_day ? slotHeight * 2 : Math.max(44, ((databaseTimestampToUtcDate(block.ends_at).getTime() - databaseTimestampToUtcDate(block.starts_at).getTime()) / 60000 / 30) * slotHeight - 8)
          return (
            <button key={block.id} className={`timeline-block block-${block.kind}`} type="button" style={{ top, height }} onClick={() => onBlockOpen(block)} aria-label={`${block.kind === "available" ? "Horario especial" : "Bloqueo"} ${block.reason ?? ""}`}>
              <strong>{block.kind === "available" ? "Horario especial" : "Bloqueado"}</strong>
              <span>{displayTime(block.starts_at)} - {displayTime(block.ends_at)}</span>
              <em>{block.reason ?? "Sin motivo"}</em>
            </button>
          )
        })}
        {sorted.map((appointment) => {
          const top = Math.max(0, ((localMinutes(appointment.startsAt) - dayStartHour * 60) / 30) * slotHeight)
          const height = Math.max(52, (durationMinutes(appointment) / 30) * slotHeight - 8)
          return (
            <div key={appointment.id} className="timeline-event" style={{ top, height }}>
              <AppointmentCard appointment={appointment} next={appointment.id === nextId} onOpen={onOpen} />
            </div>
          )
        })}
      </div>
    </section>
  )
}

function WeekView({ days, byDay, blocksByDay, onOpen, onBlockOpen }: { days: string[]; byDay: Map<string, Appointment[]>; blocksByDay: Map<string, AgendaBlock[]>; onOpen: (appointment: Appointment) => void; onBlockOpen: (block: AgendaBlock) => void }) {
  const today = localTodayKey()
  return (
    <section className="premium-week-shell week-board-shell" aria-label="Agenda semanal">
      <div className="premium-week week-board">
        {days.map((day) => {
          const items = [...(byDay.get(day) ?? [])].sort((a, b) => databaseTimestampToUtcDate(a.startsAt).getTime() - databaseTimestampToUtcDate(b.startsAt).getTime())
          const blocks = blocksByDay.get(day) ?? []
          const totalEntries = items.length + blocks.length
          return (
            <article className={`week-column week-board-column ${day === today ? "today" : ""}`} key={day}>
              <header className="week-board-header">
                <span>{displayDay(day)}</span>
                {day === today && <em>Hoy</em>}
              </header>
              <div className="week-board-body">
                {blocks.map((block) => <button key={block.id} className="week-block" type="button" onClick={() => onBlockOpen(block)}>{block.reason ?? "Bloqueo"}</button>)}
                {items.map((appointment) => (
                  <AppointmentCard key={appointment.id} appointment={appointment} compact onOpen={onOpen} />
                ))}
                {totalEntries === 0 && <p className="week-empty">Sin citas</p>}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function ListView({ appointments, onOpen }: { appointments: Appointment[]; onOpen: (appointment: Appointment) => void }) {
  const sorted = [...appointments].sort((a, b) => databaseTimestampToUtcDate(a.startsAt).getTime() - databaseTimestampToUtcDate(b.startsAt).getTime())
  const nextId = sorted.find((item) => databaseTimestampToUtcDate(item.startsAt) >= new Date() && item.status !== "cancelled")?.id
  const groups = new Map<string, Appointment[]>()
  for (const item of sorted) {
    const key = appointmentDateKey(item.startsAt)
    groups.set(key, [...(groups.get(key) ?? []), item])
  }

  return (
    <section className="premium-list" aria-label="Listado de citas">
      {[...groups.entries()].map(([day, items]) => (
        <article key={day}>
          <h2>{displayDay(day, "long")}</h2>
          <div>{items.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} next={appointment.id === nextId} onOpen={onOpen} />)}</div>
        </article>
      ))}
    </section>
  )
}


type AgendaHeaderProps = {
  view: ViewMode
  date: string
  activeFilters: number
  filtersOpen: boolean
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
  onDateChange: (value: string) => void
  onViewChange: (value: ViewMode) => void
  onCreate: () => void
  onToggleFilters: () => void
}

function AgendaHeader({ view, date, activeFilters, filtersOpen, onPrevious, onNext, onToday, onDateChange, onViewChange, onCreate, onToggleFilters }: AgendaHeaderProps) {
  return (
    <section className="agenda-command-center" aria-labelledby="agenda-title">
      <div className="agenda-title-block">
        <p className="eyebrow">Agenda</p>
        <h1 id="agenda-title">Agenda</h1>
        <span>{formatRange(date, view)} Â· {timezone}</span>
      </div>
      <div className="agenda-command-actions">
        <button className="primary-link compact agenda-create-button" type="button" onClick={onCreate}><Plus size={16} aria-hidden="true" />Nueva cita</button>
        <button className="icon-action mobile-filter-toggle" type="button" onClick={onToggleFilters} aria-expanded={filtersOpen} aria-label={`Mostrar filtros${activeFilters ? `, ${activeFilters} activos` : ""}`}><Filter size={17} aria-hidden="true" />{activeFilters > 0 && <span>{activeFilters}</span>}</button>
      </div>
      <div className="agenda-timebar" aria-label="Navegacion temporal">
        <button className="icon-action" type="button" onClick={onPrevious} aria-label="Periodo anterior" title="Periodo anterior"><ChevronLeft size={17} aria-hidden="true" /></button>
        <button className="secondary-link compact" type="button" onClick={onToday}><RotateCcw size={14} aria-hidden="true" />Hoy</button>
        <button className="icon-action" type="button" onClick={onNext} aria-label="Periodo siguiente" title="Periodo siguiente"><ChevronRight size={17} aria-hidden="true" /></button>
        <label className="agenda-date-field"><span>Fecha</span><input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} aria-label="Fecha" /></label>
        <span className="agenda-readable-date">{formatMachineDate(date)}</span>
      </div>
      <div className="segmented-control agenda-view-tabs" aria-label="Vista">
        {(["day", "week", "list"] as const).map((item) => (
          <button key={item} className={view === item ? "selected" : ""} type="button" onClick={() => onViewChange(item)} aria-pressed={view === item}>{viewLabel(item)}</button>
        ))}
      </div>
    </section>
  )
}

function AgendaFilters({ open, activeFilters, professionalId, status, professionals, onProfessionalChange, onStatusChange, onClear }: { open: boolean; activeFilters: number; professionalId: string; status: AppointmentStatus | "all"; professionals: Professional[]; onProfessionalChange: (value: string) => void; onStatusChange: (value: AppointmentStatus | "all") => void; onClear: () => void }) {
  return (
    <section className={`agenda-filter-panel ${open ? "open" : ""}`} aria-label="Filtros de agenda">
      <div>
        <strong>Filtros</strong>
        <span>{activeFilters ? `${activeFilters} activo${activeFilters === 1 ? "" : "s"}` : "Sin filtros activos"}</span>
      </div>
      <label>Profesional<select value={professionalId} onChange={(event) => onProfessionalChange(event.target.value)}>
        <option value="all">Todos los profesionales</option>
        {professionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}
      </select></label>
      <label>Estado<select value={status} onChange={(event) => onStatusChange(event.target.value as AppointmentStatus | "all")}>
        {statuses.map((item) => <option key={item} value={item}>{statusLabel[item]}</option>)}
      </select></label>
      <button className="secondary-link compact" type="button" onClick={onClear} disabled={activeFilters === 0}>Limpiar</button>
    </section>
  )
}function ManualAppointmentDialog({ seed, services, professionals, assignments, onClose, onCreated }: { seed: ManualSeed; services: OptionService[]; professionals: OptionProfessional[]; assignments: OptionAssignment[]; onClose: () => void; onCreated: () => void }) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "")
  const [professionalId, setProfessionalId] = useState(seed.professionalId)
  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [customerQuery, setCustomerQuery] = useState("")
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const allowedProfessionals = professionals.filter((professional) => assignments.some((assignment) => assignment.professional_id === professional.id && assignment.service_id === serviceId))
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  useEffect(() => {
    if (customerQuery.trim().length < 2) {
      void Promise.resolve().then(() => setCustomerResults([]))
      return
    }
    const timer = window.setTimeout(() => {
      fetch(`/api/dashboard/customers?mode=search&q=${encodeURIComponent(customerQuery)}`)
        .then((res) => res.json())
        .then((data) => setCustomerResults(data.customers ?? []))
        .catch(() => setCustomerResults([]))
    }, 220)
    return () => window.clearTimeout(timer)
  }, [customerQuery])

  async function submit() {
    setSaving(true)
    setError("")
    const res = await fetch("/api/dashboard/manual-appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId,
        professionalId,
        date: seed.date,
        time: seed.time,
        customerId: selectedCustomer?.id,
        clientName: selectedCustomer?.name ?? clientName,
        clientEmail: selectedCustomer?.email ?? clientEmail,
        clientPhone: selectedCustomer?.phone ?? clientPhone,
        notes,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(data.error ?? "No se pudo crear la cita")
      return
    }
    onCreated()
  }

  return (
    <div className="modal-backdrop sheet-backdrop" role="presentation">
      <section className="confirm-modal manual-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-title">
        <header className="manual-dialog-header"><div><h2 id="manual-title">Nueva cita</h2><p>{seed.date} Â· {seed.time}</p></div><button className="icon-action" type="button" onClick={onClose} aria-label="Cerrar nueva cita"><X size={17} aria-hidden="true" /></button></header>
        {error && <p className="form-error" role="alert">{error}</p>}
        <section className="manual-section" aria-label="Servicio y profesional">
          <label>Servicio<select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>{services.map((service) => <option key={service.id} value={service.id}>{service.name} Â· {service.duration_min} min</option>)}</select></label>
          <label>Profesional<select value={professionalId} onChange={(event) => setProfessionalId(event.target.value)}>{allowedProfessionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}</select></label>
        </section>
        <section className="manual-section" aria-label="Cliente">
          <label>Buscar cliente existente<input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Nombre, email o telefono" /></label>
          {selectedCustomer ? (
            <div className="selected-customer"><strong>{selectedCustomer.name}</strong><span>{selectedCustomer.email ?? selectedCustomer.phone ?? "Sin contacto"}</span><em>Cliente existente</em><button className="secondary-link compact" type="button" onClick={() => setSelectedCustomer(null)}>Cambiar</button></div>
          ) : customerResults.length > 0 && (
            <div className="customer-results">{customerResults.map((customer) => <button key={customer.id} type="button" onClick={() => { setSelectedCustomer(customer); setClientName(customer.name); setClientEmail(customer.email ?? ""); setClientPhone(customer.phone ?? "") }}>{customer.name}<span>{customer.email ?? customer.phone ?? "Sin contacto"}</span></button>)}</div>
          )}
          {!selectedCustomer && (
            <div className="manual-grid">
              <label>Cliente nuevo<input value={clientName} onChange={(event) => setClientName(event.target.value)} /></label>
              <label>Email<input value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} /></label>
              <label>Telefono<input value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} /></label>
            </div>
          )}
        </section>
        <section className="manual-section" aria-label="Notas"><label>Notas<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label></section>
        <div className="modal-actions"><button className="secondary-link compact" type="button" onClick={onClose}>Volver</button><button className="primary-link compact" type="button" onClick={submit} disabled={saving}>{saving ? "Creando" : "Crear cita"}</button></div>
      </section>
    </div>
  )
}

function AppointmentDetailDialog({ appointment, saving, pendingStatus, cancellationReason, setPendingStatus, setCancellationReason, onApply, onClose }: {
  appointment: Appointment
  saving: boolean
  pendingStatus: AppointmentStatus | null
  cancellationReason: string
  setPendingStatus: (status: AppointmentStatus | null) => void
  setCancellationReason: (value: string) => void
  onApply: () => void
  onClose: () => void
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <>
      <div className="modal-backdrop sheet-backdrop" role="presentation" onMouseDown={onClose}>
        <section className="appointment-modal premium-detail" role="dialog" aria-modal="true" aria-labelledby="appointment-detail-title" onMouseDown={(event) => event.stopPropagation()}>
          <header>
            <div>
              <StatusBadge status={appointment.status} />
              <h2 id="appointment-detail-title">{appointment.clientName}</h2>
              <p>{displayDay(appointmentDateKey(appointment.startsAt), "long")} Â· {displayTime(appointment.startsAt)} - {displayTime(appointment.endsAt)}</p>
            </div>
            <button className="icon-action" type="button" onClick={onClose} aria-label="Cerrar detalle"><X size={17} /></button>
          </header>
          <dl className="detail-grid">
            <div><dt>Servicio</dt><dd>{appointment.serviceName}</dd></div>
            <div><dt>Duracion</dt><dd>{durationMinutes(appointment)} minutos</dd></div>
            <div><dt>Profesional</dt><dd><ProfessionalAvatar professional={appointment.professionalName} /> {appointment.professionalName}</dd></div>
            <div><dt>Origen</dt><dd>{appointment.source}</dd></div>
            <div><dt>Telefono</dt><dd>{appointment.clientPhone ? <><Phone size={14} /> {appointment.clientPhone}</> : "Sin telefono"}</dd></div>
            <div><dt>Email</dt><dd>{appointment.clientEmail ? <><Mail size={14} /> {appointment.clientEmail}</> : "Sin email"}</dd></div>
            <div className="detail-wide"><dt>Notas</dt><dd>{appointment.notes || appointment.cancellationReason || "Sin notas registradas"}</dd></div>
          </dl>
          <div className="modal-actions action-stack">
            {allowedTransitions(appointment.status).map((next, index) => (
              <button key={next} className={`${index === 0 ? "primary-link" : "secondary-link"} compact ${next === "cancelled" ? "danger-action" : ""}`} type="button" onClick={() => setPendingStatus(next)}>
                <ActionIcon status={next} />
                {next === "no_show" ? "Marcar no-show" : statusMeta[next].label}
              </button>
            ))}
          </div>
        </section>
      </div>

      {pendingStatus && (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="status-confirm-title">
            <h2 id="status-confirm-title">Confirmar cambio</h2>
            <p>La cita de {appointment.clientName} pasara a estado {statusMeta[pendingStatus].label}.</p>
            {pendingStatus === "cancelled" && (
              <label>
                Motivo de cancelacion
                <textarea value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} maxLength={240} />
              </label>
            )}
            <div className="modal-actions">
              <button className="secondary-link compact" type="button" onClick={() => setPendingStatus(null)}>Volver</button>
              <button className="primary-link compact" type="button" onClick={onApply} disabled={saving}>{saving ? "Guardando" : "Confirmar"}</button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

export function AgendaClient({ initialView = "day" }: { initialView?: ViewMode }) {
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window !== "undefined" && window.innerWidth <= 560 && initialView !== "list") return "list"
    return initialView
  })
  const [date, setDate] = useState(() => localTodayKey())
  const [status, setStatus] = useState<AppointmentStatus | "all">("all")
  const [professionalId, setProfessionalId] = useState("all")
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [blocks, setBlocks] = useState<AgendaBlock[]>([])
  const [services, setServices] = useState<OptionService[]>([])
  const [assignments, setAssignments] = useState<OptionAssignment[]>([])
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<AgendaBlock | null>(null)
  const [manualSeed, setManualSeed] = useState<ManualSeed | null>(null)
  const [pendingStatus, setPendingStatus] = useState<AppointmentStatus | null>(null)
  const [cancellationReason, setCancellationReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)

  const range = useMemo(() => {
    if (view === "week") return { start: date, end: addDays(date, 7) }
    if (view === "list") return { start: date, end: addDays(date, 31) }
    return { start: date, end: addDays(date, 1) }
  }, [date, view])

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    setError("")
    const params = new URLSearchParams({ start: range.start, end: range.end })
    if (status !== "all") params.set("status", status)
    if (professionalId !== "all") params.set("professionalId", professionalId)
    const res = await fetch(`/api/dashboard/appointments?${params.toString()}`)
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "No se pudo cargar la agenda")
      setLoading(false)
      return
    }
    setAppointments(data.appointments)
    setBlocks(data.blocks ?? [])
    setLoading(false)
  }, [professionalId, range.end, range.start, status])

  useEffect(() => {
    fetch("/api/dashboard/professionals")
      .then((res) => res.json())
      .then((data) => setProfessionals(data.professionals ?? []))
      .catch(() => setProfessionals([]))
  }, [])

  useEffect(() => {
    fetch("/api/dashboard/options")
      .then((res) => res.json())
      .then((data) => {
        setServices(data.services ?? [])
        setAssignments(data.assignments ?? [])
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(fetchAppointments)
  }, [fetchAppointments])

  const days = useMemo(() => Array.from({ length: view === "week" ? 7 : 1 }, (_, index) => addDays(date, index)), [date, view])
  const byDay = useMemo(() => {
    const groups = new Map<string, Appointment[]>()
    for (const item of appointments) {
      const key = appointmentDateKey(item.startsAt)
      groups.set(key, [...(groups.get(key) ?? []), item])
    }
    return groups
  }, [appointments])
  const blocksByDay = useMemo(() => {
    const groups = new Map<string, AgendaBlock[]>()
    for (const item of blocks) {
      const key = appointmentDateKey(item.starts_at)
      groups.set(key, [...(groups.get(key) ?? []), item])
    }
    return groups
  }, [blocks])

  async function applyStatus() {
    if (!selected || !pendingStatus) return
    setSaving(true)
    setError("")
    const res = await fetch("/api/dashboard/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: selected.id, status: pendingStatus, cancellationReason }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(data.error ?? "No se pudo actualizar la cita")
      return
    }
    const updated = { ...selected, status: pendingStatus, cancellationReason: pendingStatus === "cancelled" ? cancellationReason : selected.cancellationReason }
    setAppointments((items) => items.map((item) => item.id === selected.id ? updated : item))
    setSelected(updated)
    setPendingStatus(null)
    setCancellationReason("")
    setNotice(`Cita actualizada a ${statusMeta[pendingStatus].label}.`)
  }

  const filtered = status !== "all" || professionalId !== "all"
  const activeFilters = Number(status !== "all") + Number(professionalId !== "all")
  const moveBy = view === "week" ? 7 : 1
  const clearFilters = () => { setStatus("all"); setProfessionalId("all") }
  const openManualAppointment = () => {
    const fallbackProfessional = professionalId !== "all" ? professionalId : professionals[0]?.id
    if (!fallbackProfessional) {
      setError("Agrega un profesional activo antes de crear una cita manual.")
      return
    }
    setManualSeed({ date, time: "09:00", professionalId: fallbackProfessional })
  }

  return (
    <main className="dashboard-page agenda-page premium-agenda">
      <AgendaHeader
        view={view}
        date={date}
        activeFilters={activeFilters}
        filtersOpen={filtersOpen}
        onPrevious={() => setDate(addDays(date, -moveBy))}
        onNext={() => setDate(addDays(date, moveBy))}
        onToday={() => setDate(localTodayKey())}
        onDateChange={setDate}
        onViewChange={setView}
        onCreate={openManualAppointment}
        onToggleFilters={() => setFiltersOpen((value) => !value)}
      />

      <AgendaFilters
        open={filtersOpen}
        activeFilters={activeFilters}
        professionalId={professionalId}
        status={status}
        professionals={professionals}
        onProfessionalChange={setProfessionalId}
        onStatusChange={setStatus}
        onClear={clearFilters}
      />

      {notice && <p className="agenda-notice" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {professionals.length === 0 && !loading && <p className="agenda-notice">No hay profesionales activos para mostrar en la agenda.</p>}

      {loading ? <AgendaSkeleton view={view} /> : (
        view === "week"
          ? <WeekView days={days} byDay={byDay} blocksByDay={blocksByDay} onOpen={setSelected} onBlockOpen={setSelectedBlock} />
          : view === "list"
            ? appointments.length === 0
              ? <EmptyAgenda filtered={filtered} view={view} onCreate={openManualAppointment} />
              : <ListView appointments={appointments} onOpen={setSelected} />
            : <DayView appointments={appointments} blocks={blocksByDay.get(date) ?? []} date={date} selectedProfessionalId={professionalId} onOpen={setSelected} onBlockOpen={setSelectedBlock} onFreeSlot={setManualSeed} />
      )}

      {selected && (
        <AppointmentDetailDialog
          appointment={selected}
          saving={saving}
          pendingStatus={pendingStatus}
          cancellationReason={cancellationReason}
          setPendingStatus={setPendingStatus}
          setCancellationReason={setCancellationReason}
          onApply={applyStatus}
          onClose={() => setSelected(null)}
        />
      )}
      {selectedBlock && (
        <div className="modal-backdrop sheet-backdrop" role="presentation" onMouseDown={() => setSelectedBlock(null)}>
          <section className="confirm-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <h2>{selectedBlock.kind === "available" ? "Horario especial" : "Bloqueo"}</h2>
            <p>{displayTime(selectedBlock.starts_at)} - {displayTime(selectedBlock.ends_at)}</p>
            <p>{selectedBlock.reason ?? "Sin motivo"}</p>
            <div className="modal-actions"><button className="secondary-link compact" type="button" onClick={() => setSelectedBlock(null)}>Cerrar</button></div>
          </section>
        </div>
      )}
      {manualSeed && <ManualAppointmentDialog seed={manualSeed} services={services} professionals={professionals} assignments={assignments} onClose={() => setManualSeed(null)} onCreated={() => { setManualSeed(null); void fetchAppointments() }} />}
    </main>
  )
}
