import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const professional = await prisma.professional.findUnique({ where: { authUserId: user.id } })
  if (!professional) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { patientId } = await params

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, professionalId: professional.id },
    select: { id: true, name: true, sex: true, birthDate: true },
  })
  if (!patient) return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })

  const analyses = await prisma.analysis.findMany({
    where: { patientId, professionalId: professional.id },
    orderBy: { collectedAt: 'asc' },
    include: {
      results: {
        select: {
          id: true, examName: true, examSlug: true, catalogId: true,
          value: true, valueNumeric: true, unit: true,
          refMin: true, refMax: true, status: true, category: true,
        },
      },
    },
  })

  // Serializa decimais
  const serialized = analyses.map((a) => ({
    id: a.id,
    collectedAt: a.collectedAt,
    labName: a.labName,
    status: a.status,
    notes: a.notes,
    results: a.results.map((r) => ({
      id: r.id,
      examName: r.examName,
      examSlug: r.examSlug,
      catalogId: r.catalogId,
      category: r.category,
      value: r.value,
      valueNumeric: r.valueNumeric != null ? Number(r.valueNumeric) : null,
      unit: r.unit,
      refMin: r.refMin != null ? Number(r.refMin) : null,
      refMax: r.refMax != null ? Number(r.refMax) : null,
      status: r.status,
    })),
  }))

  return NextResponse.json({ patient, analyses: serialized })
}
