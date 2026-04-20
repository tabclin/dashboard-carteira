import { Flame } from 'lucide-react'
import DRITabs from '@/components/dri/dri-tabs'

export default function DRILayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b bg-white px-6 py-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">DRI — Necessidade Energética</h1>
            <p className="text-xs text-slate-500">Cálculo de necessidade energética baseado nas DRIs 2023 (NASEM) · Crianças e Adolescentes</p>
          </div>
        </div>
        <div className="mt-4">
          <DRITabs />
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        {children}
      </div>
    </div>
  )
}
