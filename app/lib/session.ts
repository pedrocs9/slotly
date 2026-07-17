import "server-only"
import { notFound, redirect } from "next/navigation"
import { auth } from "./auth"
import { AuthorizationError, type SessionContext, canAccessProfessional, validateSessionClaims } from "./authorization"

export type { SessionContext } from "./authorization"

export async function requireSessionContext(): Promise<SessionContext> {
  const session = await auth()
  const user = session?.user as ({
    id?: string
    tenantId?: string
    professionalId?: string | null
    role?: "owner" | "staff"
  }) | undefined

  if (!user?.id || !user.tenantId || !user.role) {
    redirect("/login")
  }

  try {
    return await validateSessionClaims({
      userId: user.id,
      tenantId: user.tenantId,
      professionalId: user.professionalId ?? null,
      role: user.role,
    })
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401) redirect("/login")
    throw error
  }
}

export async function requireRole(roles: SessionContext["role"][]) {
  const context = await requireSessionContext()
  if (!roles.includes(context.role)) notFound()
  return context
}

export { canAccessProfessional }
