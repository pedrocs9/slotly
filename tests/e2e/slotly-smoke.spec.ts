import { expect, test } from "@playwright/test"

const ownerEmail = process.env.E2E_OWNER_EMAIL || "owner@slotly-e2e.test"
const staffEmail = process.env.E2E_STAFF_EMAIL || "staff@slotly-e2e.test"
const password = process.env.E2E_PASSWORD || "SlotlyE2E2026!"
const slug = process.env.E2E_TENANT_SLUG || "slotly-e2e"

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel(/Contrase|ContraseÃ±a/i).fill(password)
  await page.getByRole("button", { name: "Entrar" }).click()
  await expect(page.getByRole("heading", { name: /Panel operativo/i })).toBeVisible()
}

test("owner sees onboarding and core modules", async ({ page }, testInfo) => {
  await login(page, ownerEmail)
  if (testInfo.project.name === "desktop") {
    await expect(page.getByText("Prepara tu espacio de reservas")).toBeVisible()
  } else {
    await expect(page.getByRole("heading", { name: /Panel operativo/i })).toBeVisible()
  }
  await page.goto("/dashboard/servicios")
  await expect(page.getByRole("heading", { name: /Servicios del negocio/i })).toBeVisible()
  await page.goto("/dashboard/profesionales")
  await expect(page.getByRole("heading", { name: /Equipo reservable/i })).toBeVisible()
  await page.goto("/dashboard/disponibilidad")
  await expect(page.getByRole("heading", { name: /Horarios semanales/i })).toBeVisible()
})

test("staff cannot modify global settings", async ({ page }) => {
  await login(page, staffEmail)
  await page.goto("/dashboard/configuracion")
  await expect(page.getByText(/no modificar configuracion global/i)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole("button", { name: /Guardar/i })).toBeDisabled()
})

test("public reservation creates a pending request and prevents duplicate slot", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "mutating reservation smoke runs once against the shared fixture")
  const api = await request.get(`/api/public/${slug}`)
  expect(api.ok()).toBeTruthy()
  const data = await api.json()
  const service = data.services[0]
  const professional = data.professionalsByService[service.id][0]
  let selectedDate = ""
  let selectedSlot = ""
  for (let offset = 1; offset < 14 && !selectedSlot; offset += 1) {
    const day = new Date()
    day.setDate(day.getDate() + offset)
    selectedDate = day.toISOString().slice(0, 10)
    const slotsRes = await request.get(`/api/public/${slug}?serviceId=${service.id}&professionalId=${professional.id}&date=${selectedDate}`)
    const slotsData = await slotsRes.json()
    selectedSlot = slotsData.slots?.[0]?.label ?? ""
  }
  expect(selectedSlot).toBeTruthy()

  await page.goto(`/${slug}/reservar`)
  await expect(page.getByRole("heading", { name: /Reserva tu hora/i })).toBeVisible({ timeout: 15_000 })
  await page.getByRole("button", { name: /Consulta E2E/i }).click()
  await page.getByLabel("Profesional").selectOption(professional.id)
  await page.getByRole("button", { name: new RegExp(new Date(`${selectedDate}T12:00:00`).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" }), "i") }).click()
  await page.getByRole("button", { name: selectedSlot }).click()
  await page.getByRole("button", { name: "Continuar" }).click()
  await page.getByLabel("Nombre completo").fill("Cliente Publico E2E")
  await page.getByLabel(/Tel/i).fill("+56 9 3000 0000")
  await page.getByLabel("Email").fill("cliente-publico@slotly-e2e.test")
  await page.getByLabel(/Acepto ser contactado/i).check()
  await page.getByRole("button", { name: /Confirmar reserva/i }).click()
  await expect(page.getByRole("heading", { name: /Solicitud de reserva/i })).toBeVisible()

  const duplicate = await request.post("/api/appointments", {
    data: {
      slug,
      serviceId: service.id,
      professionalId: professional.id,
      fecha: selectedDate,
      hora: selectedSlot,
      nombre: "Cliente Duplicado E2E",
      telefono: "+56 9 4000 0000",
      email: "duplicado@slotly-e2e.test",
      website: "",
      consent: true,
    },
  })
  expect(duplicate.status()).toBe(409)
})


test("agenda premium controls are keyboard and filter friendly", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "agenda interaction smoke runs once against shared fixture")
  await login(page, ownerEmail)
  await page.goto("/dashboard/agenda")
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible()

  const dateInput = page.getByLabel("Fecha")
  const initialDate = await dateInput.inputValue()
  await page.getByRole("button", { name: "Periodo siguiente" }).click()
  await expect(dateInput).not.toHaveValue(initialDate)
  await page.getByRole("button", { name: /Hoy/i }).click()

  await page.getByLabel("Estado").selectOption("pending")
  await expect(page.getByText(/1 activo/i)).toBeVisible()
  await page.getByRole("button", { name: "Limpiar" }).click()
  await expect(page.getByText(/Sin filtros activos/i)).toBeVisible()

  await expect(page.getByLabel("Profesional")).toContainText("Owner E2E")
  await page.getByLabel("Profesional").selectOption({ label: "Owner E2E" })
  await page.getByRole("button", { name: /Nueva cita/i }).click()
  await expect(page.getByRole("dialog", { name: /Nueva cita/i })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: /Nueva cita/i })).toBeHidden()
})

