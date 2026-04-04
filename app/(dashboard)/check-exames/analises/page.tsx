import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import Link from 'next/link'
import { FlaskConical, Plus } from 'lucide-react'
import type { AnalysisStatus } from '@prisma/client'
import { ANALYSIS_STATUS_CONFIG } from '@/types'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'IN_REVIEW', label: 'Em revisão' },
  { value: 'FINALIZED', label: 'Finalizada' },
]

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

export default async function AnalisesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  let professional = await prisma.professional.findUnique({
    where: { authUserId: user.id },
  })

  // Auto-provisiona professional se não existir ainda
  if (!professional) {
    try {
      const org = await prisma.organization.upsert({
        where: { id: `org_${user.id}` },
        update: {},
        create: { id: `org_${user.id}`, name: user.email ?? 'Organização' },
      })
      professional = await prisma.professional.create({
        data: {
          orgId: org.id,
          authUserId: user.id,
          name: user.email?.split('@')[0] ?? 'Profissional',
          email: user.email ?? '',
        },
      })
    } catch {
      // Se falhar (ex: já existe por race condition), tenta buscar novamente
      professional = await prisma.professional.findUnique({ where: { authUserId: user.id } })
    }
    if (!professional) return (
      <div className="p-6 text-center">
        <p className="text-slate-500 text-sm">Erro ao configurar perfil. Recarregue a página.</p>
      </div>
    )
  }

  const validStatus = ['DRAFT', 'IN_REVIEW', 'FINALIZED'].includes(status ?? '')
    ? (status as AnalysisStatus)
    : undefined

  const analyses = await prisma.analysis.findMany({
    where: {
      professionalId: professional.id,
      ...(validStatus ? { status: validStatus } : {}),
    },
    orderBy: { collectedAt: 'desc' },
    include: {
      patient: { select: { id: true, name: true } },
      _count: { select: { results: true } },
    },
  })

  return (
    <div className="p-6">
      {/* Filtros + botão nova análise */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <Link
              key={opt.value}
              href={opt.value ? `/check-exames/analises?status=${opt.value}` : '/check-exames/analises'}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                (opt.value === (status ?? ''))
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
        <Link
          href="/check-exames/analises/nova"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova análise
        </Link>
      </div>

      {/* Lista */}
      {analyses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FlaskConical className="h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500 mb-1">Nenhuma análise encontrada</p>
          <p className="text-xs text-slate-400">Clique em "Nova análise" para começar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {analyses.map((analysis) => {
            const cfg = ANALYSIS_STATUS_CONFIG[analysis.status as AnalysisStatus]
            return (
              <Link
                key={analysis.id}
                href={`/check-exames/analises/${analysis.id}`}
                className="flex items-center gap-4 rounded-xl border bg-white px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{analysis.patient.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {analysis.labName ?? 'Laboratório não informado'} · Coleta: {formatDate(analysis.collectedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-400">
                    {analysis._count.results} exame{analysis._count.results !== 1 ? 's' : ''}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
