import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Slotly — Agendamiento profesional",
  description: "Sistema de agendamiento para profesionales y negocios.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
