import { formatarMoeda } from '@/lib/utils'
import type { PlanosKpi } from '@/types'
import { ClipboardList, TrendingUp, DollarSign, Target } from 'lucide-react'

interface GestaoKpiStripProps {
  kpi: PlanosKpi
}

export default function GestaoKpiStrip({ kpi }: GestaoKpiStripProps) {
  const faltaRealizar = kpi.receita_projetada - kpi.receita_realizada

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div className="card flex items-start gap-3">
        <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <ClipboardList className="w-4 h-4 text-brand-500" />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total de Planos</p>
          <p className="text-2xl font-bold text-slate-800 mt-0.5">{kpi.total}</p>
          <p className="text-xs text-slate-400 mt-0.5">{kpi.em_andamento} em andamento</p>
        </div>
      </div>

      <div className="card flex items-start gap-3">
        <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <Target className="w-4 h-4 text-emerald-500" />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Taxa de Conversão</p>
          <p className="text-2xl font-bold text-slate-800 mt-0.5">{kpi.taxa_conversao}%</p>
          <p className="text-xs text-slate-400 mt-0.5">{kpi.concluido} concluídos</p>
        </div>
      </div>

      <div className="card flex items-start gap-3">
        <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <DollarSign className="w-4 h-4 text-indigo-500" />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Receita Projetada</p>
          <p className="text-xl font-bold text-slate-800 mt-0.5">{formatarMoeda(kpi.receita_projetada)}</p>
          <p className="text-xs text-slate-400 mt-0.5">soma dos planos ativos</p>
        </div>
      </div>

      <div className="card flex items-start gap-3">
        <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-4 h-4 text-amber-500" />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Receita Realizada</p>
          <p className="text-xl font-bold text-slate-800 mt-0.5">{formatarMoeda(kpi.receita_realizada)}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {kpi.receita_projetada > 0
              ? `${Math.round((kpi.receita_realizada / kpi.receita_projetada) * 100)}% do previsto`
              : 'nenhum plano ativo'}
          </p>
        </div>
      </div>
    </div>
  )
}
