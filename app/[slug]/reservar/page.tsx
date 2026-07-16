"use client"
import { use } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { Calendar, Clock, ChevronLeft, CheckCircle, User, Phone, Mail } from "lucide-react"

type Step = "servicio" | "fecha" | "datos" | "confirmado"

const SERVICIOS = [
  { id: "1", nombre: "Podología Clínica", precio: "$25.000", duracion: 60 },
  { id: "2", nombre: "Quiropodia", precio: "$18.000", duracion: 45 },
  { id: "3", nombre: "Biomecánica y Estudio de la Pisada", precio: "$45.000", duracion: 90 },
  { id: "4", nombre: "Cirugía Ungueal — Uña Encarnada", precio: "$35.000", duracion: 60 },
  { id: "5", nombre: "Podología Estética", precio: "$22.000", duracion: 75 },
  { id: "6", nombre: "Tratamiento Pie Diabético", precio: "$30.000", duracion: 60 },
  { id: "7", nombre: "Tratamiento de Hongos", precio: "$28.000", duracion: 45 },
  { id: "8", nombre: "Verruga Plantar", precio: "$25.000", duracion: 45 },
  { id: "9", nombre: "Plantillas Ortopédicas", precio: "$65.000", duracion: 30 },
  { id: "10", nombre: "Revisión y Control", precio: "$12.000", duracion: 30 },
]

const HORAS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
]

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

function diasDisponibles() {
  const dias: Date[] = []
  const hoy = new Date()
  let i = 1
  while (dias.length < 14) {
    const d = new Date(hoy)
    d.setDate(hoy.getDate() + i)
    if (d.getDay() !== 0) dias.push(d)
    i++
  }
  return dias
}

