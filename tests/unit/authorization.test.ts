import test from "node:test"
import assert from "node:assert/strict"
import { AuthorizationError, hasPermission, requirePermission, requireStaffProfessional, type SessionContext } from "../../app/lib/authorization"

const owner: SessionContext = {
  userId: "owner",
  tenantId: "tenant-a",
  role: "owner",
  professionalId: "professional-owner",
}

const staff: SessionContext = {
  userId: "staff",
  tenantId: "tenant-a",
  role: "staff",
  professionalId: "professional-staff",
}

const detachedStaff: SessionContext = {
  userId: "detached-staff",
  tenantId: "tenant-a",
  role: "staff",
  professionalId: null,
}

test("owner permission matrix allows tenant administration", () => {
  assert.equal(hasPermission(owner, "tenant.settings.write"), true)
  assert.equal(hasPermission(owner, "services.write"), true)
  assert.equal(hasPermission(owner, "professionals.write"), true)
  assert.doesNotThrow(() => requirePermission(owner, "availability.write"))
})

test("staff permission matrix denies structural tenant administration", () => {
  assert.equal(hasPermission(staff, "appointments.read"), true)
  assert.equal(hasPermission(staff, "appointments.create"), true)
  assert.equal(hasPermission(staff, "tenant.settings.write"), false)
  assert.equal(hasPermission(staff, "services.write"), false)
  assert.throws(() => requirePermission(staff, "professionals.write"), AuthorizationError)
})

test("staff without professional association is rejected for professional-scoped work", () => {
  assert.throws(() => requireStaffProfessional(detachedStaff), AuthorizationError)
})

test("authorization errors expose stable status and code", () => {
  const forbidden = new AuthorizationError(403, "Forbidden")
  const notFound = new AuthorizationError(404, "Not found")
  const unauthorized = new AuthorizationError(401, "Unauthorized")
  assert.equal(forbidden.code, "forbidden")
  assert.equal(notFound.code, "not_found")
  assert.equal(unauthorized.code, "unauthorized")
})
