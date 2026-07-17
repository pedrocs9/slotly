import test from "node:test"
import assert from "node:assert/strict"
import { normalizeEmail, normalizePhone } from "../../app/lib/customers"

test("normalizes customer email", () => {
  assert.equal(normalizeEmail("  ANA@Example.COM "), "ana@example.com")
})

test("normalizes customer phone presentation characters", () => {
  assert.equal(normalizePhone("+56 9-1234 5678"), "+56912345678")
})
