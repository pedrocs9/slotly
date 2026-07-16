import { db } from "../../db"
import { appointments, professionals, services, tenants } from "../../db/schema"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      slug,
      servicioNombre,
      fecha,
      hora,
      nombre,
      telefono,
      email,
      duracion,
    } = body

    // Validación básica
    if (!slug || !servicioNombre || !fecha || !hora || !nombre || !telefono) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios" },
        { status: 400 }
      )
    }

    // Buscar tenant
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
    })

    if (!tenant) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 })
    }

    // Buscar profesional principal del tenant
    const profesional = await db.query.professionals.findFirst({
      where: eq(professionals.tenant_id, tenant.id),
    })

    if (!profesional) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 })
    }

    // Buscar servicio por nombre
    const servicio = await db.query.services.findFirst({
      where: eq(services.tenant_id, tenant.id),
    })

    if (!servicio) {
      return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 })
    }

    // Construir fecha y hora de inicio y fin
    const startsAt = new Date(`${fecha}T${hora}:00`)
    const endsAt = new Date(startsAt.getTime() + duracion * 60 * 1000)

    // Insertar cita
    const [cita] = await db.insert(appointments).values({
      tenant_id: tenant.id,
      professional_id: profesional.id,
      service_id: servicio.id,
      client_name: nombre,
      client_phone: telefono,
      client_email: email || null,
      starts_at: startsAt,
      ends_at: endsAt,
      status: "confirmed",
      booked_by: "client",
    }).returning()

    return NextResponse.json({ success: true, citaId: cita.id })

  } catch (error) {
    console.error("Error al crear cita:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}