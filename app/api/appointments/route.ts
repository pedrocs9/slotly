import { NextRequest, NextResponse } from "next/server"
import { rateLimitResponse } from "../../lib/api-guard"
import { createPublicAppointment } from "../../lib/booking"
import { logEvent, publicError, requestIdFromHeaders } from "../../lib/observability"
import { anonymizeIdentifier, checkRateLimit, clientIp, rateLimitConfig } from "../../lib/rate-limit"
import { cleanString, isEmail, isUuid } from "../../lib/validation"
import { sendBookingConfirmationToClient, sendBookingNotificationToTenant } from "../../lib/email"
import { eq } from "drizzle-orm"
import { db } from "../../db"
import { professionals, services, tenants } from "../../db/schema"
import { after } from "next/server"



export async function POST(req: NextRequest) {
  const requestId = await requestIdFromHeaders()
  const startedAt = Date.now()

  try {
    const config = rateLimitConfig("booking")
    const key = await anonymizeIdentifier(`${clientIp(req)}:appointments`)
    const rateLimit = await checkRateLimit({
      key,
      limit: config.limit,
      windowSeconds: config.windowSeconds,
      route: "public_appointments",
      requestId,
    })
    if (!rateLimit.ok) return rateLimitResponse(rateLimit, requestId) as unknown as NextResponse

    const contentLength = Number(req.headers.get("content-length") ?? "0")
    if (contentLength > 10_000) {
      return NextResponse.json({ error: "Solicitud demasiado grande", requestId }, { status: 413, headers: { "x-request-id": requestId } })
    }

    const body = await req.json()
    const slug = cleanString(body.slug, 100)
    const serviceId = body.serviceId
    const professionalId = body.professionalId
    const fecha = cleanString(body.fecha, 10)
    const hora = cleanString(body.hora, 5)
    const nombre = cleanString(body.nombre, 100)
    const telefono = cleanString(body.telefono, 30)
    const email = cleanString(body.email, 100).toLowerCase()
    const website = cleanString(body.website, 120)
    const consent = body.consent === true

    if (website) {
      logEvent({ event: "booking_honeypot_rejected", severity: "warn", route: "/api/appointments", requestId })
      return NextResponse.json({ error: "Solicitud invalida", requestId }, { status: 400, headers: { "x-request-id": requestId } })
    }

    if (!slug || !isUuid(serviceId) || !isUuid(professionalId) || !fecha || !hora || !nombre || !telefono) {
      return NextResponse.json({ error: "Faltan campos obligatorios", requestId }, { status: 400, headers: { "x-request-id": requestId } })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
      return NextResponse.json({ error: "Fecha u hora invalida", requestId }, { status: 400, headers: { "x-request-id": requestId } })
    }

    if (!isEmail(email)) {
      return NextResponse.json({ error: "Email invalido", requestId }, { status: 400, headers: { "x-request-id": requestId } })
    }
    if (!consent) {
      return NextResponse.json({ error: "Debes aceptar el uso de tus datos para gestionar la reserva", requestId }, { status: 400, headers: { "x-request-id": requestId } })
    }

    const result = await createPublicAppointment({
      slug,
      serviceId,
      professionalId,
      date: fecha,
      time: hora,
      clientName: nombre,
      clientPhone: telefono,
      clientEmail: email || null,
    })

    if (!result.ok) {
      logEvent({
        event: result.status === 409 ? "booking_conflict" : "booking_rejected",
        severity: result.status >= 500 ? "error" : "warn",
        route: "/api/appointments",
        requestId,
        status: result.status,
        metadata: { slug },
      })
      return NextResponse.json({ error: result.error, requestId }, { status: result.status, headers: { "x-request-id": requestId } })
    }

    logEvent({
      event: "booking_created",
      severity: "info",
      route: "/api/appointments",
      requestId,
      status: 200,
      durationMs: Date.now() - startedAt,
      metadata: { slug, appointmentStatus: result.status },
    })

    after(async () => {
      try {
        const [tenant, service, professional] = await Promise.all([
          db.query.tenants.findFirst({ where: eq(tenants.slug, slug) }),
          db.query.services.findFirst({ where: eq(services.id, serviceId) }),
          db.query.professionals.findFirst({ where: eq(professionals.id, professionalId) }),
        ])

        if (!tenant || !service || !professional) return

        const emailInput = {
          tenantName: tenant.name,
          tenantEmail: tenant.email,
          tenantSlug: tenant.slug,
          tenantPhone: tenant.phone,
          clientName: nombre,
          clientEmail: email || null,
          serviceName: service.name,
          professionalName: professional.name,
          date: fecha,
          time: hora,
          timezone: tenant.timezone,
          status: result.status,
          cancellationPolicy: tenant.cancellation_policy,
          postBookingInstructions: tenant.post_booking_instructions,
        }

        await Promise.all([
          sendBookingConfirmationToClient(emailInput),
          sendBookingNotificationToTenant(emailInput),
        ])
      } catch (err) {
        console.error("[slotly.email]", err)
      }
    })

    return NextResponse.json(
      { success: true, citaId: result.appointment.id, status: result.status, requestId },
      { headers: { "x-request-id": requestId } }
    )
  } catch (error) {
    logEvent({ event: "booking_unexpected_error", severity: "error", route: "/api/appointments", requestId, status: 500, code: error instanceof Error ? error.name : "unknown" })
    return publicError("No pudimos completar la reserva.", 500, requestId) as unknown as NextResponse
  }
}
