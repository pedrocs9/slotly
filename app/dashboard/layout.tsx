import { eq } from "drizzle-orm"
import { db } from "../db"
import { tenants, users } from "../db/schema"
import { requireSessionContext } from "../lib/session"
import { DashboardShell } from "./dashboard-shell"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await requireSessionContext()
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, context.tenantId) })
  const user = await db.query.users.findFirst({ where: eq(users.id, context.userId) })

  return (
    <DashboardShell
      tenantName={tenant?.name ?? "Slotly"}
      tenantSlug={tenant?.slug ?? null}
      userName={user?.name ?? "Usuario"}
      role={context.role}
    >
      {children}
    </DashboardShell>
  )
}
