import { NextRequest, NextResponse } from "next/server"
import { listProfessionalAdmin, saveProfessional } from "../../../lib/service-professional-admin"
import { requireSessionContext } from "../../../lib/session"

export async function GET(req: NextRequest) {
  const context = await requireSessionContext()
  const params = new URL(req.url).searchParams
  const professionals = await listProfessionalAdmin(context, {
    q: params.get("q") ?? "",
    status: params.get("status") ?? "",
    serviceId: params.get("serviceId") ?? "",
    schedule: params.get("schedule") ?? "",
  })
  return NextResponse.json({ professionals })
}

export async function POST(req: NextRequest) {
  const context = await requireSessionContext()
  const result = await saveProfessional(context, await req.json())
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}
