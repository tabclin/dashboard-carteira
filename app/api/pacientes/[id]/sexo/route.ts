import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

/** Grava o sexo da criança (menino/menina escolhido ao criar uma orientação). Só pacientes do próprio login. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await usuarioAtual()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const professional = await prisma.professional.findUnique({ where: { authUserId: user.id }, select: { id: true } })
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { sexo } = await request.json().catch(() => ({}))
  if (sexo !== 'M' && sexo !== 'F') return NextResponse.json({ error: 'Escolha menino ou menina' }, { status: 400 })

  const { count } = await prisma.patient.updateMany({ where: { id, professionalId: professional.id }, data: { sex: sexo } })
  if (!count) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
