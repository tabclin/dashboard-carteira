import { createClient } from '@/lib/supabase/server'
import ExtratoImport from '@/components/financeiro/extrato-import'
import type { FinCategoria } from '@/types'

export const revalidate = 0

export default async function ImportarPage() {
  const supabase = createClient()
  const { data } = await supabase
    .from('fin_categorias')
    .select('*')
    .eq('ativo', true)
    .order('nome')

  return <ExtratoImport categorias={(data ?? []) as FinCategoria[]} />
}
