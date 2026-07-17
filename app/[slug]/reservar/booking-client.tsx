"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle, ChevronLeft } from "lucide-react"

type Service = {
  id: string
  name: string
  description: string | null
  duration_min: number
  price: string | null
  color: string | null
}

type Professional = {
  id: string
  name: string
}

type PublicData = {
  tenant: {
    name: string
    timezone: string
    autoConfirm: boolean
    cancellationPolicy: string | null
    postBookingInstructions: string | null
    brandColor: string
    bookingPageStatus: string
  }
  reservable: boolean
  services: Service[]
  professionalsByService: Record<string, Professional[]>
  slots: { label: string }[]
}

type Step = "service" | "time" | "details" | "success"

function nextDays() {
  const days: string[] = []
  const today = new Date()

  for (let i = 1; days.length < 14; i += 1) {
    const day = new Date(today)
    day.setDate(today.getDate() + i)
    if (day.getDay() !== 0) days.push(day.toISOString().slice(0, 10))
  }

  return days
}

export default function BookingClient({ slug }: { slug: string }) {
  const [data, setData] = useState<PublicData | null>(null)
  const [step, setStep] = useState<Step>("service")
  const [serviceId, setServiceId] = useState("")
  const [professionalId, setProfessionalId] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [website, setWebsite] = useState("")
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [createdStatus, setCreatedStatus] = useState<"pending" | "confirmed">("pending")
  const [slots, setSlots] = useState<{ label: string }[]>([])

  useEffect(() => {
    fetch(`/api/public/${slug}`)
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then(setData)
      .catch(() => setError("No pudimos cargar la página de reservas."))
  }, [slug])

  useEffect(() => {
    if (!serviceId || !professionalId || !date) {
      return
    }

    fetch(`/api/public/${slug}?serviceId=${serviceId}&professionalId=${professionalId}&date=${date}`)
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((payload: PublicData) => setSlots(payload.slots))
      .catch(() => setError("No pudimos cargar los horarios disponibles."))
  }, [slug, serviceId, professionalId, date])

  const service = useMemo(() => data?.services.find((item) => item.id === serviceId), [data, serviceId])
  const professionals = serviceId && data ? data.professionalsByService[serviceId] ?? [] : []
  const selectedProfessional = professionals.find((item) => item.id === professionalId)
  const visibleSlots = serviceId && professionalId && date ? slots : []

  async function submit() {
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          serviceId,
          professionalId,
          fecha: date,
          hora: time,
          nombre: name,
          telefono: phone,
          email,
          website,
          consent: accepted,
        }),
      })
      const payload = await res.json()

      if (!res.ok) {
        setError(payload.error || "No se pudo crear la reserva.")
        return
      }

      setCreatedStatus(payload.status)
      setStep("success")
    } catch {
      setError("No se pudo conectar con el servidor. Intenta nuevamente.")
    } finally {
      setLoading(false)
    }
  }

  if (!data && !error) return <main className="booking-shell">Cargando agenda...</main>
  const brandColor = data?.tenant.brandColor ?? "#5b6ee1"

  return (
    <main className="booking-shell">
      <a className="back-link" href={`/${slug}`}><ChevronLeft size={16} /> Volver</a>

      {error && <p className="form-error">{error}</p>}

      {data && !data.reservable && (
        <section className="success-state">
          <h1>Reservas pausadas</h1>
          <p>Las reservas online estan temporalmente pausadas. Contacta al negocio para coordinar una hora.</p>
          <a className="primary-link" href={`/${slug}`}>Volver a la pagina del negocio</a>
        </section>
      )}

      {data && data.reservable && step !== "success" && (
        <>
          <p className="eyebrow">{data.tenant.name}</p>
          <h1>Reserva tu hora</h1>
          <p className="lead">Elige un servicio, profesional y horario disponible. Zona horaria: {data.tenant.timezone}.</p>
        </>
      )}

      {data && data.reservable && step === "service" && (
        <section className="stack">
          {data.services.map((item) => (
            <button
              key={item.id}
              className="option-card"
              onClick={() => {
                setServiceId(item.id)
                setProfessionalId(data.professionalsByService[item.id]?.[0]?.id ?? "")
                setStep("time")
              }}
            >
              <span className="color-dot" style={{ background: item.color ?? "#5b6ee1" }} />
              <span>
                <strong>{item.name}</strong>
                <small>{item.duration_min} min {item.price ? `· $${Number(item.price).toLocaleString("es-CL")}` : ""}</small>
                {item.description && <em>{item.description}</em>}
              </span>
            </button>
          ))}
        </section>
      )}

      {data && data.reservable && step === "time" && service && (
        <section className="stack">
          <h2>{service.name}</h2>
          <label>
            Profesional
            <select value={professionalId} onChange={(event) => setProfessionalId(event.target.value)}>
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>{professional.name}</option>
              ))}
            </select>
          </label>
          <div className="day-grid">
            {nextDays().map((day) => (
              <button key={day} className={date === day ? "selected" : ""} onClick={() => { setDate(day); setTime("") }}>
                {new Date(`${day}T12:00:00`).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}
              </button>
            ))}
          </div>
          {date && visibleSlots.length === 0 && <p className="form-error">No hay horarios disponibles para ese día.</p>}
          <div className="hour-grid">
            {visibleSlots.map((item) => (
              <button key={item.label} className={time === item.label ? "selected" : ""} onClick={() => setTime(item.label)}>{item.label}</button>
            ))}
          </div>
          <button className="primary-action" disabled={!professionalId || !date || !time} onClick={() => setStep("details")}>Continuar</button>
        </section>
      )}

      {data && data.reservable && step === "details" && service && selectedProfessional && (
        <section className="stack">
          <div className="summary-box">
            <strong>{service.name}</strong>
            <span>{selectedProfessional.name}</span>
            <span>{new Date(`${date}T12:00:00`).toLocaleDateString("es-CL")} · {time} hrs</span>
          </div>
          <label>Nombre completo<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Teléfono<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="honeypot">Sitio web<input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
          <label className="consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /> Acepto ser contactado por el negocio para gestionar esta reserva.</label>
          {data.tenant.cancellationPolicy && <p className="agenda-notice">{data.tenant.cancellationPolicy}</p>}
          <button className="primary-action" style={{ background: brandColor }} disabled={!name || !phone || !accepted || loading} onClick={submit}>
            {loading ? "Reservando..." : "Confirmar reserva"}
          </button>
        </section>
      )}

      {data && step === "success" && (
        <section className="success-state">
          <CheckCircle size={42} />
          <h1>{createdStatus === "confirmed" ? "Reserva confirmada" : "Solicitud de reserva recibida"}</h1>
          <p>{createdStatus === "confirmed" ? "Tu hora quedó registrada." : "El negocio revisará tu solicitud y te contactará para confirmarla."}</p>
          {data.tenant.postBookingInstructions && <p>{data.tenant.postBookingInstructions}</p>}
          <a className="primary-link" href={`/${slug}`}>Volver a la página del negocio</a>
        </section>
      )}
    </main>
  )
}
