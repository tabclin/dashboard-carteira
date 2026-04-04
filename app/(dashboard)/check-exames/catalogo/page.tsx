import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CatalogManager } from '@/components/check-exames/catalog/catalog-manager'

export default async function CatalogoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-slate-800">Catálogo de Exames</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Cadastre exames com nomes padronizados e nomenclaturas alternativas para consistência nas análises
        </p>
      </div>
      <div className="max-w-3xl">
        <CatalogManager />
      </div>
    </div>
  )
}
