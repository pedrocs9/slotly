import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "../../db"
import { appointments } from "../../db/schema"
import { verifyEmailActionToken } from "../../lib/email-tokens"
import { canTransition } from "../../lib/appointment-status"

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