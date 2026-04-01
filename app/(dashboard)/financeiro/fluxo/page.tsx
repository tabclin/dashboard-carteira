import { createClient } from '@/lib/supabase/server'
import FluxoCaixaView from '@/components/financeiro/fluxo-caixa-view'
import type { FinMovimentacao } from '@/types'

export const revalidate = 0

export default async function FluxoPage() {
  const supabase = createClient()

  const hoje = new Date()
  const doceMesesAtras = new Date(hoje.getFullYear() - 1, hoje.getMonth(), 1)
  const dataInicio = `${doceMesesAtras.getFullYear()}-${String(doceMesesAtras.getMonth() + 1).padStart(2, '0')}-01`

  const [{ data: movs }, { data: orcData }] = await Promise.all([
    supabase
      .from('fin_movimentacoes')
      .select('*, categoria:fin_categorias(nome, tipo, classificacao)')
      .gte('data_competencia', dataInicio)
      .order('data_competencia', { ascending: true }),
    supabase
      .from('fin_orcamento')
      .select('*, categoria:fin_categorias(tipo, nome)')
      .gte('ano', hoje.getFullYear()),
  ])

  return (
    <FluxoCaixaView
      movimentacoes={(movs ?? []) as FinMovimentacao[]}
      orcamentos={(orcData ?? []) as any[]}
    />
  )
}
