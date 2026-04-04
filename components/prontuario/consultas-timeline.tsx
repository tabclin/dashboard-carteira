'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, formatarData } from '@/lib/utils'
import { ChevronDown, ChevronUp, Pencil, Pill, PlayCircle, StopCircle, Loader2, Clock } from 'lucide-react'
import ConsultaForm from './consulta-form'
import ConsultaTimer from './consulta-timer'
import type { ProntuarioConsulta } from '@/types'

interface ConsultasTimelineProps {
  consultas: ProntuarioConsulta[]
  prontuarioId: string
  pacienteNome: string
}

export default function ConsultasTimeline({ consultas, prontuarioId, pacienteNome }: ConsultasTimelineProps) {
  const supabase = createClient()
  const router   = useRouter()

  const [modalAberto, setModalAberto]   = useState(false)
  const [editando, setEditando]         = useState<ProntuarioConsulta | null>(null)
  const [expandidas, setExpandidas]     = useState<Set<string>>(new Set())
  const [iniciando, setIniciando]       = useState(false)
  const [finalizando, setFinalizando]   = useState(false)

  const consultaAtiva = consultas.find(c => c.status === 'em_atendimento') ?? null

  function toggleExpand(id: string) {
    setExpandidas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function abrirEditar(c: ProntuarioConsulta) {
    setEditando(c)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(null)
  }

  async function iniciarConsulta() {
    setIniciando(true)
    await supabase.from('prontuario_consultas').insert({
      prontuario_id: prontuarioId,
      data:          new Date().toISOString().slice(0, 10),
      status:        'em_atendimento',
      iniciado_em:   new Date().toISOString(),
    })
    setIniciando(false)
    router.refresh()
  }

  async function finalizarConsulta() {
    if (!consultaAtiva) return
    setFinalizando(true)
    const agora  = new Date()
    const inicio = new Date(consultaAtiva.iniciado_em!)
    const duracao = Math.round((agora.getTime() - inicio.getTime()) / 60000)
    await supabase.from('prontuario_consultas')
      .update({
        status:          'finalizado',
        finalizado_em:   agora.toISOString(),
        duracao_minutos: duracao,
        atualizado_em:   agora.toISOString(),
      })
      .eq('id', consultaAtiva.id)
    setFinalizando(false)
    router.refresh()
  }

  const CAMPOS_LABELS: { key: keyof ProntuarioConsulta; label: string }[] = [
    { key: 'queixa_principal',      label: 'Queixa principal' },
    { key: 'historia_doenca_atual', label: 'História da doença' },
    { key: 'exame_fisico',          label: 'Exame físico' },
    { key: 'hipotese_diagnostica',  label: 'Hipótese diagnóstica' },
    { key: 'conduta',               label: 'Conduta' },
    { key: 'evolucao',              label: 'Evolução' },
  ]

  return (
    <div className="space-y-4">
      {/* Barra de atendimento ativo */}
      {consultaAtiva && (
        <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <span className="text-sm font-semibold text-emerald-800">Em atendimento</span>
            <ConsultaTimer iniciado_em={consultaAtiva.iniciado_em!} />
          </div>
          <button
            onClick={finalizarConsulta}
            disabled={finalizando}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-70"
          >
            {finalizando
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <StopCircle className="w-4 h-4" />
            }
            Finalizar consulta
          </button>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {consultas.length} consulta{consultas.length !== 1 ? 's' : ''} registrada{consultas.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={iniciarConsulta}
          disabled={!!consultaAtiva || iniciando}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
            consultaAtiva || iniciando
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-brand-500 hover:bg-brand-600 text-white'
          )}
        >
          {iniciando
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <PlayCircle className="w-4 h-4" />
          }
          {consultaAtiva ? 'Consulta em andamento' : 'Iniciar consulta'}
        </button>
      </div>

      {/* Lista */}
      {consultas.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-500 text-sm">Nenhuma consulta registrada ainda.</p>
          <p className="text-xs text-slate-400 mt-1">Clique em "Iniciar consulta" para criar o primeiro registro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {consultas.map(c => {
            const aberta      = expandidas.has(c.id)
            const temConteudo = CAMPOS_LABELS.some(f => (c as any)[f.key])
            const prescricoes = c.prescricoes ?? []
            const finalizado  = c.status === 'finalizado'
            const emAndamento = c.status === 'em_atendimento'

            return (
              <div
                key={c.id}
                className={cn(
                  'card p-0 overflow-hidden',
                  finalizado && 'opacity-90'
                )}
              >
                {/* Cabeçalho do card */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleExpand(c.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{formatarData(c.data)}</span>
                      {c.profissional_nome && (
                        <span className="text-xs text-slate-500">· {c.profissional_nome}</span>
                      )}

                      {/* Badge de status */}
                      {finalizado && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                          <Clock className="w-2.5 h-2.5" />
                          Finalizado
                          {c.duracao_minutos != null && ` · ${c.duracao_minutos} min`}
                        </span>
                      )}
                      {emAndamento && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Em andamento
                        </span>
                      )}

                      {prescricoes.length > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">
                          <Pill className="w-3 h-3" /> {prescricoes.length} prescrição{prescricoes.length !== 1 ? 'ões' : ''}
                        </span>
                      )}
                    </div>
                    {c.queixa_principal && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{c.queixa_principal}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Botão de editar — oculto para finalizado */}
                    {!finalizado && (
                      <button
                        onClick={e => { e.stopPropagation(); abrirEditar(c) }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {/* Botão de visualizar para finalizado */}
                    {finalizado && (
                      <button
                        onClick={e => { e.stopPropagation(); abrirEditar(c) }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Visualizar"
                      >
                        <Pencil className="w-3.5 h-3.5 opacity-40" />
                      </button>
                    )}
                    {temConteudo && (
                      aberta
                        ? <ChevronUp className="w-4 h-4 text-slate-400" />
                        : <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Detalhes expandidos */}
                {aberta && (
                  <div className="border-t border-slate-100 px-4 py-4 space-y-3">
                    {CAMPOS_LABELS.filter(f => (c as any)[f.key]).map(({ key, label }) => (
                      <div key={key}>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{(c as any)[key]}</p>
                      </div>
                    ))}

                    {prescricoes.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Prescrições</p>
                        <div className="space-y-2">
                          {prescricoes.map((p, i) => (
                            <div key={p.id ?? i} className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                              <p className="text-sm font-semibold text-slate-800">{p.medicamento}</p>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                {p.dosagem    && <span className="text-xs text-slate-600">{p.dosagem}</span>}
                                {p.frequencia && <span className="text-xs text-slate-600">{p.frequencia}</span>}
                                {p.duracao    && <span className="text-xs text-slate-600">por {p.duracao}</span>}
                              </div>
                              {p.instrucoes && (
                                <p className="text-xs text-slate-500 mt-0.5 italic">{p.instrucoes}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <ConsultaForm
          prontuarioId={prontuarioId}
          editando={editando}
          onClose={fecharModal}
        />
      )}
    </div>
  )
}
