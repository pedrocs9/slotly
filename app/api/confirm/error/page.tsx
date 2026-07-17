import Link from "next/link"

const reasons: Record<string, string> = {
  missing: "No se recibio un enlace valido.",
  invalid: "El enlace expiro o no es valido.",
  not_found: "La cita no fue encontrada.",
  cannot_confirm: "Esta cita no puede ser confirmada en su estado actual.",
}

type Props = { searchParams: Promise<{ reason?: string }> }

export default async function ConfirmErrorPage({ searchParams }: Props) {
  const { reason } = await searchParams
  const message = reasons[reason ?? ""] ?? "No se pudo confirmar la cita."

  return (
    <main className="confirm-page">
      <div className="confirm-card">
        <span className="confirm-icon error">✕</span>
        <h1>No se pudo confirmar</h1>
        <p>{message}</p>
        <Link href="/dashboard/agenda" className="confirm-link">Ir al dashboard</Link>
      </div>

      <style>{`
        .confirm-page {
          align-items: center;
          background: var(--bg, #f8fafc);
          display: flex;
          justify-content: center;
          min-height: 100vh;
          padding: 24px;
        }
        .confirm-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          box-shadow: 0 4px 24px rgba(15,23,42,.06);
          max-width: 420px;
          padding: 48px 36px;
          text-align: center;
        }
        .confirm-icon {
          align-items: center;
          border-radius: 50%;
          display: inline-flex;
          font-size: 28px;
          font-weight: 700;
          height: 64px;
          justify-content: center;
          margin-bottom: 20px;
          width: 64px;
        }
        .confirm-icon.error {
          background: rgba(239,68,68,.1);
          color: #dc2626;
        }
        .confirm-card h1 {
          color: #0f172a;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -.03em;
          margin: 0 0 12px;
        }
        .confirm-card p {
          color: #64748b;
          font-size: 15px;
          line-height: 1.6;
          margin: 0 0 28px;
        }
        .confirm-link {
          background: #0f172a;
          border-radius: 10px;
          color: #fff;
          display: inline-block;
          font-size: 14px;
          font-weight: 700;
          padding: 12px 24px;
          text-decoration: none;
        }
      `}</style>
    </main>
  )
}