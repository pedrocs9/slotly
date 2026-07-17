import "next-auth"
import "next-auth/jwt"
import type { roleEnum } from "../db/schema"

type Role = typeof roleEnum.enumValues[number]

declare module "next-auth" {
  interface User {
    role: Role
    tenantId: string
    professionalId: string | null
  }

  interface Session {
    user: {
      id: string
      role: Role
      tenantId: string
      professionalId: string | null
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role
    tenantId?: string
    professionalId?: string | null
  }
}
