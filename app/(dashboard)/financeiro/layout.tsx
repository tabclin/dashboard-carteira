import { Suspense } from 'react'
import FinTabNav from '@/components/financeiro/fin-tab-nav'

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Financeiro</h1>
        <p className="text-slate-500 text-sm mt-1">
          Gestão financeira completa da clínica
        </p>
      </div>
      <Suspense>
        <FinTabNav />
      </Suspense>
      {children}
    </div>
  )
}
