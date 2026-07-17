import test from "node:test"
import assert from "node:assert/strict"
import { logEvent } from "../../app/lib/observability"
import { anonymizeIdentifier, checkRateLimit } from "../../app/lib/rate-limit"

test("rate limit fails closed when explicitly required without provider", async () => {
  const previousRequired = process.env.SLOTLY_RATE_LIMIT_REQUIRED
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  process.env.SLOTLY_RATE_LIMIT_REQUIRED = "true"

  const result = await checkRateLimit({ key: "test", limit: 1, windowSeconds: 60, route: "unit", requestId: "unit" })
  assert.equal(result.ok, false)

  if (previousRequired === undefined) delete process.env.SLOTLY_RATE_LIMIT_REQUIRED
  else process.env.SLOTLY_RATE_LIMIT_REQUIRED = previousRequired
  if (previousUrl) process.env.UPSTASH_REDIS_REST_URL = previousUrl
  if (previousToken) process.env.UPSTASH_REDIS_REST_TOKEN = previousToken
})

test("structured logs redact sensitive metadata keys", () => {
  const original = console.log
  let line = ""
  console.log = (value?: unknown) => {
    line = String(value)
  }
  try {
    logEvent({
      event: "unit_log",
      requestId: "unit",
      metadata: {
        email: "person@example.test",
        phone: "+56912345678",
        password: "secret",
        safeCount: 1,
      },
    })
  } finally {
    console.log = original
  }
  assert.equal(line.includes("person@example.test"), false)
  assert.equal(line.includes("+56912345678"), false)
  assert.equal(line.includes("secret"), false)
  assert.equal(line.includes("safeCount"), true)
})

test("anonymized identifiers do not expose source values and remain stable", async () => {
  const first = await anonymizeIdentifier("login:person@example.test")
  const second = await anonymizeIdentifier("login:person@example.test")
  const other = await anonymizeIdentifier("login:other@example.test")
  assert.equal(first, second)
  assert.notEqual(first, other)
  assert.equal(first.includes("person"), false)
  assert.equal(first.includes("@"), false)
})

test("rate limit returns 429 semantics and isolates identifiers with mocked provider", async () => {
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN
  const previousFetch = globalThis.fetch
  const counters = new Map<string, number>()
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.test"
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token"
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Array<string[]>
    const key = body[0][1]
    const count = (counters.get(key) ?? 0) + 1
    counters.set(key, count)
    return Response.json([{ result: count }, { result: 1 }])
  }
  try {
    const one = await checkRateLimit({ key: "a", limit: 1, windowSeconds: 60, route: "unit", requestId: "unit" })
    const two = await checkRateLimit({ key: "a", limit: 1, windowSeconds: 60, route: "unit", requestId: "unit" })
    const isolated = await checkRateLimit({ key: "b", limit: 1, windowSeconds: 60, route: "unit", requestId: "unit" })
    assert.equal(one.ok, true)
    assert.equal(two.ok, false)
    assert.equal(two.retryAfter > 0, true)
    assert.equal(isolated.ok, true)
  } finally {
    globalThis.fetch = previousFetch
    if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL
    else process.env.UPSTASH_REDIS_REST_URL = previousUrl
    if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN
    else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken
  }
})

test("rate limit allows local development when provider errors and protection is not required", async () => {
  const previousRequired = process.env.SLOTLY_RATE_LIMIT_REQUIRED
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN
  const previousFetch = globalThis.fetch
  process.env.SLOTLY_RATE_LIMIT_REQUIRED = "false"
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.test"
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token"
  globalThis.fetch = async () => {
    throw new Error("network_down")
  }
  try {
    const result = await checkRateLimit({ key: "a", limit: 1, windowSeconds: 60, route: "unit", requestId: "unit" })
    assert.equal(result.ok, true)
  } finally {
    globalThis.fetch = previousFetch
    if (previousRequired === undefined) delete process.env.SLOTLY_RATE_LIMIT_REQUIRED
    else process.env.SLOTLY_RATE_LIMIT_REQUIRED = previousRequired
    if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL
    else process.env.UPSTASH_REDIS_REST_URL = previousUrl
    if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN
    else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken
  }
})
