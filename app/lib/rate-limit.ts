import { logEvent } from "./observability"

type RateLimitInput = {
  key: string
  limit: number
  windowSeconds: number
  route: string
  requestId: string
}

type RateLimitResult = {
  ok: boolean
  retryAfter: number
  remaining?: number
  key?: string
}

function isProtectedRuntime() {
  return process.env.NODE_ENV === "production" || process.env.SLOTLY_RATE_LIMIT_REQUIRED === "true"
}

export async function checkRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    if (isProtectedRuntime()) {
      logEvent({ event: "rate_limit_misconfigured", severity: "error", route: input.route, requestId: input.requestId })
      return { ok: false, retryAfter: input.windowSeconds }
    }
    return { ok: true, retryAfter: 0 }
  }

  const now = Math.floor(Date.now() / 1000)
  const windowId = Math.floor(now / input.windowSeconds)
  const key = `slotly:rl:${input.route}:${input.key}:${windowId}`
  const endpoint = `${url.replace(/\/$/, "")}/pipeline`

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(input.windowSeconds)],
      ]),
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`upstash_${res.status}`)
    const data = await res.json() as Array<{ result: number }>
    const count = Number(data[0]?.result ?? 0)
    const retryAfter = input.windowSeconds - (now % input.windowSeconds)
    const ok = count <= input.limit
    if (!ok) logEvent({ event: "rate_limit_exceeded", severity: "warn", route: input.route, requestId: input.requestId, metadata: { retryAfter } })
    return { ok, retryAfter, remaining: Math.max(0, input.limit - count), key }
  } catch (error) {
    logEvent({ event: "rate_limit_error", severity: "error", route: input.route, requestId: input.requestId, code: error instanceof Error ? error.message : "unknown" })
    return isProtectedRuntime() ? { ok: false, retryAfter: input.windowSeconds } : { ok: true, retryAfter: 0 }
  }
}

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || req.headers.get("x-real-ip") || "unknown"
}

export async function anonymizeIdentifier(value: string) {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24)
}

export function rateLimitConfig(kind: "login" | "booking" | "public") {
  if (kind === "login") {
    return {
      limit: Number(process.env.RATE_LIMIT_LOGIN_LIMIT ?? 8),
      windowSeconds: Number(process.env.RATE_LIMIT_LOGIN_WINDOW_SECONDS ?? 300),
    }
  }
  if (kind === "booking") {
    return {
      limit: Number(process.env.RATE_LIMIT_BOOKING_LIMIT ?? 20),
      windowSeconds: Number(process.env.RATE_LIMIT_BOOKING_WINDOW_SECONDS ?? 300),
    }
  }
  return {
    limit: Number(process.env.RATE_LIMIT_PUBLIC_LIMIT ?? 120),
    slotLimit: Number(process.env.RATE_LIMIT_PUBLIC_SLOTS_LIMIT ?? 80),
    windowSeconds: Number(process.env.RATE_LIMIT_PUBLIC_WINDOW_SECONDS ?? 300),
  }
}
