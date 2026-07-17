
import { Resend } from "resend"
import { createEmailActionToken } from "./email-tokens"

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

function getFrom() {
  return process.env.SLOTLY_FROM_EMAIL ?? "hola@pgstudio.tech"
}
export type BookingEmailInput = {
  tenantName: string
  tenantEmail: string | null
  tenantSlug: string
  tenantPhone: string | null
  clientName: string
  clientEmail: string | null
  serviceName: string
  professionalName: string
  date: string
  time: string
  timezone: string
  status: "pending" | "confirmed"
  cancellationPolicy: string | null
  postBookingInstructions: string | null
}

function formatDate(date: string, time: string, timezone: string) {
  const dt = new Date(`${date}T${time}:00`)
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt)
}

export async function sendBookingConfirmationToClient(input: BookingEmailInput) {
  if (!input.clientEmail) return

  const dateFormatted = formatDate(input.date, input.time, input.timezone)
  const isConfirmed = input.status === "confirmed"

  await getResend().emails.send({
     from: `${input.tenantName} via Slotly <${getFrom()}>`,
    to: input.clientEmail,
    subject: isConfirmed
      ? `Reserva confirmada · ${input.serviceName} en ${input.tenantName}`
      : `Solicitud recibida · ${input.serviceName} en ${input.tenantName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 0;color:#0f172a">
        <p style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#0ea5e9;text-transform:uppercase;margin:0 0 8px">
          ${input.tenantName}
        </p>
        <h1 style="font-size:26px;font-weight:700;margin:0 0 6px;letter-spacing:-.03em">
          ${isConfirmed ? "Reserva confirmada ✓" : "Solicitud recibida"}
        </h1>
        <p style="color:#64748b;font-size:15px;margin:0 0 28px;line-height:1.6">
          ${isConfirmed
            ? "Tu hora quedo registrada. Te esperamos."
            : "Recibimos tu solicitud. El negocio la revisara y te contactara para confirmarla."}
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:22px;margin-bottom:24px">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;width:130px">Servicio</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:600">${input.serviceName}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px">Profesional</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px">${input.professionalName}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px">Fecha y hora</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:600">${dateFormatted}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-size:14px">Estado</td><td style="padding:8px 0;font-size:14px"><span style="background:${isConfirmed ? "rgba(5,150,105,.1)" : "rgba(245,158,11,.1)"};color:${isConfirmed ? "#047857" : "#b45309"};border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700">${isConfirmed ? "Confirmada" : "Pendiente"}</span></td></tr>
          </table>
        </div>
        ${input.postBookingInstructions ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin-bottom:20px"><p style="font-size:13px;color:#1e40af;margin:0;line-height:1.6"><strong>Instrucciones:</strong> ${input.postBookingInstructions}</p></div>` : ""}
        ${input.cancellationPolicy ? `<p style="font-size:13px;color:#94a3b8;line-height:1.6;margin-bottom:24px"><strong style="color:#64748b">Cancelacion:</strong> ${input.cancellationPolicy}</p>` : ""}
        ${input.tenantPhone ? `<p style="font-size:13px;color:#64748b;margin-bottom:4px">Contacto del negocio:</p><p style="font-size:14px;font-weight:700;color:#0f172a;margin:0 0 24px">${input.tenantPhone}</p>` : ""}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="font-size:12px;color:#94a3b8;margin:0">Reserva gestionada con <strong>Slotly</strong> · pgstudio.tech</p>
      </div>
    `,
  })
}

export async function sendBookingNotificationToTenant(input: BookingEmailInput & { appointmentId?: string }) {
  if (!input.tenantEmail) return

  const dateFormatted = formatDate(input.date, input.time, input.timezone)
  const isConfirmed = input.status === "confirmed"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://slotly.pgstudio.tech"

  let confirmUrl = ""
  if (!isConfirmed && input.appointmentId) {
    const token = await createEmailActionToken(input.appointmentId, "confirm")
    confirmUrl = `${appUrl}/api/appointments/confirm?token=${token}`
  }

  await getResend().emails.send({
    from: `Slotly <${getFrom()}>`,
    to: input.tenantEmail,
    subject: `Nueva reserva · ${input.clientName} · ${input.serviceName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 0;color:#0f172a">
        <p style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#0ea5e9;text-transform:uppercase;margin:0 0 8px">
          Nueva reserva · Slotly
        </p>
        <h1 style="font-size:24px;font-weight:700;margin:0 0 24px;letter-spacing:-.03em">
          ${input.clientName} reservo una hora
        </h1>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:22px;margin-bottom:24px">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;width:130px">Cliente</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:600">${input.clientName}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px">Servicio</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px">${input.serviceName}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px">Profesional</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px">${input.professionalName}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px">Fecha y hora</td><td style="padding:8px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:600">${dateFormatted}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-size:14px">Estado</td><td style="padding:8px 0;font-size:14px"><span style="background:${isConfirmed ? "rgba(5,150,105,.1)" : "rgba(245,158,11,.1)"};color:${isConfirmed ? "#047857" : "#b45309"};border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700">${isConfirmed ? "Auto-confirmada" : "Pendiente"}</span></td></tr>
          </table>
        </div>
        ${confirmUrl ? `
        <a href="${confirmUrl}" style="display:inline-block;background:#047857;color:#fff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;margin-bottom:12px">
          ✓ Confirmar cita
        </a>
        <br />` : ""}
        <a href="${appUrl}/dashboard" style="display:inline-block;background:#0f172a;color:#fff;font-size:14px;font-weight:700;padding:12px 22px;border-radius:10px;text-decoration:none;margin-bottom:24px">
          Ver en dashboard →
        </a>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="font-size:12px;color:#94a3b8;margin:0">Slotly · pgstudio.tech</p>
      </div>
    `,
  })
}