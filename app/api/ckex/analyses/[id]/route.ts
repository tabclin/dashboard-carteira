import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'
import { findMatchedRefsForResults } from '@/lib/exam/normalize'

type RefMap = Map<string, { refMin: number | null; refMax: number | null; unit: string } | null>

function serializeAnalysis(analysis: any, refMap?: RefMap) {
  return {
    ...analysis,
    results: analysis.results.map((r: any) => {
      const matched = refMap?.get(`${r.examSlug}::${r.unit ?? ''}`) ?? null
      return {
        ...r,
        refMin: r.refMin != null ? r.refMin.toNumber() : null,
        refMax: r.refMax != null ? r.refMax.toNumber() : null,
        matchedRef: matched,
        catalog: r.catalog ? {
          refMinMale:   r.catalog.refMinMale   != null ? r.catalog.refMinMale.toNumber()   : null,
          refMaxMale:   r.catalog.refMaxMale   != null ? r.catalog.refMaxMale.toNumber()   : null,
          refMinFemale: r.catalog.refMinFemale != null ? r.catalog.refMinFemale.toNumber() : null,
          refMaxFemale: r.catalog.refMaxFemale != null ? r.catalog.refMaxFemale.toNumber() : null,
          unit:         r.catalog.unit,
        } : null,
      }
    }),
  }
}

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

  const analysis = await prisma.analysis.findFirst({
    where: { id, professionalId: professional.id },
    include: {
      patient: true,
      results: {
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
        include: {
          catalog: {
            select: {
              refMinMale: true, refMaxMale: true,
              refMinFemale: true, refMaxFemale: true,
              unit: true,
            },
          },
        },
      },
    },
  })

  if (!analysis) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const refMap = await findMatchedRefsForResults(
    analysis.results.map((r) => ({ examSlug: r.examSlug, unit: r.unit })),
    analysis.patient.sex,
    analysis.patient.birthDate,
    professional.id,
  )

  return NextResponse.json(serializeAnalysis(analysis, refMap))
}

const updateSchema = z.object({
  status: z.enum(['DRAFT', 'IN_REVIEW', 'FINALIZED']).optional(),
  labName: z.string().optional(),
  notes: z.string().optional(),
  collectedAt: z.string().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const professional = await getProfessional()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const existing = await prisma.analysis.findFirst({
    where: { id, professionalId: professional.id },
  })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const { status, collectedAt, ...rest } = parsed.data

  const analysis = await prisma.analysis.update({
    where: { id },
    data: {
      ...rest,
      ...(status ? { status, finalizedAt: status === 'FINALIZED' ? new Date() : null } : {}),
      ...(collectedAt ? { collectedAt: new Date(collectedAt) } : {}),
    },
    include: {
      patient: true,
      results: {
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
        include: {
          catalog: {
            select: {
              refMinMale: true, refMaxMale: true,
              refMinFemale: true, refMaxFemale: true,
              unit: true,
            },
          },
        },
      },
    },
  })

  const refMapPatch = await findMatchedRefsForResults(
    analysis.results.map((r) => ({ examSlug: r.examSlug, unit: r.unit })),
    analysis.patient.sex,
    analysis.patient.birthDate,
    professional.id,
  )

  return NextResponse.json(serializeAnalysis(analysis, refMapPatch))
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const professional = await getProfessional()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.analysis.findFirst({
    where: { id, professionalId: professional.id },
  })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await prisma.analysis.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
