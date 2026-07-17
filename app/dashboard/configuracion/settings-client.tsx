"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, ExternalLink, Save } from "lucide-react"
import { BOOKING_PAGE_STATUSES, TIME_ZONES, normalizeSlug, readableTextColor } from "../../lib/business-settings"

type Settings = {
  name: string
  description: string | null
  email: string | null
  phone: string | null
  address: string | null
  timezone: string
  logoUrl: string | null
  slug: string
  bookingPageStatus: string
  brandColor: string
  bookingMinNoticeMin: number
  bookingHorizonDays: number
  slotIntervalMin: number
  autoConfirmAppointments: boolean
  cancellationPolicy: string | null
  postBookingInstructions: string | null
}

const emptySettings: Settings = {
  name: "",
  description: "",
  email: "",
  phone: "",
  address: "",
  timezone: "America/Santiago",
  logoUrl: "",
  slug: "",
  bookingPageStatus: "draft",
  brandColor: "#5b6ee1",
  bookingMinNoticeMin: 120,
  bookingHorizonDays: 45,
  slotIntervalMin: 30,
  autoConfirmAppointments: false,
  cancellationPolicy: "",
  postBookingInstructions: "",
}

export function SettingsClient() {
  const [settings, setSettings] = useState<Settings>(emptySettings)
  const [initial, setInitial] = useState<Settings>(emptySettings)
  const [role, setRole] = useState<"owner" | "staff">("staff")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(initial), [settings, initial])
  const canEdit = role === "owner"
  const textColor = readableTextColor(settings.brandColor)

  useEffect(() => {
    fetch("/api/dashboard/settings")
      .then((res) => res.json())
      .then((payload) => {
        setSettings(payload.tenant)
        setInitial(payload.tenant)
        setRole(payload.role)
      })
      .catch(() => setError("No pudimos cargar la configuracion."))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
    setMessage("")
    setErrors({})
  }

  async function save() {
    setSaving(true)
    setError("")
    setMessage("")
    const res = await fetch("/api/dashboard/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    })
    const payload = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(payload.error || "No se pudo guardar.")
      setErrors(payload.errors || {})
      return
    }
    setSettings(payload.tenant)
    setInitial(payload.tenant)
    setMessage("Configuracion guardada.")
  }

  if (loading) return <main className="dashboard-page"><section className="panel">Cargando configuracion...</section></main>

  return (
    <main className="dashboard-page settings-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Configuracion</p>
          <h1>Negocio y pagina publica</h1>
          <p className="muted-copy">La zona horaria afecta agenda y reservas nuevas; las citas historicas no se recalculan.</p>
        </div>
        <div className="topbar-actions">
          <a className="secondary-link compact" href={`/${settings.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Ver publica</a>
          <button className="primary-link compact" disabled={!canEdit || !dirty || saving} onClick={save}><Save size={15} /> {saving ? "Guardando..." : "Guardar"}</button>
        </div>
      </header>

      {role !== "owner" && <p className="agenda-notice">Tu rol puede consultar esta informacion, pero no modificar configuracion global.</p>}
      {dirty && <p className="agenda-notice">Hay cambios sin guardar. Si cambias el slug, los enlaces anteriores podrian dejar de funcionar.</p>}
      {message && <p className="agenda-notice"><Check size={14} /> {message}</p>}
      {error && <p className="form-error">{error}</p>}

      <section className="settings-grid">
        <div className="settings-forms">
          <section className="panel settings-section">
            <h2>Negocio</h2>
            <label>Nombre<input disabled={!canEdit} value={settings.name} onChange={(event) => update("name", event.target.value)} />{errors.name && <em>{errors.name}</em>}</label>
            <label>Descripcion<textarea disabled={!canEdit} value={settings.description ?? ""} onChange={(event) => update("description", event.target.value)} /></label>
            <label>Email<input disabled={!canEdit} value={settings.email ?? ""} onChange={(event) => update("email", event.target.value)} />{errors.email && <em>{errors.email}</em>}</label>
            <label>Telefono<input disabled={!canEdit} value={settings.phone ?? ""} onChange={(event) => update("phone", event.target.value)} /></label>
            <label>Direccion<input disabled={!canEdit} value={settings.address ?? ""} onChange={(event) => update("address", event.target.value)} /></label>
            <label>Zona horaria<select disabled={!canEdit} value={settings.timezone} onChange={(event) => update("timezone", event.target.value)}>{TIME_ZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select>{errors.timezone && <em>{errors.timezone}</em>}</label>
          </section>

          <section className="panel settings-section">
            <h2>Pagina publica</h2>
            <label>Slug<input disabled={!canEdit || saving} value={settings.slug} onChange={(event) => update("slug", normalizeSlug(event.target.value))} />{errors.slug && <em>{errors.slug}</em>}</label>
            <small>URL actual: /{initial.slug} · Nueva URL: /{settings.slug || "tu-negocio"}</small>
            <label>Estado<select disabled={!canEdit} value={settings.bookingPageStatus} onChange={(event) => update("bookingPageStatus", event.target.value)}>{BOOKING_PAGE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label>Logo URL<input disabled={!canEdit} value={settings.logoUrl ?? ""} onChange={(event) => update("logoUrl", event.target.value)} />{errors.logoUrl && <em>{errors.logoUrl}</em>}</label>
            <label>Color principal<input disabled={!canEdit} type="color" value={settings.brandColor} onChange={(event) => update("brandColor", event.target.value)} />{errors.brandColor && <em>{errors.brandColor}</em>}</label>
          </section>

          <section className="panel settings-section">
            <h2>Reservas</h2>
            <label>Anticipacion minima (minutos)<input disabled={!canEdit} type="number" value={settings.bookingMinNoticeMin} onChange={(event) => update("bookingMinNoticeMin", Number(event.target.value))} />{errors.bookingMinNoticeMin && <em>{errors.bookingMinNoticeMin}</em>}</label>
            <label>Horizonte maximo (dias)<input disabled={!canEdit} type="number" value={settings.bookingHorizonDays} onChange={(event) => update("bookingHorizonDays", Number(event.target.value))} />{errors.bookingHorizonDays && <em>{errors.bookingHorizonDays}</em>}</label>
            <label>Intervalo de slots<select disabled={!canEdit} value={settings.slotIntervalMin} onChange={(event) => update("slotIntervalMin", Number(event.target.value))}><option value={15}>15 minutos</option><option value={30}>30 minutos</option><option value={60}>60 minutos</option></select></label>
            <label className="consent"><input disabled={!canEdit} type="checkbox" checked={settings.autoConfirmAppointments} onChange={(event) => update("autoConfirmAppointments", event.target.checked)} /> Confirmar automaticamente las reservas publicas</label>
            <label>Politica de cancelacion<textarea disabled={!canEdit} value={settings.cancellationPolicy ?? ""} onChange={(event) => update("cancellationPolicy", event.target.value)} /></label>
            <label>Instrucciones posteriores<textarea disabled={!canEdit} value={settings.postBookingInstructions ?? ""} onChange={(event) => update("postBookingInstructions", event.target.value)} /></label>
          </section>
        </div>

        <aside className="panel preview-panel">
          <h2>Vista previa</h2>
          <div className="preview-card" style={{ borderColor: settings.brandColor }}>
            <div className="preview-logo" style={{ background: settings.brandColor, color: textColor }}>{settings.logoUrl ? "Logo" : settings.name.slice(0, 1) || "S"}</div>
            <span>{settings.bookingPageStatus === "published" ? "Publicada" : settings.bookingPageStatus === "paused" ? "Pausada" : "Borrador"}</span>
            <h3>{settings.name || "Tu negocio"}</h3>
            <p>{settings.description || "Descripcion visible para clientes."}</p>
            <button style={{ background: settings.bookingPageStatus === "paused" ? "#e5e7eb" : settings.brandColor, color: settings.bookingPageStatus === "paused" ? "#374151" : textColor }}>
              {settings.bookingPageStatus === "paused" ? "Reservas pausadas" : "Reservar hora"}
            </button>
          </div>
        </aside>
      </section>
    </main>
  )
}
