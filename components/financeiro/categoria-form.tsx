'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import type { FinCategoria, FinClassificacao } from '@/types'

interface CategoriaFormProps {
  editando: FinCategoria | null
  classificacoes: FinClassificacao[]
  tipoInicial?: 'entrada' | 'saida'
  onClose: () => void
}

export default function CategoriaForm({ editando, classificacoes, tipoInicial = 'saida', onClose }: CategoriaFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [tipo, setTipo] = useState<'entrada' | 'saida'>(editando?.tipo ?? tipoInicial)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [classificacaoId, setClassificacaoId] = useState('')
  const [metaStr, setMetaStr] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  const opcoesClassificacao = classificacoes.filter(c => c.movimentacao === tipo)

  useEffect(() => {
    if (editando) {
      setTipo(editando.tipo)
      setNome(editando.nome)
      setDescricao(editando.descricao ?? '')
      setClassificacaoId(editando.classificacao_id ?? '')
      setMetaStr(editando.meta_mensal ? (editando.meta_mensal / 100).toFixed(2).replace('.', ',') : '')
    }
  }, [editando])

  function handleTipoChange(novoTipo: 'entrada' | 'saida') {
    setTipo(novoTipo)
    setClassificacaoId('')
  }

  async function handleSave() {
    if (!nome.trim()) { setErro('Informe o nome da categoria.'); return }
    setErro('')
    setSaving(true)

    const meta = metaStr ? Math.round(parseFloat(metaStr.replace(',', '.')) * 100) || null : null
    const clf = classificacoes.find(c => c.id === classificacaoId)

    const payload: Record<string, unknown> = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      tipo,
      classificacao: clf?.tipo ?? editando?.classificacao ?? 'variavel',
      classificacao_id: classificacaoId || null,
      meta_mensal: meta,
    }

    // Entradas criadas aqui são receitas avulsas — sem vínculo com serviço
    if (!editando && tipo === 'entrada') {
      payload.servico_id = null
    }

    const { error } = editando
      ? await supabase.from('fin_categorias').update({ ...payload, atualizado_em: new Date().toISOString() }).eq('id', editando.id)
      : await supabase.from('fin_categorias').insert(payload)

    setSaving(false)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }
    router.refresh()
    onClose()
  }

  const isEntrada = tipo === 'entrada'
  const titulo = editando
    ? 'Editar Categoria'
    : isEntrada ? 'Nova Receita Avulsa' : 'Nova Despesa'

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{titulo}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Toggle entrada/saída — apenas ao criar */}
          {!editando && (
            <div>
              <label className="label">Tipo *</label>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleTipoChange('saida')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    !isEntrada ? 'bg-white shadow text-red-700' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Saída (Despesa)
                </button>
                <button
                  type="button"
                  onClick={() => handleTipoChange('entrada')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    isEntrada ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Entrada (Receita)
                </button>
              </div>
              {isEntrada && (
                <p className="text-xs text-slate-400 mt-1.5">
                  Para receitas não vinculadas a serviços clínicos (aluguel de sala, venda avulsa, etc.). Não aparece em Planos.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="label">Nome *</label>
            <input
              className="input"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder={isEntrada ? 'Ex: Aluguel de sala, Venda avulsa...' : 'Ex: Aluguel, Energia...'}
            />
          </div>

          <div>
            <label className="label">Classificação</label>
            <select
              className="input"
              value={classificacaoId}
              onChange={e => setClassificacaoId(e.target.value)}
            >
              <option value="">Sem classificação</option>
              {opcoesClassificacao.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            {opcoesClassificacao.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Nenhuma classificação de {isEntrada ? 'entrada' : 'saída'} cadastrada. Crie em "+ Classificação".
              </p>
            )}
          </div>

          <div>
            <label className="label">Meta mensal (R$)</label>
            <input
              className="input"
              placeholder="0,00"
              value={metaStr}
              onChange={e => setMetaStr(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">
              {isEntrada ? 'Meta de receita mensal (opcional)' : 'Limite de gasto mensal (opcional)'}
            </p>
          </div>

          <div>
            <label className="label">Descrição</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Descrição opcional..."
            />
          </div>

          {erro && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
