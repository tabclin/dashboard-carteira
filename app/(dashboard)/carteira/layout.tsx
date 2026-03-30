import { Suspense } from 'react'
import CarteiraTabNav from '@/components/carteira/carteira-tab-nav'

export default function CarteiraLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Carteira</h1>
        <p className="text-slate-500 text-sm mt-1">
          Gestão e acompanhamento dos pacientes da clínica
        </p>
      </div>
      <Suspense>
        <CarteiraTabNav />
      </Suspense>
      {children}
    </div>
  )
}
