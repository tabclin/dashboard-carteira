import { createClient } from '@/lib/supabase/server'
import PlanejamentoGrid from '@/components/financeiro/planejamento-grid'
import type { FinCategoria, FinOrcamento } from '@/types'

export const revalidate = 0

interface PageProps {
  searchParams: { ano?: string }
}

export default async function PlanejamentoPage({ searchParams }: PageProps) {
  const ano = parseInt(searchParams.ano ?? String(new Date().getFullYear()))
  const supabase = createClient()

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

  const categorias = (cats ?? []) as FinCategoria[]
  const orcamento = (orc ?? []) as FinOrcamento[]

  // Agrupa realizado por categoria → mês
  const realizado: Record<string, Record<number, number>> = {}
  for (const m of movs ?? []) {
    if (!m.categoria_id || !m.data_caixa) continue
    const mes = parseInt(m.data_caixa.split('-')[1])
    if (!realizado[m.categoria_id]) realizado[m.categoria_id] = {}
    realizado[m.categoria_id][mes] = (realizado[m.categoria_id][mes] ?? 0) + m.valor
  }

  const anos = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-slate-700">Planejamento Anual</h2>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {anos.map(a => (
            <a
              key={a}
              href={`/financeiro/planejamento?ano=${a}`}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                a === ano ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {a}
            </a>
          ))}
        </div>
      </div>

      <PlanejamentoGrid
        ano={ano}
        categorias={categorias}
        orcamento={orcamento}
        realizado={realizado}
      />
    </div>
  )
}
