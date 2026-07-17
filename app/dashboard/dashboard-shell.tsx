"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { CalendarDays, ChevronLeft, Clock, LayoutDashboard, LogOut, Menu, Settings, Users, Wrench, X } from "lucide-react"
import { IconButton, ButtonLink } from "../components/ui"
import { logoutAction } from "./actions"

type NavigationItem = {
  label: string
  href: string
  icon: typeof LayoutDashboard
  disabled?: boolean
}

type NavigationGroup = {
  group: string
  items: NavigationItem[]
  ownerOnly?: boolean
}

const navigation: NavigationGroup[] = [
  { group: "Operacion", items: [
    { label: "Inicio", href: "/dashboard", icon: LayoutDashboard },
    { label: "Agenda", href: "/dashboard/agenda", icon: CalendarDays },
    { label: "Clientes", href: "/dashboard/clientes", icon: Users },
  ] },
  { group: "Gestion", items: [
    { label: "Servicios", href: "/dashboard/servicios", icon: Wrench },
    { label: "Profesionales", href: "/dashboard/profesionales", icon: Users },
    { label: "Disponibilidad", href: "/dashboard/disponibilidad", icon: Clock },
    { label: "Bloqueos", href: "/dashboard/bloqueos", icon: CalendarDays },
  ] },
  { group: "Sistema", ownerOnly: true, items: [
    { label: "Configuracion", href: "/dashboard/configuracion", icon: Settings },
  ] },
]

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function initials(value: string) {
  return value.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "S"
}

function SidebarNav({ groups, collapsed, onNavigate }: { groups: NavigationGroup[]; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="private-nav" aria-label="Navegacion privada">
      {groups.map((section) => (
        <section key={section.group} className="private-nav-group">
          <p>{section.group}</p>
          {section.items.map((item) => {
            const Icon = item.icon
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`private-nav-link sidebar-tip ${active ? "active" : ""} ${item.disabled ? "muted-link" : ""}`}
                data-tooltip={item.label}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                aria-disabled={item.disabled}
                onClick={onNavigate}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </section>
      ))}
    </nav>
  )
}

export function DashboardShell({
  children,
  tenantName,
  tenantSlug,
  userName,
  role,
}: {
  children: ReactNode
  tenantName: string
  tenantSlug: string | null
  userName: string
  role: "owner" | "staff"
}) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("slotly-sidebar-collapsed") === "true")
  const groups = useMemo(() => navigation.filter((section) => !section.ownerOnly || role === "owner"), [role])
  const pathname = usePathname()
  const current = groups.flatMap((group) => group.items).find((item) => isActive(pathname, item.href))
  const shellStyle = { "--slotly-sidebar-width": collapsed ? "68px" : "252px" } as React.CSSProperties

  useEffect(() => {
    window.localStorage.setItem("slotly-sidebar-collapsed", collapsed ? "true" : "false")
  }, [collapsed])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div className={`private-shell ${collapsed ? "is-collapsed" : ""}`} style={shellStyle}>
      <aside className="private-sidebar" aria-label="Navegacion principal">
        <div className="private-sidebar-header">
          <div className="private-brand sidebar-tip" data-tooltip="Slotly">
            <div className="brand-mark">S</div>
            <div className="private-brand-copy">
              <strong>Slotly</strong>
              <span>{tenantName}</span>
            </div>
          </div>
          <button className="sidebar-collapse-button sidebar-tip" data-tooltip={collapsed ? "Expandir" : "Colapsar"} type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expandir navegacion" : "Colapsar navegacion"}>
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
        </div>
        <SidebarNav groups={groups} collapsed={collapsed} />
        <div className="sidebar-footer">
          <div className="sidebar-account sidebar-tip" data-tooltip={`${userName} · ${role === "owner" ? "Owner" : "Staff"}`}>
            <span className="sidebar-avatar" aria-hidden="true">{initials(userName)}</span>
            <div className="sidebar-account-copy">
              <span>{role === "owner" ? "Owner" : "Staff"}</span>
              <strong>{userName}</strong>
            </div>
          </div>
          <form action={logoutAction}>
            <button className="sidebar-logout sidebar-tip" data-tooltip="Cerrar sesion" type="submit" aria-label="Cerrar sesion">
              <LogOut size={17} aria-hidden="true" />
              <span>Cerrar sesion</span>
            </button>
          </form>
        </div>
      </aside>

      <div className="private-main">
        <header className="private-topbar">
          <div className="topbar-context">
            <IconButton type="button" className="mobile-nav-trigger" aria-label="Abrir navegacion" onClick={() => setOpen(true)}>
              <Menu size={18} aria-hidden="true" />
            </IconButton>
            <div>
              <span>{tenantName}</span>
              <strong>{current?.label ?? "Slotly"}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            {tenantSlug && <ButtonLink variant="secondary" size="sm" href={`/${tenantSlug}`}>Pagina publica</ButtonLink>}
            <form action={logoutAction}>
              <IconButton type="submit" aria-label="Cerrar sesion"><LogOut size={17} aria-hidden="true" /></IconButton>
            </form>
          </div>
        </header>
        {children}
      </div>

      {open && (
        <div className="mobile-drawer-layer" role="presentation">
          <button className="mobile-drawer-backdrop" type="button" aria-label="Cerrar navegacion" onClick={() => setOpen(false)} />
          <aside className="mobile-drawer" aria-label="Navegacion movil">
            <header>
              <div className="private-brand">
                <div className="brand-mark">S</div>
                <div className="private-brand-copy">
                  <strong>Slotly</strong>
                  <span>{tenantName}</span>
                </div>
              </div>
              <IconButton type="button" aria-label="Cerrar navegacion" onClick={() => setOpen(false)}>
                <X size={18} aria-hidden="true" />
              </IconButton>
            </header>
            <SidebarNav groups={groups} collapsed={false} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  )
}