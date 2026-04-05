import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PlanejamentoGrid from '@/components/financeiro/planejamento-grid'
import PlanejamentoVendas from '@/components/financeiro/planejamento-vendas'
import type { FinCategoria, FinOrcamento } from '@/types'
import { cn } from '@/lib/utils'

export const revalidate = 0

interface PageProps {
  searchParams: { ano?: string; tab?: string }
}

export default async function PlanejamentoPage({ searchParams }: PageProps) {
  const tab = searchParams.tab === 'vendas' ? 'vendas' : 'anual'
  const ano = parseInt(searchParams.ano ?? String(new Date().getFullYear()))
  const supabase = createClient()

  let categorias: FinCategoria[] = []
  let orcamento: FinOrcamento[] = []
  let realizado: Record<string, Record<number, number>> = {}

  if (tab === 'anual') {
    const [{ data: cats }, { data: orc }, { data: movs }] = await Promise.all([
      supabase.from('fin_categorias').select('*').eq('ativo', true).order('tipo').order('nome'),
      supabase.from('fin_orcamento').select('*').eq('ano', ano),
      supabase
        .from('fin_movimentacoes')
        .select('categoria_id, valor, tipo, data_caixa')
        .gte('data_caixa', `${ano}-01-01`)
        .lte('data_caixa', `${ano}-12-31`)
        .not('data_caixa', 'is', null),
    ])

    categorias = (cats ?? []) as FinCategoria[]
    orcamento  = (orc  ?? []) as FinOrcamento[]

    for (const m of movs ?? []) {
      if (!m.categoria_id || !m.data_caixa) continue
      const mes = parseInt(m.data_caixa.split('-')[1])
      if (!realizado[m.categoria_id]) realizado[m.categoria_id] = {}
      realizado[m.categoria_id][mes] = (realizado[m.categoria_id][mes] ?? 0) + m.valor
    }
  }

  const anos = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i)

  return (
    <div className="space-y-5">
      {/* Cabeçalho com sub-tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-slate-700">Planejamento</h2>

        {/* Sub-tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          <Link
            href="/financeiro/planejamento?tab=anual"
            className={cn(
              'px-3 py-1 rounded-md text-sm font-medium transition-all',
              tab === 'anual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            Planejamento Anual
          </Link>
          <Link
            href="/financeiro/planejamento?tab=vendas"
            className={cn(
              'px-3 py-1 rounded-md text-sm font-medium transition-all',
              tab === 'vendas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            Planejamento de Vendas
          </Link>
        </div>

        {/* Seletor de ano — apenas no Planejamento Anual */}
        {tab === 'anual' && (
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {anos.map(a => (
              <Link
                key={a}
                href={`/financeiro/planejamento?tab=anual&ano=${a}`}
                className={cn(
                  'px-3 py-1 rounded-md text-sm font-medium transition-all',
                  a === ano ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {a}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Conteúdo */}
      {tab === 'anual' ? (
        <PlanejamentoGrid
          ano={ano}
          categorias={categorias}
          orcamento={orcamento}
          realizado={realizado}
        />
      ) : (
        <PlanejamentoVendas />
      )}
    </div>
  )
}
