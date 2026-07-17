import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import { db } from "../db"
import { tenants, users } from "../db/schema"

type AuthUser = {
  role: "owner" | "staff"
  tenantId: string
  professionalId: string | null
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const authUser = user as typeof user & AuthUser
        token.role = authUser.role
        token.tenantId = authUser.tenantId
        token.professionalId = authUser.professionalId
      }
      return token
    },
    session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub ?? "",
          role: token.role,
          tenantId: token.tenantId,
          professionalId: token.professionalId,
        },
      }
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase()
        const password = String(credentials?.password ?? "")

        if (!email || !password) return null

        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        })

        if (!user?.active) return null

        const valid = await bcrypt.compare(password, user.password_hash)
        if (!valid) return null

        const tenant = await db.query.tenants.findFirst({
          where: eq(tenants.id, user.tenant_id),
        })

        if (!tenant?.active || tenant.status === "inactive") return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenant_id,
          professionalId: user.professional_id,
        }
      },
    }),
  ],
})
