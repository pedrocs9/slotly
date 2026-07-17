import { headers } from "next/headers"

type Severity = "debug" | "info" | "warn" | "error"

type LogEvent = {
  event: string
  severity?: Severity
  route?: string
  requestId?: string
  tenantId?: string
  actorId?: string
  role?: string
  status?: number
  code?: string
  durationMs?: number
  metadata?: Record<string, string | number | boolean | null>
}

function redactMetadata(metadata: LogEvent["metadata"]) {
  if (!metadata) return undefined
  const blocked = ["password", "token", "cookie", "authorization", "email", "phone", "notes", "connectionString"]
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !blocked.some((blockedKey) => key.toLowerCase().includes(blockedKey))))
}

export function createRequestId() {
  return crypto.randomUUID().slice(0, 12)
}

export async function requestIdFromHeaders() {
  const headerList = await headers()
  return headerList.get("x-request-id") || createRequestId()
}

export function logEvent(input: LogEvent) {
  const payload = {
    timestamp: new Date().toISOString(),
    severity: input.severity ?? "info",
    event: input.event,
    route: input.route,
    requestId: input.requestId,
    tenantId: input.tenantId,
    actorId: input.actorId,
    role: input.role,
    status: input.status,
    code: input.code,
    durationMs: input.durationMs,
    release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version || "local",
    metadata: redactMetadata(input.metadata),
  }

  const line = JSON.stringify(payload)
  if (payload.severity === "error") console.error(line)
  else if (payload.severity === "warn") console.warn(line)
  else console.log(line)
}

export function publicError(message: string, status: number, requestId: string, headers?: HeadersInit) {
  const body = status >= 500
    ? { error: `${message} Codigo de referencia: ${requestId}.`, requestId }
    : { error: message, requestId }
  return Response.json(body, { status, headers: { "x-request-id": requestId, ...headers } })
}
