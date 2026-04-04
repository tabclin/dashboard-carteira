'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import StatusBadge, { STATUS_COLOR } from './status-badge'
import AgendamentoModal from './agendamento-modal'
import PlanoBlockModal from './plano-block-modal'
import type { Agendamento, Servico, Profissional } from '@/types'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const HORA_INICIO = 7
const HORA_FIM = 20
const SLOT_MIN = 30 // minutos por slot

interface SemanaViewProps {
  agendamentos: Agendamento[]
  servicos: Servico[]
  profissionais: Profissional[]
}

function isoSemanaInicio(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // Começa na segunda-feira
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDias(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatDiaMes(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function slotToMinutos(hora: number, slot: number): number {
  return hora * 60 + slot * SLOT_MIN
}

function minutoToTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

function minutoFimPadrao(inicio: string): string {
  const [h, m] = inicio.split(':').map(Number)
  const total = h * 60 + m + 30
  return minutoToTime(total)
}

export default function SemanaView({ agendamentos, servicos, profissionais }: SemanaViewProps) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const [semanaInicio, setSemanaInicio] = useState(() => isoSemanaInicio(hoje))
  const [modalAberto, setModalAberto]       = useState(false)
  const [editando, setEditando]             = useState<Agendamento | null>(null)
  const [dataModal, setDataModal]           = useState<string | undefined>()
  const [horaModal, setHoraModal]           = useState<string | undefined>()
  const [planoBlock, setPlanoBlock]         = useState<Agendamento | null>(null)

  const diasSemana = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => addDias(semanaInicio, i)), // Seg-Sáb
  [semanaInicio])

  const slotsHora = useMemo(() =>
    Array.from({ length: (HORA_FIM - HORA_INICIO) * (60 / SLOT_MIN) }, (_, i) => {
      const min = HORA_INICIO * 60 + i * SLOT_MIN
      return { label: i % 2 === 0 ? minutoToTime(min) : '', min }
    }),
  [])

  // Normalizar hora para HH:MM (Supabase TIME retorna "HH:MM:SS")
  function normHora(h: string): string { return h?.slice(0, 5) ?? '' }

  // Agrupar agendamentos por data (normalizando horas)
  const porData = useMemo(() => {
    const map: Record<string, Agendamento[]> = {}
    for (const a of agendamentos) {
      const norm = { ...a, hora_inicio: normHora(a.hora_inicio), hora_fim: normHora(a.hora_fim) }
      if (!map[norm.data]) map[norm.data] = []
      map[norm.data].push(norm)
    }
    return map
  }, [agendamentos])

  function abrirNovo(data: string, hora: string) {
    setEditando(null)
    setDataModal(data)
    setHoraModal(hora)
    setModalAberto(true)
  }

  function abrirEditar(ag: Agendamento) {
    if (ag.origem === 'plano') { setPlanoBlock(ag); return }
    setEditando(ag)
    setDataModal(undefined)
    setHoraModal(undefined)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(null)
  }

  const semanaLabel = `${formatDiaMes(semanaInicio)} — ${formatDiaMes(addDias(semanaInicio, 5))}`

  return (
    <div className="space-y-3">
      {/* Header de navegação */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSemanaInicio(d => addDias(d, -7))}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[140px] text-center">{semanaLabel}</span>
          <button
            onClick={() => setSemanaInicio(d => addDias(d, 7))}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSemanaInicio(isoSemanaInicio(hoje))}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors"
          >
            Hoje
          </button>
        </div>
        <button
          onClick={() => abrirNovo(toISO(hoje), '08:00')}
          className="btn-primary text-sm"
        >
          <Plus className="w-4 h-4" /> Novo agendamento
        </button>
      </div>

      {/* Grade do calendário */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: '700px' }}>
            {/* Cabeçalho de dias */}
            <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: '56px repeat(6, 1fr)' }}>
              <div className="py-2" /> {/* coluna de horário */}
              {diasSemana.map((dia, i) => {
                const iso = toISO(dia)
                const isHoje = iso === toISO(hoje)
                return (
                  <div
                    key={i}
                    className={cn(
                      'py-2 px-1 text-center border-l border-slate-100',
                      isHoje && 'bg-brand-50'
                    )}
                  >
                    <p className={cn('text-xs font-medium', isHoje ? 'text-brand-600' : 'text-slate-500')}>
                      {DIAS[(semanaInicio.getDay() + i) % 7]}
                    </p>
                    <p className={cn(
                      'text-sm font-bold leading-tight',
                      isHoje ? 'text-brand-700' : 'text-slate-700'
                    )}>
                      {dia.getDate()}
                    </p>
                    <p className="text-[10px] text-slate-400">{porData[iso]?.length ?? 0} ag.</p>
                  </div>
                )
              })}
            </div>

            {/* Slots de horário */}
            <div className="relative">
              {slotsHora.map((slot, si) => (
                <div
                  key={si}
                  className="grid border-b border-slate-50"
                  style={{ gridTemplateColumns: '56px repeat(6, 1fr)', minHeight: '32px' }}
                >
                  {/* Label de hora */}
                  <div className="px-2 flex items-start pt-0.5">
                    {slot.label && (
                      <span className="text-[10px] text-slate-400 leading-none">{slot.label}</span>
                    )}
                  </div>

                  {/* Célula de cada dia */}
                  {diasSemana.map((dia, di) => {
                    const iso = toISO(dia)
                    const isHoje = iso === toISO(hoje)
                    const hora = minutoToTime(slot.min)

                    // Agendamentos que começam neste slot
                    const ags = (porData[iso] ?? []).filter(a => a.hora_inicio === hora)

                    return (
                      <div
                        key={di}
                        className={cn(
                          'border-l border-slate-100 relative group cursor-pointer',
                          isHoje && 'bg-brand-50/30',
                          'hover:bg-slate-50 transition-colors'
                        )}
                        onClick={() => abrirNovo(iso, hora)}
                      >
                        {/* Botão de adicionar ao hover */}
                        {ags.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="w-3 h-3 text-slate-300" />
                          </div>
                        )}

                        {/* Blocos de agendamento */}
                        {ags.map(ag => {
                          const [h1, m1] = ag.hora_inicio.split(':').map(Number)
                          const [h2, m2] = ag.hora_fim.split(':').map(Number)
                          const duracaoSlots = Math.max(1, Math.ceil(((h2 * 60 + m2) - (h1 * 60 + m1)) / SLOT_MIN))

                          return (
                            <div
                              key={ag.id}
                              onClick={e => { e.stopPropagation(); abrirEditar(ag) }}
                              className="absolute left-0.5 right-0.5 top-0.5 rounded-md px-1.5 py-0.5 cursor-pointer hover:brightness-95 transition-all z-10 overflow-hidden"
                              style={{
                                backgroundColor: STATUS_COLOR[ag.status] + '22',
                                borderLeft: `3px solid ${STATUS_COLOR[ag.status]}`,
                                minHeight: `${duracaoSlots * 32 - 2}px`,
                              }}
                              title={`${ag.hora_inicio}–${ag.hora_fim} · ${ag.paciente_nome}`}
                            >
                              <div className="flex items-center gap-1 flex-wrap">
                                <p className="text-[10px] font-semibold text-slate-800 leading-tight truncate">{ag.paciente_nome}</p>
                                {ag.origem === 'plano' && (
                                  <span className="text-[8px] font-bold uppercase tracking-wide text-violet-600 bg-violet-100 px-1 py-0.5 rounded leading-none shrink-0">plano</span>
                                )}
                              </div>
                              {ag.servico_nome && (
                                <p className="text-[10px] text-slate-500 truncate leading-tight">{ag.servico_nome}</p>
                              )}
                              <StatusBadge status={ag.status} size="xs" />
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de agendamento normal */}
      {modalAberto && (
        <AgendamentoModal
          editando={editando}
          dataInicial={dataModal}
          horaInicial={horaModal}
          servicos={servicos}
          profissionais={profissionais}
          onClose={fecharModal}
        />
      )}

      {/* Modal de bloqueio para agendamentos de plano */}
      {planoBlock && (
        <PlanoBlockModal
          agendamento={planoBlock}
          onCancelar={() => setPlanoBlock(null)}
        />
      )}
    </div>
  )
}
