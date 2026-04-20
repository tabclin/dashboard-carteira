import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

async function getProfessional() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.professional.findUnique({ where: { authUserId: user.id } })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const professional = await getProfessional()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const avaliacao = await prisma.driAvaliacao.findFirst({
    where: { id, professionalId: professional.id },
  })
  if (!avaliacao) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  return NextResponse.json(avaliacao)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const professional = await getProfessional()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.driAvaliacao.findFirst({
    where: { id, professionalId: professional.id },
  })
  if (!existing) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })

  await prisma.driAvaliacao.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
