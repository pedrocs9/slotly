import { cleanString, isEmail } from "./validation"

export function normalizePrice(value: unknown) {
  const raw = cleanString(value, 20).replace(",", ".")
  if (!raw) return null
  const price = Number(raw)
  if (!Number.isFinite(price) || price < 0) return null
  return price.toFixed(2)
}

export function isHexColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
}

export function validateServiceInput(input: {
  name: unknown
  durationMin: unknown
  price?: unknown
  color?: unknown
}) {
  const name = cleanString(input.name, 100)
  const durationMin = Number(input.durationMin)
  const price = normalizePrice(input.price)
  const color = isHexColor(input.color) ? input.color as string : "#5b6ee1"
  if (!name) return { ok: false as const, error: "Nombre requerido" }
  if (!Number.isInteger(durationMin) || durationMin <= 0 || durationMin > 480) return { ok: false as const, error: "Duracion invalida" }
  if (input.price && price === null) return { ok: false as const, error: "Precio invalido" }
  return { ok: true as const, values: { name, durationMin, price, color } }
}

export function validateProfessionalInput(input: { name: unknown; email: unknown }) {
  const name = cleanString(input.name, 100)
  const email = cleanString(input.email, 100).toLowerCase()
  if (!name) return { ok: false as const, error: "Nombre requerido" }
  if (!isEmail(email)) return { ok: false as const, error: "Email invalido" }
  return { ok: true as const, values: { name, email } }
}
