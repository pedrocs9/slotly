import Link from "next/link"

type Props = { searchParams: Promise<{ already?: string }> }

export default async function ConfirmSuccessPage({ searchParams }: Props) {
  const { already } = await searchParams
  const wasAlready = already === "true"

  return (
    <main className="confirm-page">
      <div className="confirm-card">
        <span className="confirm-icon">✓</span>
        <h1>{wasAlready ? "Cita ya confirmada" : "Cita confirmada"}</h1>
        <p>
          {wasAlready
            ? "Esta cita ya estaba confirmada previamente. No se realizaron cambios."
            : "La cita fue confirmada exitosamente. El cliente será atendido en el horario reservado."}
        </p>
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
          background: rgba(5,150,105,.1);
          border-radius: 50%;
          color: #047857;
          display: inline-flex;
          font-size: 28px;
          font-weight: 700;
          height: 64px;
          justify-content: center;
          margin-bottom: 20px;
          width: 64px;
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
        .confirm-link:hover { opacity: .9; }
      `}</style>
    </main>
  )
}