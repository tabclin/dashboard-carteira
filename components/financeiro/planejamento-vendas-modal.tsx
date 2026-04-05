'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Servico, FinPlanejamentoVenda } from '@/types'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

interface Props {
  servicos: Servico[]
  planejamento: FinPlanejamentoVenda[]
  realizadoMap: Record<string, Record<number, number>>
  anoInicial: number
  onClose: () => void
  onSaved: (data: FinPlanejamentoVenda[]) => void
}

// Estado local do grid: servico_id (ou servico_nome) → mes → quantidade
type GridState = Record<string, Record<number, number>>

function buildGrid(planejamento: FinPlanejamentoVenda[]): GridState {
  const grid: GridState = {}
  for (const p of planejamento) {
    const key = p.servico_id ?? p.servico_nome
    if (!grid[key]) grid[key] = {}
    grid[key][p.mes] = p.quantidade
  }
  return grid
}

export default function PlanejamentoVendasModal({
  servicos, planejamento, realizadoMap, anoInicial, onClose, onSaved,
}: Props) {
  const supabase = createClient()

  const anos = useMemo(() =>
    Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i), [])

  const [ano, setAno]     = useState(anoInicial)
  const [saving, setSaving] = useState(false)
  const [erro, setErro]   = useState('')

  // Carregamento de dados ao trocar o ano
  const [loadingAno, setLoadingAno] = useState(false)
  const [planejAnual, setPlanejAnual] = useState<FinPlanejamentoVenda[]>(planejamento)
  const [grid, setGrid]   = useState<GridState>(() => buildGrid(planejamento))

  async function trocarAno(novoAno: number) {
    if (novoAno === ano) return
    setLoadingAno(true)
    const { data } = await supabase
      .from('fin_planejamento_vendas')
      .select('*')
      .eq('ano', novoAno)
    const dados = (data ?? []) as FinPlanejamentoVenda[]
    setPlanejAnual(dados)
    setGrid(buildGrid(dados))
    setAno(novoAno)
    setLoadingAno(false)
  }

  function getPrevisto(servicoId: string, mes: number): number {
    return grid[servicoId]?.[mes] ?? 0
  }

  function setPrevisto(servicoId: string, mes: number, val: number) {
    setGrid(prev => ({
      ...prev,
      [servicoId]: { ...(prev[servicoId] ?? {}), [mes]: Math.max(0, val || 0) },
    }))
  }

  function getRealizado(servicoNome: string, mes: number): number {
    return realizadoMap[servicoNome]?.[mes] ?? 0
  }

  function totalPrevistoPorMes(mes: number): number {
    return servicos.reduce((sum, s) => sum + getPrevisto(s.id, mes), 0)
  }

  function totalRealizadoPorMes(mes: number): number {
    return servicos.reduce((sum, s) => sum + getRealizado(s.nome, mes), 0)
  }

  function totalPrevistoServico(servicoId: string): number {
    return Array.from({ length: 12 }, (_, i) => i + 1).reduce(
      (sum, mes) => sum + getPrevisto(servicoId, mes), 0
    )
  }

  async function salvar() {
    setSaving(true)
    setErro('')

    const rows: Omit<FinPlanejamentoVenda, 'id'>[] = []
    for (const svc of servicos) {
      for (let mes = 1; mes <= 12; mes++) {
        const qtd = getPrevisto(svc.id, mes)
        if (qtd > 0) {
          rows.push({
            servico_id: svc.id,
            servico_nome: svc.nome,
            ano,
            mes,
            quantidade: qtd,
          })
        }
      }
    }

    // Primeiro deletar as linhas do ano para este user (upsert não limpa zeros)
    await supabase
      .from('fin_planejamento_vendas')
      .delete()
      .eq('ano', ano)

    if (rows.length > 0) {
      const { data, error } = await supabase
        .from('fin_planejamento_vendas')
        .insert(rows)
        .select()

      if (error) { setErro(error.message); setSaving(false); return }
      onSaved((data ?? []) as FinPlanejamentoVenda[])
    } else {
      onSaved([])
    }

    setSaving(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-slate-800">Planejamento de Vendas</h3>
            {/* Seletor de ano */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              {anos.map(a => (
                <button
                  key={a}
                  onClick={() => trocarAno(a)}
                  className={cn(
                    'px-3 py-1 rounded-md text-sm font-medium transition-all',
                    a === ano
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto">
          {loadingAno ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : (
            <div className="min-w-[900px]">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-44 min-w-[160px]">
                      Serviço
                    </th>
                    {MESES.map((m, i) => (
                      <th key={i} className="text-center px-1 py-3 font-semibold text-slate-600 w-16">
                        {m}
                      </th>
                    ))}
                    <th className="text-center px-2 py-3 font-semibold text-slate-600 w-16">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {servicos.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="text-center text-slate-400 py-12 text-sm">
                        Nenhum serviço cadastrado. Adicione serviços em Produtos para começar.
                      </td>
                    </tr>
                  ) : servicos.map((svc, si) => (
                    <tr
                      key={svc.id}
                      className={cn('border-b border-slate-100', si % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}
                    >
                      {/* Nome do serviço */}
                      <td className="px-4 py-2 font-medium text-slate-700 text-xs leading-tight">
                        {svc.nome}
                      </td>

                      {/* Células por mês */}
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => {
                        const real = getRealizado(svc.nome, mes)
                        const prev = getPrevisto(svc.id, mes)
                        const superou = real > 0 && prev > 0 && real >= prev
                        return (
                          <td key={mes} className="px-1 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={prev || ''}
                              placeholder="—"
                              onChange={e => setPrevisto(svc.id, mes, parseInt(e.target.value) || 0)}
                              className={cn(
                                'w-full text-center text-xs rounded-md py-1 px-0.5 border transition-colors focus:outline-none focus:ring-1 focus:ring-brand-400',
                                superou
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                              )}
                            />
                            {real > 0 && (
                              <p className="text-[9px] text-slate-400 mt-0.5 leading-none">
                                real: {real}
                              </p>
                            )}
                          </td>
                        )
                      })}

                      {/* Total do serviço */}
                      <td className="px-2 py-2 text-center">
                        <span className={cn(
                          'text-xs font-semibold',
                          totalPrevistoServico(svc.id) > 0 ? 'text-brand-700' : 'text-slate-300'
                        )}>
                          {totalPrevistoServico(svc.id) || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {/* Linha de totais */}
                  {servicos.length > 0 && (
                    <tr className="bg-slate-100 border-t-2 border-slate-200 font-semibold">
                      <td className="px-4 py-2 text-xs text-slate-600">Total previsto</td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => (
                        <td key={mes} className="px-1 py-2 text-center">
                          <span className="text-xs text-slate-700">
                            {totalPrevistoPorMes(mes) || '—'}
                          </span>
                          {totalRealizadoPorMes(mes) > 0 && (
                            <p className="text-[9px] text-slate-400 mt-0.5 leading-none">
                              real: {totalRealizadoPorMes(mes)}
                            </p>
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center text-xs text-brand-700 font-bold">
                        {Array.from({ length: 12 }, (_, i) => i + 1).reduce(
                          (s, m) => s + totalPrevistoPorMes(m), 0
                        ) || '—'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <div className="text-xs text-slate-400">
            Os valores abaixo das células mostram o realizado histórico no mesmo mês.
            Células em verde indicam meta atingida.
          </div>
          <div className="flex items-center gap-3">
            {erro && <p className="text-sm text-red-500">{erro}</p>}
            <button onClick={onClose} className="btn-secondary">Cancelar</button>
            <button onClick={salvar} disabled={saving} className="btn-primary">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : 'Salvar planejamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
