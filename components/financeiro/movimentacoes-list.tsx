'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, formatarMoeda, formatarData } from '@/lib/utils'
import { Plus, Pencil, Trash2, Clock, CheckCircle2, Filter } from 'lucide-react'
import MovimentacaoForm from './movimentacao-form'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import type { FinMovimentacao, FinCategoria, Servico } from '@/types'

interface MovimentacoesListProps {
  movimentacoes: FinMovimentacao[]
  categorias: FinCategoria[]
  servicos: Servico[]
}

export default function MovimentacoesList({ movimentacoes, categorias, servicos }: MovimentacoesListProps) {
  const router = useRouter()
  const supabase = createClient()
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<FinMovimentacao | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [confirmando, setConfirmando] = useState<FinMovimentacao | null>(null)

  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>()
    movimentacoes.forEach(m => {
      const mes = m.data_competencia.slice(0, 7)
      set.add(mes)
    })
    return Array.from(set).sort().reverse()
  }, [movimentacoes])

  const filtradas = useMemo(() => {
    return movimentacoes.filter(m => {
      if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false
      if (filtroMes && !m.data_competencia.startsWith(filtroMes)) return false
      if (filtroCategoria && m.categoria_id !== filtroCategoria) return false
      return true
    })
  }, [movimentacoes, filtroTipo, filtroMes, filtroCategoria])

  const totais = useMemo(() => {
    const receita = filtradas.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0)
    const despesa = filtradas.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0)
    return { receita, despesa, saldo: receita - despesa }
  }, [filtradas])

  async function excluir(m: FinMovimentacao) {
    await supabase.from('fin_movimentacoes').delete().eq('id', m.id)
    router.refresh()
  }

  function handleNova() { setEditando(null); setShowModal(true) }
  function handleEditar(m: FinMovimentacao) { setEditando(m); setShowModal(true) }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">Tipo</label>
            <div className="flex gap-1">
              {([['todos', 'Todos'], ['entrada', 'Receitas'], ['saida', 'Despesas']] as const).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setFiltroTipo(v)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                    filtroTipo === v
                      ? v === 'entrada' ? 'bg-emerald-500 text-white border-emerald-500'
                        : v === 'saida' ? 'bg-red-500 text-white border-red-500'
                        : 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  )}
                >{l}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Mês</label>
            <select className="input py-1.5 text-sm" value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
              <option value="">Todos os meses</option>
              {mesesDisponiveis.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Categoria</label>
            <select className="input py-1.5 text-sm" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
              <option value="">Todas</option>
              {categorias.filter(c => c.ativo).map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div className="ml-auto">
            <button onClick={handleNova} className="btn-primary text-sm">
              <Plus className="w-4 h-4" /> Nova Movimentação
            </button>
          </div>
        </div>
      </div>

      {/* Totalizadores */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card py-3 text-center">
          <p className="text-xs text-emerald-600 font-medium">Receitas</p>
          <p className="text-lg font-bold text-emerald-700">{formatarMoeda(totais.receita)}</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-xs text-red-600 font-medium">Despesas</p>
          <p className="text-lg font-bold text-red-700">{formatarMoeda(totais.despesa)}</p>
        </div>
        <div className={cn('card py-3 text-center', totais.saldo >= 0 ? 'bg-emerald-50' : 'bg-red-50')}>
          <p className={cn('text-xs font-medium', totais.saldo >= 0 ? 'text-emerald-600' : 'text-red-600')}>Saldo</p>
          <p className={cn('text-lg font-bold', totais.saldo >= 0 ? 'text-emerald-700' : 'text-red-700')}>
            {formatarMoeda(totais.saldo)}
          </p>
        </div>
      </div>

      {/* Tabela */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Data</th>
                <th className="table-th">Descrição</th>
                <th className="table-th">Categoria</th>
                <th className="table-th">Valor</th>
                <th className="table-th">Pagamento</th>
                <th className="table-th"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                    Nenhuma movimentação encontrada.
                  </td>
                </tr>
              ) : (
                filtradas.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="table-td text-slate-500 text-sm whitespace-nowrap">
                      {formatarData(m.data_competencia)}
                    </td>
                    <td className="table-td">
                      <p className="text-sm font-medium text-slate-800">{m.descricao}</p>
                      {m.observacao && <p className="text-xs text-slate-400 truncate max-w-xs">{m.observacao}</p>}
                    </td>
                    <td className="table-td">
                      {m.categoria ? (
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          m.categoria.tipo === 'entrada' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        )}>
                          {m.categoria.nome}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="table-td whitespace-nowrap">
                      <span className={cn(
                        'font-semibold text-sm',
                        m.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-600'
                      )}>
                        {m.tipo === 'entrada' ? '+' : '-'} {formatarMoeda(m.valor)}
                      </span>
                    </td>
                    <td className="table-td whitespace-nowrap">
                      {m.data_caixa ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {formatarData(m.data_caixa)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                          <Clock className="w-3.5 h-3.5" />
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="table-td">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditar(m)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmando(m)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
          <p className="text-xs text-slate-400">
            {filtradas.length} movimentação{filtradas.length !== 1 ? 'ões' : ''} {filtradas.length !== movimentacoes.length ? `(de ${movimentacoes.length} total)` : ''}
          </p>
        </div>
      </div>

      {showModal && (
        <MovimentacaoForm
          editando={editando}
          categorias={categorias}
          servicos={servicos}
          onClose={() => setShowModal(false)}
        />
      )}

      <ConfirmDialog
        open={confirmando !== null}
        mensagem={`Excluir "${confirmando?.descricao}"?`}
        onConfirmar={() => { excluir(confirmando!); setConfirmando(null) }}
        onCancelar={() => setConfirmando(null)}
      />
    </div>
  )
}
