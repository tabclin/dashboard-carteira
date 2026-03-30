'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, formatarMoeda } from '@/lib/utils'
import { Plus, Pencil, Trash2, Settings2, Package } from 'lucide-react'
import AlocacaoForm from './alocacao-form'
import type { Servico, FinAlocacao, FinCategoria } from '@/types'
import type { ProdutoFinanceiro } from '@/app/(dashboard)/financeiro/produtos/page'
import ServicoForm from '@/components/planos/planos-servicos/servico-form'

interface ProdutosListProps {
  produtos: ProdutoFinanceiro[]
  categorias: FinCategoria[]
  alocacoes: FinAlocacao[]
  mesLabel: string
}

export default function ProdutosList({ produtos, categorias, alocacoes, mesLabel }: ProdutosListProps) {
  const router = useRouter()
  const supabase = createClient()
  const [editandoServico, setEditandoServico] = useState<Servico | null>(null)
  const [showNovoServico, setShowNovoServico] = useState(false)
  const [editandoAlocacao, setEditandoAlocacao] = useState<Servico | null>(null)

  async function excluirServico(s: Servico) {
    if (!confirm(`Excluir serviço "${s.nome}"? Esta ação não pode ser desfeita.`)) return
    await supabase.from('servicos').delete().eq('id', s.id)
    router.refresh()
  }

  const ativos = produtos.filter(p => p.servico.ativo)
  const inativos = produtos.filter(p => !p.servico.ativo)

  function MargemBadge({ margem }: { margem: number | null }) {
    if (margem === null) return <span className="text-xs text-slate-400">Sem dados</span>
    return (
      <span className={cn(
        'text-xs font-bold px-2 py-0.5 rounded-full',
        margem >= 50 ? 'bg-emerald-100 text-emerald-700'
        : margem >= 20 ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700'
      )}>
        {margem.toFixed(1)}%
      </span>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Métricas financeiras de <strong>{mesLabel}</strong> · {ativos.length} serviços ativos
        </p>
        <button onClick={() => setShowNovoServico(true)} className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> Novo Serviço
        </button>
      </div>

      {/* Cards de produtos */}
      <div className="space-y-3">
        {ativos.length === 0 && (
          <div className="card text-center py-10">
            <Package className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">Nenhum serviço cadastrado ainda.</p>
          </div>
        )}
        {ativos.map(({ servico: s, alocacoes: sAloc, receitaHistorica, qtdAtendimentos, custoAlocado, margem }) => (
          <div key={s.id} className="card">
            <div className="flex items-start gap-4">
              {/* Info do serviço */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-800">{s.nome}</h3>
                  <MargemBadge margem={margem} />
                </div>
                {s.descricao && <p className="text-xs text-slate-500 mt-0.5">{s.descricao}</p>}
                <div className="flex gap-4 mt-1">
                  <span className="text-xs text-slate-500">Preço: <strong>{formatarMoeda(s.valor_recorrente ?? s.valor_cheio)}</strong></span>
                  <span className="text-xs text-slate-500">Antecedência: <strong>{s.antecedencia_dias}d</strong></span>
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => setEditandoAlocacao(s)}
                  className="p-1.5 rounded-lg hover:bg-brand-50 text-slate-400 hover:text-brand-600 transition-colors"
                  title="Configurar custos"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditandoServico(s)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  title="Editar serviço"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => excluirServico(s)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Métricas financeiras */}
            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-slate-400">Receita no mês</p>
                <p className="text-sm font-semibold text-emerald-600">{formatarMoeda(receitaHistorica)}</p>
                <p className="text-xs text-slate-400">{qtdAtendimentos} atend.</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Custo alocado</p>
                <p className="text-sm font-semibold text-red-600">{custoAlocado > 0 ? formatarMoeda(custoAlocado) : '—'}</p>
                <p className="text-xs text-slate-400">{sAloc.length} regra{sAloc.length !== 1 ? 's' : ''}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Lucro estimado</p>
                <p className={cn(
                  'text-sm font-semibold',
                  receitaHistorica - custoAlocado >= 0 ? 'text-emerald-600' : 'text-red-600'
                )}>
                  {receitaHistorica > 0 ? formatarMoeda(receitaHistorica - custoAlocado) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Margem</p>
                <MargemBadge margem={margem} />
                {sAloc.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">Configure custos ↑</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Inativos */}
      {inativos.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm text-slate-500 select-none">
            {inativos.length} serviço{inativos.length !== 1 ? 's' : ''} inativo{inativos.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-3 space-y-2">
            {inativos.map(({ servico: s }) => (
              <div key={s.id} className="flex items-center gap-2 opacity-60">
                <span className="text-sm text-slate-600">{s.nome}</span>
                <button onClick={() => setEditandoServico(s)} className="p-1 text-slate-400 hover:text-slate-600">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Modais */}
      {(showNovoServico || editandoServico) && (
        <ServicoForm
          servico={editandoServico}
          onClose={() => { setShowNovoServico(false); setEditandoServico(null) }}
          onSaved={() => { setShowNovoServico(false); setEditandoServico(null); router.refresh() }}
        />
      )}

      {editandoAlocacao && (
        <AlocacaoForm
          servico={editandoAlocacao}
          categorias={categorias}
          alocacoes={alocacoes.filter(a => a.servico_id === editandoAlocacao.id)}
          onClose={() => setEditandoAlocacao(null)}
        />
      )}
    </div>
  )
}
