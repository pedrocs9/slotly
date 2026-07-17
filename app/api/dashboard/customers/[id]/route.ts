import { NextRequest, NextResponse } from "next/server"
import { getCustomerDetail, updateCustomer } from "../../../../lib/customers"
import { requireSessionContext } from "../../../../lib/session"
import { isUuid } from "../../../../lib/validation"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireSessionContext()
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: "Cliente invalido" }, { status: 400 })
  const detail = await getCustomerDetail(context, id)
  if (!detail) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
  return NextResponse.json(detail)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireSessionContext()
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: "Cliente invalido" }, { status: 400 })
  const result = await updateCustomer(context, id, await req.json())
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ customer: result.customer })
}
