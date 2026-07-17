import { AuthError } from "next-auth"
import { signIn } from "../lib/auth"
import { logEvent, requestIdFromHeaders } from "../lib/observability"

async function login(formData: FormData) {
  "use server"
  const requestId = await requestIdFromHeaders()

  try {
    const email = String(formData.get("email") ?? "").trim().toLowerCase()
    await signIn("credentials", {
      email,
      password: String(formData.get("password") ?? ""),
      redirectTo: "/dashboard",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      logEvent({ event: "login_rejected", severity: "warn", route: "/login", requestId, code: error.type })
      return
    }
    throw error
  }
}

export default function LoginPage() {
  return (
    <main className="auth-page">
      <form action={login} className="auth-card">
        <span className="beta-pill">Acceso privado</span>
        <h1>Entrar a Slotly</h1>
        <p>Usa las credenciales entregadas por PG Studio para administrar tu agenda.</p>
        <label>Email<input name="email" type="email" required /></label>
        <label>Contraseña<input name="password" type="password" required /></label>
        <button className="primary-action" type="submit">Entrar</button>
      </form>
    </main>
  )
}
