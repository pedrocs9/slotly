export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function cleanString(value: unknown, max = 160) {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, max)
}

export function isEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

import { zonedDateTimeToUtc } from "./time"

export function parseLocalDateTime(date: string, time: string, timeZone = "America/Santiago") {
  return zonedDateTimeToUtc(date, time, timeZone)
}
