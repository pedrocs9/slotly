const encoder = new TextEncoder()

async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

async function verify(payload: string, signature: string, secret: string) {
  const expected = await sign(payload, secret)
  return expected === signature
}

function getSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is required for email tokens")
  return secret
}

export async function createEmailActionToken(appointmentId: string, action: "confirm") {
  const secret = getSecret()
  const payload = `${action}:${appointmentId}:${Math.floor(Date.now() / 1000)}`
  const sig = await sign(payload, secret)
  return Buffer.from(`${payload}:${sig}`).toString("base64url")
}

export async function verifyEmailActionToken(token: string): Promise<{ appointmentId: string; action: string } | null> {
  try {
    const decoded = Buffer.from(token, "base64url").toString()
    const parts = decoded.split(":")
    if (parts.length !== 4) return null

    const [action, appointmentId, timestampStr, sig] = parts
    const payload = `${action}:${appointmentId}:${timestampStr}`
    const secret = getSecret()

    const valid = await verify(payload, sig, secret)
    if (!valid) return null

    // Token expires after 7 days
    const timestamp = Number(timestampStr)
    const now = Math.floor(Date.now() / 1000)
    if (now - timestamp > 7 * 24 * 60 * 60) return null

    return { appointmentId, action }
  } catch {
    return null
  }
}