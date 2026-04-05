'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import type { Servico } from '@/types'

interface ServicoFormProps {
  servico?: Servico | null
  onClose: () => void
  onSaved: () => void
}

export default function ServicoForm({ servico, onClose, onSaved }: ServicoFormProps) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  const [nome, setNome] = useState(servico?.nome ?? '')
  const [descricao, setDescricao] = useState(servico?.descricao ?? '')
  const [valorCheio, setValorCheio] = useState(
    servico ? (servico.valor_cheio / 100).toFixed(2) : ''
  )
  const [valorRecorrente, setValorRecorrente] = useState(
    servico?.valor_recorrente != null ? (servico.valor_recorrente / 100).toFixed(2) : ''
  )
  const [antecedenciaDias, setAntecedenciaDias] = useState(
    String(servico?.antecedencia_dias ?? 30)
  )
  const [duracaoMinutos, setDuracaoMinutos] = useState(
    servico?.duracao_minutos != null ? String(servico.duracao_minutos) : ''
  )

  function parseBRL(v: string): number {
    return Math.round(parseFloat(v.replace(',', '.')) * 100) || 0
  }

  async function handleSave() {
    if (!nome.trim()) { setErro('Nome é obrigatório.'); return }
    if (!valorCheio || parseBRL(valorCheio) <= 0) { setErro('Valor cheio inválido.'); return }

    setSaving(true)
    setErro('')

    const payload = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      valor_cheio: parseBRL(valorCheio),
      valor_recorrente: valorRecorrente ? parseBRL(valorRecorrente) : null,
      antecedencia_dias: Math.max(1, parseInt(antecedenciaDias, 10) || 30),
      duracao_minutos: duracaoMinutos ? Math.max(1, parseInt(duracaoMinutos, 10) || 30) : null,
    }

    const { error } = servico
      ? await supabase.from('servicos').update(payload).eq('id', servico.id)
      : await supabase.from('servicos').insert(payload)

    setSaving(false)
    if (error) { setErro(error.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {servico ? 'Editar Serviço' : 'Novo Serviço'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Nome do serviço *</label>
            <input className="input" value={nome} onChange={e => setNome(e.target.value)}
              placeholder="Ex: Consulta Pediátrica" />
          </div>

          <div>
            <label className="label">Descrição</label>
            <textarea className="input resize-none" rows={2} value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Breve descrição (opcional)" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor cheio (R$) *</label>
              <input className="input" type="number" min="0" step="0.01"
                value={valorCheio} onChange={e => setValorCheio(e.target.value)}
                placeholder="600,00" />
            </div>
            <div>
              <label className="label">Valor recorrente (R$)</label>
              <input className="input" type="number" min="0" step="0.01"
                value={valorRecorrente} onChange={e => setValorRecorrente(e.target.value)}
                placeholder="500,00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Antecedência (dias)</label>
              <input className="input" type="number" min="1" step="1"
                value={antecedenciaDias} onChange={e => setAntecedenciaDias(e.target.value)}
                placeholder="30" />
              <p className="text-xs text-slate-400 mt-1">
                Dias de antecedência para agendamento
              </p>
            </div>
            <div>
              <label className="label">Duração (min)</label>
              <input className="input" type="number" min="1" step="1"
                value={duracaoMinutos} onChange={e => setDuracaoMinutos(e.target.value)}
                placeholder="30" />
              <p className="text-xs text-slate-400 mt-1">
                Tempo médio da consulta/serviço
              </p>
            </div>
          </div>

          {erro && <p className="text-sm text-red-500">{erro}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 pb-5">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
