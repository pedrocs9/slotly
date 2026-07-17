export const appointmentStatuses = ["pending", "confirmed", "completed", "cancelled", "no_show", "done"] as const

export type AppointmentStatus = typeof appointmentStatuses[number]

export const statusMeta: Record<AppointmentStatus, { label: string, tone: string }> = {
  pending: { label: "Pendiente", tone: "warning" },
  confirmed: { label: "Confirmada", tone: "success" },
  completed: { label: "Completada", tone: "neutral" },
  done: { label: "Completada", tone: "neutral" },
  cancelled: { label: "Cancelada", tone: "danger" },
  no_show: { label: "No asistio", tone: "danger" },
}

const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "no_show"],
  completed: [],
  done: [],
  cancelled: [],
  no_show: [],
}

export function allowedTransitions(status: AppointmentStatus) {
  return transitions[status] ?? []
}

export function canTransition(from: AppointmentStatus, to: AppointmentStatus) {
  return allowedTransitions(from).includes(to)
}

export function normalizeStatus(status: string): AppointmentStatus {
  return status === "done" ? "completed" : status as AppointmentStatus
}
