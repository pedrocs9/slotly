import { and, eq, ne } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "../../../db"
import { tenants } from "../../../db/schema"
import { requirePermission } from "../../../lib/authorization"
import { parseBusinessSettings } from "../../../lib/business-settings"
import { logEvent, requestIdFromHeaders } from "../../../lib/observability"
import { getOnboardingStatus } from "../../../lib/onboarding"
import { getTenantSettingsForContext } from "../../../lib/resource-access"
import { requireSessionContext } from "../../../lib/session"

function serializeTenant(tenant: typeof tenants.$inferSelect) {
  return {
    id: tenant.id,
    name: tenant.name,
    description: tenant.description,
    email: tenant.email,
    phone: tenant.phone,
    address: tenant.address,
    timezone: tenant.timezone,
    logoUrl: tenant.logo_url,
    slug: tenant.slug,
    bookingPageStatus: tenant.booking_page_status,
    brandColor: tenant.brand_color,
    bookingMinNoticeMin: tenant.booking_min_notice_min,
    bookingHorizonDays: tenant.booking_horizon_days,
    slotIntervalMin: tenant.slot_interval_min,
    autoConfirmAppointments: tenant.auto_confirm_appointments,
    cancellationPolicy: tenant.cancellation_policy,
    postBookingInstructions: tenant.post_booking_instructions,
  }
}

export async function GET() {
  const context = await requireSessionContext()
  requirePermission(context, "tenant.settings.read")
  const tenant = await getTenantSettingsForContext(context)
  return NextResponse.json({ tenant: serializeTenant(tenant), role: context.role })
}

export async function PATCH(req: Request) {
  const requestId = await requestIdFromHeaders()
  const context = await requireSessionContext()
  try {
    requirePermission(context, "tenant.settings.write")
  } catch {
    return NextResponse.json({ error: "Solo el owner puede modificar configuracion global" }, { status: 403 })
  }

  const payload = await req.json()
  const parsed = parseBusinessSettings(payload)
  if (!parsed.ok) return NextResponse.json({ error: "Configuracion invalida", errors: parsed.errors }, { status: 400 })

  const slugOwner = await db.query.tenants.findFirst({
    where: and(eq(tenants.slug, parsed.data.slug), ne(tenants.id, context.tenantId)),
  })
  if (slugOwner) {
    return NextResponse.json({ error: "Slug no disponible", errors: { slug: "Este enlace ya esta en uso." } }, { status: 409 })
  }

  if (parsed.data.bookingPageStatus === "published") {
    const onboarding = await getOnboardingStatus(context.tenantId)
    if (!onboarding.canPublish) {
      return NextResponse.json({
        error: "Faltan requisitos para publicar",
        errors: {
          bookingPageStatus: `Completa antes: ${onboarding.missingForPublish.map((step) => step.label).join(", ")}.`,
        },
        missing: onboarding.missingForPublish,
      }, { status: 400 })
    }
  }

  const [updated] = await db.update(tenants)
    .set({
      name: parsed.data.name,
      description: parsed.data.description,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      timezone: parsed.data.timezone,
      logo_url: parsed.data.logoUrl,
      slug: parsed.data.slug,
      booking_page_status: parsed.data.bookingPageStatus,
      brand_color: parsed.data.brandColor,
      booking_min_notice_min: parsed.data.bookingMinNoticeMin,
      booking_horizon_days: parsed.data.bookingHorizonDays,
      slot_interval_min: parsed.data.slotIntervalMin,
      auto_confirm_appointments: parsed.data.autoConfirmAppointments,
      cancellation_policy: parsed.data.cancellationPolicy,
      post_booking_instructions: parsed.data.postBookingInstructions,
    })
    .where(eq(tenants.id, context.tenantId))
    .returning()

  if (parsed.data.bookingPageStatus === "published") {
    logEvent({ event: "business_published", severity: "info", route: "/api/dashboard/settings", requestId, tenantId: context.tenantId, actorId: context.userId, role: context.role })
  }
  return NextResponse.json({ tenant: serializeTenant(updated), requestId }, { headers: { "x-request-id": requestId } })
}
