'use client'

import { useState } from 'react'
import { cn, formatarData } from '@/lib/utils'
import { PlayCircle, RotateCcw, Eye, Clock, Video, Copy, Check } from 'lucide-react'
import StatusBadge from '@/components/agenda/status-badge'
import type { Agendamento, ProntuarioConsulta } from '@/types'

interface Props {
  agendamentos: Agendamento[]
  consultas: ProntuarioConsulta[]
  onIniciar: (ag: Agendamento) => void
  onContinuar: (ag: Agendamento, consulta: ProntuarioConsulta) => void
  onVer: (ag: Agendamento, consulta: ProntuarioConsulta) => void
}

export default function ConsultasListagem({ agendamentos, consultas, onIniciar, onContinuar, onVer }: Props) {
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null)

  function copiarLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/telemedicina/${token}`)
    setLinkCopiado(token)
    setTimeout(() => setLinkCopiado(null), 2000)
  }
  // Ordenar crescente: próximas primeiro (agendadas), depois realizadas, depois canceladas
  const ordenados = [...agendamentos].sort((a, b) => {
    const prioridade = (s: string) => {
      if (s === 'em_consulta') return 0
      if (s === 'agendado' || s === 'confirmado') return 1
      if (s === 'realizado') return 2
      return 3 // faltou, cancelado
    }
    if (prioridade(a.status) !== prioridade(b.status)) return prioridade(a.status) - prioridade(b.status)
    const cmp = a.data.localeCompare(b.data)
    if (cmp !== 0) return cmp
    return a.hora_inicio.localeCompare(b.hora_inicio)
  })

  if (ordenados.length === 0) {
    return (
      <div className="card text-center py-12">
        <Clock className="w-10 h-10 mx-auto text-slate-300 mb-3" />
        <p className="text-slate-500 text-sm font-medium">Nenhuma consulta encontrada</p>
        <p className="text-xs text-slate-400 mt-1">Agendamentos aparecerão aqui quando criados na Agenda.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {ordenados.map(ag => {
        const consulta = consultas.find(c => c.agendamento_id === ag.id) ?? null

        return (
          <div
            key={ag.id}
            className={cn(
              'card flex items-center gap-4 p-4',
              (ag.status === 'cancelado' || ag.status === 'faltou') && 'opacity-50'
            )}
          >
            {/* Data + hora */}
            <div className="flex-shrink-0 w-24">
              <p className="text-sm font-bold text-slate-800 whitespace-nowrap">{formatarData(ag.data)}</p>
              <p className="text-xs text-slate-400">{ag.hora_inicio}</p>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={ag.status} />
                {ag.origem === 'plano' && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded leading-none">
                    Plano
                  </span>
                )}
                {ag.telemedicina && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-sky-600 bg-sky-100 px-1.5 py-0.5 rounded leading-none">
                    <Video className="w-3 h-3" />
                    Telemedicina
                  </span>
                )}
                {ag.servico_nome && (
                  <span className="text-xs text-slate-600">{ag.servico_nome}</span>
                )}
              </div>
              {ag.profissional?.nome && (
                <p className="text-xs text-slate-400 mt-0.5">{ag.profissional.nome}</p>
              )}
              {consulta?.duracao_minutos != null && (
                <p className="text-xs text-slate-400 mt-0.5">Duração: {consulta.duracao_minutos} min</p>
              )}
            </div>

            {/* Botão de ação */}
            <div className="flex-shrink-0 flex items-center gap-2">
              {ag.telemedicina && ag.telemedicina_token && (
                <button
                  onClick={() => copiarLink(ag.telemedicina_token!)}
                  title="Copiar link do paciente"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-sky-200 text-sky-600 hover:bg-sky-50 text-xs font-medium transition-colors"
                >
                  {linkCopiado === ag.telemedicina_token
                    ? <><Check className="w-3.5 h-3.5" /> Copiado</>
                    : <><Copy className="w-3.5 h-3.5" /> Link</>
                  }
                </button>
              )}
              {ag.status === 'agendado' || ag.status === 'confirmado' ? (
                <button
                  onClick={() => onIniciar(ag)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
                >
                  <PlayCircle className="w-4 h-4" />
                  Iniciar
                </button>
              ) : ag.status === 'em_consulta' ? (
                <button
                  onClick={() => onContinuar(ag, consulta!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Continuar
                </button>
              ) : ag.status === 'realizado' && consulta ? (
                <button
                  onClick={() => onVer(ag, consulta)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Ver
                </button>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
