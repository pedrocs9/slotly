import test from "node:test"
import assert from "node:assert/strict"
import {
  hasReadableContrast,
  isBookingPageStatus,
  isReservedSlug,
  isValidHexColor,
  normalizeSlug,
  parseBusinessSettings,
  publicMetadataTitle,
  readableTextColor,
} from "../../app/lib/business-settings"

test("normalizes and rejects reserved slugs", () => {
  assert.equal(normalizeSlug(" Podologia Aurora! "), "podologia-aurora")
  assert.equal(isReservedSlug("dashboard"), true)
  assert.equal(parseBusinessSettings({ ...validInput(), slug: "dashboard" }).ok, false)
})

test("validates brand color and readable text color", () => {
  assert.equal(isValidHexColor("#5b6ee1"), true)
  assert.equal(isValidHexColor("blue"), false)
  assert.equal(hasReadableContrast("#ffffff"), true)
  assert.equal(readableTextColor("#ffffff"), "#111827")
})

test("validates booking rules and publication status", () => {
  assert.equal(isBookingPageStatus("published"), true)
  assert.equal(isBookingPageStatus("hidden"), false)
  assert.equal(parseBusinessSettings({ ...validInput(), bookingMinNoticeMin: -1 }).ok, false)
  assert.equal(parseBusinessSettings({ ...validInput(), bookingHorizonDays: 366 }).ok, false)
  assert.equal(parseBusinessSettings({ ...validInput(), slotIntervalMin: 20 }).ok, false)
})

test("builds public metadata title", () => {
  assert.equal(publicMetadataTitle("Podologia Aurora"), "Reservas | Podologia Aurora")
})

function validInput() {
  return {
    name: "Podologia Aurora",
    description: "Atencion profesional",
    email: "hola@example.com",
    phone: "+56911111111",
    address: "Santiago",
    timezone: "America/Santiago",
    logoUrl: "https://example.com/logo.png",
    slug: "podologia-aurora",
    bookingPageStatus: "published",
    brandColor: "#5b6ee1",
    bookingMinNoticeMin: 120,
    bookingHorizonDays: 45,
    slotIntervalMin: 30,
    autoConfirmAppointments: false,
    cancellationPolicy: "Avisar con anticipacion.",
    postBookingInstructions: "Te contactaremos.",
  }
}
