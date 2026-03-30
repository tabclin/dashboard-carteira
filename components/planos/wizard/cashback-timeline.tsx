import { formatarMoeda } from '@/lib/utils'
import { recalcularTimeline, somarConsultas, calcularEconomia } from '@/lib/planos-utils'
import type { ConsultaRascunho, PlanoPagamento } from '@/types'

interface CashbackTimelineProps {
  consultas: ConsultaRascunho[]
  plano: PlanoPagamento | null
  pacienteNome: string
}

export default function CashbackTimeline({ consultas, plano, pacienteNome }: CashbackTimelineProps) {
  const calculadas = recalcularTimeline(consultas, plano)
  const { totalCheio, totalComPlano } = somarConsultas(calculadas)
  const { economiaReais, economiaPct } = calcularEconomia(totalCheio, totalComPlano)

  if (calculadas.length === 0) return null

  return (
    <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{pacienteNome}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="table-th text-xs py-2">#</th>
              <th className="table-th text-xs py-2">Serviço</th>
              <th className="table-th text-xs py-2">Data</th>
              <th className="table-th text-xs py-2">Valor Cheio</th>
              <th className="table-th text-xs py-2">Valor Pago</th>
              {plano?.tipo === 'cashback' && (
                <>
                  <th className="table-th text-xs py-2">Cashback Ger.</th>
                  <th className="table-th text-xs py-2">Cashback Util.</th>
                  <th className="table-th text-xs py-2">Saldo</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {calculadas.map((c, i) => {
              let saldoAcum = 0
              for (let j = 0; j <= i; j++) {
                saldoAcum += calculadas[j].cashback_gerado - calculadas[j].cashback_utilizado
              }
              return (
                <tr key={c.tempId}>
                  <td className="table-td py-2 text-xs text-slate-400">{i + 1}</td>
                  <td className="table-td py-2 text-xs">{c.servico_nome || '—'}</td>
                  <td className="table-td py-2 text-xs text-slate-500">
                    {c.data_sugerida ? c.data_sugerida.split('-').reverse().join('/') : '—'}
                  </td>
                  <td className="table-td py-2 text-xs text-slate-500 line-through">
                    {formatarMoeda(c.valor_cheio)}
                  </td>
                  <td className="table-td py-2 text-xs font-semibold text-emerald-600">
                    {formatarMoeda(c.valor_com_plano)}
                  </td>
                  {plano?.tipo === 'cashback' && (
                    <>
                      <td className="table-td py-2 text-xs text-purple-600">
                        {c.cashback_gerado > 0 ? `+${formatarMoeda(c.cashback_gerado)}` : '—'}
                      </td>
                      <td className="table-td py-2 text-xs text-blue-600">
                        {c.cashback_utilizado > 0 ? `-${formatarMoeda(c.cashback_utilizado)}` : '—'}
                      </td>
                      <td className="table-td py-2 text-xs font-medium text-slate-700">
                        {formatarMoeda(saldoAcum)}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {economiaReais > 0 && (
        <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-100 flex justify-between text-xs">
          <span className="text-slate-600">
            Total: <span className="line-through">{formatarMoeda(totalCheio)}</span>
            {' → '}
            <span className="font-semibold text-emerald-700">{formatarMoeda(totalComPlano)}</span>
          </span>
          <span className="font-semibold text-emerald-700">
            Economia: {formatarMoeda(economiaReais)} ({economiaPct}%)
          </span>
        </div>
      )}
    </div>
  )
}