test("owner agenda supports views and status transitions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "agenda mutation runs once against shared fixture")
  await login(page, ownerEmail)
  await page.goto("/dashboard/agenda")
  await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible()
  await page.getByRole("button", { name: "Semana" }).click()
  await expect(page.getByLabel("Agenda semanal")).toBeVisible()
  await page.getByRole("button", { name: "Lista" }).click()
  await expect(page.getByLabel("Listado de citas")).toBeVisible()
  await page.getByRole("button", { name: /Cliente Publico E2E/i }).first().click()
  await expect(page.getByRole("dialog", { name: /Cliente Publico E2E/i })).toBeVisible()
  await page.getByRole("button", { name: /Confirmada/i }).click()
  await page.getByRole("button", { name: "Confirmar" }).click()
  await expect(page.getByText(/Cita actualizada/i)).toBeVisible()
})
test("manual appointment API creates appointment and rejects conflicts", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "manual appointment mutation runs once against shared fixture")
  await login(page, ownerEmail)
  const api = await request.get(`/api/public/${slug}`)
  const data = await api.json()
  const service = data.services[0]
  const professional = data.professionalsByService[service.id][0]
  let selectedDate = ""
  let selectedSlot = ""
  for (let offset = 2; offset < 14 && !selectedSlot; offset += 1) {
    const day = new Date()
    day.setDate(day.getDate() + offset)
    selectedDate = day.toISOString().slice(0, 10)
    const slotsRes = await request.get(`/api/public/${slug}?serviceId=${service.id}&professionalId=${professional.id}&date=${selectedDate}`)
    const slotsData = await slotsRes.json()
    selectedSlot = slotsData.slots?.find((slot: { label: string }) => slot.label !== "09:00")?.label ?? ""
  }
  expect(selectedSlot).toBeTruthy()

  const payload = {
    serviceId: service.id,
    professionalId: professional.id,
    date: selectedDate,
    time: selectedSlot,
    clientName: "Manual E2E",
    clientEmail: "manual@slotly-e2e.test",
    clientPhone: "+56 9 5000 0000",
    notes: "Manual E2E",
  }
  const created = await page.context().request.post("/api/dashboard/manual-appointments", { data: payload })
  expect(created.ok()).toBeTruthy()
  const duplicate = await page.context().request.post("/api/dashboard/manual-appointments", { data: { ...payload, clientEmail: "manual-duplicate@slotly-e2e.test" } })
  expect(duplicate.status()).toBe(409)
})
