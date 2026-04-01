'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, formatarMoeda } from '@/lib/utils'
import { Plus, Pencil, Trash2, Eye, EyeOff, X, Loader2, Tags } from 'lucide-react'
import CategoriaForm from './categoria-form'
import ClassificacaoModal from './classificacao-modal'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import type { FinCategoria, FinClassificacao, Servico } from '@/types'

interface CategoriasListProps {
  categorias: FinCategoria[]
  servicos: Servico[]
  classificacoes: FinClassificacao[]
}

export default function CategoriasList({ categorias, servicos, classificacoes }: CategoriasListProps) {
  const router = useRouter()
  const supabase = createClient()
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<FinCategoria | null>(null)
  const [showInativos, setShowInativos] = useState(false)
  const [showClassificacaoModal, setShowClassificacaoModal] = useState(false)
  const [confirmando, setConfirmando] = useState<FinCategoria | null>(null)

  // Estado para edição inline de entrada (serviço)
  const [editandoEntrada, setEditandoEntrada] = useState<Servico | null>(null)
  const [entradaMeta, setEntradaMeta] = useState('')
  const [entradaDescricao, setEntradaDescricao] = useState('')
  const [entradaClassificacaoId, setEntradaClassificacaoId] = useState('')
  const [salvandoEntrada, setSalvandoEntrada] = useState(false)
  const [erroEntrada, setErroEntrada] = useState('')

  // Mapa servico_id → fin_categoria para entradas vinculadas a serviços
  const entradaMap = new Map<string, FinCategoria>(
    categorias
      .filter(c => c.tipo === 'entrada' && c.servico_id)
      .map(c => [c.servico_id!, c])
  )

  // Entradas avulsas: tipo='entrada' sem vínculo com serviço
  const entradasAvulsas = showInativos
    ? categorias.filter(c => c.tipo === 'entrada' && !c.servico_id)
    : categorias.filter(c => c.tipo === 'entrada' && !c.servico_id && c.ativo)

  // Mapa classificacao_id → nome
  const clfMap = new Map<string, FinClassificacao>(classificacoes.map(c => [c.id, c]))
  const opcoesEntrada = classificacoes.filter(c => c.movimentacao === 'entrada')

  const saidas = showInativos
    ? categorias.filter(c => c.tipo === 'saida')
    : categorias.filter(c => c.tipo === 'saida' && c.ativo)

  async function toggleAtivo(c: FinCategoria) {
    await supabase.from('fin_categorias').update({ ativo: !c.ativo, atualizado_em: new Date().toISOString() }).eq('id', c.id)
    router.refresh()
  }

  async function excluir(c: FinCategoria) {
    await supabase.from('fin_categorias').delete().eq('id', c.id)
    router.refresh()
  }

  function abrirEditarEntrada(s: Servico) {
    const existente = entradaMap.get(s.id)
    setEntradaMeta(existente?.meta_mensal ? (existente.meta_mensal / 100).toFixed(2).replace('.', ',') : '')
    setEntradaDescricao(existente?.descricao ?? '')
    setEntradaClassificacaoId(existente?.classificacao_id ?? '')
    setErroEntrada('')
    setEditandoEntrada(s)
  }

  async function salvarEntrada() {
    if (!editandoEntrada) return
    setSalvandoEntrada(true)
    setErroEntrada('')

    const meta = entradaMeta ? Math.round(parseFloat(entradaMeta.replace(',', '.')) * 100) || null : null
    const descricao = entradaDescricao.trim() || null
    const clf = clfMap.get(entradaClassificacaoId)
    const existente = entradaMap.get(editandoEntrada.id)

    const payload = {
      meta_mensal: meta,
      descricao,
      classificacao_id: entradaClassificacaoId || null,
      classificacao: clf?.tipo ?? existente?.classificacao ?? 'variavel',
    }

    const { error } = existente
      ? await supabase.from('fin_categorias').update({ ...payload, atualizado_em: new Date().toISOString() }).eq('id', existente.id)
      : await supabase.from('fin_categorias').insert({
          nome: editandoEntrada.nome,
          tipo: 'entrada',
          servico_id: editandoEntrada.id,
          ativo: true,
          ...payload,
        })

    setSalvandoEntrada(false)
    if (error) { setErroEntrada('Erro ao salvar: ' + error.message); return }
    setEditandoEntrada(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {servicos.length + entradasAvulsas.length} entradas · {saidas.length} saídas {showInativos ? '' : 'ativas'}
        </p>
        <div className="flex gap-2">
          <button onClick={() => setShowInativos(v => !v)} className="btn-secondary text-xs">
            {showInativos ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showInativos ? 'Ocultar inativas' : 'Mostrar inativas'}
          </button>
          <button onClick={() => setShowClassificacaoModal(true)} className="btn-secondary text-xs">
            <Tags className="w-3.5 h-3.5" /> + Classificação
          </button>
          <button onClick={() => { setEditando(null); setShowModal(true) }} className="btn-primary text-xs">
            <Plus className="w-3.5 h-3.5" /> Nova Categoria
          </button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* ── Entradas (Receitas) ── */}
        <div className="card space-y-4">
          {/* Sub-seção: Serviços clínicos */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-1 text-emerald-600">
              Serviços Clínicos ({servicos.length})
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Gerados pela aba Produtos. Aparecem em Planos → Serviços.
            </p>
            {servicos.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center border-2 border-dashed border-slate-200 rounded-xl">
                Nenhum serviço ativo. Acesse Financeiro → Produtos.
              </p>
            ) : (
              <div className="space-y-2">
                {servicos.map(s => {
                  const cat = entradaMap.get(s.id)
                  const clf = cat?.classificacao_id ? clfMap.get(cat.classificacao_id) : null
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border bg-white border-slate-200">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-800">{s.nome}</span>
                          {clf && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700">
                              {clf.nome}
                            </span>
                          )}
                        </div>
                        {cat?.descricao && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{cat.descricao}</p>
                        )}
                        {cat?.meta_mensal ? (
                          <p className="text-xs text-slate-500 mt-0.5">Meta: {formatarMoeda(cat.meta_mensal)}/mês</p>
                        ) : (
                          <p className="text-xs text-slate-300 mt-0.5">Sem meta definida</p>
                        )}
                      </div>
                      <button
                        onClick={() => abrirEditarEntrada(s)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                        title="Editar classificação, meta e descrição"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Divisor */}
          <div className="border-t border-slate-100" />

          {/* Sub-seção: Receitas avulsas */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-1 text-emerald-600">
              Receitas Avulsas ({entradasAvulsas.length})
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Aluguel de sala, venda avulsa, etc. Não aparecem em Planos.
            </p>
            {entradasAvulsas.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center border-2 border-dashed border-slate-200 rounded-xl">
                Nenhuma cadastrada. Use "+ Nova Categoria" e escolha Entrada.
              </p>
            ) : (
              <div className="space-y-2">
                {entradasAvulsas.map(c => {
                  const clf = c.classificacao_id ? clfMap.get(c.classificacao_id) : null
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                        c.ativo ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-800">{c.nome}</span>
                          {clf && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700">
                              {clf.nome}
                            </span>
                          )}
                          {!c.ativo && <span className="text-xs text-slate-400">inativa</span>}
                        </div>
                        {c.descricao && <p className="text-xs text-slate-400 mt-0.5 truncate">{c.descricao}</p>}
                        {c.meta_mensal && (
                          <p className="text-xs text-slate-500 mt-0.5">Meta: {formatarMoeda(c.meta_mensal)}/mês</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => { setEditando(c); setShowModal(true) }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleAtivo(c)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                          title={c.ativo ? 'Desativar' : 'Ativar'}
                        >
                          {c.ativo ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setConfirmando(c)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Saídas (Gasto): CRUD manual ── */}
        <div className="card">
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-1 text-red-600">
            Saídas (Gasto) ({saidas.length})
          </h3>
          <p className="text-xs text-slate-400 mb-3">Custos e despesas da clínica.</p>
          {saidas.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center border-2 border-dashed border-slate-200 rounded-xl">
              Nenhuma categoria cadastrada.
            </p>
          ) : (
            <div className="space-y-2">
              {saidas.map(c => {
                const clf = c.classificacao_id ? clfMap.get(c.classificacao_id) : null
                return (
                  <div
                    key={c.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                      c.ativo ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800">{c.nome}</span>
                        {clf ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                            {clf.nome}
                          </span>
                        ) : c.classificacao && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500">
                            {c.classificacao}
                          </span>
                        )}
                        {!c.ativo && <span className="text-xs text-slate-400">inativa</span>}
                      </div>
                      {c.descricao && <p className="text-xs text-slate-400 mt-0.5 truncate">{c.descricao}</p>}
                      {c.meta_mensal && (
                        <p className="text-xs text-slate-500 mt-0.5">Meta: {formatarMoeda(c.meta_mensal)}/mês</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => { setEditando(c); setShowModal(true) }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleAtivo(c)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        title={c.ativo ? 'Desativar' : 'Ativar'}
                      >
                        {c.ativo ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setConfirmando(c)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <CategoriaForm
          editando={editando}
          classificacoes={classificacoes}
          onClose={() => setShowModal(false)}
        />
      )}

      {showClassificacaoModal && (
        <ClassificacaoModal
          classificacoes={classificacoes}
          onClose={() => setShowClassificacaoModal(false)}
        />
      )}

      {/* Modal inline para editar entrada (serviço) */}
      {editandoEntrada && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-800">{editandoEntrada.nome}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Entrada (Receita)</p>
              </div>
              <button onClick={() => setEditandoEntrada(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="label">Classificação</label>
                <select
                  className="input"
                  value={entradaClassificacaoId}
                  onChange={e => setEntradaClassificacaoId(e.target.value)}
                >
                  <option value="">Sem classificação</option>
                  {opcoesEntrada.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
                {opcoesEntrada.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Crie classificações de entrada em "+ Classificação".</p>
                )}
              </div>
              <div>
                <label className="label">Meta mensal (R$)</label>
                <input
                  className="input"
                  placeholder="0,00"
                  value={entradaMeta}
                  onChange={e => setEntradaMeta(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">Meta de receita mensal para este serviço (opcional)</p>
              </div>
              <div>
                <label className="label">Descrição</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  value={entradaDescricao}
                  onChange={e => setEntradaDescricao(e.target.value)}
                  placeholder="Descrição opcional..."
                />
              </div>
              {erroEntrada && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erroEntrada}</p>
              )}
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setEditandoEntrada(null)} className="btn-secondary flex-1" disabled={salvandoEntrada}>Cancelar</button>
              <button onClick={salvarEntrada} disabled={salvandoEntrada} className="btn-primary flex-1">
                {salvandoEntrada ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmando !== null}
        mensagem={`Excluir categoria "${confirmando?.nome}"?`}
        detalhe="Movimentações vinculadas perderão a categoria."
        onConfirmar={() => { excluir(confirmando!); setConfirmando(null) }}
        onCancelar={() => setConfirmando(null)}
      />
    </div>
  )
}
