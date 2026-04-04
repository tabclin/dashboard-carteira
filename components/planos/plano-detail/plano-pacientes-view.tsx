'use client'

import { useState } from 'react'
import { formatarMoeda, cn } from '@/lib/utils'
import { calcularEconomia } from '@/lib/planos-utils'
import { calcularAlertaConsulta } from '@/lib/planos-utils'
import { ChevronDown, ChevronRight } from 'lucide-react'
import PlanoConsultaRow from './plano-consulta-row'
import type { PlanoPaciente, PlanoConsulta, Servico, Profissional } from '@/types'

interface PlanoPacientesViewProps {
  pacientes: PlanoPaciente[]
  antecedenciaMap?: Record<string, number>
  servicos: Servico[]
  profissionais: Profissional[]
}

export default function PlanoPacientesView({ pacientes: initial, antecedenciaMap = {}, servicos, profissionais }: PlanoPacientesViewProps) {
  const [pacientes, setPacientes] = useState(initial)
  // Todos colapsados por padrão
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})

  function toggleExpandido(id: string) {
    setExpandidos(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function handleConsultaUpdated(pacienteId: string, consultaId: string, changes: Partial<PlanoConsulta>) {
    setPacientes(prev =>
      prev.map(p =>
        p.id === pacienteId
          ? { ...p, plano_consultas: p.plano_consultas?.map(c => c.id === consultaId ? { ...c, ...changes } : c) }
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
    <div className="space-y-3">
      {pacientes.map((paciente) => {
        const consultas = paciente.plano_consultas ?? []
        const totalCheio = consultas.reduce((s, c) => s + c.valor_cheio, 0)
        const totalPago  = consultas.reduce((s, c) => s + c.valor_com_plano, 0)
        const realizadas = consultas.filter(c => c.realizada).length
        const { economiaReais, economiaPct } = calcularEconomia(totalCheio, totalPago)
        const expandido = expandidos[paciente.id] ?? false

        // Detectar se qualquer consulta está atrasada
        const temAtraso = consultas.some(c =>
          calcularAlertaConsulta(
            c.realizada,
            c.data_sugerida,
            c.data_agendamento,
            c.servico_id ? antecedenciaMap[c.servico_id] ?? 30 : 30
          ) === 'atrasado'
        )

        return (
          <div
            key={paciente.id}
            className={cn(
              'card p-0 overflow-hidden transition-all',
              temAtraso && !expandido && 'border-l-4 border-l-red-400'
            )}
          >
            {/* ── Cabeçalho clicável ── */}
            <button
              onClick={() => toggleExpandido(paciente.id)}
              className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-slate-50/70 transition-colors"
            >
              {/* Ícone collapse */}
              <span className="text-slate-400 flex-shrink-0">
                {expandido
                  ? <ChevronDown className="w-4 h-4" />
                  : <ChevronRight className="w-4 h-4" />
                }
              </span>

              {/* Info do paciente */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {temAtraso && (
                    <span
                      className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"
                      title="Há consultas em atraso"
                    />
                  )}
                  <span className="text-sm font-semibold text-slate-800">{paciente.nome}</span>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {paciente.nascimento && (
                    <span className="text-xs text-slate-400">
                      Nasc.: {paciente.nascimento.split('-').reverse().join('/')}
                    </span>
                  )}
                  {paciente.observacao && (
                    <span className="text-xs text-slate-500 italic truncate max-w-xs">
                      {paciente.observacao}
                    </span>
                  )}
                </div>
              </div>

              {/* Contadores — sempre visíveis */}
              <div className="text-right text-xs text-slate-500 flex-shrink-0 space-y-0.5">
                <p className="font-medium">{realizadas}/{consultas.length} consultas realizadas</p>
                {economiaPct > 0 && (
                  <p className="text-emerald-600 font-medium">
                    Economia: {economiaPct}% ({formatarMoeda(economiaReais)})
                  </p>
                )}
              </div>
            </button>

            {/* ── Conteúdo expansível ── */}
            {expandido && (
              <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
                {/* Progress bar */}
                {consultas.length > 0 && (
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${(realizadas / consultas.length) * 100}%` }}
                    />
                  </div>
                )}

                {/* Lista de consultas */}
                <div className="space-y-2">
                  {consultas
                    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
                    .map((c, cidx) => (
                      <PlanoConsultaRow
                        key={c.id}
                        consulta={c}
                        index={cidx}
                        pacienteNome={paciente.nome}
                        antecedencia_dias={c.servico_id ? antecedenciaMap[c.servico_id] ?? 30 : 30}
                        servicos={servicos}
                        profissionais={profissionais}
                        onUpdated={(id, changes) => handleConsultaUpdated(paciente.id, id, changes)}
                      />
                    ))}
                </div>

                {/* Total */}
                {consultas.length > 0 && (
                  <div className="flex justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
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
            )}
          </div>
        )
      })}
    </div>
  )
}
