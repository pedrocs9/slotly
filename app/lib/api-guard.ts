import { publicError } from "./observability"
import { AuthorizationError } from "./authorization"
import type { checkRateLimit } from "./rate-limit"

export function rateLimitResponse(result: Awaited<ReturnType<typeof checkRateLimit>>, requestId: string) {
  return publicError(
    "Has realizado demasiados intentos. Espera un momento antes de continuar.",
    429,
    requestId,
    { "Retry-After": String(Math.max(1, result.retryAfter)) },
  )
}

export function authorizationErrorResponse(error: unknown, requestId: string) {
  if (error instanceof AuthorizationError) {
    return publicError(error.message, error.status, requestId)
  }
  throw error
}
