import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'

const saveSchema = z.object({
  avaliacaoId: z.string().optional().nullable(),
  patientName: z.string().optional().nullable(),
  eerKcal:     z.number().positive(),
  ageMonths:   z.number().int().min(0),
  ageGroup:    z.string().min(1),
  grupos:      z.array(z.any()),
  refeicoes:   z.array(z.any()),
  condutaIa:   z.string().optional().nullable(),
  notes:       z.string().optional().nullable(),
})

async function getProfessional() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.professional.findUnique({ where: { authUserId: user.id } })
}

export async function GET(request: Request) {
  const professional = await getProfessional()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const limit       = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
  const avaliacaoId = searchParams.get('avaliacaoId')

  const planos = await prisma.planoAlimentar.findMany({
    where:   avaliacaoId
      ? { professionalId: professional.id, avaliacaoId }
      : { professionalId: professional.id },
    orderBy: { createdAt: 'desc' },
    take:    limit,
  })

  return NextResponse.json(planos)
}

export async function POST(request: Request) {
  const professional = await getProfessional()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data
  try {
    const plano = await prisma.planoAlimentar.create({
      data: {
        professionalId: professional.id,
        avaliacaoId:    d.avaliacaoId ?? null,
        patientName:    d.patientName ?? null,
        eerKcal:        d.eerKcal,
        ageMonths:      d.ageMonths,
        ageGroup:       d.ageGroup,
        grupos:         d.grupos,
        refeicoes:      d.refeicoes,
        condutaIa:      d.condutaIa ?? null,
        notes:          d.notes     ?? null,
      },
    })
    return NextResponse.json(plano, { status: 201 })
  } catch (err) {
    console.error('[dri/planos POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar plano', detail: String(err) }, { status: 500 })
  }
}
