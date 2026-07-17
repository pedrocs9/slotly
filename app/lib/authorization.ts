import { and, eq } from "drizzle-orm"
import { db } from "../db"
import { professionals, tenants, users } from "../db/schema"

export type SessionContext = {
  userId: string
  tenantId: string
  role: "owner" | "staff"
  professionalId: string | null
}

export type Permission =
  | "tenant.settings.read"
  | "tenant.settings.write"
  | "appointments.read"
  | "appointments.create"
  | "appointments.update"
  | "customers.read"
  | "customers.write"
  | "services.read"
  | "services.write"
  | "professionals.read"
  | "professionals.write"
  | "availability.read"
  | "availability.write"
  | "exceptions.read"
  | "exceptions.write"

export class AuthorizationError extends Error {
  constructor(
    public status: 401 | 403 | 404,
    message: string,
    public code: "unauthorized" | "forbidden" | "not_found" = status === 401 ? "unauthorized" : status === 403 ? "forbidden" : "not_found",
  ) {
    super(message)
    this.name = "AuthorizationError"
  }
}

const rolePermissions: Record<SessionContext["role"], ReadonlySet<Permission>> = {
  owner: new Set([
    "tenant.settings.read",
    "tenant.settings.write",
    "appointments.read",
    "appointments.create",
    "appointments.update",
    "customers.read",
    "customers.write",
    "services.read",
    "services.write",
    "professionals.read",
    "professionals.write",
    "availability.read",
    "availability.write",
    "exceptions.read",
    "exceptions.write",
  ]),
  staff: new Set([
    "tenant.settings.read",
    "appointments.read",
    "appointments.create",
    "appointments.update",
    "customers.read",
    "customers.write",
    "services.read",
    "professionals.read",
    "availability.read",
    "exceptions.read",
    "exceptions.write",
  ]),
}

export function hasPermission(context: SessionContext, permission: Permission) {
  return rolePermissions[context.role]?.has(permission) ?? false
}

export function requirePermission(context: SessionContext, permission: Permission) {
  if (!hasPermission(context, permission)) {
    throw new AuthorizationError(403, "No tienes permisos para realizar esta accion")
  }
}

export async function validateSessionClaims(input: {
  userId?: string
  tenantId?: string
  role?: "owner" | "staff"
  professionalId?: string | null
}): Promise<SessionContext> {
  if (!input.userId || !input.tenantId || !input.role) {
    throw new AuthorizationError(401, "Sesion invalida")
  }

  const user = await db.query.users.findFirst({
    where: and(
      eq(users.id, input.userId),
      eq(users.tenant_id, input.tenantId),
      eq(users.active, true),
    ),
  })
  if (!user) throw new AuthorizationError(401, "Sesion invalida")

  const tenant = await db.query.tenants.findFirst({
    where: and(eq(tenants.id, user.tenant_id), eq(tenants.active, true)),
  })
  if (!tenant || tenant.status === "inactive") throw new AuthorizationError(401, "Tenant inactivo")

  if (user.role !== input.role) throw new AuthorizationError(401, "Sesion inconsistente")
  if ((user.professional_id ?? null) !== (input.professionalId ?? null)) {
    throw new AuthorizationError(401, "Sesion inconsistente")
  }

  if (user.professional_id) {
    const professional = await db.query.professionals.findFirst({
      where: and(
        eq(professionals.id, user.professional_id),
        eq(professionals.tenant_id, user.tenant_id),
      ),
    })
    if (!professional) throw new AuthorizationError(401, "Profesional de sesion invalido")
  }

  return {
    userId: user.id,
    tenantId: user.tenant_id,
    role: user.role,
    professionalId: user.professional_id,
  }
}

export async function canAccessProfessional(context: SessionContext, professionalId: string, options: { activeOnly?: boolean } = {}) {
  const professional = await db.query.professionals.findFirst({
    where: and(
      eq(professionals.id, professionalId),
      eq(professionals.tenant_id, context.tenantId),
      ...(options.activeOnly ? [eq(professionals.active, true)] : []),
    ),
  })
  if (!professional) return false
  return context.role === "owner" || context.professionalId === professional.id
}

export async function requireProfessionalAccess(context: SessionContext, professionalId: string, options: { activeOnly?: boolean } = {}) {
  if (!await canAccessProfessional(context, professionalId, options)) {
    throw new AuthorizationError(404, "Recurso no encontrado")
  }
}

export function requireStaffProfessional(context: SessionContext) {
  if (context.role === "staff" && !context.professionalId) {
    throw new AuthorizationError(403, "Staff sin profesional asociado")
  }
}
