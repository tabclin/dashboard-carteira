import { NextResponse } from 'next/server'
import { usuarioAtual } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

/** Pacientes do login (id, nome e sexo), para os campos de busca das Orientações e da Nova tarefa. */
export async function GET(request: Request) {
  const user = await usuarioAtual()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const professional = await prisma.professional.findUnique({ where: { authUserId: user.id }, select: { id: true } })
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  const patients = await prisma.patient.findMany({
    where: { professionalId: professional.id, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
    select: { id: true, name: true, sex: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(patients)
}
