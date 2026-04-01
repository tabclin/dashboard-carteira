'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatarMoeda } from '@/lib/utils'
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown,
  Loader2, X, Settings2, BarChart3, ArrowUp, ArrowDown,
} from 'lucide-react'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import type { FinClassificacao, FinDreLinha } from '@/types'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// ── Tipos ──────────────────────────────────────────────────────────

interface LinhaComValor extends FinDreLinha {
  valor: number
  acumulado: number
}

interface CategoriaDetalhe {
  id: string
  nome: string
  valor: number
}

// Chave "YYYY-MM" → classificacao_id → total
type TotaisPorMes = Record<string, Record<string, number>>
// Chave "YYYY-MM" → classificacao_id → categorias
type DetalhesPorMes = Record<string, Record<string, CategoriaDetalhe[]>>

interface MesItem {
  mes: number
  ano: number
  key: string      // "YYYY-MM"
  label: string    // "JAN/25"
  labelLongo: string // "Janeiro 2025"
}

// ── Helper puro: lista de meses a exibir ──────────────────────────

function getMesesExibidos(mes: number, ano: number, nMeses: number): MesItem[] {
  const list: MesItem[] = []
  for (let i = nMeses - 1; i >= 0; i--) {
    let m = mes - i
    let a = ano
    while (m <= 0) { m += 12; a-- }
    list.push({
      mes: m,
      ano: a,
      key: `${a}-${String(m).padStart(2, '0')}`,
      label: MESES[m - 1].slice(0, 3).toUpperCase() + '/' + String(a).slice(2),
      labelLongo: MESES[m - 1] + ' ' + a,
    })
  }
  return list
}

// ── Indicador de variação ─────────────────────────────────────────

function VariacaoIcon({
  atual,
  anterior,
  tipo,
}: {
  atual: number
  anterior: number | null
  tipo: 'entrada' | 'saida' | 'resultado'
}) {
  if (anterior === null || anterior === 0 || Math.abs(atual - anterior) < 0.01) return null
  const subiu = atual > anterior
  const pct = ((atual - anterior) / anterior) * 100
  // Saída: subir = ruim. Entrada/resultado: subir = bom.
  const bom = tipo === 'saida' ? !subiu : subiu
  const Icon = subiu ? ArrowUp : ArrowDown
  return (
    <span
      className={cn('inline-flex items-center ml-1 cursor-help flex-shrink-0', bom ? 'text-emerald-500' : 'text-red-400')}
      title={`${pct > 0 ? '+' : ''}${pct.toFixed(1)}% vs mês anterior`}
    >
      <Icon className="w-3 h-3" />
    </span>
  )
}

// ── Componente principal ──────────────────────────────────────────

