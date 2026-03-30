import { createClient } from '@/lib/supabase/server'
import FluxoCaixaView from '@/components/financeiro/fluxo-caixa-view'
import type { FinMovimentacao } from '@/types'

export const revalidate = 0

export default async function FluxoPage() {
  const supabase = createClient()

  // Busca últimos 12 meses para ter histórico suficiente no seletor de período
  const hoje = new Date()
  const doceMesesAtras = new Date(hoje.getFullYear() - 1, hoje.getMonth(), 1)
  const dataInicio = `${doceMesesAtras.getFullYear()}-${String(doceMesesAtras.getMonth() + 1).padStart(2, '0')}-01`

  const { data } = await supabase
    .from('fin_movimentacoes')
    .select('*, categoria:fin_categorias(nome, tipo, classificacao)')
    .gte('data_competencia', dataInicio)
    .order('data_competencia', { ascending: true })

  return <FluxoCaixaView movimentacoes={(data ?? []) as FinMovimentacao[]} />
}
