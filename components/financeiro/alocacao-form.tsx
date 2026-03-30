'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Plus, Trash2 } from 'lucide-react'
import { formatarMoeda } from '@/lib/utils'
import type { FinAlocacao, FinCategoria, Servico } from '@/types'

interface AlocacaoFormProps {
  servico: Servico
  categorias: FinCategoria[]
  alocacoes: FinAlocacao[]
  onClose: () => void
}

const TIPO_LABELS: Record<string, string> = {
  percentual_custo:    '% do custo fixo mensal',
  percentual_receita:  '% sobre a receita',
  valor_fixo_unidade:  'Valor fixo por unidade (R$)',
}

export default function AlocacaoForm({ servico, categorias, alocacoes, onClose }: AlocacaoFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  // Local state para nova alocação
  const [novaCategoria, setNovaCategoria] = useState('')
  const [novoTipo, setNovoTipo] = useState<FinAlocacao['tipo_alocacao']>('percentual_custo')
  const [novoValor, setNovoValor] = useState('')

  const categoriasDisponiveis = categorias.filter(c =>
    c.ativo && c.tipo === 'saida' &&
    !alocacoes.some(a => a.categoria_id === c.id && a.tipo_alocacao === novoTipo)
  )

  async function adicionarAlocacao() {
    if (!novaCategoria) { setErro('Selecione uma categoria.'); return }
    const valor = parseFloat(novoValor.replace(',', '.'))
    if (!valor || valor <= 0) { setErro('Informe um valor válido.'); return }
    if (novoTipo === 'percentual_custo' && valor > 100) { setErro('Percentual não pode ser maior que 100%.'); return }
    setErro('')
    setSaving(true)

    const { error } = await supabase.from('fin_alocacoes').insert({
      categoria_id: novaCategoria,
      servico_id: servico.id,
      tipo_alocacao: novoTipo,
      valor: novoTipo === 'valor_fixo_unidade'
        ? Math.round(valor * 100)  // centavos
        : valor,
    })

    setSaving(false)
    if (error) { setErro('Erro: ' + error.message); return }
    setNovaCategoria('')
    setNovoValor('')
    router.refresh()
  }

  async function removerAlocacao(id: string) {
    await supabase.from('fin_alocacoes').delete().eq('id', id)
    router.refresh()
  }

  async function toggleAtivo(a: FinAlocacao) {
    await supabase.from('fin_alocacoes').update({ ativo: !a.ativo }).eq('id', a.id)
    router.refresh()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white">
          <div>
            <h3 className="font-semibold text-slate-800">Alocação de Custos</h3>
            <p className="text-xs text-slate-500 mt-0.5">{servico.nome}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Alocações existentes */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Regras configuradas</h4>
            {alocacoes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4 border-2 border-dashed border-slate-200 rounded-xl">
                Nenhuma regra de custo configurada.
              </p>
            ) : (
              <div className="space-y-2">
                {alocacoes.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{a.categoria?.nome ?? '—'}</p>
                      <p className="text-xs text-slate-500">
                        {TIPO_LABELS[a.tipo_alocacao]}: {' '}
                        {a.tipo_alocacao === 'valor_fixo_unidade'
                          ? formatarMoeda(a.valor)
                          : `${a.valor}%`}
                      </p>
                    </div>
                    <button
                      onClick={() => removerAlocacao(a.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Nova alocação */}
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Nova regra</h4>

            <div className="space-y-3">
              <div>
                <label className="label">Categoria de custo</label>
                <select className="input" value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)}>
                  <option value="">Selecionar...</option>
                  {categorias.filter(c => c.ativo && c.tipo === 'saida').map(c => (
                    <option key={c.id} value={c.id}>{c.nome} ({c.classificacao})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Tipo de alocação</label>
                <select className="input" value={novoTipo} onChange={e => setNovoTipo(e.target.value as FinAlocacao['tipo_alocacao'])}>
                  <option value="percentual_custo">% do custo fixo mensal desta categoria</option>
                  <option value="percentual_receita">% sobre a receita gerada</option>
                  <option value="valor_fixo_unidade">Valor fixo por atendimento (R$)</option>
                </select>
              </div>

              <div>
                <label className="label">
                  {novoTipo === 'valor_fixo_unidade' ? 'Valor (R$)' : 'Percentual (%)'}
                </label>
                <input
                  className="input"
                  placeholder={novoTipo === 'valor_fixo_unidade' ? '0,00' : '0'}
                  value={novoValor}
                  onChange={e => setNovoValor(e.target.value)}
                />
              </div>

              {erro && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}

              <button onClick={adicionarAlocacao} disabled={saving} className="btn-primary w-full text-sm">
                <Plus className="w-4 h-4" />
                {saving ? 'Adicionando...' : 'Adicionar Regra'}
              </button>
            </div>
          </div>

          {/* Exemplo de cálculo */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs font-medium text-slate-600 mb-1">Como funciona o cálculo:</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Cada regra aloca uma parte do custo para este serviço. O custo unitário é dividido pelo número de atendimentos do mês, reduzindo com o volume.
            </p>
          </div>
        </div>

        <div className="px-5 pb-5">
          <button onClick={onClose} className="btn-secondary w-full">Fechar</button>
        </div>
      </div>
    </div>
  )
}