export default function DreEditor() {
  const supabase = createClient()

  const now = new Date()
  const [mes, setMes]   = useState(now.getMonth() + 1)
  const [ano, setAno]   = useState(now.getFullYear())
  const [nMeses, setNMeses] = useState(3)
  const [mode, setMode] = useState<'estrutura' | 'visualizar'>('visualizar')

  const [linhas, setLinhas]             = useState<FinDreLinha[]>([])
  const [classificacoes, setClassificacoes] = useState<FinClassificacao[]>([])
  const [totaisPorMes, setTotaisPorMes] = useState<TotaisPorMes>({})
  const [detalhesPorMes, setDetalhesPorMes] = useState<DetalhesPorMes>({})
  const [expandidas, setExpandidas]     = useState<Set<string>>(new Set())
  const [loading, setLoading]           = useState(true)
  const [loadingMov, setLoadingMov]     = useState(false)

  // Form de linha
  const [showForm, setShowForm]     = useState(false)
  const [formLinha, setFormLinha]   = useState<FinDreLinha | null>(null)
  const [formNome, setFormNome]     = useState('')
  const [formTipo, setFormTipo]     = useState<'entrada' | 'saida' | 'resultado'>('entrada')
  const [formClfIds, setFormClfIds] = useState<string[]>([])
  const [savingForm, setSavingForm] = useState(false)
  const [erroForm, setErroForm]     = useState('')
  const [confirmando, setConfirmando] = useState<FinDreLinha | null>(null)

  // ── Fetch inicial ─────────────────────────────────────────────

  const fetchLinhas = useCallback(async () => {
    const { data } = await supabase
      .from('fin_dre_linhas')
      .select('*, fin_dre_linha_classificacoes(classificacao_id)')
      .eq('ativo', true)
      .order('ordem')
    setLinhas((data ?? []).map((l: any) => ({
      ...l,
      classificacao_ids: (l.fin_dre_linha_classificacoes ?? []).map((x: any) => x.classificacao_id),
    })))
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      const [, { data: clfs }] = await Promise.all([
        fetchLinhas(),
        supabase.from('fin_classificacoes').select('*').eq('ativo', true).order('nome'),
      ])
      setClassificacoes((clfs ?? []) as FinClassificacao[])
      setLoading(false)
    }
    init()
  }, [fetchLinhas])

  // ── Fetch movimentações (range único para todos os meses) ─────

  useEffect(() => {
    async function fetchMovs() {
      setLoadingMov(true)
      const mesesList = getMesesExibidos(mes, ano, nMeses)
      const primeiro  = mesesList[0]
      const ultimo    = mesesList[mesesList.length - 1]
      const inicio    = `${primeiro.key}-01`
      const fimDia    = new Date(ultimo.ano, ultimo.mes, 0).getDate()
      const fim       = `${ultimo.key}-${String(fimDia).padStart(2, '0')}`

      const { data: movs } = await supabase
        .from('fin_movimentacoes')
        .select('valor, data_caixa, fin_categorias!categoria_id(id, nome, classificacao_id)')
        .gte('data_caixa', inicio)
        .lte('data_caixa', fim)
        .not('data_caixa', 'is', null)

      const totaisLocal: TotaisPorMes = {}
      const detalhesRaw: Record<string, Record<string, Record<string, CategoriaDetalhe>>> = {}

      for (const mov of movs ?? []) {
        const cat    = (mov as any).fin_categorias
        const cid    = cat?.classificacao_id
        const mesKey = (mov as any).data_caixa?.slice(0, 7) as string | undefined
        if (!cid || !mesKey) continue

        // Totais
        if (!totaisLocal[mesKey]) totaisLocal[mesKey] = {}
        totaisLocal[mesKey][cid] = (totaisLocal[mesKey][cid] ?? 0) + (mov.valor as number)

        // Detalhes
        if (!detalhesRaw[mesKey]) detalhesRaw[mesKey] = {}
        if (!detalhesRaw[mesKey][cid]) detalhesRaw[mesKey][cid] = {}
        const catId   = cat.id ?? '__sem_categoria__'
        const catNome = cat.nome ?? 'Sem categoria'
        if (!detalhesRaw[mesKey][cid][catId]) {
          detalhesRaw[mesKey][cid][catId] = { id: catId, nome: catNome, valor: 0 }
        }
        detalhesRaw[mesKey][cid][catId].valor += mov.valor as number
      }

      // Converte para arrays ordenados
      const detalhesLocal: DetalhesPorMes = {}
      for (const [mk, clfData] of Object.entries(detalhesRaw)) {
        detalhesLocal[mk] = {}
        for (const [cid, cats] of Object.entries(clfData)) {
          detalhesLocal[mk][cid] = Object.values(cats).sort((a, b) => b.valor - a.valor)
        }
      }

      setTotaisPorMes(totaisLocal)
      setDetalhesPorMes(detalhesLocal)
      setLoadingMov(false)
    }
    fetchMovs()
  }, [mes, ano, nMeses])

  // ── Cálculo do DRE por mês ────────────────────────────────────

  function calcularDreParaMes(mesKey: string): LinhaComValor[] {
    const totais = totaisPorMes[mesKey] ?? {}
    let acumulado = 0
    return linhas.map(l => {
      let valor = 0
      if (l.tipo !== 'resultado') {
        valor = l.classificacao_ids.reduce((s, cid) => s + (totais[cid] ?? 0), 0)
        acumulado += l.tipo === 'entrada' ? valor : -valor
      }
      return { ...l, valor, acumulado }
    })
  }

  // ── Categorias de uma linha (união de todos os meses visíveis) ─

  function getAllCategoriesForLine(l: FinDreLinha): CategoriaDetalhe[] {
    const catMap: Record<string, CategoriaDetalhe> = {}
    for (const [, mesDetalhes] of Object.entries(detalhesPorMes)) {
      for (const cid of l.classificacao_ids) {
        for (const cat of mesDetalhes[cid] ?? []) {
          if (!catMap[cat.id]) catMap[cat.id] = { ...cat, valor: 0 }
          catMap[cat.id].valor += cat.valor
        }
      }
    }
    return Object.values(catMap).sort((a, b) => b.valor - a.valor)
  }

  function getCatValorMes(l: FinDreLinha, catId: string, mesKey: string): number {
    return l.classificacao_ids.reduce((sum, cid) => {
      const cats = detalhesPorMes[mesKey]?.[cid] ?? []
      return sum + (cats.find(c => c.id === catId)?.valor ?? 0)
    }, 0)
  }

  function toggleExpand(id: string) {
    setExpandidas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── CRUD de linhas ────────────────────────────────────────────

  function abrirNova() {
    setFormLinha(null); setFormNome(''); setFormTipo('entrada')
    setFormClfIds([]); setErroForm(''); setShowForm(true)
  }

  function abrirEditar(l: FinDreLinha) {
    setFormLinha(l); setFormNome(l.nome); setFormTipo(l.tipo)
    setFormClfIds([...l.classificacao_ids]); setErroForm(''); setShowForm(true)
  }

  async function salvarLinha() {
    if (!formNome.trim()) { setErroForm('Informe o nome da linha.'); return }
    setSavingForm(true); setErroForm('')
    const maxOrdem = linhas.length > 0 ? Math.max(...linhas.map(l => l.ordem)) : 0
    if (formLinha) {
      await supabase.from('fin_dre_linhas').update({ nome: formNome.trim(), tipo: formTipo }).eq('id', formLinha.id)
      await supabase.from('fin_dre_linha_classificacoes').delete().eq('linha_id', formLinha.id)
      if (formClfIds.length > 0)
        await supabase.from('fin_dre_linha_classificacoes').insert(formClfIds.map(cid => ({ linha_id: formLinha.id, classificacao_id: cid })))
    } else {
      const { data: nova } = await supabase.from('fin_dre_linhas')
        .insert({ nome: formNome.trim(), tipo: formTipo, ordem: maxOrdem + 10 }).select().single()
      if (nova && formClfIds.length > 0)
        await supabase.from('fin_dre_linha_classificacoes').insert(formClfIds.map(cid => ({ linha_id: nova.id, classificacao_id: cid })))
    }
    await fetchLinhas(); setSavingForm(false); setShowForm(false)
  }

  async function excluirLinha(l: FinDreLinha) {
    await supabase.from('fin_dre_linhas').delete().eq('id', l.id)
    await fetchLinhas()
  }

  async function mover(idx: number, dir: 'up' | 'down') {
    const outro = dir === 'up' ? idx - 1 : idx + 1
    if (outro < 0 || outro >= linhas.length) return
    const [a, b] = [linhas[idx], linhas[outro]]
    await Promise.all([
      supabase.from('fin_dre_linhas').update({ ordem: b.ordem }).eq('id', a.id),
      supabase.from('fin_dre_linhas').update({ ordem: a.ordem }).eq('id', b.id),
    ])
    await fetchLinhas()
  }

  function toggleClf(id: string) {
    setFormClfIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // ── Dados computados ──────────────────────────────────────────

  const clfMap     = useMemo(() => new Map(classificacoes.map(c => [c.id, c])), [classificacoes])
  const mesesList  = useMemo(() => getMesesExibidos(mes, ano, nMeses), [mes, ano, nMeses])
  const anos       = [ano - 2, ano - 1, ano, ano + 1]
  const mesAtualKey = `${ano}-${String(mes).padStart(2, '0')}`

  const dresPorMes = useMemo(() => {
    const result: Record<string, LinhaComValor[]> = {}
    for (const m of mesesList) result[m.key] = calcularDreParaMes(m.key)
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesesList, totaisPorMes, linhas])

  // Receita Bruta por mês = soma de todas as linhas de entrada
  const receitaBrutaPorMes = useMemo(() => {
    const result: Record<string, number> = {}
    for (const m of mesesList) {
      const dre = dresPorMes[m.key] ?? []
      result[m.key] = dre.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0)
    }
    return result
  }, [dresPorMes, mesesList])

  function pct(valor: number, mesKey: string): string | null {
    const base = receitaBrutaPorMes[mesKey] ?? 0
    if (base === 0 || valor === 0) return null
    return `${((valor / base) * 100).toFixed(1)}%`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Mode toggle */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {([
            { v: 'visualizar', label: 'Visualizar DRE', Icon: BarChart3 },
            { v: 'estrutura',  label: 'Estrutura',      Icon: Settings2 },
          ] as const).map(({ v, label, Icon }) => (
            <button
              key={v}
              onClick={() => setMode(v)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                mode === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Controles de período */}
        {mode === 'visualizar' && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Seletor de intervalo */}
            <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
              {([1, 3, 6] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setNMeses(n)}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-semibold transition-all',
                    nMeses === n ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  {n}m
                </button>
              ))}
            </div>
            <select className="input py-1.5 text-sm w-36" value={mes} onChange={e => setMes(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select className="input py-1.5 text-sm w-24" value={ano} onChange={e => setAno(Number(e.target.value))}>
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}

        {mode === 'estrutura' && (
          <button onClick={abrirNova} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Adicionar Linha
          </button>
        )}
      </div>

      {/* ── Modo: Visualizar DRE ── */}
      {mode === 'visualizar' && (
        <div className="card p-0 overflow-hidden">
          {loadingMov && (
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando dados...
            </div>
          )}

          {linhas.length === 0 ? (
            <div className="text-center py-16">
              <BarChart3 className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm">Nenhuma linha configurada.</p>
              <p className="text-xs text-slate-400 mt-1">Acesse "Estrutura" para criar as linhas do DRE.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: `${220 + mesesList.length * 240}px` }}>
                <thead>
                  {/* Linha 1: mês com colspan=2 */}
                  <tr className="border-b border-slate-100">
                    <th
                      rowSpan={2}
                      className="table-th text-left sticky left-0 bg-white z-10 border-r border-slate-100 min-w-[200px]"
                    >
                      Descrição
                    </th>
                    {mesesList.map((m) => (
                      <th
                        key={m.key}
                        colSpan={2}
                        className={cn(
                          'text-center text-xs font-semibold py-2 px-3 border-l border-slate-100',
                          m.key === mesAtualKey
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-slate-500'
                        )}
                      >
                        {m.labelLongo}
                      </th>
                    ))}
                  </tr>
                  {/* Linha 2: Valor / Acum. por mês */}
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    {mesesList.map((m) => (
                      <>
                        <th
                          key={`${m.key}-v`}
                          className={cn(
                            'table-th text-right text-xs font-medium text-slate-500 w-28 border-l border-slate-100',
                            m.key === mesAtualKey && 'bg-brand-50/50'
                          )}
                        >
                          Valor
                        </th>
                        <th
                          key={`${m.key}-a`}
                          className={cn(
                            'table-th text-right text-xs font-medium text-slate-400 w-28',
                            m.key === mesAtualKey && 'bg-brand-50/50'
                          )}
                        >
                          Acum.
                        </th>
                      </>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {linhas.map((l) => {
                    const aberta   = expandidas.has(l.id)
                    const temCats  = l.classificacao_ids.length > 0
                    const categorias = aberta ? getAllCategoriesForLine(l) : []

                    // Linha do tipo "resultado" (linha de resultado, ex: Lucro Líquido)
                    if (l.tipo === 'resultado') {
                      return (
                        <tr key={l.id} className="bg-slate-800 border-t-2 border-slate-700">
                          <td className="table-td font-bold text-white sticky left-0 bg-slate-800 border-r border-slate-700">
                            <span className="text-slate-400 mr-2 text-xs">=</span>{l.nome}
                          </td>
                          {mesesList.map((m, mi) => {
                            const dreM   = dresPorMes[m.key] ?? []
                            const linhaM = dreM.find(x => x.id === l.id)
                            const prevM  = mi > 0 ? (dresPorMes[mesesList[mi - 1].key] ?? []).find(x => x.id === l.id) : null
                            const acum   = linhaM?.acumulado ?? 0
                            const prevAcum = prevM?.acumulado ?? null
                            const pr     = pct(Math.abs(acum), m.key)
                            return (
                              <>
                                <td
                                  key={`${l.id}-${m.key}-v`}
                                  className={cn(
                                    'table-td text-right border-l border-slate-700',
                                    m.key === mesAtualKey && 'bg-slate-700/40'
                                  )}
                                />
                                <td
                                  key={`${l.id}-${m.key}-a`}
                                  className={cn(
                                    'table-td text-right font-bold',
                                    acum >= 0 ? 'text-emerald-400' : 'text-red-400',
                                    m.key === mesAtualKey && 'text-base bg-slate-700/40'
                                  )}
                                >
                                  <div className="flex items-center justify-end gap-1">
                                    {mi > 0 && (
                                      <VariacaoIcon atual={acum} anterior={prevAcum} tipo="resultado" />
                                    )}
                                    <span>
                                      {formatarMoeda(Math.abs(acum))}
                                      {acum < 0 && <span className="text-xs ml-1 opacity-60">(neg.)</span>}
                                      {pr && <span className="ml-1 text-[10px] font-normal opacity-60">{pr}</span>}
                                    </span>
                                  </div>
                                </td>
                              </>
                            )
                          })}
                        </tr>
                      )
                    }

                    // Linha normal (entrada ou saída)
                    return (
                      <>
                        <tr key={l.id} className="hover:bg-slate-50 border-b border-slate-50">
                          {/* Descrição */}
                          <td className="table-td text-slate-700 sticky left-0 bg-white border-r border-slate-100 hover:bg-slate-50">
                            <div className="flex items-center gap-1.5">
                              {temCats ? (
                                <button
                                  onClick={() => toggleExpand(l.id)}
                                  className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
                                  title={aberta ? 'Recolher' : 'Expandir detalhes'}
                                >
                                  {aberta ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                              ) : (
                                <span className="w-5 flex-shrink-0" />
                              )}
                              <span className={cn('text-xs font-bold flex-shrink-0', l.tipo === 'entrada' ? 'text-emerald-500' : 'text-red-500')}>
                                {l.tipo === 'entrada' ? '+' : '−'}
                              </span>
                              <span className="truncate">{l.nome}</span>
                            </div>
                          </td>

                          {/* Valor + Acum por mês */}
                          {mesesList.map((m, mi) => {
                            const dreM    = dresPorMes[m.key] ?? []
                            const linhaM  = dreM.find(x => x.id === l.id)
                            const prevM   = mi > 0 ? (dresPorMes[mesesList[mi - 1].key] ?? []).find(x => x.id === l.id) : null
                            const valor   = linhaM?.valor ?? 0
                            const acum    = linhaM?.acumulado ?? 0
                            const prevVal = prevM?.valor ?? null
                            const p       = pct(valor, m.key)
                            return (
                              <>
                                <td
                                  key={`${l.id}-${m.key}-v`}
                                  className={cn(
                                    'table-td text-right font-medium border-l border-slate-100',
                                    l.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600',
                                    m.key === mesAtualKey && 'bg-brand-50/30'
                                  )}
                                >
                                  <div className="flex items-center justify-end gap-0.5">
                                    {mi > 0 && (
                                      <VariacaoIcon atual={valor} anterior={prevVal} tipo={l.tipo} />
                                    )}
                                    {valor > 0 ? (
                                      <span>
                                        {formatarMoeda(valor)}
                                        {p && <span className="ml-1 text-[10px] text-slate-400 font-normal">{p}</span>}
                                      </span>
                                    ) : <span className="text-slate-300">—</span>}
                                  </div>
                                </td>
                                <td
                                  key={`${l.id}-${m.key}-a`}
                                  className={cn(
                                    'table-td text-right text-xs text-slate-400',
                                    m.key === mesAtualKey && 'bg-brand-50/30'
                                  )}
                                >
                                  {formatarMoeda(acum)}
                                </td>
                              </>
                            )
                          })}
                        </tr>

                        {/* Linhas de categorias (expand) */}
                        {aberta && categorias.length === 0 && (
                          <tr key={`${l.id}-vazio`} className="bg-slate-50/60 border-b border-slate-50">
                            <td
                              colSpan={1 + mesesList.length * 2}
                              className="table-td pl-10 text-xs text-slate-400 italic sticky left-0"
                            >
                              Nenhuma movimentação no período.
                            </td>
                          </tr>
                        )}

                        {aberta && categorias.map(cat => (
                          <tr key={`${l.id}-${cat.id}`} className="bg-slate-50/50 border-b border-slate-50">
                            <td className="table-td pl-8 text-slate-500 sticky left-0 bg-slate-50/50 border-r border-slate-100">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-300 text-base leading-none">└</span>
                                <span className="text-xs truncate">{cat.nome}</span>
                              </div>
                            </td>
                            {mesesList.map((m, mi) => {
                              const valMes  = getCatValorMes(l, cat.id, m.key)
                              const prevCat = mi > 0 ? getCatValorMes(l, cat.id, mesesList[mi - 1].key) : null
                              const pc      = pct(valMes, m.key)
                              return (
                                <>
                                  <td
                                    key={`${l.id}-${cat.id}-${m.key}-v`}
                                    className={cn(
                                      'table-td text-right text-xs border-l border-slate-100',
                                      l.tipo === 'entrada' ? 'text-emerald-500' : 'text-red-500',
                                      m.key === mesAtualKey && 'bg-brand-50/20'
                                    )}
                                  >
                                    <div className="flex items-center justify-end gap-0.5">
                                      {mi > 0 && (
                                        <VariacaoIcon atual={valMes} anterior={prevCat} tipo={l.tipo} />
                                      )}
                                      {valMes > 0 ? (
                                        <span>
                                          {formatarMoeda(valMes)}
                                          {pc && <span className="ml-1 text-[10px] text-slate-400 font-normal">{pc}</span>}
                                        </span>
                                      ) : <span className="text-slate-300">—</span>}
                                    </div>
                                  </td>
                                  <td
                                    key={`${l.id}-${cat.id}-${m.key}-a`}
                                    className={cn(
                                      'table-td text-right text-xs text-slate-300',
                                      m.key === mesAtualKey && 'bg-brand-50/20'
                                    )}
                                  >
                                    —
                                  </td>
                                </>
                              )
                            })}
                          </tr>
                        ))}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modo: Estrutura ── */}
      {mode === 'estrutura' && (
        <div className="card p-0 overflow-hidden">
          {linhas.length === 0 ? (
            <div className="text-center py-16">
              <Settings2 className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm">Nenhuma linha criada ainda.</p>
              <p className="text-xs text-slate-400 mt-1">Clique em "Adicionar Linha" para começar.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="table-th text-left">Nome</th>
                  <th className="table-th">Tipo</th>
                  <th className="table-th">Classificações</th>
                  <th className="table-th text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr
                    key={l.id}
                    className={cn('border-b border-slate-50', l.tipo === 'resultado' ? 'bg-slate-800' : 'hover:bg-slate-50')}
                  >
                    <td className={cn('table-td font-medium', l.tipo === 'resultado' ? 'text-white' : 'text-slate-800')}>
                      {l.tipo === 'resultado' && <span className="text-slate-400 mr-1 text-xs">=</span>}
                      {l.nome}
                    </td>
                    <td className="table-td text-center">
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        l.tipo === 'entrada'   ? 'bg-emerald-100 text-emerald-700'
                        : l.tipo === 'saida'   ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-500'
                      )}>
                        {l.tipo === 'entrada' ? '+ Entrada' : l.tipo === 'saida' ? '− Saída' : '= Resultado'}
                      </span>
                    </td>
                    <td className="table-td">
                      <div className="flex flex-wrap gap-1">
                        {l.classificacao_ids.length === 0
                          ? <span className="text-xs text-slate-400">—</span>
                          : l.classificacao_ids.map(cid => (
                              <span key={cid} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                {clfMap.get(cid)?.nome ?? cid}
                              </span>
                            ))
                        }
                      </div>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => mover(i, 'up')} disabled={i === 0} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors">
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button onClick={() => mover(i, 'down')} disabled={i === linhas.length - 1} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors">
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button onClick={() => abrirEditar(l)} className="p-1.5 text-slate-400 hover:text-brand-500 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setConfirmando(l)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Modal: Formulário de linha ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{formLinha ? 'Editar Linha' : 'Nova Linha do DRE'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Nome *</label>
                <input className="input" value={formNome} onChange={e => setFormNome(e.target.value)} placeholder="Ex: Receita Bruta, Lucro Líquido..." />
              </div>

              <div>
                <label className="label">Tipo *</label>
                <div className="flex gap-2">
                  {([
                    { v: 'entrada',   label: '+ Soma (Entrada)',   color: 'bg-emerald-500' },
                    { v: 'saida',     label: '− Subtrai (Saída)',  color: 'bg-red-500'     },
                    { v: 'resultado', label: '= Resultado',        color: 'bg-slate-700'   },
                  ] as const).map(({ v, label, color }) => (
                    <button
                      key={v}
                      onClick={() => setFormTipo(v)}
                      className={cn(
                        'flex-1 py-2 px-1 rounded-lg text-xs font-medium border transition-colors',
                        formTipo === v ? `${color} text-white border-transparent` : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {formTipo !== 'resultado' && (
                <div>
                  <label className="label">
                    Classificações vinculadas
                    <span className="text-slate-400 font-normal ml-1">(quais grupos alimentam esta linha)</span>
                  </label>
                  {classificacoes.filter(c => c.movimentacao === formTipo).length === 0 ? (
                    <p className="text-xs text-amber-600">Nenhuma classificação de {formTipo === 'entrada' ? 'entrada' : 'saída'} cadastrada.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2">
                      {classificacoes.filter(c => c.movimentacao === formTipo).map(c => (
                        <label key={c.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input type="checkbox" checked={formClfIds.includes(c.id)} onChange={() => toggleClf(c.id)} className="rounded" />
                          <span className="text-sm text-slate-700">{c.nome}</span>
                          <span className={cn('text-xs px-1.5 py-0.5 rounded ml-auto', c.tipo === 'fixo' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-600')}>
                            {c.tipo === 'fixo' ? 'Fixo' : 'Variável'}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {erroForm && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erroForm}</p>}
            </div>

            <div className="flex gap-2 px-6 pb-5">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={salvarLinha} disabled={savingForm} className="btn-primary flex-1">
                {savingForm ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmando !== null}
        mensagem={`Excluir linha "${confirmando?.nome}"?`}
        onConfirmar={() => { excluirLinha(confirmando!); setConfirmando(null) }}
        onCancelar={() => setConfirmando(null)}
      />
    </div>
  )
}
