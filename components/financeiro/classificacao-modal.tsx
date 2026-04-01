'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import type { FinClassificacao } from '@/types'

interface ClassificacaoModalProps {
  classificacoes: FinClassificacao[]
  onClose: () => void
}

const TIPO_LABEL: Record<string, string> = { fixo: 'Fixo', variavel: 'Variável' }
const MOV_LABEL: Record<string, string> = { entrada: 'Entrada', saida: 'Saída' }

export default function ClassificacaoModal({ classificacoes, onClose }: ClassificacaoModalProps) {
  const router = useRouter()
  const supabase = createClient()

  const [editando, setEditando] = useState<FinClassificacao | null>(null)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<'fixo' | 'variavel'>('variavel')
  const [movimentacao, setMovimentacao] = useState<'entrada' | 'saida'>('saida')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmando, setConfirmando] = useState<FinClassificacao | null>(null)

  function iniciarNova() {
    setEditando(null)
    setNome('')
    setTipo('variavel')
    setMovimentacao('saida')
    setErro('')
  }

  function iniciarEditar(c: FinClassificacao) {
    setEditando(c)
    setNome(c.nome)
    setTipo(c.tipo)
    setMovimentacao(c.movimentacao)
    setErro('')
  }

  async function salvar() {
    if (!nome.trim()) { setErro('Informe o nome.'); return }
    setSaving(true)
    setErro('')

    const payload = { nome: nome.trim(), tipo, movimentacao }
    const { error } = editando
      ? await supabase.from('fin_classificacoes').update(payload).eq('id', editando.id)
      : await supabase.from('fin_classificacoes').insert(payload)

    setSaving(false)
    if (error) { setErro('Erro: ' + error.message); return }
    router.refresh()
    iniciarNova()
  }

  async function excluir(c: FinClassificacao) {
    await supabase.from('fin_classificacoes').delete().eq('id', c.id)
    router.refresh()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Gerenciar Classificações</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          {/* ── Lista de classificações ── */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Classificações ({classificacoes.length})</p>
              <button onClick={iniciarNova} className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Nova
              </button>
            </div>

            {classificacoes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                Nenhuma classificação ainda.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {classificacoes.map(c => (
                  <div
                    key={c.id}
                    className={cn(
                      'flex items-center gap-2 p-2.5 rounded-xl border transition-colors',
                      editando?.id === c.id ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{c.nome}</p>
                      <div className="flex gap-2 mt-0.5">
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded font-medium',
                          c.tipo === 'fixo' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'
                        )}>
                          {TIPO_LABEL[c.tipo]}
                        </span>
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded font-medium',
                          c.movimentacao === 'entrada' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        )}>
                          {MOV_LABEL[c.movimentacao]}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => iniciarEditar(c)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmando(c)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Formulário ── */}
          <div className="p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              {editando ? `Editando: ${editando.nome}` : 'Nova Classificação'}
            </p>

            <div className="space-y-3">
              <div>
                <label className="label">Nome *</label>
                <input
                  className="input"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Custo Fixo, Impostos..."
                />
              </div>

              <div>
                <label className="label">Tipo *</label>
                <div className="flex gap-2">
                  {(['fixo', 'variavel'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTipo(t)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                        tipo === t
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      )}
                    >
                      {t === 'fixo' ? 'Fixo' : 'Variável'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Movimentação *</label>
                <div className="flex gap-2">
                  {(['entrada', 'saida'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setMovimentacao(m)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                        movimentacao === m
                          ? m === 'entrada'
                            ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-red-500 text-white border-red-500'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      )}
                    >
                      {m === 'entrada' ? '↑ Entrada' : '↓ Saída'}
                    </button>
                  ))}
                </div>
              </div>

              {erro && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}

              <div className="flex gap-2 pt-1">
                {editando && (
                  <button onClick={iniciarNova} className="btn-secondary flex-1 text-sm">Cancelar</button>
                )}
                <button onClick={salvar} disabled={saving} className="btn-primary flex-1 text-sm">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : editando ? 'Salvar Alterações' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmando !== null}
        mensagem={`Excluir classificação "${confirmando?.nome}"?`}
        detalhe="Categorias vinculadas perderão a classificação."
        onConfirmar={() => { excluir(confirmando!); setConfirmando(null) }}
        onCancelar={() => setConfirmando(null)}
      />
    </div>
  )
}
