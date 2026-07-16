import { db } from "../db"
import { tenants, services, professionals } from "../db/schema"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { MapPin, Phone, Mail, Clock, Star, ChevronRight, Calendar, Shield, Award } from "lucide-react"

export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  })

  if (!tenant || !tenant.active) return notFound()

  const serviciosList = await db.query.services.findMany({
    where: eq(services.tenant_id, tenant.id),
  })

  const profesionalesList = await db.query.professionals.findMany({
    where: eq(professionals.tenant_id, tenant.id),
  })

  return (
    <main style={{ background: "var(--background)", minHeight: "100vh" }}>

      <style>{`
        .service-card {
          display: flex;
          flex-direction: column;
          padding: 20px;
          background: white;
          border-radius: 16px;
          border: 1.5px solid var(--border);
          text-decoration: none;
          transition: all .2s;
          cursor: pointer;
        }
        .service-card:hover {
          border-color: var(--primary);
          box-shadow: 0 8px 24px rgba(74,103,65,0.12);
          transform: translateY(-2px);
        }
        .nav-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 20px;
          background: var(--primary);
          color: white;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 500;
          text-decoration: none;
          transition: all .2s;
        }
        .nav-btn:hover {
          background: var(--primary-dark);
        }
        .cta-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 16px 40px;
          background: white;
          color: var(--primary-dark);
          border-radius: 100px;
          font-size: 15px;
          font-weight: 700;
          text-decoration: none;
          box-shadow: 0 8px 32px rgba(0,0,0,0.25);
          transition: all .2s;
        }
        .cta-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.3);
        }
        .hero-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 32px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          color: white;
          border-radius: 100px;
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          transition: all .2s;
        }
        .hero-btn-secondary:hover {
          background: rgba(255,255,255,0.18);
        }
        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 14px;
        }
        @media (max-width: 640px) {
          .services-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 24px", height: "60px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "50%",
            background: "var(--primary)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "white", fontSize: "14px", fontFamily: "var(--font-heading)" }}>P</span>
          </div>
          <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--foreground)", fontFamily: "var(--font-heading)" }}>
            {tenant.name}
          </span>
        </div>
        <a href={`/${slug}/reservar`} className="nav-btn">
          <Calendar size={14} />
          Reservar hora
        </a>
      </nav>

      {/* HERO */}
      <section style={{
        background: "linear-gradient(160deg, #1a3318 0%, #2E4A2B 50%, #4A6741 100%)",
        padding: "80px 24px 100px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "-80px", right: "-80px",
          width: "400px", height: "400px", borderRadius: "50%",
          background: "rgba(255,255,255,0.03)", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "-60px", left: "-60px",
          width: "300px", height: "300px", borderRadius: "50%",
          background: "rgba(255,255,255,0.03)", pointerEvents: "none",
        }} />

        <div style={{ maxWidth: "760px", margin: "0 auto", textAlign: "center", position: "relative" }}>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "6px 16px",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "100px", marginBottom: "28px",
          }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#4ade80" }} />
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "12px", fontWeight: 500 }}>
              Agenda abierta · Reserva tu hora online
            </span>
          </div>

          <h1 style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
            color: "white", lineHeight: 1.1,
            marginBottom: "20px", fontWeight: 400,
          }}>
            {tenant.name}
          </h1>

          {tenant.description && (
            <p style={{
              color: "rgba(255,255,255,0.7)", fontSize: "16px",
              lineHeight: 1.7, maxWidth: "560px",
              margin: "0 auto 36px",
            }}>
              {tenant.description}
            </p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center", marginBottom: "48px" }}>
            <a href={`/${slug}/reservar`} className="cta-btn">
              <Calendar size={16} />
              Reservar mi hora
            </a>
            <a href="#servicios" className="hero-btn-secondary">
              Ver servicios
            </a>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px" }}>
            {[
              { icon: MapPin, text: tenant.address },
              { icon: Phone, text: tenant.phone },
              { icon: Mail, text: tenant.email },
            ].filter(i => i.text).map(({ icon: Icon, text }) => (
              <div key={text} style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 14px",
                background: "rgba(255,255,255,0.08)",
                borderRadius: "100px",
                color: "rgba(255,255,255,0.75)", fontSize: "12px",
              }}>
                <Icon size={12} />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <div style={{
        background: "white",
        borderBottom: "1px solid var(--border)",
        padding: "20px 24px",
      }}>
        <div style={{
          maxWidth: "760px", margin: "0 auto",
          display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "32px",
        }}>
          {[
            { icon: Award, label: "+10 años", sub: "de experiencia" },
            { icon: Star, label: "4.9 / 5", sub: "valoración Google" },
            { icon: Clock, label: "Lun–Sáb", sub: "9:00 a 19:00 hrs" },
            { icon: Shield, label: "Atención", sub: "100% profesional" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "10px",
                background: "var(--primary-light)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon size={16} color="var(--primary)" />
              </div>
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--foreground)" }}>{label}</div>
                <div style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SERVICIOS */}
      <section id="servicios" style={{ padding: "72px 24px" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          <div style={{ marginBottom: "40px" }}>
            <p style={{
              fontSize: "11px", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.12em",
              color: "var(--primary)", marginBottom: "10px",
            }}>
              ¿Qué necesitas?
            </p>
            <h2 style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
              color: "var(--foreground)", fontWeight: 400, marginBottom: "10px",
            }}>
              Nuestros servicios
            </h2>
            <p style={{ fontSize: "14px", color: "var(--muted-foreground)", lineHeight: 1.6 }}>
              Selecciona el servicio para ver disponibilidad y reservar tu hora.
            </p>
          </div>

          <div className="services-grid">
            {serviciosList.map((servicio) => (
              <a
                key={servicio.id}
                href={`/${slug}/reservar?servicio=${servicio.id}`}
                className="service-card"
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "10px", height: "10px", borderRadius: "50%", flexShrink: 0,
                      background: servicio.color || "var(--primary)", marginTop: "3px",
                    }} />
                    <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)", lineHeight: 1.3 }}>
                      {servicio.name}
                    </h3>
                  </div>
                  <ChevronRight size={15} color="var(--muted-foreground)" style={{ flexShrink: 0, marginTop: "2px" }} />
                </div>

                {servicio.description && (
                  <p style={{
                    fontSize: "12.5px", color: "var(--muted-foreground)",
                    lineHeight: 1.6, flex: 1, marginBottom: "16px",
                  }}>
                    {servicio.description}
                  </p>
                )}

                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  paddingTop: "14px", borderTop: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--primary)" }}>
                      ${Number(servicio.price).toLocaleString("es-CL")}
                    </span>
                    <span style={{
                      fontSize: "11px", padding: "3px 10px", borderRadius: "100px",
                      background: "var(--muted)", color: "var(--muted-foreground)", fontWeight: 500,
                    }}>
                      {servicio.duration_min} min
                    </span>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--primary)" }}>
                    Reservar →
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* EQUIPO */}
      {profesionalesList.length > 0 && (
        <section style={{ padding: "72px 24px", background: "var(--muted)" }}>
          <div style={{ maxWidth: "760px", margin: "0 auto" }}>
            <div style={{ marginBottom: "36px" }}>
              <p style={{
                fontSize: "11px", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.12em",
                color: "var(--primary)", marginBottom: "10px",
              }}>
                Especialistas
              </p>
              <h2 style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
                color: "var(--foreground)", fontWeight: 400,
              }}>
                Nuestro equipo
              </h2>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
              {profesionalesList.map((prof) => (
                <div key={prof.id} style={{
                  display: "flex", alignItems: "center", gap: "16px",
                  padding: "20px 24px", background: "white",
                  borderRadius: "16px", border: "1px solid var(--border)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)", minWidth: "260px",
                }}>
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: "20px",
                    fontFamily: "var(--font-heading)", flexShrink: 0,
                    boxShadow: "0 4px 12px rgba(74,103,65,0.3)",
                  }}>
                    {prof.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)", marginBottom: "2px" }}>
                      {prof.name}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--primary)", fontWeight: 500, marginBottom: "5px" }}>
                      {prof.role === "owner" ? "Podóloga especialista" : "Podóloga"}
                    </div>
                    <div style={{ display: "flex", gap: "2px" }}>
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={10} fill="var(--accent)" color="var(--accent)" />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA FINAL */}
      <section style={{
        padding: "80px 24px",
        background: "linear-gradient(135deg, #1a3318 0%, var(--primary-dark) 100%)",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: "540px", margin: "0 auto" }}>
          <h2 style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(1.8rem, 3vw, 2.6rem)",
            color: "white", fontWeight: 400, marginBottom: "14px",
          }}>
            ¿Lista para sentirte mejor?
          </h2>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "15px", lineHeight: 1.6, marginBottom: "36px" }}>
            Reserva tu hora en menos de un minuto. Sin llamadas, sin esperas.
          </p>
          <a href={`/${slug}/reservar`} className="cta-btn">
            <Calendar size={18} />
            Reservar mi hora
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "24px", background: "var(--foreground)", textAlign: "center" }}>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
          © {new Date().getFullYear()} {tenant.name} · Powered by{" "}
          <a href="https://pgstudio.tech" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>
            pgstudio
          </a>
        </p>
      </footer>

    </main>
  )
}