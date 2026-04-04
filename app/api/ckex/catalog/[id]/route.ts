import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'

const updateSchema = z.object({
  displayName: z.string().min(1).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  refMinMale: z.number().nullable().optional(),
  refMaxMale: z.number().nullable().optional(),
  refMinFemale: z.number().nullable().optional(),
  refMaxFemale: z.number().nullable().optional(),
})

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.professional.findUnique({ where: { authUserId: user.id } })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const professional = await requireAuth()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  const item = await prisma.examCatalog.findFirst({ where: { id, professionalId: professional.id } })
  if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(item)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const professional = await requireAuth()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params

  const existing = await prisma.examCatalog.findFirst({ where: { id, professionalId: professional.id } })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const item = await prisma.examCatalog.update({
    where: { id },
    data: parsed.data,
  })
  return NextResponse.json(item)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const professional = await requireAuth()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params

  const existing = await prisma.examCatalog.findFirst({ where: { id, professionalId: professional.id } })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await prisma.examCatalog.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
