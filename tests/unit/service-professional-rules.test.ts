import test from "node:test"
import assert from "node:assert/strict"
import { normalizePrice, validateProfessionalInput, validateServiceInput } from "../../app/lib/service-professional-rules"

test("service validation rejects invalid duration", () => {
  const result = validateServiceInput({ name: "Control", durationMin: 0, price: "10000", color: "#5b6ee1" })
  assert.equal(result.ok, false)
})

test("service validation accepts non-negative price", () => {
  assert.equal(normalizePrice("12500"), "12500.00")
  assert.equal(normalizePrice("-1"), null)
})

test("professional validation requires valid email", () => {
  assert.equal(validateProfessionalInput({ name: "Ana", email: "ana@example.com" }).ok, true)
  assert.equal(validateProfessionalInput({ name: "Ana", email: "bad-email" }).ok, false)
})
