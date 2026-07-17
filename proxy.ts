import { auth } from "./app/lib/auth"
import { NextResponse } from "next/server"
import { createRequestId } from "./app/lib/observability"
import { anonymizeIdentifier, checkRateLimit, clientIp, rateLimitConfig } from "./app/lib/rate-limit"

export default auth(async (req) => {
  const pathname = req.nextUrl.pathname
  const requestId = req.headers.get("x-request-id") || createRequestId()

  if (pathname === "/login" && req.method === "POST" && !req.auth?.user) {
    const config = rateLimitConfig("login")
    const key = await anonymizeIdentifier(`login:${clientIp(req)}`)
    const rateLimit = await checkRateLimit({ key, limit: config.limit, windowSeconds: config.windowSeconds, route: "login", requestId })
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "Has realizado demasiados intentos. Espera un momento antes de continuar.", requestId },
        { status: 429, headers: { "Retry-After": String(Math.max(1, rateLimit.retryAfter)), "x-request-id": requestId } },
      )
    }
  }

  if (pathname.startsWith("/dashboard") && !req.auth?.user) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (pathname === "/login" && req.auth?.user) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
}
