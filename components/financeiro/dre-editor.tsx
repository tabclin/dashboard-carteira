'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatarMoeda } from '@/lib/utils'
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown,
  Loader2, X, Settings2, BarChart3,
} from 'lucide-react'
import type { FinClassificacao, FinDreLinha } from '@/types'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// ── Tipos locais ─────────────────────────────────────────────────

interface LinhaComValor extends FinDreLinha {
  valor: number            // calculado para o período
  acumulado: number        // resultado acumulado até aqui
}

// ── Componente principal ──────────────────────────────────────────

export default function DreEditor() {
  const supabase = createClient()

  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [mode, setMode] = useState<'estrutura' | 'visualizar'>('visualizar')

  const [linhas, setLinhas] = useState<FinDreLinha[]>([])
  const [classificacoes, setClassificacoes] = useState<FinClassificacao[]>([])
  const [totaisPorClf, setTotaisPorClf] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [loadingMov, setLoadingMov] = useState(false)

  // Form de linha
  const [showForm, setShowForm] = useState(false)
  const [formLinha, setFormLinha] = useState<FinDreLinha | null>(null)
  const [formNome, setFormNome] = useState('')
  const [formTipo, setFormTipo] = useState<'entrada' | 'saida' | 'resultado'>('entrada')
  const [formClfIds, setFormClfIds] = useState<string[]>([])
  const [savingForm, setSavingForm] = useState(false)
  const [erroForm, setErroForm] = useState('')

  // ── Fetch inicial: linhas + classificacoes ───────────────────

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

  // ── Fetch movimentacoes para o período ───────────────────────

  useEffect(() => {
    async function fetchMovs() {
      setLoadingMov(true)
      const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const fimMes = new Date(ano, mes, 0).getDate()
      const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(fimMes).padStart(2, '0')}`

      const { data: movs } = await supabase
        .from('fin_movimentacoes')
        .select('valor, fin_categorias!categoria_id(classificacao_id)')
        .gte('data_caixa', inicio)
        .lte('data_caixa', fim)
        .not('data_caixa', 'is', null)

      const totais: Record<string, number> = {}
      for (const mov of movs ?? []) {
        const cid = (mov as any).fin_categorias?.classificacao_id
        if (cid) totais[cid] = (totais[cid] ?? 0) + (mov.valor as number)
      }
      setTotaisPorClf(totais)
      setLoadingMov(false)
    }
    fetchMovs()
  }, [mes, ano])

  // ── Cálculo do DRE ───────────────────────────────────────────

  function calcularDre(): LinhaComValor[] {
    let acumulado = 0
    return linhas.map(l => {
      let valor = 0
      if (l.tipo !== 'resultado') {
        valor = l.classificacao_ids.reduce((s, cid) => s + (totaisPorClf[cid] ?? 0), 0)
        acumulado += l.tipo === 'entrada' ? valor : -valor
      }
      return { ...l, valor, acumulado }
    })
  }

  // ── CRUD de linhas ────────────────────────────────────────────

  function abrirNova() {
    setFormLinha(null)
    setFormNome('')
    setFormTipo('entrada')
    setFormClfIds([])
    setErroForm('')
    setShowForm(true)
  }

  function abrirEditar(l: FinDreLinha) {
    setFormLinha(l)
    setFormNome(l.nome)
    setFormTipo(l.tipo)
    setFormClfIds([...l.classificacao_ids])
    setErroForm('')
    setShowForm(true)
  }

  async function salvarLinha() {
    if (!formNome.trim()) { setErroForm('Informe o nome da linha.'); return }
    setSavingForm(true)
    setErroForm('')

    const maxOrdem = linhas.length > 0 ? Math.max(...linhas.map(l => l.ordem)) : 0

    if (formLinha) {
      // Atualizar linha existente
      await supabase.from('fin_dre_linhas').update({ nome: formNome.trim(), tipo: formTipo }).eq('id', formLinha.id)
      // Re-sincronizar classificacoes
      await supabase.from('fin_dre_linha_classificacoes').delete().eq('linha_id', formLinha.id)
      if (formClfIds.length > 0) {
        await supabase.from('fin_dre_linha_classificacoes').insert(
          formClfIds.map(cid => ({ linha_id: formLinha.id, classificacao_id: cid }))
        )
      }
    } else {
      // Inserir nova linha
      const { data: nova } = await supabase
        .from('fin_dre_linhas')
        .insert({ nome: formNome.trim(), tipo: formTipo, ordem: maxOrdem + 10 })
        .select()
        .single()
      if (nova && formClfIds.length > 0) {
        await supabase.from('fin_dre_linha_classificacoes').insert(
          formClfIds.map(cid => ({ linha_id: nova.id, classificacao_id: cid }))
        )
      }
    }

    await fetchLinhas()
    setSavingForm(false)
    setShowForm(false)
  }

  async function excluirLinha(l: FinDreLinha) {
    if (!confirm(`Excluir linha "${l.nome}"?`)) return
    await supabase.from('fin_dre_linhas').delete().eq('id', l.id)
    await fetchLinhas()
  }

  async function mover(idx: number, dir: 'up' | 'down') {
    const outro = dir === 'up' ? idx - 1 : idx + 1
    if (outro < 0 || outro >= linhas.length) return
    const a = linhas[idx]
    const b = linhas[outro]
    await Promise.all([
      supabase.from('fin_dre_linhas').update({ ordem: b.ordem }).eq('id', a.id),
      supabase.from('fin_dre_linhas').update({ ordem: a.ordem }).eq('id', b.id),
    ])
    await fetchLinhas()
  }

  function toggleClf(id: string) {
    setFormClfIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const clfMap = new Map(classificacoes.map(c => [c.id, c]))
  const dreCalculado = calcularDre()

  const anos = [ano - 1, ano, ano + 1]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setMode('visualizar')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              mode === 'visualizar' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <BarChart3 className="w-4 h-4" /> Visualizar DRE
          </button>
          <button
            onClick={() => setMode('estrutura')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              mode === 'estrutura' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <Settings2 className="w-4 h-4" /> Estrutura
          </button>
        </div>

        {/* Seletor de período (só no modo visualizar) */}
        {mode === 'visualizar' && (
          <div className="flex items-center gap-2">
            <select
              className="input py-1.5 text-sm w-36"
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
            >
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select
              className="input py-1.5 text-sm w-24"
              value={ano}
              onChange={e => setAno(Number(e.target.value))}
            >
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
          {dreCalculado.length === 0 ? (
            <div className="text-center py-16">
              <BarChart3 className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm">Nenhuma linha configurada.</p>
              <p className="text-xs text-slate-400 mt-1">Acesse "Estrutura" para criar as linhas do DRE.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="table-th text-left">Descrição</th>
                  <th className="table-th text-right w-40">Valor</th>
                  <th className="table-th text-right w-40">Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {dreCalculado.map((l, i) => {
                  if (l.tipo === 'resultado') {
                    return (
                      <tr key={l.id} className="bg-slate-800">
                        <td className="table-td font-bold text-white">
                          <span className="text-slate-400 mr-2 text-xs">=</span>{l.nome}
                        </td>
                        <td className="table-td text-right" />
                        <td className={cn(
                          'table-td text-right font-bold text-base',
                          l.acumulado >= 0 ? 'text-emerald-400' : 'text-red-400'
                        )}>
                          {formatarMoeda(Math.abs(l.acumulado))}
                          {l.acumulado < 0 && <span className="text-xs ml-1">(negativo)</span>}
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr key={l.id} className="hover:bg-slate-50 border-b border-slate-50">
                      <td className="table-td text-slate-700">
                        <span className={cn(
                          'mr-2 text-xs font-bold',
                          l.tipo === 'entrada' ? 'text-emerald-500' : 'text-red-500'
                        )}>
                          {l.tipo === 'entrada' ? '+' : '-'}
                        </span>
                        {l.nome}
                        {l.classificacao_ids.length > 0 && (
                          <span className="text-xs text-slate-400 ml-2">
                            ({l.classificacao_ids.map(id => clfMap.get(id)?.nome ?? id).join(', ')})
                          </span>
                        )}
                      </td>
                      <td className={cn(
                        'table-td text-right font-medium',
                        l.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'
                      )}>
                        {l.valor > 0 ? formatarMoeda(l.valor) : '—'}
                      </td>
                      <td className="table-td text-right text-xs text-slate-400">
                        {formatarMoeda(l.acumulado)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
                    className={cn(
                      'border-b border-slate-50',
                      l.tipo === 'resultado' ? 'bg-slate-800' : 'hover:bg-slate-50'
                    )}
                  >
                    <td className={cn('table-td font-medium', l.tipo === 'resultado' ? 'text-white' : 'text-slate-800')}>
                      {l.tipo === 'resultado' && <span className="text-slate-400 mr-1 text-xs">=</span>}
                      {l.nome}
                    </td>
                    <td className="table-td text-center">
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        l.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-700'
                        : l.tipo === 'saida' ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-500'
                      )}>
                        {l.tipo === 'entrada' ? '+ Entrada' : l.tipo === 'saida' ? '- Saída' : '= Resultado'}
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
                        <button onClick={() => excluirLinha(l)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{formLinha ? 'Editar Linha' : 'Nova Linha do DRE'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="label">Nome *</label>
                <input
                  className="input"
                  value={formNome}
                  onChange={e => setFormNome(e.target.value)}
                  placeholder="Ex: Receita Bruta, Lucro Líquido..."
                />
              </div>

              <div>
                <label className="label">Tipo *</label>
                <div className="flex gap-2">
                  {([
                    { v: 'entrada', label: '+ Soma (Entrada)', color: 'bg-emerald-500' },
                    { v: 'saida',   label: '- Subtrai (Saída)', color: 'bg-red-500'    },
                    { v: 'resultado', label: '= Resultado',    color: 'bg-slate-700'   },
                  ] as const).map(({ v, label, color }) => (
                    <button
                      key={v}
                      onClick={() => setFormTipo(v)}
                      className={cn(
                        'flex-1 py-2 px-1 rounded-lg text-xs font-medium border transition-colors',
                        formTipo === v
                          ? `${color} text-white border-transparent`
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
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
                    <p className="text-xs text-amber-600">Nenhuma classificação de {formTipo === 'entrada' ? 'entrada' : 'saída'} cadastrada. Crie em Categorias → + Classificação.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2">
                      {classificacoes
                        .filter(c => c.movimentacao === formTipo)
                        .map(c => (
                          <label key={c.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formClfIds.includes(c.id)}
                              onChange={() => toggleClf(c.id)}
                              className="rounded"
                            />
                            <span className="text-sm text-slate-700">{c.nome}</span>
                            <span className={cn(
                              'text-xs px-1.5 py-0.5 rounded ml-auto',
                              c.tipo === 'fixo' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-600'
                            )}>
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
    </div>
  )
}
