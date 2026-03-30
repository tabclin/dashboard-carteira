import { createClient } from '@/lib/supabase/server'
import CategoriasList from '@/components/financeiro/categorias-list'
import type { FinCategoria, FinClassificacao, Servico } from '@/types'

export const revalidate = 0

export default async function CategoriasPage() {
  const supabase = createClient()

  const [{ data: cats }, { data: svcs }, { data: clfs }] = await Promise.all([
    supabase.from('fin_categorias').select('*').order('tipo').order('nome'),
    supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
    supabase.from('fin_classificacoes').select('*').eq('ativo', true).order('nome'),
  ])

  return (
    <CategoriasList
      categorias={(cats ?? []) as FinCategoria[]}
      servicos={(svcs ?? []) as Servico[]}
      classificacoes={(clfs ?? []) as FinClassificacao[]}
    />
  )
}
