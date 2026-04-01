'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart, Bar, Line, LineChart,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { cn, formatarMoeda, formatarData } from '@/lib/utils'
import { Clock, TrendingUp } from 'lucide-react'
import type { FinMovimentacao } from '@/types'

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// ── Helpers ──────────────────────────────────────────────────────────

function mesAnterior(mesKey: string, n = 1): string {
  let [ano, mes] = mesKey.split('-').map(Number)
  mes -= n
  while (mes <= 0) { mes += 12; ano-- }
  return `${ano}-${String(mes).padStart(2, '0')}`
}

function mesProximo(mesKey: string): string {
  let [ano, mes] = mesKey.split('-').map(Number)
  mes += 1
  if (mes > 12) { mes = 1; ano++ }
  return `${ano}-${String(mes).padStart(2, '0')}`
}

function mesLabel(mesKey: string): string {
  const [ano, mes] = mesKey.split('-')
  return `${MESES_PT[parseInt(mes) - 1]}/${ano.slice(2)}`
}

function diasNoMes(mesKey: string): number {
  const [ano, mes] = mesKey.split('-').map(Number)
  return new Date(ano, mes, 0).getDate()
}

function calcSaldoDiario(
  movs: FinMovimentacao[],
  dataField: 'data_caixa' | 'data_competencia',
  mesKey: string,
): { dia: string; saldo: number }[] {
  const map = new Map<string, number>()
  for (const m of movs) {
    const d = m[dataField] as string | null
    if (!d || !d.startsWith(mesKey)) continue
    const dia = d.slice(8)
    map.set(dia, (map.get(dia) ?? 0) + (m.tipo === 'entrada' ? m.valor : -m.valor))
  }
  let saldo = 0
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, delta]) => { saldo += delta; return { dia, saldo } })
}

// ── Tooltips ─────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const entrada = payload.find((p: any) => p.dataKey === 'entrada')?.value ?? 0
  const saida   = payload.find((p: any) => p.dataKey === 'saida')?.value ?? 0
  const saldo   = payload.find((p: any) => p.dataKey === 'saldo')?.value ?? 0
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-slate-700 mb-1.5">Dia {label}</p>
      {entrada > 0 && <p className="text-emerald-600">↑ Entrada: <span className="font-bold">{formatarMoeda(entrada)}</span></p>}
      {saida   > 0 && <p className="text-red-600">↓ Saída: <span className="font-bold">{formatarMoeda(saida)}</span></p>}
      <p className={cn('font-bold border-t border-slate-100 pt-1 mt-1', saldo >= 0 ? 'text-indigo-600' : 'text-red-600')}>
        Saldo: {formatarMoeda(saldo)}
      </p>
    </div>
  )
}

// ── Tipos ─────────────────────────────────────────────────────────────

interface OrcamentoItem {
  ano: number
  mes: number
  valor_previsto: number
  tipo_calculo: string
  categoria?: { tipo: 'entrada' | 'saida'; nome: string } | null
}

interface FluxoCaixaViewProps {
  movimentacoes: FinMovimentacao[]
  orcamentos: OrcamentoItem[]
}

// ── Componente principal ──────────────────────────────────────────────

