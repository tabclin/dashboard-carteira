'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatarMoeda } from '@/lib/utils'
import { X, Loader2, ChevronDown, ChevronUp, Search, Check, Lightbulb } from 'lucide-react'
import type { FinCategoria, FinOrcamento } from '@/types'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

interface PlanejamentoGridProps {
  ano: number
  categorias: FinCategoria[]
  orcamento: FinOrcamento[]
  realizado: Record<string, Record<number, number>>
}

interface CelulaEditando {
  catId: string
  mes: number
  catNome: string
  servicoId: string | null
}

interface SugestaoVendas {
  quantidade: number
  valorServico: number  // centavos
}

export default function PlanejamentoGrid({ ano, categorias, orcamento: orcamentoInicial, realizado }: PlanejamentoGridProps) {
  const supabase = createClient()
  const [orcamento, setOrcamento] = useState<FinOrcamento[]>(orcamentoInicial)

  const [receitasAbertas, setReceitasAbertas] = useState(true)
  const [gastosAbertos, setGastosAbertos] = useState(true)
  const [celula, setCelula] = useState<CelulaEditando | null>(null)
  const [modo, setModo] = useState<'fixo' | 'percentual'>('fixo')
  const [valorInput, setValorInput] = useState('')
  const [percentualInput, setPercentualInput] = useState('')
  const [categoriaRefIds, setCategoriaRefIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [sugestao, setSugestao] = useState<SugestaoVendas | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Leitura ──────────────────────────────────────────────────────

  function getOrcEntry(catId: string, mes: number): FinOrcamento | undefined {
    return orcamento.find(o => o.categoria_id === catId && o.mes === mes)
  }

  function getRealizado(catId: string, mes: number): number {
    return realizado[catId]?.[mes] ?? 0
  }

  function getOrcado(catId: string, mes: number): number {
    const orc = getOrcEntry(catId, mes)
    if (!orc) return 0
    if (orc.tipo_calculo === 'percentual' && orc.categoria_ref_ids?.length && orc.percentual) {
      const baseTotal = orc.categoria_ref_ids.reduce((s, id) => s + getRealizado(id, mes), 0)
      return Math.round((orc.percentual / 100) * baseTotal)
    }
    return orc.valor_previsto ?? 0
  }

  // ── Abrir modal ───────────────────────────────────────────────────

  async function startEdit(cat: FinCategoria, mes: number) {
    const orc = getOrcEntry(cat.id, mes)
    if (orc?.tipo_calculo === 'percentual') {
      setModo('percentual')
      setPercentualInput(String(orc.percentual ?? ''))
      setCategoriaRefIds(orc.categoria_ref_ids ?? [])
      setValorInput('')
    } else {
      setModo('fixo')
      const v = orc?.valor_previsto ?? 0
      setValorInput(v > 0 ? (v / 100).toFixed(2).replace('.', ',') : '')
      setPercentualInput('')
      setCategoriaRefIds([])
    }
    setSugestao(null)
    setCelula({ catId: cat.id, mes, catNome: cat.nome, servicoId: cat.servico_id ?? null })

    // Busca sugestão do Planejamento de Vendas para categorias de receita vinculadas a serviço
    if (cat.tipo === 'entrada' && cat.servico_id) {
      const [{ data: planejRow }, { data: svcRow }] = await Promise.all([
        supabase
          .from('fin_planejamento_vendas')
          .select('quantidade')
          .eq('servico_id', cat.servico_id)
          .eq('ano', ano)
          .eq('mes', mes)
          .maybeSingle(),
        supabase
          .from('servicos')
          .select('valor_cheio')
          .eq('id', cat.servico_id)
          .maybeSingle(),
      ])
      if (planejRow?.quantidade && svcRow?.valor_cheio) {
        setSugestao({ quantidade: planejRow.quantidade, valorServico: svcRow.valor_cheio })
      }
    }
  }

  function toggleRef(id: string) {
    setCategoriaRefIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // ── Salvar ────────────────────────────────────────────────────────

  async function salvar() {
    if (!celula) return
    setSaving(true)

    let payload: Record<string, unknown>
    if (modo === 'percentual') {
      const pct = parseFloat(percentualInput.replace(',', '.'))
      payload = {
        tipo_calculo: 'percentual',
        percentual: isNaN(pct) ? null : pct,
        categoria_ref_ids: categoriaRefIds,
        valor_previsto: 0,
      }
    } else {
      const valor = Math.round(parseFloat(valorInput.replace(',', '.')) * 100) || 0
      payload = {
        tipo_calculo: 'fixo',
        percentual: null,
        categoria_ref_ids: [],
        valor_previsto: valor,
      }
    }

    const existing = getOrcEntry(celula.catId, celula.mes)
    if (existing) {
      await supabase.from('fin_orcamento').update(payload).eq('id', existing.id)
      setOrcamento(prev => prev.map(o =>
        o.id === existing.id ? { ...o, ...payload } as FinOrcamento : o
      ))
    } else {
      const { data } = await supabase
        .from('fin_orcamento')
        .insert({ categoria_id: celula.catId, ano, mes: celula.mes, ...payload })
        .select()
        .single()
      if (data) setOrcamento(prev => [...prev, data as FinOrcamento])
    }

    setSaving(false)
    setCelula(null)
  }

  // ── Auxiliares ────────────────────────────────────────────────────

  const entradas = categorias.filter(c => c.tipo === 'entrada' && c.ativo)
  const saidas = categorias.filter(c => c.tipo === 'saida' && c.ativo)
  const catMapNome = new Map(categorias.map(c => [c.id, c.nome]))

  // Preview do modo percentual no modal
  const pct = parseFloat(percentualInput.replace(',', '.'))
  const previewBase = celula
    ? categoriaRefIds.reduce((s, id) => s + getRealizado(id, celula.mes), 0)
    : 0
  const previewValor = !isNaN(pct) && categoriaRefIds.length > 0
    ? Math.round((pct / 100) * previewBase)
    : null

  function TotaisRow({ label, cats }: { label: string; cats: FinCategoria[] }) {
    return (
      <tr className="bg-slate-100 font-semibold">
        <td className="table-td text-xs text-slate-600 font-bold">{label}</td>
        {MESES.map((_, i) => {
          const mes = i + 1
          const totOrc = cats.reduce((s, c) => s + getOrcado(c.id, mes), 0)
          const totReal = cats.reduce((s, c) => s + getRealizado(c.id, mes), 0)
          return (
            <td key={mes} className="table-td text-right">
              <div className="text-xs font-bold text-slate-700">{totOrc > 0 ? formatarMoeda(totOrc) : '—'}</div>
              {totReal > 0 && (
                <div className={cn('text-xs', totReal > totOrc && totOrc > 0 ? 'text-red-600' : 'text-emerald-600')}>
                  {formatarMoeda(totReal)}
                </div>
              )}
            </td>
          )
        })}
        <td className="table-td text-right">
          <div className="text-xs font-bold text-slate-700">
            {formatarMoeda(cats.reduce((s, c) => s + MESES.reduce((ms, _, i) => ms + getOrcado(c.id, i + 1), 0), 0))}
          </div>
        </td>
      </tr>
    )
  }

  function CatRows({ cats }: { cats: FinCategoria[] }) {
    return (
      <>
        {cats.map(cat => (
          <tr key={cat.id} className="hover:bg-slate-50/70">
            <td className="table-td">
              <div className="text-sm font-medium text-slate-700">{cat.nome}</div>
              <div className="text-xs text-slate-400">{cat.classificacao}</div>
            </td>
            {MESES.map((_, i) => {
              const mes = i + 1
              const orc = getOrcEntry(cat.id, mes)
              const orcado = getOrcado(cat.id, mes)
              const real = getRealizado(cat.id, mes)
              const isPct = orc?.tipo_calculo === 'percentual'
              const acima = cat.tipo === 'saida' ? real > orcado && orcado > 0 : false
              const abaixo = cat.tipo === 'entrada' ? real < orcado && orcado > 0 : false

              return (
                <td key={mes} className="table-td text-right p-1.5">
                  <button onClick={() => startEdit(cat, mes)} className="w-full text-right group">
                    {isPct ? (
                      <div className="text-xs">
                        <span className="text-brand-500 font-medium">{orc?.percentual}%</span>
                        {orc?.categoria_ref_ids?.length === 1 && (
                          <span className="text-slate-400 ml-0.5 text-[10px]">
                            {catMapNome.get(orc.categoria_ref_ids[0])?.split(' ')[0]}
                          </span>
                        )}
                        {(orc?.categoria_ref_ids?.length ?? 0) > 1 && (
                          <span className="text-slate-400 ml-0.5 text-[10px]">
                            {orc!.categoria_ref_ids.length} cat.
                          </span>
                        )}
                        {orcado > 0 && (
                          <div className="text-slate-500 text-[10px]">{formatarMoeda(orcado)}</div>
                        )}
                      </div>
                    ) : (
                      <div className={cn('text-xs', orcado > 0 ? 'text-slate-700' : 'text-slate-300 group-hover:text-slate-500')}>
                        {orcado > 0 ? formatarMoeda(orcado) : '+'}
                      </div>
                    )}
                    {real > 0 && (
                      <div className={cn('text-xs font-medium', acima ? 'text-red-500' : abaixo ? 'text-amber-500' : 'text-emerald-600')}>
                        {formatarMoeda(real)}
                      </div>
                    )}
                    {orcado > 0 && real > 0 && (
                      <div className="w-full bg-slate-200 rounded-full h-1 mt-1">
                        <div
                          className={cn('h-1 rounded-full', acima ? 'bg-red-400' : 'bg-emerald-400')}
                          style={{ width: `${Math.min((real / orcado) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </button>
                </td>
              )
            })}
            <td className="table-td text-right text-xs text-slate-500">
              {formatarMoeda(MESES.reduce((s, _, i) => s + getOrcado(cat.id, i + 1), 0))}
            </td>
          </tr>
        ))}
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> Previsto</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Realizado (ok)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Realizado (acima)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-400" /> % do realizado</span>
        <span className="text-slate-400">· Clique em uma célula para editar o orçamento</span>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-th min-w-[140px]">Categoria</th>
                {MESES.map(m => <th key={m} className="table-th text-right min-w-[80px]">{m}</th>)}
                <th className="table-th text-right min-w-[80px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {entradas.length > 0 && (
                <>
                  <tr
                    className="bg-emerald-50 cursor-pointer select-none hover:bg-emerald-100/70 transition-colors"
                    onClick={() => setReceitasAbertas(v => !v)}
                  >
                    <td colSpan={14} className="px-4 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Receitas</span>
                        {receitasAbertas
                          ? <ChevronUp className="w-3.5 h-3.5 text-emerald-500" />
                          : <ChevronDown className="w-3.5 h-3.5 text-emerald-500" />}
                      </div>
                    </td>
                  </tr>
                  {receitasAbertas && <CatRows cats={entradas} />}
                  <TotaisRow label="Total Receitas" cats={entradas} />
                </>
              )}
              {saidas.length > 0 && (
                <>
                  <tr
                    className="bg-red-50 cursor-pointer select-none hover:bg-red-100/70 transition-colors"
                    onClick={() => setGastosAbertos(v => !v)}
                  >
                    <td colSpan={14} className="px-4 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-red-700 uppercase tracking-wide">Gastos</span>
                        {gastosAbertos
                          ? <ChevronUp className="w-3.5 h-3.5 text-red-500" />
                          : <ChevronDown className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                    </td>
                  </tr>
                  {gastosAbertos && <CatRows cats={saidas} />}
                  <TotaisRow label="Total de Gastos" cats={saidas} />
                </>
              )}
              {(entradas.length > 0 || saidas.length > 0) && (
                <tr className="bg-slate-800">
                  <td className="table-td text-xs text-white font-bold">Resultado Previsto</td>
                  {MESES.map((_, i) => {
                    const mes = i + 1
                    const recPrev = entradas.reduce((s, c) => s + getOrcado(c.id, mes), 0)
                    const despPrev = saidas.reduce((s, c) => s + getOrcado(c.id, mes), 0)
                    const resultado = recPrev - despPrev
                    return (
                      <td key={mes} className={cn('table-td text-right text-xs font-bold', resultado >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {recPrev > 0 || despPrev > 0 ? formatarMoeda(resultado) : '—'}
                      </td>
                    )
                  })}
                  <td className="table-td text-right text-xs font-bold text-white">
                    {formatarMoeda(
                      entradas.reduce((s, c) => s + MESES.reduce((ms, _, i) => ms + getOrcado(c.id, i + 1), 0), 0) -
                      saidas.reduce((s, c) => s + MESES.reduce((ms, _, i) => ms + getOrcado(c.id, i + 1), 0), 0)
                    )}
                  </td>
                </tr>
              )}
              {entradas.length === 0 && saidas.length === 0 && (
                <tr>
                  <td colSpan={14} className="text-center py-12 text-slate-400 text-sm">
                    Cadastre categorias financeiras para usar o planejamento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal de edição ── */}
      {celula && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="font-semibold text-slate-800 text-sm">{celula.catNome}</p>
                <p className="text-xs text-slate-400">{MESES[celula.mes - 1]} {ano}</p>
              </div>
              <button onClick={() => { setCelula(null); setDropdownAberto(false) }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setModo('fixo')}
                  className={cn('flex-1 py-1.5 rounded-lg text-sm font-medium transition-all', modo === 'fixo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500')}
                >
                  R$ Valor fixo
                </button>
                <button
                  onClick={() => setModo('percentual')}
                  className={cn('flex-1 py-1.5 rounded-lg text-sm font-medium transition-all', modo === 'percentual' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500')}
                >
                  % do realizado
                </button>
              </div>

              {modo === 'fixo' ? (
                <div className="space-y-3">
                  <div>
                    <label className="label">Valor previsto (R$)</label>
                    <input
                      autoFocus
                      className="input"
                      placeholder="0,00"
                      value={valorInput}
                      onChange={e => setValorInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') salvar() }}
                    />
                  </div>

                  {sugestao && (
                    <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                        <p className="text-[11px] font-semibold text-violet-700">Sugestão do Planejamento de Vendas</p>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="font-bold text-slate-800">{sugestao.quantidade}</span>
                          <span className="text-slate-400">×</span>
                          <span className="font-medium">{formatarMoeda(sugestao.valorServico)}</span>
                        </div>
                        <span className="text-slate-400 text-xs">=</span>
                        <span className="font-bold text-violet-700 text-sm">{formatarMoeda(sugestao.quantidade * sugestao.valorServico)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setValorInput(((sugestao.quantidade * sugestao.valorServico) / 100).toFixed(2).replace('.', ','))}
                        className="w-full text-[11px] font-medium text-violet-600 hover:text-violet-800 bg-violet-100 hover:bg-violet-200 rounded-lg py-1 transition-colors"
                      >
                        Usar este valor
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="label">Percentual (%)</label>
                    <input
                      autoFocus
                      className="input"
                      placeholder="Ex: 10"
                      value={percentualInput}
                      onChange={e => setPercentualInput(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="label">
                      Baseado no realizado de
                      <span className="font-normal text-slate-400 ml-1">(uma ou mais)</span>
                    </label>

                    {/* Combobox colapsável */}
                    <div ref={dropdownRef} className="relative">
                      {/* Trigger */}
                      <button
                        type="button"
                        onClick={() => { setDropdownAberto(v => !v); setBusca('') }}
                        className="input flex items-center justify-between text-left w-full"
                      >
                        <span className={cn('text-sm truncate', categoriaRefIds.length === 0 ? 'text-slate-400' : 'text-slate-700')}>
                          {categoriaRefIds.length === 0
                            ? 'Selecione categorias...'
                            : categoriaRefIds.length === 1
                              ? catMapNome.get(categoriaRefIds[0]) ?? '1 selecionada'
                              : `${categoriaRefIds.length} categorias selecionadas`}
                        </span>
                        <ChevronDown className={cn('w-4 h-4 text-slate-400 flex-shrink-0 transition-transform', dropdownAberto && 'rotate-180')} />
                      </button>

                      {/* Selecionadas como tags */}
                      {categoriaRefIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {categoriaRefIds.map(id => {
                            const cat = categorias.find(c => c.id === id)
                            return (
                              <span key={id} className="inline-flex items-center gap-1 text-xs bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 rounded-full">
                                {cat?.nome}
                                <button onClick={() => toggleRef(id)} className="hover:text-brand-900">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            )
                          })}
                        </div>
                      )}

                      {/* Dropdown */}
                      {dropdownAberto && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                          {/* Campo de busca */}
                          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
                            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <input
                              autoFocus
                              className="text-sm outline-none flex-1 text-slate-700 placeholder:text-slate-400"
                              placeholder="Buscar categoria..."
                              value={busca}
                              onChange={e => setBusca(e.target.value)}
                            />
                          </div>
                          {/* Lista */}
                          <div className="max-h-44 overflow-y-auto">
                            {categorias
                              .filter(c => c.ativo && c.nome.toLowerCase().includes(busca.toLowerCase()))
                              .map(c => {
                                const selecionada = categoriaRefIds.includes(c.id)
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => toggleRef(c.id)}
                                    className={cn(
                                      'w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors',
                                      selecionada && 'bg-brand-50'
                                    )}
                                  >
                                    <div className={cn(
                                      'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                                      selecionada ? 'bg-brand-500 border-brand-500' : 'border-slate-300'
                                    )}>
                                      {selecionada && <Check className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                    <span className="text-sm text-slate-700 flex-1">{c.nome}</span>
                                    <span className={cn('text-xs px-1.5 py-0.5 rounded flex-shrink-0', c.tipo === 'entrada' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
                                      {c.tipo === 'entrada' ? 'Receita' : 'Despesa'}
                                    </span>
                                  </button>
                                )
                              })}
                            {categorias.filter(c => c.ativo && c.nome.toLowerCase().includes(busca.toLowerCase())).length === 0 && (
                              <p className="text-xs text-slate-400 text-center py-4">Nenhuma categoria encontrada.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {previewValor !== null && categoriaRefIds.length > 0 && !isNaN(pct) && (
                    <div className="bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 text-xs text-brand-700 space-y-0.5">
                      <p>
                        <span className="font-medium">{pct}%</span> de{' '}
                        {categoriaRefIds.map((id, i) => (
                          <span key={id}>
                            {i > 0 && ' + '}
                            <span className="font-medium">{catMapNome.get(id)}</span>
                            {' '}({formatarMoeda(getRealizado(id, celula.mes))})
                          </span>
                        ))}
                      </p>
                      <p>
                        Base total: {formatarMoeda(previewBase)} → <span className="font-bold">{formatarMoeda(previewValor)}</span>
                      </p>
                    </div>
                  )}

                  {categoriaRefIds.length > 0 && previewBase === 0 && (
                    <p className="text-xs text-slate-400">
                      Sem realizado em {MESES[celula.mes - 1]} para as categorias selecionadas — resultado será R$ 0,00.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => { setCelula(null); setDropdownAberto(false) }} className="btn-secondary flex-1" disabled={saving}>Cancelar</button>
              <button onClick={salvar} disabled={saving} className="btn-primary flex-1">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
