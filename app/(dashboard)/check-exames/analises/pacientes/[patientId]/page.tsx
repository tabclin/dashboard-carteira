import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { PatientHistory } from '@/components/check-exames/analyses/patient-history'
import { findMatchedRefsForResults } from '@/lib/exam/normalize'
import Link from 'next/link'
import { ArrowLeft, User } from 'lucide-react'

export default async function PatientHistoryPage({
  params,
}: {
  params: Promise<{ patientId: string }>
}) {
  const { patientId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const professional = await prisma.professional.findUnique({
    where: { authUserId: user.id },
  })
  if (!professional) notFound()

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, professionalId: professional.id },
  })
  if (!patient) notFound()

  const analyses = await prisma.analysis.findMany({
    where: { patientId, professionalId: professional.id },
    orderBy: { collectedAt: 'asc' },
    include: {
      results: {
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
        select: {
          id: true, examName: true, examSlug: true, catalogId: true,
          value: true, valueNumeric: true, unit: true,
          refMin: true, refMax: true, status: true, category: true,
        },
      },
    },
  })

  // Tenta enriquecer refs da última análise (para o gráfico)
  const lastAnalysis = analyses[analyses.length - 1]
  const refMap = lastAnalysis
    ? await findMatchedRefsForResults(
        lastAnalysis.results.map((r) => ({ examSlug: r.examSlug, unit: r.unit })),
        patient.sex,
        patient.birthDate,
        professional.id,
      )
    : new Map()

  const serializedAnalyses = analyses.map((a) => ({
    id: a.id,
    collectedAt: a.collectedAt.toISOString(),
    labName: a.labName,
    status: a.status,
    notes: a.notes,
    results: a.results.map((r) => {
      const matched = refMap.get(`${r.examSlug}::${r.unit ?? ''}`)
      return {
        id: r.id,
        examName: r.examName,
        examSlug: r.examSlug,
        catalogId: r.catalogId,
        category: r.category,
        value: r.value,
        valueNumeric: r.valueNumeric != null ? Number(r.valueNumeric) : null,
        unit: r.unit,
        refMin: matched?.refMin ?? (r.refMin != null ? Number(r.refMin) : null),
        refMax: matched?.refMax ?? (r.refMax != null ? Number(r.refMax) : null),
        status: r.status,
      }
    }),
  }))

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/check-exames/pacientes"
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">{patient.name}</h2>
            <p className="text-xs text-slate-400">
              {analyses.length} análise{analyses.length !== 1 ? 's' : ''} registrada{analyses.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Link
          href="/check-exames/analises/nova"
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          + Nova análise
        </Link>
      </div>

      <PatientHistory
        patient={{
          id: patient.id,
          name: patient.name,
          sex: patient.sex,
          birthDate: patient.birthDate?.toISOString() ?? null,
        }}
        analyses={serializedAnalyses}
      />
    </div>
  )
}
