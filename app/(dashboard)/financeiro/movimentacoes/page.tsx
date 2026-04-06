import { createClient } from '@/lib/supabase/server'
import MovimentacoesList from '@/components/financeiro/movimentacoes-list'
import type { FinMovimentacao, FinCategoria } from '@/types'

export const revalidate = 0

export default async function MovimentacoesPage() {
  const supabase = createClient()

  const [{ data: movs }, { data: cats }] = await Promise.all([
    supabase
      .from('fin_movimentacoes')
      .select('*, categoria:fin_categorias(*), servico:servicos(id, nome)')
      .order('data_competencia', { ascending: false })
      .order('criado_em', { ascending: false }),
    supabase.from('fin_categorias').select('*').order('nome'),
  ])

  return (
    <MovimentacoesList
      movimentacoes={(movs ?? []) as FinMovimentacao[]}
      categorias={(cats ?? []) as FinCategoria[]}
    />
  )
}
