'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import type { FinMovimentacao, FinCategoria } from '@/types'

function parseCentavos(v: string): number {
  const s = v.trim().replace(/R\$\s?/g, '')
  if (/\d,\d{1,2}$/.test(s)) {
    return Math.round(parseFloat(s.replace(/\./g, '').replace(',', '.')) * 100) || 0
  }
  return Math.round(parseFloat(s.replace(/,/g, '')) * 100) || 0
}

function hoje() {
  return new Date().toISOString().split('T')[0]
}

interface MovimentacaoFormProps {
  editando: FinMovimentacao | null
  categorias: FinCategoria[]
  onClose: () => void
}

export default function MovimentacaoForm({ editando, categorias, onClose }: MovimentacaoFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const [descricao, setDescricao] = useState('')
  const [valorStr, setValorStr] = useState('')
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('saida')
  const [categoriaId, setCategoriaId] = useState('')
  const [dataCompetencia, setDataCompetencia] = useState(hoje())
  const [dataCaixa, setDataCaixa] = useState('')
  const [observacao, setObservacao] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (editando) {
      setDescricao(editando.descricao)
      setValorStr((editando.valor / 100).toFixed(2).replace('.', ','))
      setTipo(editando.tipo)
      setCategoriaId(editando.categoria_id ?? '')
      setDataCompetencia(editando.data_competencia)
      setDataCaixa(editando.data_caixa ?? '')
      setObservacao(editando.observacao ?? '')
    }
  }, [editando])

  const categoriasFiltradas = categorias.filter(c => c.ativo && c.tipo === tipo)

  async function handleSave() {
    if (!descricao.trim()) { setErro('Informe a descrição.'); return }
    const valor = parseCentavos(valorStr)
    if (!valor || valor <= 0) { setErro('Informe um valor válido.'); return }
    if (!dataCompetencia) { setErro('Informe a data de competência.'); return }
    setErro('')
    setSaving(true)

    const payload = {
      descricao: descricao.trim(),
      valor,
      tipo,
      categoria_id: categoriaId || null,
      data_competencia: dataCompetencia,
      data_caixa: dataCaixa || null,
      observacao: observacao.trim() || null,
    }

    const { error } = editando
      ? await supabase.from('fin_movimentacoes').update({ ...payload, atualizado_em: new Date().toISOString() }).eq('id', editando.id)
      : await supabase.from('fin_movimentacoes').insert({ ...payload, origem: 'manual' })

    setSaving(false)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-slate-800">
            {editando ? 'Editar Movimentação' : 'Nova Movimentação'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tipo */}
          <div>
            <label className="label">Tipo *</label>
            <div className="flex gap-2">
              {(['entrada', 'saida'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTipo(t); setCategoriaId('') }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                    tipo === t
                      ? t === 'entrada'
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                        : 'bg-red-500 text-white border-red-500 shadow-sm'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {t === 'entrada' ? '↑ Receita' : '↓ Despesa'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Descrição *</label>
              <input
                className="input"
                placeholder="Ex: Pagamento aluguel, Consulta paciente..."
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Valor (R$) *</label>
              <input
                className="input"
                placeholder="0,00"
                value={valorStr}
                onChange={e => setValorStr(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Categoria</label>
              <select
                className="input"
                value={categoriaId}
                onChange={e => setCategoriaId(e.target.value)}
              >
                <option value="">Sem categoria</option>
                {categoriasFiltradas.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.classificacao})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Data de Competência *</label>
              <input
                type="date"
                className="input"
                value={dataCompetencia}
                onChange={e => setDataCompetencia(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Data de Pagamento</label>
              <input
                type="date"
                className="input"
                value={dataCaixa}
                onChange={e => setDataCaixa(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">Vazio = pendente</p>
            </div>

            <div className="col-span-2">
              <label className="label">Observação</label>
              <textarea
                className="input resize-none"
                rows={2}
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                placeholder="Observações opcionais..."
              />
            </div>
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