function ReservarContent({ slug }: { slug: string }) {
  const searchParams = useSearchParams()
  const servicioIdParam = searchParams.get("servicio")

  const servicioInicial = SERVICIOS.find(s => s.id === servicioIdParam)

  const [step, setStep] = useState<Step>(servicioInicial ? "fecha" : "servicio")
  const [seleccion, setSeleccion] = useState({
    servicioId: servicioInicial?.id || "",
    servicioNombre: servicioInicial?.nombre || "",
    precio: servicioInicial?.precio || "",
    duracion: servicioInicial?.duracion || 0,
    fecha: "",
    hora: "",
    nombre: "",
    telefono: "",
    email: "",
  })

  const [cargando, setCargando] = useState(false)
const [error, setError] = useState("")

const handleConfirmar = async () => {
  setCargando(true)
  setError("")

  try {
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        servicioNombre: seleccion.servicioNombre,
        fecha: seleccion.fecha,
        hora: seleccion.hora,
        nombre: seleccion.nombre,
        telefono: seleccion.telefono,
        email: seleccion.email,
        duracion: seleccion.duracion,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || "Ocurrió un error al confirmar la reserva.")
      return
    }

    setStep("confirmado")
  } catch (err) {
    setError("No se pudo conectar con el servidor. Intenta nuevamente.")
  } finally {
    setCargando(false)
  }
}

  const stepIndex: Record<Step, number> = {
    servicio: 1,
    fecha: 2,
    datos: 3,
    confirmado: 4,
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      <style>{`
        .step-btn {
          width: 100%;
          padding: 16px 20px;
          background: white;
          border: 1.5px solid var(--border);
          border-radius: 12px;
          text-align: left;
          cursor: pointer;
          transition: all .2s;
          font-family: var(--font-body);
        }
        .step-btn:hover {
          border-color: var(--primary);
          box-shadow: 0 4px 16px rgba(74,103,65,0.1);
          transform: translateY(-1px);
        }
        .hora-btn {
          padding: 10px 8px;
          border: 1.5px solid var(--border);
          border-radius: 10px;
          background: white;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: var(--foreground);
          transition: all .15s;
          font-family: var(--font-body);
          text-align: center;
        }
        .hora-btn:hover { border-color: var(--primary); color: var(--primary); }
        .hora-btn.sel { background: var(--primary); border-color: var(--primary); color: white; }
        .dia-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 10px 8px;
          border: 1.5px solid var(--border);
          border-radius: 12px;
          background: white;
          cursor: pointer;
          transition: all .15s;
          min-width: 52px;
          font-family: var(--font-body);
        }
        .dia-btn:hover { border-color: var(--primary); }
        .dia-btn.sel { background: var(--primary); border-color: var(--primary); }
        .input-field {
          width: 100%;
          padding: 12px 16px;
          border: 1.5px solid var(--border);
          border-radius: 12px;
          font-size: 14px;
          outline: none;
          background: white;
          color: var(--foreground);
          font-family: var(--font-body);
          transition: border-color .15s;
          box-sizing: border-box;
        }
        .input-field:focus { border-color: var(--primary); }
        .btn-primary {
          width: 100%;
          padding: 14px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all .2s;
          font-family: var(--font-body);
        }
        .btn-primary:hover { background: var(--primary-dark); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-ghost {
          width: 100%;
          padding: 12px;
          background: transparent;
          border: none;
          color: var(--muted-foreground);
          font-size: 13px;
          cursor: pointer;
          margin-top: 8px;
          font-family: var(--font-body);
        }
        .resumen-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
        }
        .resumen-row:last-child { border-bottom: none; }
      `}</style>

      {/* NAV */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
          padding: "0 24px",
          height: "60px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <a
          href={`/${slug}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--muted-foreground)",
            fontSize: "13px",
            textDecoration: "none",
          }}
        >
          <ChevronLeft size={16} />
          Volver
        </a>
        <span style={{ color: "var(--border)" }}>|</span>
        <span
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--foreground)",
          }}
        >
          Reservar hora
        </span>
      </nav>

      <div
        style={{ maxWidth: "520px", margin: "0 auto", padding: "32px 24px" }}
      >
        {/* PROGRESS BAR */}
        {step !== "confirmado" && (
          <div style={{ display: "flex", gap: "6px", marginBottom: "32px" }}>
            {([1, 2, 3] as number[]).map((n) => (
              <div
                key={n}
                style={{
                  flex: 1,
                  height: "4px",
                  borderRadius: "2px",
                  background:
                    stepIndex[step] >= n ? "var(--primary)" : "var(--border)",
                  opacity: stepIndex[step] >= n ? 1 : 0.3,
                  transition: "all .3s",
                }}
              />
            ))}
          </div>
        )}

        {/* ── STEP 1: SERVICIO ── */}
        {step === "servicio" && (
          <div>
            <h1
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "1.8rem",
                fontWeight: 400,
                color: "var(--foreground)",
                marginBottom: "6px",
              }}
            >
              ¿Qué servicio necesitas?
            </h1>
            <p
              style={{
                fontSize: "13px",
                color: "var(--muted-foreground)",
                marginBottom: "24px",
              }}
            >
              Selecciona el servicio para ver disponibilidad.
            </p>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {SERVICIOS.map((s) => (
                <button
                  key={s.id}
                  className="step-btn"
                  onClick={() => {
                    setSeleccion((prev) => ({
                      ...prev,
                      servicioId: s.id,
                      servicioNombre: s.nombre,
                      precio: s.precio,
                      duracion: s.duracion,
                    }));
                    setStep("fecha");
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--foreground)",
                      }}
                    >
                      {s.nombre}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                        flexShrink: 0,
                        marginLeft: "12px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--muted-foreground)",
                        }}
                      >
                        {s.duracion} min
                      </span>
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "var(--primary)",
                        }}
                      >
                        {s.precio}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: FECHA Y HORA ── */}
        {step === "fecha" && (
          <div>
            <h1
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "1.8rem",
                fontWeight: 400,
                color: "var(--foreground)",
                marginBottom: "6px",
              }}
            >
              Elige fecha y hora
            </h1>
            <p
              style={{
                fontSize: "13px",
                color: "var(--muted-foreground)",
                marginBottom: "24px",
              }}
            >
              Disponibilidad para{" "}
              <strong style={{ color: "var(--primary)" }}>
                {seleccion.servicioNombre}
              </strong>
            </p>

            {/* Días */}
            <div style={{ marginBottom: "28px" }}>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--muted-foreground)",
                  marginBottom: "12px",
                }}
              >
                Selecciona un día
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  overflowX: "auto",
                  paddingBottom: "4px",
                }}
              >
                {diasDisponibles().map((dia) => {
                  const key = dia.toISOString().split("T")[0];
                  const sel = seleccion.fecha === key;
                  return (
                    <button
                      key={key}
                      className={`dia-btn${sel ? " sel" : ""}`}
                      onClick={() =>
                        setSeleccion((prev) => ({
                          ...prev,
                          fecha: key,
                          hora: "",
                        }))
                      }
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 500,
                          marginBottom: "2px",
                          color: sel
                            ? "rgba(255,255,255,0.8)"
                            : "var(--muted-foreground)",
                        }}
                      >
                        {DIAS_SEMANA[dia.getDay()]}
                      </span>
                      <span
                        style={{
                          fontSize: "16px",
                          fontWeight: 700,
                          color: sel ? "white" : "var(--foreground)",
                        }}
                      >
                        {dia.getDate()}
                      </span>
                      <span
                        style={{
                          fontSize: "9px",
                          color: sel
                            ? "rgba(255,255,255,0.7)"
                            : "var(--muted-foreground)",
                        }}
                      >
                        {MESES[dia.getMonth()]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Horas */}
            {seleccion.fecha && (
              <div style={{ marginBottom: "28px" }}>
                <p
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--muted-foreground)",
                    marginBottom: "12px",
                  }}
                >
                  Selecciona una hora
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "8px",
                  }}
                >
                  {HORAS.map((hora) => (
                    <button
                      key={hora}
                      className={`hora-btn${seleccion.hora === hora ? " sel" : ""}`}
                      onClick={() =>
                        setSeleccion((prev) => ({ ...prev, hora }))
                      }
                    >
                      {hora}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              className="btn-primary"
              disabled={!seleccion.fecha || !seleccion.hora}
              onClick={() => setStep("datos")}
            >
              Continuar →
            </button>
            <button className="btn-ghost" onClick={() => setStep("servicio")}>
              ← Cambiar servicio
            </button>
          </div>
        )}

        {/* ── STEP 3: DATOS ── */}
        {step === "datos" && (
          <div>
            <h1
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "1.8rem",
                fontWeight: 400,
                color: "var(--foreground)",
                marginBottom: "6px",
              }}
            >
              Tus datos
            </h1>
            <p
              style={{
                fontSize: "13px",
                color: "var(--muted-foreground)",
                marginBottom: "24px",
              }}
            >
              Para confirmar tu reserva necesitamos tus datos de contacto.
            </p>

            {/* Resumen cita */}
            <div
              style={{
                padding: "16px",
                background: "var(--primary-light)",
                borderRadius: "12px",
                marginBottom: "24px",
                border: "1px solid rgba(74,103,65,0.15)",
              }}
            >
              <div className="resumen-row">
                <span
                  style={{ fontSize: "12px", color: "var(--muted-foreground)" }}
                >
                  Servicio
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--foreground)",
                  }}
                >
                  {seleccion.servicioNombre}
                </span>
              </div>
              <div className="resumen-row">
                <span
                  style={{ fontSize: "12px", color: "var(--muted-foreground)" }}
                >
                  Fecha
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--foreground)",
                  }}
                >
                  {new Date(seleccion.fecha + "T12:00:00").toLocaleDateString(
                    "es-CL",
                    {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    },
                  )}
                </span>
              </div>
              <div className="resumen-row">
                <span
                  style={{ fontSize: "12px", color: "var(--muted-foreground)" }}
                >
                  Hora
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--foreground)",
                  }}
                >
                  {seleccion.hora} hrs
                </span>
              </div>
              <div className="resumen-row">
                <span
                  style={{ fontSize: "12px", color: "var(--muted-foreground)" }}
                >
                  Precio
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "var(--primary)",
                  }}
                >
                  {seleccion.precio}
                </span>
              </div>
            </div>

            {/* Formulario */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                marginBottom: "20px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--foreground)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: "7px",
                  }}
                >
                  <User size={11} /> Nombre completo
                </label>
                <input
                  className="input-field"
                  placeholder="Tu nombre"
                  value={seleccion.nombre}
                  onChange={(e) =>
                    setSeleccion((prev) => ({
                      ...prev,
                      nombre: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--foreground)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: "7px",
                  }}
                >
                  <Phone size={11} /> Teléfono
                </label>
                <input
                  className="input-field"
                  placeholder="+56 9 1234 5678"
                  value={seleccion.telefono}
                  onChange={(e) =>
                    setSeleccion((prev) => ({
                      ...prev,
                      telefono: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "var(--foreground)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: "7px",
                  }}
                >
                  <Mail size={11} />
                  Email{" "}
                  <span
                    style={{
                      fontWeight: 400,
                      textTransform: "none",
                      letterSpacing: 0,
                      color: "var(--muted-foreground)",
                    }}
                  >
                    (opcional)
                  </span>
                </label>
                <input
                  className="input-field"
                  placeholder="tu@email.com"
                  value={seleccion.email}
                  onChange={(e) =>
                    setSeleccion((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>
            </div>

            {error && (
              <p
                style={{
                  fontSize: "13px",
                  color: "#ef4444",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  marginBottom: "12px",
                }}
              >
                {error}
              </p>
            )}

            <button
              className="btn-primary"
              disabled={!seleccion.nombre || !seleccion.telefono || cargando}
              onClick={handleConfirmar}
            >
              {cargando ? "Confirmando..." : "Confirmar reserva →"}
            </button>
          </div>
        )}

        {/* ── STEP 4: CONFIRMADO ── */}
        {step === "confirmado" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "var(--primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
              }}
            >
              <CheckCircle size={36} color="var(--primary)" />
            </div>

            <h1
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "2rem",
                fontWeight: 400,
                color: "var(--foreground)",
                marginBottom: "10px",
              }}
            >
              ¡Reserva confirmada!
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "var(--muted-foreground)",
                marginBottom: "32px",
                lineHeight: 1.6,
              }}
            >
              Te contactaremos al <strong>{seleccion.telefono}</strong> para
              confirmar tu cita.
            </p>

            {/* Resumen final */}
            <div
              style={{
                padding: "20px",
                background: "white",
                borderRadius: "16px",
                border: "1px solid var(--border)",
                textAlign: "left",
                marginBottom: "28px",
              }}
            >
              <div className="resumen-row">
                <span
                  style={{ fontSize: "12px", color: "var(--muted-foreground)" }}
                >
                  Servicio
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--foreground)",
                  }}
                >
                  {seleccion.servicioNombre}
                </span>
              </div>
              <div className="resumen-row">
                <span
                  style={{ fontSize: "12px", color: "var(--muted-foreground)" }}
                >
                  Fecha
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--foreground)",
                  }}
                >
                  {new Date(seleccion.fecha + "T12:00:00").toLocaleDateString(
                    "es-CL",
                    {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    },
                  )}
                </span>
              </div>
              <div className="resumen-row">
                <span
                  style={{ fontSize: "12px", color: "var(--muted-foreground)" }}
                >
                  Hora
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--foreground)",
                  }}
                >
                  {seleccion.hora} hrs
                </span>
              </div>
              <div className="resumen-row">
                <span
                  style={{ fontSize: "12px", color: "var(--muted-foreground)" }}
                >
                  Precio
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "var(--primary)",
                  }}
                >
                  {seleccion.precio}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                justifyContent: "center",
                marginBottom: "28px",
              }}
            >
              <Clock size={14} color="var(--muted-foreground)" />
              <span
                style={{ fontSize: "12px", color: "var(--muted-foreground)" }}
              >
                Recibirás un recordatorio 24 hrs antes de tu cita
              </span>
            </div>

            <a
              href={`/${slug}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 28px",
                background: "var(--primary)",
                color: "white",
                borderRadius: "100px",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Volver al inicio
            </a>
          </div>
        )}
      </div>
    </div>
  );
}


export default function ReservarPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)

  return (
    <Suspense>
      <ReservarContent slug={slug} />
    </Suspense>
  )
}