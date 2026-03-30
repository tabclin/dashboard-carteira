'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutList, CreditCard, Wrench } from 'lucide-react'

const tabs = [
  { key: 'gestao',    label: 'Gestão de Planos',    icon: LayoutList   },
  { key: 'pagamento', label: 'Planos de Pagamento',  icon: CreditCard   },
  { key: 'servicos',  label: 'Serviços',             icon: Wrench       },
] as const

type TabKey = typeof tabs[number]['key']

export default function PlanosTabNav() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = (searchParams?.get('tab') ?? 'gestao') as TabKey

  function handleTab(key: TabKey) {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('tab', key)
    router.push(`/planos?${params.toString()}`)
  }

  return (
    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
      {tabs.map(({ key, label, icon: Icon }) => {
        const active = activeTab === key
        return (
          <button
            key={key}
            onClick={() => handleTab(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              active
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
