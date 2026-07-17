import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "../../db"
import { appointments } from "../../db/schema"
import { rateLimitResponse } from "../../lib/api-guard"
import { createPublicAppointment } from "../../lib/booking"
import { verifyEmailActionToken } from "../../lib/email-tokens"
import { canTransition } from "../../lib/appointment-status"
import { requestIdFromHeaders } from "../../lib/observability"
import { anonymizeIdentifier, checkRateLimit, clientIp, rateLimitConfig } from "../../lib/rate-limit"
import { cleanString, isEmail, isUuid } from "../../lib/validation"

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token")
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://slotly.pgstudio.tech"

  if (!token) {
    return NextResponse.redirect(new URL(`/confirm/error?reason=missing`, base))
  }

  const result = await verifyEmailActionToken(token)

  if (!result || result.action !== "confirm") {
    return NextResponse.redirect(new URL(`/confirm/error?reason=invalid`, base))
  }

  const appointment = await db.query.appointments.findFirst({
    where: eq(appointments.id, result.appointmentId),
  })

  if (!appointment) {
    return NextResponse.redirect(new URL(`/confirm/error?reason=not_found`, base))
  }

  if (appointment.status === "confirmed") {
    return NextResponse.redirect(new URL(`/confirm/success?already=true`, base))
  }

  if (!canTransition(appointment.status, "confirmed")) {
    return NextResponse.redirect(new URL(`/confirm/error?reason=cannot_confirm`, base))
  }

  await db.update(appointments)
    .set({ status: "confirmed", updated_at: new Date() })
    .where(eq(appointments.id, result.appointmentId))

  return NextResponse.redirect(new URL(`/confirm/success`, base))
}

export async function POST(req: NextRequest) {
  const requestId = await requestIdFromHeaders()
  const config = rateLimitConfig("booking")
  const key = await anonymizeIdentifier(clientIp(req))
  const rateLimit = await checkRateLimit({ key, limit: config.limit, windowSeconds: config.windowSeconds, route: "public_booking", requestId })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit, requestId)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Solicitud invalida", requestId }, { status: 400, headers: { "x-request-id": requestId } })
  }

  if (cleanString(body.website, 200)) {
    return NextResponse.json({ error: "No se pudo crear la reserva.", requestId }, { status: 400, headers: { "x-request-id": requestId } })
  }

  if (body.consent !== true) {
    return NextResponse.json({ error: "Debes aceptar ser contactado para gestionar la reserva.", requestId }, { status: 400, headers: { "x-request-id": requestId } })
  }

  const slug = cleanString(body.slug, 80)
  const serviceId = cleanString(body.serviceId, 80)
  const professionalId = cleanString(body.professionalId, 80)
  const date = cleanString(body.fecha, 20)
  const time = cleanString(body.hora, 10)
  const clientName = cleanString(body.nombre, 120)
  const clientPhone = cleanString(body.telefono, 40)
  const clientEmail = cleanString(body.email, 160)

  if (!slug || !isUuid(serviceId) || !isUuid(professionalId) || !date || !time || !clientName || !clientPhone || !isEmail(clientEmail)) {
    return NextResponse.json({ error: "Completa los datos de la reserva.", requestId }, { status: 400, headers: { "x-request-id": requestId } })
  }

  const result = await createPublicAppointment({
    slug,
    serviceId,
    professionalId,
    date,
    time,
    clientName,
    clientPhone,
    clientEmail: clientEmail || null,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error, requestId }, { status: result.status, headers: { "x-request-id": requestId } })
  }

  return NextResponse.json({ ...result, requestId }, { headers: { "x-request-id": requestId } })
}
