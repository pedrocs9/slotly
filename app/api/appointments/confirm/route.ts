import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "../../../db"
import { appointments } from "../../../db/schema"
import { verifyEmailActionToken } from "../../../lib/email-tokens"
import { canTransition } from "../../../lib/appointment-status"

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token")
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://slotly.pgstudio.tech"

  if (!token) {
    return NextResponse.redirect(`${base}/confirm/error?reason=missing`)
  }

  const result = await verifyEmailActionToken(token)

  if (!result || result.action !== "confirm") {
    return NextResponse.redirect(`${base}/confirm/error?reason=invalid`)
  }

  const appointment = await db.query.appointments.findFirst({
    where: eq(appointments.id, result.appointmentId),
  })

  if (!appointment) {
    return NextResponse.redirect(`${base}/confirm/error?reason=not_found`)
  }

  if (appointment.status === "confirmed") {
    return NextResponse.redirect(`${base}/confirm/success?already=true`)
  }

  if (!canTransition(appointment.status, "confirmed")) {
    return NextResponse.redirect(`${base}/confirm/error?reason=cannot_confirm`)
  }

  await db.update(appointments)
    .set({ status: "confirmed", updated_at: new Date() })
    .where(eq(appointments.id, result.appointmentId))

  return NextResponse.redirect(`${base}/confirm/success`)
}
