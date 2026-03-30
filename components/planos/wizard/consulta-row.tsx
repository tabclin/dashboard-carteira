'use client'

import { formatarMoeda } from '@/lib/utils'
import { Trash2 } from 'lucide-react'
import type { ConsultaRascunho, Servico } from '@/types'

interface ConsultaRowProps {
  consulta: ConsultaRascunho
  index: number
  servicos: Servico[]
  onUpdate: (tempId: string, changes: Partial<ConsultaRascunho>) => void
  onRemove: (tempId: string) => void
  showCalculado?: boolean
}

export default function ConsultaRow({
  consulta, index, servicos, onUpdate, onRemove, showCalculado = false
}: ConsultaRowProps) {

  function handleServicoChange(servicoId: string) {
    const s = servicos.find(sv => sv.id === servicoId)
    if (s) {
      onUpdate(consulta.tempId, {
        servico_id: s.id,
        servico_nome: s.nome,
        valor_cheio: s.valor_recorrente ?? s.valor_cheio,
      })
    }
  }

  return (
    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Consulta {index + 1}
        </span>
        <button
          onClick={() => onRemove(consulta.tempId)}
          className="text-slate-400 hover:text-red-500 transition-colors p-1"
          title="Remover consulta"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label">Serviço</label>
          <select
            className="input"
            value={consulta.servico_id ?? ''}
            onChange={e => handleServicoChange(e.target.value)}
          >
            <option value="">Selecione...</option>
            {servicos.filter(s => s.ativo).map(s => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Data Sugerida</label>
          <input
            type="date"
            className="input"
            value={consulta.data_sugerida}
            onChange={e => onUpdate(consulta.tempId, { data_sugerida: e.target.value })}
          />
        </div>

        <div>
          <label className="label">Valor Cheio (R$)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            value={consulta.valor_cheio / 100 || ''}
            onChange={e => onUpdate(consulta.tempId, {
              valor_cheio: Math.round(parseFloat(e.target.value || '0') * 100)
            })}
          />
        </div>
      </div>

      <div>
        <label className="label">Observação clínica</label>
        <textarea
          className="input resize-none"
          rows={3}
          placeholder="Ex: Revisão de crescimento, vacinação, etc."
          value={consulta.observacao}
          onChange={e => onUpdate(consulta.tempId, { observacao: e.target.value })}
        />
      </div>

      {showCalculado && consulta.valor_com_plano !== consulta.valor_cheio && (
        <div className="flex items-center gap-3 text-sm bg-white rounded-lg px-3 py-2 border border-emerald-100">
          <span className="text-slate-500 line-through">{formatarMoeda(consulta.valor_cheio)}</span>
          <span className="font-semibold text-emerald-600">{formatarMoeda(consulta.valor_com_plano)}</span>
          {consulta.cashback_gerado > 0 && (
            <span className="text-xs text-purple-600 ml-auto">
              +{formatarMoeda(consulta.cashback_gerado)} cashback
            </span>
          )}
        </div>
      )}
    </div>
  )
}
