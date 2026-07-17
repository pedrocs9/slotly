import { NextResponse } from "next/server"
import { getAvailableSlots, getBookableProfessionals, getBookableServices, getPublicTenant } from "../../../lib/booking"
import { rateLimitResponse } from "../../../lib/api-guard"
import { requestIdFromHeaders } from "../../../lib/observability"
import { anonymizeIdentifier, checkRateLimit, clientIp, rateLimitConfig } from "../../../lib/rate-limit"

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const requestId = await requestIdFromHeaders()
  const { slug } = await params
  const { searchParams } = new URL(req.url)
  const config = rateLimitConfig("public")
  const key = await anonymizeIdentifier(`${clientIp(req)}:${slug}`)
  const publicLimit = searchParams.has("date") && "slotLimit" in config && typeof config.slotLimit === "number"
    ? config.slotLimit
    : config.limit
  const rateLimit = await checkRateLimit({ key, limit: publicLimit, windowSeconds: config.windowSeconds, route: "public_availability", requestId })
  if (!rateLimit.ok) return rateLimitResponse(rateLimit, requestId)
  const tenant = await getPublicTenant(slug)

  if (!tenant || tenant.booking_page_status === "draft") return NextResponse.json({ error: "Negocio no encontrado", requestId }, { status: 404, headers: { "x-request-id": requestId } })

  const reservable = tenant.booking_page_status === "published"
  const services = reservable ? await getBookableServices(tenant.id) : []
  const professionalsByService = Object.fromEntries(
    await Promise.all(
      services.map(async (service) => [
        service.id,
        await getBookableProfessionals(tenant.id, service.id),
      ])
    )
  )

  const serviceId = searchParams.get("serviceId")
  const professionalId = searchParams.get("professionalId")
  const date = searchParams.get("date")
  const slots = serviceId && professionalId && date
    ? await getAvailableSlots({ tenantId: tenant.id, serviceId, professionalId, date })
    : []

  return NextResponse.json({
    tenant: {
      name: tenant.name,
      slug: tenant.slug,
      timezone: tenant.timezone,
      phone: tenant.phone,
      email: tenant.email,
      address: tenant.address,
      description: tenant.description,
      logoUrl: tenant.logo_url,
      brandColor: tenant.brand_color,
      bookingPageStatus: tenant.booking_page_status,
      cancellationPolicy: tenant.cancellation_policy,
      postBookingInstructions: tenant.post_booking_instructions,
      autoConfirm: tenant.auto_confirm_appointments,
    },
    reservable,
    services,
    professionalsByService,
    slots: slots.map((slot) => ({ label: slot.label })),
    requestId,
  }, { headers: { "x-request-id": requestId } })
}
