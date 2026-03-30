'use client'

import { formatarMoeda } from '@/lib/utils'
import { recalcularTodosPacientes, somarConsultas, calcularEconomia } from '@/lib/planos-utils'
import CashbackTimeline from './cashback-timeline'
import type { PlanoWizardState, PlanoPagamento } from '@/types'

interface Step3Props {
  state: PlanoWizardState
  planosPagamento: PlanoPagamento[]
  onChange: (changes: Partial<PlanoWizardState>) => void
}

export default function Step3Revisao({ state, planosPagamento, onChange }: Step3Props) {
  const planoSelecionado = planosPagamento.find(p => p.id === state.plano_pagamento_id) ?? null
  const pacientesCalculados = recalcularTodosPacientes(state.pacientes, planoSelecionado)

  const todasConsultas = pacientesCalculados.flatMap(p => p.consultas)
  const { totalCheio, totalComPlano } = somarConsultas(todasConsultas)
  const { economiaReais, economiaPct } = calcularEconomia(totalCheio, totalComPlano)

  const ativosFiltrados = planosPagamento.filter(p => p.ativo)

  return (
    <div className="space-y-6">
      {/* Selecionar plano de pagamento */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Plano de Pagamento</h3>

        <div className="space-y-2">
          <div>
            <label className="label">Selecione uma regra financeira</label>
            <select
              className="input"
              value={state.plano_pagamento_id ?? ''}
              onChange={e => onChange({ plano_pagamento_id: e.target.value || null })}
            >
              <option value="">Sem plano de pagamento (valores cheios)</option>
              {ativosFiltrados.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nome} — {p.tipo === 'desconto_fixo' && `Desconto ${p.percentual}%`}
                  {p.tipo === 'cashback' && `Cashback ${p.percentual}%`}
                  {p.tipo === 'personalizado' && 'Personalizado'}
                </option>
              ))}
            </select>
          </div>

          {planoSelecionado?.descricao && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              {planoSelecionado.descricao}
            </p>
          )}
        </div>
      </div>

      {/* Resumo financeiro */}
      {todasConsultas.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Resumo Financeiro</h3>

          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Sem plano</p>
              <p className="text-lg font-bold text-slate-800">{formatarMoeda(totalCheio)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <p className="text-xs text-emerald-600 mb-1">Com plano</p>
              <p className="text-lg font-bold text-emerald-700">{formatarMoeda(totalComPlano)}</p>
            </div>
            <div className="bg-brand-50 rounded-xl p-4 text-center">
              <p className="text-xs text-brand-600 mb-1">Economia</p>
              <p className="text-lg font-bold text-brand-700">
                {economiaReais > 0 ? `${economiaPct}%` : '—'}
              </p>
              {economiaReais > 0 && (
                <p className="text-xs text-brand-500">{formatarMoeda(economiaReais)}</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {pacientesCalculados.map((p, i) => (
              <CashbackTimeline
                key={p.tempId}
                consultas={p.consultas}
                plano={planoSelecionado}
                pacienteNome={p.nome || `Paciente ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Resumo do plano */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Resumo do Plano</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-500">Responsável</span>
            <span className="font-medium text-slate-800">{state.responsavel_nome || '—'}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-500">Pacientes</span>
            <span className="font-medium text-slate-800">{state.pacientes.length}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-500">Total de consultas</span>
            <span className="font-medium text-slate-800">{todasConsultas.length}</span>
          </div>
          {state.data_inicio && state.data_fim && (
            <div className="flex justify-between py-1.5 border-b border-slate-50">
              <span className="text-slate-500">Período</span>
              <span className="font-medium text-slate-800">
                {state.data_inicio} → {state.data_fim}
              </span>
            </div>
          )}
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500">Plano de pagamento</span>
            <span className="font-medium text-slate-800">{planoSelecionado?.nome ?? 'Nenhum'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
