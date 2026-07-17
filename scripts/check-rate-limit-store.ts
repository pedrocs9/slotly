import "./load-env"

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

async function command(args: string[]) {
  if (!url || !token) fail("Upstash environment: missing")
  const res = await fetch(`${url.replace(/\/$/, "")}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) fail(`Upstash request failed: ${res.status}`)
  return res.json() as Promise<{ result: unknown }>
}

async function main() {
  if (!url || !token) fail("Upstash environment: missing")
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    fail("Upstash environment: invalid URL")
  }
  if (parsed.protocol !== "https:") fail("Upstash environment: URL must use HTTPS")

  console.log("Upstash environment: configured")

  const key = `slotly:diagnostic:${Date.now()}:${crypto.randomUUID().slice(0, 8)}`
  const value = "ok"

  await command(["SET", key, value, "EX", "60"])
  console.log("Write: successful")

  const read = await command(["GET", key])
  if (read.result !== value) fail("Read: failed")
  console.log("Read: successful")

  await command(["DEL", key])
  const afterDelete = await command(["GET", key])
  if (afterDelete.result !== null) fail("Cleanup: failed")
  console.log("Cleanup: successful")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Rate limit store check failed")
  process.exit(1)
})
