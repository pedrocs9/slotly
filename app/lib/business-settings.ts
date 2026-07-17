export const BOOKING_PAGE_STATUSES = ["draft", "published", "paused"] as const
export type BookingPageStatus = typeof BOOKING_PAGE_STATUSES[number]

export const TIME_ZONES = [
  "America/Santiago",
  "America/Buenos_Aires",
  "America/Lima",
  "America/Bogota",
  "America/Mexico_City",
  "America/New_York",
  "Europe/Madrid",
  "UTC",
] as const

export const RESERVED_SLUGS = [
  "_next",
  "admin",
  "api",
  "dashboard",
  "login",
  "privacidad",
  "reservar",
  "slotly",
  "terminos",
] as const

export type BusinessSettingsInput = {
  name: string
  description: string | null
  email: string | null
  phone: string | null
  address: string | null
  timezone: string
  logoUrl: string | null
  slug: string
  bookingPageStatus: string
  brandColor: string
  bookingMinNoticeMin: number
  bookingHorizonDays: number
  slotIntervalMin: number
  autoConfirmAppointments: boolean
  cancellationPolicy: string | null
  postBookingInstructions: string | null
}

export function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
}

export function isReservedSlug(slug: string) {
  return RESERVED_SLUGS.includes(slug as typeof RESERVED_SLUGS[number])
}

export function isValidSlug(slug: string) {
  return /^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])$/.test(slug) && !isReservedSlug(slug)
}

export function isValidHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

export function colorLuminance(hex: string) {
  const rgb = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
  const linear = rgb.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

export function readableTextColor(background: string) {
  if (!isValidHexColor(background)) return "#ffffff"
  return colorLuminance(background) > 0.46 ? "#111827" : "#ffffff"
}

export function hasReadableContrast(background: string) {
  if (!isValidHexColor(background)) return false
  const luminance = colorLuminance(background)
  const whiteContrast = 1.05 / (luminance + 0.05)
  const darkContrast = (luminance + 0.05) / 0.05
  return Math.max(whiteContrast, darkContrast) >= 4.5
}

export function isValidTimeZone(value: string) {
  return TIME_ZONES.includes(value as typeof TIME_ZONES[number])
}

export function isBookingPageStatus(value: string): value is BookingPageStatus {
  return BOOKING_PAGE_STATUSES.includes(value as BookingPageStatus)
}

function cleanNullable(value: unknown, max: number) {
  if (typeof value !== "string") return null
  const clean = value.trim().slice(0, max)
  return clean || null
}

function cleanRequired(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function asInteger(value: unknown) {
  const number = Number(value)
  return Number.isInteger(number) ? number : Number.NaN
}

export function parseBusinessSettings(input: Record<string, unknown>) {
  const normalizedSlug = normalizeSlug(cleanRequired(input.slug, 100))
  const parsed: BusinessSettingsInput = {
    name: cleanRequired(input.name, 100),
    description: cleanNullable(input.description, 600),
    email: cleanNullable(input.email, 100)?.toLowerCase() ?? null,
    phone: cleanNullable(input.phone, 30),
    address: cleanNullable(input.address, 200),
    timezone: cleanRequired(input.timezone, 50),
    logoUrl: cleanNullable(input.logoUrl, 400),
    slug: normalizedSlug,
    bookingPageStatus: cleanRequired(input.bookingPageStatus, 20),
    brandColor: cleanRequired(input.brandColor, 7),
    bookingMinNoticeMin: asInteger(input.bookingMinNoticeMin),
    bookingHorizonDays: asInteger(input.bookingHorizonDays),
    slotIntervalMin: asInteger(input.slotIntervalMin),
    autoConfirmAppointments: input.autoConfirmAppointments === true,
    cancellationPolicy: cleanNullable(input.cancellationPolicy, 900),
    postBookingInstructions: cleanNullable(input.postBookingInstructions, 900),
  }
  const errors: Record<string, string> = {}

  if (!parsed.name) errors.name = "El nombre es obligatorio."
  if (parsed.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.email)) errors.email = "Email invalido."
  if (!isValidTimeZone(parsed.timezone)) errors.timezone = "Zona horaria no permitida."
  if (!isValidSlug(parsed.slug)) errors.slug = isReservedSlug(parsed.slug) ? "Slug reservado." : "Slug invalido."
  if (!isBookingPageStatus(parsed.bookingPageStatus)) errors.bookingPageStatus = "Estado de publicacion invalido."
  if (!isValidHexColor(parsed.brandColor) || !hasReadableContrast(parsed.brandColor)) errors.brandColor = "Usa un color hexadecimal legible."
  if (parsed.bookingMinNoticeMin < 0 || parsed.bookingMinNoticeMin > 10080) errors.bookingMinNoticeMin = "Anticipacion fuera de rango."
  if (parsed.bookingHorizonDays < 1 || parsed.bookingHorizonDays > 365) errors.bookingHorizonDays = "Horizonte fuera de rango."
  if (![15, 30, 60].includes(parsed.slotIntervalMin)) errors.slotIntervalMin = "Intervalo no compatible."
  if (parsed.logoUrl && !/^https?:\/\/.+/i.test(parsed.logoUrl)) errors.logoUrl = "Logo debe ser una URL https/http."

  return { data: parsed, errors, ok: Object.keys(errors).length === 0 }
}

export function publicMetadataTitle(name: string) {
  return `Reservas | ${name}`
}
