import { NextRequest, NextResponse } from "next/server"
import { customerStats, listCustomers } from "../../../lib/customers"
import { searchCustomers } from "../../../lib/manual-appointments"
import { requireSessionContext } from "../../../lib/session"

export async function GET(req: NextRequest) {
  const context = await requireSessionContext()
  const params = new URL(req.url).searchParams
  const q = params.get("q") ?? ""
  if (params.get("mode") === "search") {
    return NextResponse.json({ customers: await searchCustomers(context, q) })
  }
  const customers = await listCustomers(context, {
    q,
    upcoming: params.get("upcoming") === "true",
    activity: params.get("activity") ?? undefined,
    limit: Number(params.get("limit") ?? 50),
  })
  const stats = await customerStats(context)
  return NextResponse.json({ customers, stats })
}
