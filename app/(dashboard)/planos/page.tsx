import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import PlanosTabNav from '@/components/planos/planos-tab-nav'
import PagamentoList from '@/components/planos/planos-pagamento/pagamento-list'
import PlanosList from '@/components/planos/planos-gestao/planos-list'
import GestaoKpiStrip from '@/components/planos/planos-gestao/gestao-kpi-strip'
import ServicosList from '@/components/planos/planos-servicos/servicos-list'
import { calcularAlertaPlano } from '@/lib/planos-utils'
import type {
  PlanoPagamento, PlanoAcompanhamento, PlanosKpi, PlanoAgendamentoInfo, Servico
} from '@/types'

export const revalidate = 0

interface PageProps {
  searchParams: { tab?: string }
}

export default async function PlanosPage({ searchParams }: PageProps) {
  const tab = searchParams.tab ?? 'gestao'
  const supabase = createClient()

  let planosPagamento: PlanoPagamento[] = []
  let planos: PlanoAcompanhamento[] = []
  let servicos: Servico[] = []
  let agendamentoMap: Record<string, PlanoAgendamentoInfo> = {}
  let kpi: PlanosKpi = {
    total: 0, rascunho: 0, proposta_enviada: 0, em_andamento: 0,
    nao_aderido: 0, concluido: 0, receita_projetada: 0, receita_realizada: 0,
    taxa_conversao: 0,
  }

  if (tab === 'pagamento') {
    const { data } = await supabase.from('planos_pagamento').select('*').order('nome')
    planosPagamento = (data ?? []) as PlanoPagamento[]
  }

  if (tab === 'servicos') {
    const { data } = await supabase.from('servicos').select('*').order('nome')
    servicos = (data ?? []) as Servico[]
  }

  if (tab === 'gestao') {
    // Busca antecedência dos serviços para o mapa de lookup
    const { data: servicosData } = await supabase
      .from('servicos')
      .select('id, antecedencia_dias')
    const antecedenciaMap: Record<string, number> = {}
    for (const s of servicosData ?? []) {
      antecedenciaMap[s.id] = s.antecedencia_dias
    }

    // Busca planos incluindo consultas via join já comprovado (plano_pacientes → plano_consultas)
    const { data } = await supabase
      .from('planos_acompanhamento')
      .select(`
        *,
        plano_pagamento:planos_pagamento(*),
        plano_pacientes(
          nome,
          nascimento,
          plano_consultas(*)
        )
      `)
      .order('criado_em', { ascending: false })
    planos = (data ?? []) as PlanoAcompanhamento[]

    // Extrair todas as consultas dos planos (já retornadas no join)
    const todasConsultas = planos.flatMap(p =>
      (p.plano_pacientes ?? []).flatMap(pac =>
        (pac.plano_consultas ?? []) as {
          plano_id: string; servico_id: string | null
          valor_com_plano: number; realizada: boolean
          data_sugerida: string | null; data_agendamento: string | null
        }[]
      )
    )

    // KPIs financeiros
    const totalProjetado = todasConsultas.reduce((s, c) => s + c.valor_com_plano, 0)
    const totalRealizado = todasConsultas
      .filter(c => c.realizada)
      .reduce((s, c) => s + c.valor_com_plano, 0)

    // Calcular alerta de agendamento por plano (consultas já agrupadas por plano via join)
    agendamentoMap = {}
    for (const plano of planos) {
      const consultasDoPlano = (plano.plano_pacientes ?? [])
        .flatMap(pac => (pac.plano_consultas ?? []) as typeof todasConsultas)
        .map(c => ({
          ...c,
          antecedencia_dias: (c.servico_id ? antecedenciaMap[c.servico_id] : undefined) ?? 30,
        }))
      agendamentoMap[plano.id] = calcularAlertaPlano(consultasDoPlano)
    }

    const counts = planos.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)

    const denominador = (counts.proposta_enviada ?? 0) + (counts.em_andamento ?? 0) +
      (counts.nao_aderido ?? 0) + (counts.concluido ?? 0)
    const taxa = denominador > 0
      ? Math.round(((counts.concluido ?? 0) / denominador) * 100)
      : 0

    kpi = {
      total: planos.length,
      rascunho: counts.rascunho ?? 0,
      proposta_enviada: counts.proposta_enviada ?? 0,
      em_andamento: counts.em_andamento ?? 0,
      nao_aderido: counts.nao_aderido ?? 0,
      concluido: counts.concluido ?? 0,
      receita_projetada: totalProjetado,
      receita_realizada: totalRealizado,
      taxa_conversao: taxa,
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Planos de Acompanhamento</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Simule, proponha e gerencie planos clínicos para suas famílias
          </p>
        </div>
        {tab === 'gestao' && (
          <Link href="/planos/novo" className="btn-primary no-print">
            <Plus className="w-4 h-4" /> Novo Plano
          </Link>
        )}
      </div>

      {/* Tab navigation */}
      <Suspense>
        <PlanosTabNav />
      </Suspense>

      {/* Conteúdo por tab */}
      {tab === 'gestao' && (
        <div className="space-y-5">
          <GestaoKpiStrip kpi={kpi} />
          <PlanosList planos={planos} agendamentoMap={agendamentoMap} />
        </div>
      )}

      {tab === 'pagamento' && <PagamentoList planos={planosPagamento} />}

      {tab === 'servicos' && <ServicosList servicos={servicos} somenteLeitura />}
    </div>
  )
}
