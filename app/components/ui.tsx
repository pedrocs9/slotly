import Link from "next/link"
import type { ComponentPropsWithoutRef, ReactNode } from "react"
import { clsx } from "clsx"

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"
type ButtonSize = "sm" | "md"

function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return clsx("ui-button", `ui-button-${variant}`, `ui-button-${size}`, className)
}

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentPropsWithoutRef<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />
}

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ComponentPropsWithoutRef<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />
}

export function IconButton({ className, ...props }: ComponentPropsWithoutRef<"button">) {
  return <button className={clsx("ui-icon-button", className)} {...props} />
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "info" | "success" | "warning" | "danger"; children: ReactNode }) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>
}

export function Surface({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return <section className={clsx("ui-surface", className)} {...props} />
}

export function PageLayout({ className, ...props }: ComponentPropsWithoutRef<"main">) {
  return <main className={clsx("page-layout", className)} {...props} />
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="section-header">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  )
}

export function MetricCard({ label, value, detail, tone = "neutral" }: { label: string; value: string | number; detail?: string; tone?: "neutral" | "info" | "success" | "warning" | "danger" }) {
  return (
    <article className={`metric-card metric-card-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state premium-empty">
      <strong>{title}</strong>
      <span>{description}</span>
      {action}
    </div>
  )
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "success" | "warning" | "danger"; title: string; children?: ReactNode }) {
  return (
    <div className={`ui-alert ui-alert-${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <strong>{title}</strong>
      {children && <span>{children}</span>}
    </div>
  )
}
