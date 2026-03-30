'use client'

import { useState } from 'react'
import { formatarMoeda } from '@/lib/utils'
import { calcularEconomia } from '@/lib/planos-utils'
import PlanoConsultaRow from './plano-consulta-row'
import type { PlanoPaciente, PlanoConsulta } from '@/types'

interface PlanoPacientesViewProps {
  pacientes: PlanoPaciente[]
  antecedenciaMap?: Record<string, number>
}

export default function PlanoPacientesView({ pacientes: initial, antecedenciaMap = {} }: PlanoPacientesViewProps) {
  const [pacientes, setPacientes] = useState(initial)

  function handleConsultaUpdated(pacienteId: string, consultaId: string, changes: Partial<PlanoConsulta>) {
    setPacientes(prev =>
      prev.map(p =>
        p.id === pacienteId
          ? {
              ...p,
              plano_consultas: p.plano_consultas?.map(c =>
                c.id === consultaId ? { ...c, ...changes } : c
              ),
            }
          : p
      )
    )
  }

  if (pacientes.length === 0) {
    return (
      <div className="card text-center py-12 text-slate-400">
        <p className="text-sm">Nenhum paciente neste plano.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {pacientes.map((paciente, pidx) => {
        const consultas = paciente.plano_consultas ?? []
        const totalCheio = consultas.reduce((s, c) => s + c.valor_cheio, 0)
        const totalPago = consultas.reduce((s, c) => s + c.valor_com_plano, 0)
        const realizadas = consultas.filter(c => c.realizada).length
        const { economiaReais, economiaPct } = calcularEconomia(totalCheio, totalPago)

        return (
          <div key={paciente.id} className="card">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{paciente.nome}</h3>
                {paciente.nascimento && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Nasc.: {paciente.nascimento.split('-').reverse().join('/')}
                  </p>
                )}
                {paciente.observacao && (
                  <p className="text-xs text-slate-500 mt-1 italic">{paciente.observacao}</p>
                )}
              </div>

              <div className="text-right text-xs text-slate-500 flex-shrink-0">
                <p>{realizadas}/{consultas.length} consultas realizadas</p>
                {economiaPct > 0 && (
                  <p className="text-emerald-600 font-medium mt-0.5">
                    Economia: {economiaPct}% ({formatarMoeda(economiaReais)})
                  </p>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {consultas.length > 0 && (
              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-4">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(realizadas / consultas.length) * 100}%` }}
                />
              </div>
            )}

            <div className="space-y-2">
              {consultas
                .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
                .map((c, cidx) => (
                  <PlanoConsultaRow
                    key={c.id}
                    consulta={c}
                    index={cidx}
                    antecedencia_dias={c.servico_id ? antecedenciaMap[c.servico_id] ?? 30 : 30}
                    onUpdated={(id, changes) => handleConsultaUpdated(paciente.id, id, changes)}
                  />
                ))}
            </div>

            {consultas.length > 0 && (
              <div className="flex justify-between text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
                <span>Total do paciente</span>
                <div className="flex items-center gap-2">
                  {economiaPct > 0 && (
                    <span className="line-through text-slate-400">{formatarMoeda(totalCheio)}</span>
                  )}
                  <span className="font-semibold text-slate-700">{formatarMoeda(totalPago)}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
