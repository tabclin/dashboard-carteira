import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { slugify } from '@/lib/utils'
import { findReference, resolveUnit } from '@/lib/exam/normalize'
import { autoEvaluate } from '@/lib/exam/evaluate'

async function getProfessional() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return prisma.professional.findUnique({ where: { authUserId: user.id } })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const professional = await getProfessional()
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params

  const analysis = await prisma.analysis.findFirst({
    where: { id, professionalId: professional.id },
    include: { patient: true },
  })
  if (!analysis) return NextResponse.json({ error: 'Análise não encontrada' }, { status: 404 })

  const body = await request.json()

  const result = await prisma.result.create({
    data: {
      analysisId: id,
      examName: body.examName ?? 'Novo exame',
      examSlug: body.examSlug ?? slugify(body.examName ?? 'novo_exame'),
      category: body.category ?? 'Outros',
      sortOrder: body.sortOrder ?? 0,
      status: 'NOT_EVALUATED',
      catalogId: body.catalogId ?? undefined,
      unit:      body.unit      ?? undefined,
      refMin:    body.refMin    ?? undefined,
      refMax:    body.refMax    ?? undefined,
      refText:   body.refText   ?? undefined,
    },
  })

  let matched: { refMin: number | null; refMax: number | null; unit: string } | null = null

  if (result.examSlug && result.unit) {
    const canonicalUnit = await resolveUnit(result.unit)
    matched = await findReference(
      result.examSlug,
      canonicalUnit,
      analysis.patient.sex,
      professional.id,
      analysis.patient.birthDate,
    )
  }

  const refMinForStatus = matched?.refMin ?? (result.refMin != null ? Number(result.refMin) : null)
  const refMaxForStatus = matched?.refMax ?? (result.refMax != null ? Number(result.refMax) : null)

  const status = autoEvaluate(
    result.valueNumeric != null ? Number(result.valueNumeric) : null,
    refMinForStatus,
    refMaxForStatus,
  )

  if (status !== result.status) {
    await prisma.result.update({ where: { id: result.id }, data: { status } })
  }

  return NextResponse.json({
    ...result,
    valueNumeric: result.valueNumeric != null ? Number(result.valueNumeric) : null,
    refMin:       result.refMin       != null ? Number(result.refMin)       : null,
    refMax:       result.refMax       != null ? Number(result.refMax)       : null,
    status,
    matchedRef: matched ?? null,
    catalog: null,
  }, { status: 201 })
}
