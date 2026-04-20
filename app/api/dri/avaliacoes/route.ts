import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'

const saveSchema = z.object({
  patientName:   z.string().optional().nullable(),
  ageMonths:     z.number().int().min(0).max(227),
  weightKg:      z.number().positive(),
  heightCm:      z.number().positive(),
  sexInput:      z.enum(['M', 'F', 'both']),
  activityLevel: z.string().min(1),
  growthFactorM: z.number().nullable().optional(),
  growthFactorF: z.number().nullable().optional(),
  intakeKcal:    z.number().positive().nullable().optional(),
  eerMasc:       z.number().nullable().optional(),
  eerFem:        z.number().nullable().optional(),
  kcalPerKgMasc: z.number().nullable().optional(),
  kcalPerKgFem:  z.number().nullable().optional(),
  ageCategory:   z.string().min(1),
  notes:         z.string().optional().nullable(),
  conduta:       z.string().optional().nullable(),
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
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

  const avaliacoes = await prisma.driAvaliacao.findMany({
    where:   { professionalId: professional.id },
    orderBy: { data: 'desc' },
    take:    limit,
    include: { planos: { select: { id: true } } },
  })

  return NextResponse.json(avaliacoes)
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
    const avaliacao = await prisma.driAvaliacao.create({
      data: {
        professionalId: professional.id,
        patientName:    d.patientName   ?? null,
        ageMonths:      d.ageMonths,
        weightKg:       d.weightKg,
        heightCm:       d.heightCm,
        sexInput:       d.sexInput,
        activityLevel:  d.activityLevel,
        growthFactorM:  d.growthFactorM ?? null,
        growthFactorF:  d.growthFactorF ?? null,
        intakeKcal:     d.intakeKcal    ?? null,
        eerMasc:        d.eerMasc       ?? null,
        eerFem:         d.eerFem        ?? null,
        kcalPerKgMasc:  d.kcalPerKgMasc ?? null,
        kcalPerKgFem:   d.kcalPerKgFem  ?? null,
        ageCategory:    d.ageCategory,
        notes:          d.notes         ?? null,
        conduta:        d.conduta       ?? null,
      },
    })
    return NextResponse.json(avaliacao, { status: 201 })
  } catch (err) {
    console.error('[dri/avaliacoes POST]', err)
    return NextResponse.json({ error: 'Erro interno ao salvar avaliação', detail: String(err) }, { status: 500 })
  }
}