export default function FluxoCaixaView({ movimentacoes, orcamentos }: FluxoCaixaViewProps) {
  const [regime, setRegime]           = useState<'caixa' | 'competencia'>('caixa')
  const [periodo, setPeriodo]         = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })
  const [mostrarResumo, setMostrarResumo]           = useState(false)
  const [mostrarTransacoes, setMostrarTransacoes]   = useState(false)
  const [modoComparacao, setModoComparacao]         = useState<'historico' | 'previsao'>('historico')

  const dataField = regime === 'caixa' ? 'data_caixa' : 'data_competencia'

  const movsFiltradas = useMemo(() =>
    movimentacoes
      .filter(m => { const d = m[dataField]; return d && (d as string).startsWith(periodo) })
      .sort((a, b) => ((a[dataField] ?? '') as string).localeCompare((b[dataField] ?? '') as string))
  , [movimentacoes, dataField, periodo])

  const pendentes = regime === 'caixa'
    ? movimentacoes.filter(m => !m.data_caixa && m.data_competencia.startsWith(periodo))
    : []

  const dadosDiarios = useMemo(() => {
    const map = new Map<string, { entrada: number; saida: number }>()
    for (const m of movsFiltradas) {
      const dia = (m[dataField] as string).slice(8)
      const cur = map.get(dia) ?? { entrada: 0, saida: 0 }
      if (m.tipo === 'entrada') cur.entrada += m.valor
      else cur.saida += m.valor
      map.set(dia, cur)
    }
    let acum = 0
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, { entrada, saida }]) => {
        acum += entrada - saida
        return { dia, entrada, saida, resultado: entrada - saida, saldo: acum }
      })
  }, [movsFiltradas, dataField])

  const linhas = useMemo(() => {
    let saldo = 0
    return movsFiltradas.map(m => {
      saldo += m.tipo === 'entrada' ? m.valor : -m.valor
      return { ...m, saldo }
    })
  }, [movsFiltradas])

  const totais = useMemo(() => {
    const entrada = movsFiltradas.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0)
    const saida   = movsFiltradas.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0)
    return { entrada, saida, saldo: entrada - saida }
  }, [movsFiltradas])

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>()
    movimentacoes.forEach(m => {
      set.add(m.data_competencia.slice(0, 7))
      if (m.data_caixa) set.add((m.data_caixa as string).slice(0, 7))
    })
    return Array.from(set).sort().reverse()
  }, [movimentacoes])

  // ── Gráfico comparativo ───────────────────────────────────────────

  const mes1    = useMemo(() => mesAnterior(periodo, 2), [periodo])
  const mes2    = useMemo(() => mesAnterior(periodo, 1), [periodo])
  const mesNext = useMemo(() => mesProximo(periodo), [periodo])

  const dadosHist1 = useMemo(() => calcSaldoDiario(movimentacoes, dataField, mes1),    [movimentacoes, dataField, mes1])
  const dadosHist2 = useMemo(() => calcSaldoDiario(movimentacoes, dataField, mes2),    [movimentacoes, dataField, mes2])

  const dadosPrevisao = useMemo(() => {
    const [anoNext, mesNumNext] = mesNext.split('-').map(Number)
    const orc = orcamentos.filter(o =>
      o.ano === anoNext && o.mes === mesNumNext && o.tipo_calculo === 'fixo'
    )
    if (orc.length === 0) return []
    let totalEntrada = 0; let totalSaida = 0
    for (const o of orc) {
      if (o.categoria?.tipo === 'entrada') totalEntrada += o.valor_previsto
      else if (o.categoria?.tipo === 'saida') totalSaida += o.valor_previsto
    }
    const liquido  = totalEntrada - totalSaida
    const dias     = diasNoMes(mesNext)
    const dailyNet = liquido / dias
    let acum = 0
    return Array.from({ length: dias }, (_, i) => {
      acum += dailyNet
      return { dia: String(i + 1).padStart(2, '0'), previsao: Math.round(acum) }
    })
  }, [orcamentos, mesNext])

  const dadosComparativos = useMemo(() => {
    if (modoComparacao === 'historico') {
      const dias  = new Set([...dadosHist1.map(d => d.dia), ...dadosHist2.map(d => d.dia)])
      const map1  = new Map(dadosHist1.map(d => [d.dia, d.saldo]))
      const map2  = new Map(dadosHist2.map(d => [d.dia, d.saldo]))
      return Array.from(dias).sort().map(dia => ({
        dia,
        [mes1]: map1.get(dia) ?? null,
        [mes2]: map2.get(dia) ?? null,
      }))
    }
    return dadosPrevisao.map(d => ({ dia: d.dia, previsao: d.previsao }))
  }, [modoComparacao, dadosHist1, dadosHist2, dadosPrevisao, mes1, mes2])

  const temHistorico = dadosHist1.length > 0 || dadosHist2.length > 0
  const temPrevisao  = dadosPrevisao.length > 0
  const mesNome      = mesLabel(periodo)

  return (
    <div className="space-y-5">

      {/* ── Filtros + KPIs ────────────────────────────────────────── */}
      <div className="card">
        <div className="flex flex-wrap gap-6 items-center">

          {/* Grupo 1: Filtros */}
          <div className="flex gap-4 items-center flex-wrap">
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
                {regime === 'caixa' ? 'Pagamentos recebidos/efetuados' : 'Data de origem da receita/despesa'}
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

          {/* Divider */}
          <div className="w-px h-20 bg-slate-100 hidden sm:block" />

          {/* Grupo 2: KPIs */}
          <div className="flex gap-3 flex-1 min-w-[280px]">
            {/* Coluna 1: Entradas + Saídas */}
            <div className="flex flex-col gap-2 flex-1">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5">
                <p className="text-xs text-emerald-600 font-medium">↑ Total Entradas</p>
                <p className="text-lg font-bold text-emerald-700 leading-tight mt-0.5">{formatarMoeda(totais.entrada)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5">
                <p className="text-xs text-red-600 font-medium">↓ Total Saídas</p>
                <p className="text-lg font-bold text-red-700 leading-tight mt-0.5">{formatarMoeda(totais.saida)}</p>
              </div>
            </div>
            {/* Coluna 2: Resultado (mesclado verticalmente) */}
            <div className={cn(
              'flex flex-col items-center justify-center rounded-xl border px-5 py-3 flex-1',
              totais.saldo >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
            )}>
              <p className={cn('text-xs font-medium', totais.saldo >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                Resultado
              </p>
              <p className={cn('text-2xl font-bold mt-0.5', totais.saldo >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                {formatarMoeda(totais.saldo)}
              </p>
              {totais.entrada > 0 && (
                <p className={cn('text-xs mt-1.5 font-medium', totais.saldo >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                  {((Math.abs(totais.saldo) / totais.entrada) * 100).toFixed(1)}% da receita
                </p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Gráfico principal: barras + saldo ────────────────────── */}
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
                axisLine={false} tickLine={false} width={55}
              />
              <YAxis
                yAxisId="line"
                orientation="right"
                tickFormatter={v => `${(v / 100).toFixed(0)}`}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false} tickLine={false} width={55}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                formatter={v => v === 'entrada' ? 'Entrada' : v === 'saida' ? 'Saída' : 'Saldo acum.'}
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              />
              <ReferenceLine yAxisId="line" y={0} stroke="#e2e8f0" strokeDasharray="4 4" />
              <Bar yAxisId="bars" dataKey="entrada" fill="#10b981" radius={[3,3,0,0]} maxBarSize={28} />
              <Bar yAxisId="bars" dataKey="saida"   fill="#f87171" radius={[3,3,0,0]} maxBarSize={28} />
              <Line yAxisId="line" type="monotone" dataKey="saldo" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Gráfico comparativo: Histórico / Previsão ────────────── */}
      <div className="card">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Saldo acumulado</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {modoComparacao === 'historico'
                ? `Comparação com ${mesLabel(mes1)} e ${mesLabel(mes2)}`
                : `Projeção de ${mesLabel(mesNext)} baseada no planejamento`
              }
            </p>
          </div>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {([['historico', 'Histórico'], ['previsao', 'Previsão']] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setModoComparacao(v)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  modoComparacao === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {modoComparacao === 'historico' && !temHistorico && (
          <p className="text-sm text-slate-400 text-center py-10">Sem dados dos meses anteriores.</p>
        )}

        {modoComparacao === 'previsao' && !temPrevisao && (
          <div className="text-center py-10 space-y-1">
            <TrendingUp className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm text-slate-400">Sem dados de previsão para {mesLabel(mesNext)}.</p>
            <p className="text-xs text-slate-400">Configure o planejamento na aba "Planejamento".</p>
          </div>
        )}

        {((modoComparacao === 'historico' && temHistorico) || (modoComparacao === 'previsao' && temPrevisao)) && (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dadosComparativos}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={v => `${(v / 100).toFixed(0)}`}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false} tickLine={false} width={55}
              />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs space-y-1 min-w-[150px]">
                      <p className="font-semibold text-slate-700 mb-1">Dia {label}</p>
                      {payload.filter((p: any) => p.value !== null).map((p: any) => (
                        <p key={p.dataKey} style={{ color: p.color }}>
                          {p.name}: <span className="font-bold">{formatarMoeda(p.value)}</span>
                        </p>
                      ))}
                    </div>
                  )
                }}
              />
              <ReferenceLine y={0} stroke="#e2e8f0" strokeDasharray="4 4" />
              {modoComparacao === 'historico' && dadosHist1.length > 0 && (
                <Line
                  type="monotone" dataKey={mes1} name={mesLabel(mes1)}
                  stroke="#93c5fd" strokeWidth={2} dot={false} activeDot={{ r: 3 }} connectNulls
                />
              )}
              {modoComparacao === 'historico' && dadosHist2.length > 0 && (
                <Line
                  type="monotone" dataKey={mes2} name={mesLabel(mes2)}
                  stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 3 }} connectNulls
                />
              )}
              {modoComparacao === 'previsao' && (
                <Line
                  type="monotone" dataKey="previsao" name={`Projeção ${mesLabel(mesNext)}`}
                  stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 3" dot={false} activeDot={{ r: 3 }}
                />
              )}
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Resumo diário (colapsável) ────────────────────────────── */}
      {dadosDiarios.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <button
            onClick={() => setMostrarResumo(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-100"
          >
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Resumo diário — {mesNome}
            </h3>
            <span className="text-xs text-slate-400">{mostrarResumo ? 'Ocultar ▲' : 'Exibir ▼'}</span>
          </button>

          {mostrarResumo && (
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
                      <td className="table-td font-medium text-slate-600">{periodo}-{d.dia}</td>
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
          )}
        </div>
      )}

      {/* ── Pendentes ────────────────────────────────────────────── */}
      {pendentes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm font-medium text-amber-700">
            <Clock className="inline w-4 h-4 mr-1" />
            {pendentes.length} lançamento{pendentes.length !== 1 ? 's' : ''} pendente{pendentes.length !== 1 ? 's' : ''} de pagamento
            ({formatarMoeda(pendentes.reduce((s, m) => s + (m.tipo === 'entrada' ? m.valor : -m.valor), 0))})
          </p>
        </div>
      )}

      {/* ── Transações individuais (colapsável) ──────────────────── */}
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
                ) : linhas.map(m => (
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
