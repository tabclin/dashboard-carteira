import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatarMoeda } from '@/lib/utils'
import { calcularEconomia } from '@/lib/planos-utils'
import PlanoHeader from '@/components/planos/plano-detail/plano-header'
import PlanoPacientesView from '@/components/planos/plano-detail/plano-pacientes-view'
import PlanoPdfPreview from '@/components/planos/plano-detail/plano-pdf-preview'
import PlanoPdfButton from '@/components/planos/plano-detail/plano-pdf-button'
import type { PlanoAcompanhamento } from '@/types'

export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export default async function PlanoDetailPage({ params }: PageProps) {
  const supabase = createClient()

  const [{ data }, { data: servicosData }] = await Promise.all([
    supabase
      .from('planos_acompanhamento')
      .select(`*, plano_pagamento:planos_pagamento(*), plano_pacientes(*, plano_consultas(*))`)
      .eq('id', params.id)
      .single(),
    supabase
      .from('servicos')
      .select('id, antecedencia_dias'),
  ])

  if (!data) notFound()

  const plano = data as PlanoAcompanhamento
  const antecedenciaMap: Record<string, number> = {}
  for (const s of servicosData ?? []) {
    antecedenciaMap[s.id] = s.antecedencia_dias
  }

  // Métricas rápidas
  const todasConsultas = (plano.plano_pacientes ?? []).flatMap(p => p.plano_consultas ?? [])
  const totalCheio = todasConsultas.reduce((s, c) => s + c.valor_cheio, 0)
  const totalComPlano = todasConsultas.reduce((s, c) => s + c.valor_com_plano, 0)
  const realizadas = todasConsultas.filter(c => c.realizada).length
  const { economiaReais, economiaPct } = calcularEconomia(totalCheio, totalComPlano)

  return (
    <div className="space-y-5">
      {/* Header com status e ações */}
      <div className="flex items-start justify-between gap-3 flex-wrap no-print">
        <PlanoHeader plano={plano} />
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 no-print">
        <div className="card text-center py-3">
          <p className="text-xs text-slate-500">Total de Consultas</p>
          <p className="text-xl font-bold text-slate-800 mt-0.5">{todasConsultas.length}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xs text-slate-500">Realizadas</p>
          <p className="text-xl font-bold text-emerald-600 mt-0.5">{realizadas}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xs text-slate-500">Valor Total</p>
          <p className="text-base font-bold text-slate-800 mt-0.5">{formatarMoeda(totalComPlano)}</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-xs text-slate-500">Economia</p>
          <p className="text-base font-bold text-brand-600 mt-0.5">
            {economiaPct > 0 ? `${economiaPct}% (${formatarMoeda(economiaReais)})` : '—'}
          </p>
        </div>
      </div>

      {/* Pacientes e consultas */}
      <PlanoPacientesView pacientes={plano.plano_pacientes ?? []} antecedenciaMap={antecedenciaMap} />

      {/* ── Proposta / PDF ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Proposta para o Responsável</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Clique em "Gerar PDF" para criar o arquivo e compartilhar via WhatsApp
            </p>
          </div>
          <PlanoPdfButton />
        </div>

        {/* Preview do documento — capturado pelo html2canvas */}
        <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-inner bg-slate-50">
          <PlanoPdfPreview plano={plano} />
        </div>
      </div>
    </div>
  )
}
