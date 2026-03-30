'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import type { PlanoPagamento, PlanoPagamentoTipo } from '@/types'

const TIPO_LABELS: Record<PlanoPagamentoTipo, string> = {
  desconto_fixo: 'Desconto Fixo (%)',
  cashback:      'Cashback (%)',
  personalizado: 'Personalizado',
}

interface PagamentoFormProps {
  plano?: PlanoPagamento | null
  onClose: () => void
  onSaved: () => void
}

export default function PagamentoForm({ plano, onClose, onSaved }: PagamentoFormProps) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  const [nome, setNome] = useState(plano?.nome ?? '')
  const [tipo, setTipo] = useState<PlanoPagamentoTipo>(plano?.tipo ?? 'desconto_fixo')
  const [percentual, setPercentual] = useState(plano?.percentual?.toString() ?? '')
  const [descricao, setDescricao] = useState(plano?.descricao ?? '')

  const precisaPercentual = tipo !== 'personalizado'

  async function handleSave() {
    if (!nome.trim()) { setErro('Nome é obrigatório.'); return }
    if (precisaPercentual && (!percentual || Number(percentual) <= 0)) {
      setErro('Informe o percentual.'); return
    }

    setSaving(true)
    setErro('')

    const payload = {
      nome: nome.trim(),
      tipo,
      percentual: precisaPercentual ? Number(percentual) : null,
      descricao: descricao.trim() || null,
    }

    const { error } = plano
      ? await supabase.from('planos_pagamento').update(payload).eq('id', plano.id)
      : await supabase.from('planos_pagamento').insert(payload)

    setSaving(false)
    if (error) { setErro(error.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {plano ? 'Editar Plano de Pagamento' : 'Novo Plano de Pagamento'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Nome *</label>
            <input className="input" value={nome} onChange={e => setNome(e.target.value)}
              placeholder="Ex: Plano Família Premium" />
          </div>

          <div>
            <label className="label">Tipo *</label>
            <select className="input" value={tipo} onChange={e => setTipo(e.target.value as PlanoPagamentoTipo)}>
              {(Object.keys(TIPO_LABELS) as PlanoPagamentoTipo[]).map(t => (
                <option key={t} value={t}>{TIPO_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {precisaPercentual && (
            <div>
              <label className="label">
                {tipo === 'cashback' ? 'Percentual de Cashback (%)' : 'Percentual de Desconto (%)'}
              </label>
              <input className="input" type="number" min="0" max="100" step="0.5"
                value={percentual} onChange={e => setPercentual(e.target.value)}
                placeholder="Ex: 15" />
              {tipo === 'cashback' && (
                <p className="text-xs text-slate-400 mt-1">
                  O cashback acumula a cada consulta e é abatido automaticamente na próxima.
                </p>
              )}
            </div>
          )}

          {tipo === 'personalizado' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-sm text-amber-700">
                No tipo personalizado, os valores de cada consulta são definidos manualmente no wizard.
              </p>
            </div>
          )}

          <div>
            <label className="label">Descrição</label>
            <textarea className="input resize-none" rows={2} value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Explique como este plano funciona para apresentar ao responsável" />
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
