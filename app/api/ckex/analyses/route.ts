import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'
import { autoEvaluate } from '@/lib/exam/evaluate'
import { findMatchedRefsForResults } from '@/lib/exam/normalize'

const createSchema = z.object({
  patientId: z.string().min(1),
  collectedAt: z.string().min(1),
  labName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  results: z.array(z.object({
    examName: z.string(),
    examSlug: z.string(),
    catalogId: z.string().optional(),
    extractedName: z.string().optional(),
    category: z.string().optional(),
    value: z.string().optional(),
    valueNumeric: z.number().nullable().optional(),
    unit: z.string().optional(),
    refMin: z.number().nullable().optional(),
    refMax: z.number().nullable().optional(),
    refText: z.string().optional(),
  })).optional(),
})

async function getProfessional() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.professional.findUnique({ where: { authUserId: user.id } })
}

export async function GET() {
  const professional = await getProfessional()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const analyses = await prisma.analysis.findMany({
    where: { professionalId: professional.id },
    include: {
      patient: { select: { id: true, name: true, sex: true, birthDate: true } },
      results: { select: { id: true, status: true } },
    },
    orderBy: { collectedAt: 'desc' },
  })

  return NextResponse.json(analyses)
}

export async function POST(request: Request) {
  const professional = await getProfessional()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { patientId, collectedAt, labName, notes, results } = parsed.data

  // Verifica se o paciente pertence ao profissional
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, professionalId: professional.id },
  })
  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const analysis = await prisma.analysis.create({
    data: {
      patientId,
      professionalId: professional.id,
      collectedAt: new Date(collectedAt),
      labName: labName || null,
      notes: notes || null,
      status: 'DRAFT',
      results: results && results.length > 0 ? {
        create: results.map((r, i) => ({
          examName: r.examName,
          examSlug: r.examSlug,
          catalogId: r.catalogId || null,
          extractedName: r.extractedName || null,
          category: r.category || null,
          value: r.value || null,
          valueNumeric: r.valueNumeric ?? null,
          unit: r.unit || null,
          refMin: r.refMin ?? null,
          refMax: r.refMax ?? null,
          refText: r.refText || null,
          sortOrder: i,
          status: autoEvaluate(r.valueNumeric ?? null, r.refMin ?? null, r.refMax ?? null),
        })),
      } : undefined,
    },
    include: { results: { orderBy: { sortOrder: 'asc' } } },
  })

  // Re-avaliar status usando referências do catálogo (filtradas por sexo/idade)
  const refMap = await findMatchedRefsForResults(
    analysis.results.map((r) => ({ examSlug: r.examSlug, unit: r.unit })),
    patient.sex,
    patient.birthDate,
    professional.id,
  )

  const statusUpdates = analysis.results.flatMap((r) => {
    const matched = refMap.get(`${r.examSlug}::${r.unit ?? ''}`)
    if (!matched) return []
    const newStatus = autoEvaluate(
      r.valueNumeric != null ? Number(r.valueNumeric) : null,
      matched.refMin,
      matched.refMax,
    )
    if (newStatus === r.status) return []
    return [prisma.result.update({ where: { id: r.id }, data: { status: newStatus } })]
  })

  if (statusUpdates.length > 0) await Promise.all(statusUpdates)

  return NextResponse.json(analysis, { status: 201 })
}
