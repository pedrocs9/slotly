import { NextRequest, NextResponse } from "next/server"
import { listServiceAdmin, saveService } from "../../../lib/service-professional-admin"
import { requireSessionContext } from "../../../lib/session"

export async function GET(req: NextRequest) {
  const context = await requireSessionContext()
  const params = new URL(req.url).searchParams
  const services = await listServiceAdmin(context, { q: params.get("q") ?? "", status: params.get("status") ?? "" })
  return NextResponse.json({ services })
}

export async function POST(req: NextRequest) {
  const context = await requireSessionContext()
  const result = await saveService(context, await req.json())
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}
