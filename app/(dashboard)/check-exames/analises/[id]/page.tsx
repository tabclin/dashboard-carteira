import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { ResultsTable } from '@/components/check-exames/analyses/results-table'
import { AnalysisNotes } from '@/components/check-exames/analyses/analysis-notes'
import { ANALYSIS_STATUS_CONFIG } from '@/types'
import Link from 'next/link'
import { ArrowLeft, FileDown, History } from 'lucide-react'
import type { AnalysisStatus } from '@prisma/client'
import { findMatchedRefsForResults } from '@/lib/exam/normalize'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

export default async function AnaliseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const professional = await prisma.professional.findUnique({
    where: { authUserId: user.id },
  })
  if (!professional) notFound()

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

  if (!analysis) notFound()

  const refMap = await findMatchedRefsForResults(
    analysis.results.map((r) => ({ examSlug: r.examSlug, unit: r.unit })),
    analysis.patient.sex,
    analysis.patient.birthDate,
    professional.id,
  )

  const statusCfg = ANALYSIS_STATUS_CONFIG[analysis.status as AnalysisStatus]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <Link
            href="/check-exames/analises"
            className="mt-0.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-base font-semibold text-slate-800">{analysis.patient.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {analysis.labName ?? 'Laboratório não informado'} · Coleta: {formatDate(analysis.collectedAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/check-exames/analises/pacientes/${analysis.patient.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            Histórico
          </Link>
          <a
            href={`/api/ckex/analyses/${analysis.id}/report`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            Relatório PDF
          </a>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        </div>
      </div>

      <ResultsTable
        analysisId={analysis.id}
        results={analysis.results.map((r) => ({
          ...r,
          valueNumeric: r.valueNumeric != null ? r.valueNumeric.toNumber() : null,
          refMin: r.refMin != null ? r.refMin.toNumber() : null,
          refMax: r.refMax != null ? r.refMax.toNumber() : null,
          matchedRef: refMap.get(`${r.examSlug}::${r.unit ?? ''}`) ?? null,
          catalog: r.catalog ? {
            refMinMale:   r.catalog.refMinMale   != null ? r.catalog.refMinMale.toNumber()   : null,
            refMaxMale:   r.catalog.refMaxMale   != null ? r.catalog.refMaxMale.toNumber()   : null,
            refMinFemale: r.catalog.refMinFemale != null ? r.catalog.refMinFemale.toNumber() : null,
            refMaxFemale: r.catalog.refMaxFemale != null ? r.catalog.refMaxFemale.toNumber() : null,
            unit:         r.catalog.unit,
          } : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        })) as any}
        analysisStatus={analysis.status as AnalysisStatus}
        patientSex={analysis.patient.sex}
      />
      <AnalysisNotes
        analysisId={analysis.id}
        initialNotes={analysis.notes}
        analysisStatus={analysis.status as AnalysisStatus}
      />
    </div>
  )
}
