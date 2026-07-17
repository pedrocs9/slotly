import test from "node:test"
import assert from "node:assert/strict"
import { allowedTransitions, canTransition } from "../../app/lib/appointment-status"

test("appointment status transitions follow the private agenda contract", () => {
  assert.deepEqual(allowedTransitions("pending"), ["confirmed", "cancelled"])
  assert.deepEqual(allowedTransitions("confirmed"), ["completed", "cancelled", "no_show"])
  assert.deepEqual(allowedTransitions("cancelled"), [])

  assert.equal(canTransition("pending", "confirmed"), true)
  assert.equal(canTransition("confirmed", "completed"), true)
  assert.equal(canTransition("cancelled", "confirmed"), false)
  assert.equal(canTransition("completed", "cancelled"), false)
})
