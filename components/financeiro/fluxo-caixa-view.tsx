'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { cn, formatarMoeda, formatarData } from '@/lib/utils'
import { Clock } from 'lucide-react'
import type { FinMovimentacao } from '@/types'

interface FluxoCaixaViewProps {
  movimentacoes: FinMovimentacao[]
}

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Tooltip customizado do gráfico
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const entrada = payload.find((p: any) => p.dataKey === 'entrada')?.value ?? 0
  const saida = payload.find((p: any) => p.dataKey === 'saida')?.value ?? 0
  const saldo = payload.find((p: any) => p.dataKey === 'saldo')?.value ?? 0
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-slate-700 mb-1.5">Dia {label}</p>
      {entrada > 0 && <p className="text-emerald-600">↑ Entrada: <span className="font-bold">{formatarMoeda(entrada)}</span></p>}
      {saida > 0 && <p className="text-red-600">↓ Saída: <span className="font-bold">{formatarMoeda(saida)}</span></p>}
      <p className={cn('font-bold border-t border-slate-100 pt-1 mt-1', saldo >= 0 ? 'text-indigo-600' : 'text-red-600')}>
        Saldo: {formatarMoeda(saldo)}
      </p>
    </div>
  )
}

export default function FluxoCaixaView({ movimentacoes }: FluxoCaixaViewProps) {
  const [regime, setRegime] = useState<'caixa' | 'competencia'>('caixa')
  const [periodo, setPeriodo] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })
  const [mostrarTransacoes, setMostrarTransacoes] = useState(false)

  const dataField = regime === 'caixa' ? 'data_caixa' : 'data_competencia'

  const movsFiltradas = useMemo(() => {
    return movimentacoes
      .filter(m => {
        const d = m[dataField]
        if (!d) return false
        return d.startsWith(periodo)
      })
      .sort((a, b) => ((a[dataField] ?? '') as string).localeCompare((b[dataField] ?? '') as string))
  }, [movimentacoes, dataField, periodo])

  const pendentes = regime === 'caixa'
    ? movimentacoes.filter(m => !m.data_caixa && m.data_competencia.startsWith(periodo))
    : []

  // Agrupa por dia: entrada, saída, saldo acumulado
  const dadosDiarios = useMemo(() => {
    const map = new Map<string, { entrada: number; saida: number }>()
    for (const m of movsFiltradas) {
      const d = (m[dataField] as string)
      const dia = d.slice(8) // "01", "02"...
      const atual = map.get(dia) ?? { entrada: 0, saida: 0 }
      if (m.tipo === 'entrada') atual.entrada += m.valor
      else atual.saida += m.valor
      map.set(dia, atual)
    }
    let saldoAcum = 0
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, { entrada, saida }]) => {
        saldoAcum += entrada - saida
        return { dia, entrada, saida, resultado: entrada - saida, saldo: saldoAcum }
      })
  }, [movsFiltradas, dataField])

  // Linhas detalhadas com saldo acumulado
  const linhas = useMemo(() => {
    let saldo = 0
    return movsFiltradas.map(m => {
      saldo += m.tipo === 'entrada' ? m.valor : -m.valor
      return { ...m, saldo }
    })
  }, [movsFiltradas])

  const totais = useMemo(() => {
    const entrada = movsFiltradas.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0)
    const saida = movsFiltradas.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0)
    return { entrada, saida, saldo: entrada - saida }
  }, [movsFiltradas])

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>()
    movimentacoes.forEach(m => {
      set.add(m.data_competencia.slice(0, 7))
      if (m.data_caixa) set.add(m.data_caixa.slice(0, 7))
    })
    return Array.from(set).sort().reverse()
  }, [movimentacoes])

  const [mesLabel] = periodo.split('-').reverse()
  const mesNome = `${MESES_PT[parseInt(periodo.split('-')[1]) - 1]}/${periodo.split('-')[0]}`

  return (
    <div className="space-y-5">
      {/* Controles */}
      <div className="card">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="label">Regime</label>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {([['caixa', 'Caixa'], ['competencia', 'Competência']] as const).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setRegime(v)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                    regime === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {regime === 'caixa' ? 'Apenas pagamentos recebidos/efetuados' : 'Data de origem da receita/despesa'}
            </p>
          </div>
          <div>
            <label className="label">Período</label>
            <select className="input py-1.5 text-sm" value={periodo} onChange={e => setPeriodo(e.target.value)}>
              {mesesDisponiveis.map(m => {
                const [ano, mes] = m.split('-')
                return <option key={m} value={m}>{MESES_PT[parseInt(mes) - 1]}/{ano}</option>
              })}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card py-3 text-center">
          <p className="text-xs text-emerald-600 font-medium">Total Entradas</p>
          <p className="text-xl font-bold text-emerald-700">{formatarMoeda(totais.entrada)}</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-xs text-red-600 font-medium">Total Saídas</p>
          <p className="text-xl font-bold text-red-700">{formatarMoeda(totais.saida)}</p>
        </div>
        <div className={cn('card py-3 text-center', totais.saldo >= 0 ? 'bg-emerald-50' : 'bg-red-50')}>
          <p className={cn('text-xs font-medium', totais.saldo >= 0 ? 'text-emerald-600' : 'text-red-600')}>Resultado</p>
          <p className={cn('text-xl font-bold', totais.saldo >= 0 ? 'text-emerald-700' : 'text-red-700')}>
            {formatarMoeda(totais.saldo)}
          </p>
        </div>
      </div>

      {/* Gráfico combinado: barras (entrada/saída) + linha (saldo) */}
      {dadosDiarios.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Fluxo diário — {mesNome}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={dadosDiarios} barGap={2} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="bars"
                tickFormatter={v => `${(v / 100).toFixed(0)}`}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <YAxis
                yAxisId="line"
                orientation="right"
                tickFormatter={v => `${(v / 100).toFixed(0)}`}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                formatter={(value) =>
                  value === 'entrada' ? 'Entrada' : value === 'saida' ? 'Saída' : 'Saldo acum.'
                }
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              />
              <ReferenceLine yAxisId="line" y={0} stroke="#e2e8f0" strokeDasharray="4 4" />
              <Bar yAxisId="bars" dataKey="entrada" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar yAxisId="bars" dataKey="saida" fill="#f87171" radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Line
                yAxisId="line"
                type="monotone"
                dataKey="saldo"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela diária resumida */}
      {dadosDiarios.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Resumo diário — {mesNome}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">Dia</th>
                  <th className="table-th text-right">Entradas</th>
                  <th className="table-th text-right">Saídas</th>
                  <th className="table-th text-right">Resultado do dia</th>
                  <th className="table-th text-right">Saldo acumulado</th>
                </tr>
              </thead>
              <tbody>
                {dadosDiarios.map(d => (
                  <tr key={d.dia} className="hover:bg-slate-50/70 border-b border-slate-50">
                    <td className="table-td font-medium text-slate-600">
                      {periodo}-{d.dia}
                    </td>
                    <td className="table-td text-right">
                      {d.entrada > 0
                        ? <span className="text-emerald-600 font-medium">+ {formatarMoeda(d.entrada)}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="table-td text-right">
                      {d.saida > 0
                        ? <span className="text-red-600 font-medium">- {formatarMoeda(d.saida)}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="table-td text-right">
                      <span className={cn('font-medium', d.resultado >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                        {d.resultado >= 0 ? '+' : ''}{formatarMoeda(d.resultado)}
                      </span>
                    </td>
                    <td className="table-td text-right">
                      <span className={cn('font-bold', d.saldo >= 0 ? 'text-indigo-600' : 'text-red-700')}>
                        {formatarMoeda(d.saldo)}
                      </span>
                    </td>
                  </tr>
                ))}
                {/* Totalizador */}
                <tr className="bg-slate-800">
                  <td className="table-td text-white font-bold text-xs">Total</td>
                  <td className="table-td text-right font-bold text-emerald-400 text-xs">+ {formatarMoeda(totais.entrada)}</td>
                  <td className="table-td text-right font-bold text-red-400 text-xs">- {formatarMoeda(totais.saida)}</td>
                  <td className="table-td text-right font-bold text-xs">
                    <span className={totais.saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {totais.saldo >= 0 ? '+' : ''}{formatarMoeda(totais.saldo)}
                    </span>
                  </td>
                  <td className="table-td" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm font-medium text-amber-700">
            <Clock className="inline w-4 h-4 mr-1" />
            {pendentes.length} lançamento{pendentes.length !== 1 ? 's' : ''} pendente{pendentes.length !== 1 ? 's' : ''} de pagamento
            ({formatarMoeda(pendentes.reduce((s, m) => s + (m.tipo === 'entrada' ? m.valor : -m.valor), 0))})
          </p>
        </div>
      )}

      {/* Tabela de transações (colapsável) */}
      <div className="card p-0 overflow-hidden">
        <button
          onClick={() => setMostrarTransacoes(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-100"
        >
          <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Transações individuais ({linhas.length})
          </h3>
          <span className="text-xs text-slate-400">{mostrarTransacoes ? 'Ocultar ▲' : 'Exibir ▼'}</span>
        </button>

        {mostrarTransacoes && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Data</th>
                  <th className="table-th">Descrição</th>
                  <th className="table-th">Categoria</th>
                  <th className="table-th text-right">Entrada</th>
                  <th className="table-th text-right">Saída</th>
                  <th className="table-th text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 text-sm">
                      Nenhuma movimentação no período.
                    </td>
                  </tr>
                ) : (
                  linhas.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors border-b border-slate-50">
                      <td className="table-td text-sm text-slate-500 whitespace-nowrap">
                        {formatarData((m[dataField] as string) ?? '')}
                      </td>
                      <td className="table-td">
                        <p className="text-sm font-medium text-slate-800">{m.descricao}</p>
                      </td>
                      <td className="table-td">
                        <span className="text-xs text-slate-500">{m.categoria?.nome ?? '—'}</span>
                      </td>
                      <td className="table-td text-right">
                        {m.tipo === 'entrada' && (
                          <span className="text-sm font-semibold text-emerald-600">+ {formatarMoeda(m.valor)}</span>
                        )}
                      </td>
                      <td className="table-td text-right">
                        {m.tipo === 'saida' && (
                          <span className="text-sm font-semibold text-red-600">- {formatarMoeda(m.valor)}</span>
                        )}
                      </td>
                      <td className="table-td text-right">
                        <span className={cn('text-sm font-bold', m.saldo >= 0 ? 'text-indigo-700' : 'text-red-700')}>
                          {formatarMoeda(m.saldo)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
