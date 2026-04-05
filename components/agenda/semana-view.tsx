'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus, Settings } from 'lucide-react'
import StatusBadge, { STATUS_COLOR } from './status-badge'
import AgendamentoModal from './agendamento-modal'
import PlanoBlockModal from './plano-block-modal'
import AgendaConfigModal from './agenda-config-modal'
import type { Agendamento, Servico, Profissional, AgendaConfig, AgendaBloqueio } from '@/types'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DEFAULT_SLOT_MIN = 30
const ROW_H = 32 // px por slot

interface SemanaViewProps {
  agendamentos: Agendamento[]
  servicos: Servico[]
  profissionais: Profissional[]
}

function isoSemanaInicio(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}
function addDias(date: Date, n: number): Date {
  const d = new Date(date); d.setDate(d.getDate() + n); return d
}
function toISO(date: Date): string { return date.toISOString().slice(0, 10) }
function formatDiaMes(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
function minutoToTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}
function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Greedy column assignment: atribui col e totalCols para layout lado a lado
function computeColumns<T extends { hora_inicio: string; hora_fim: string; id: string }>(
  ags: T[]
): (T & { col: number; totalCols: number })[] {
  if (!ags.length) return []
  const sorted = [...ags].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
  const colEndTimes: string[] = []
  const colAssigned: number[] = []

  for (const ag of sorted) {
    let col = colEndTimes.findIndex(end => end <= ag.hora_inicio)
    if (col === -1) col = colEndTimes.length
    colEndTimes[col] = ag.hora_fim
    colAssigned.push(col)
  }

  return sorted.map((ag, i) => {
    // totalCols = max col index entre todos que se sobrepõem com este + 1
    let maxCol = colAssigned[i]
    for (let j = 0; j < sorted.length; j++) {
      if (i !== j &&
          sorted[j].hora_inicio < ag.hora_fim &&
          sorted[j].hora_fim    > ag.hora_inicio) {
        maxCol = Math.max(maxCol, colAssigned[j])
      }
    }
    return { ...ag, col: colAssigned[i], totalCols: maxCol + 1 }
  })
}

const DEFAULT_CONFIG: AgendaConfig = {
  id: '', hora_inicio: '07:00', hora_fim: '20:00', dias_ativos: [1, 2, 3, 4, 5, 6], slot_min: DEFAULT_SLOT_MIN,
}

export default function SemanaView({ agendamentos, servicos, profissionais }: SemanaViewProps) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)

  const [semanaInicio, setSemanaInicio] = useState(() => isoSemanaInicio(hoje))
  const [modalAberto, setModalAberto]   = useState(false)
  const [editando, setEditando]         = useState<Agendamento | null>(null)
  const [dataModal, setDataModal]       = useState<string | undefined>()
  const [horaModal, setHoraModal]       = useState<string | undefined>()
  const [planoBlock, setPlanoBlock]     = useState<Agendamento | null>(null)
  const [configAberto, setConfigAberto] = useState(false)
  const [config, setConfig]             = useState<AgendaConfig>(DEFAULT_CONFIG)
  const [bloqueios, setBloqueios]       = useState<AgendaBloqueio[]>([])
  const [hoveredDi, setHoveredDi]       = useState<number | null>(null)
  const [hoveredSi, setHoveredSi]       = useState<number | null>(null)

  async function fetchConfig() {
    const supabase = createClient()
    const { data: cfg } = await supabase.from('agenda_config').select('*').maybeSingle()
    if (cfg) setConfig(cfg)
    const { data: bl } = await supabase.from('agenda_bloqueios').select('*').order('data_inicio')
    setBloqueios(bl ?? [])
  }

  useEffect(() => { fetchConfig() }, [])

  function fecharConfigModal() {
    setConfigAberto(false)
    fetchConfig() // sempre re-sincroniza ao fechar, independente do caminho
  }

  const diasSemana = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => addDias(semanaInicio, i)), [semanaInicio])

  const horaInicioMin = useMemo(() => timeToMin(config.hora_inicio), [config])
  const horaFimMin    = useMemo(() => timeToMin(config.hora_fim), [config])

  const slotMin = config.slot_min ?? DEFAULT_SLOT_MIN

  const slotsHora = useMemo(() => {
    const n = (horaFimMin - horaInicioMin) / slotMin
    // Mostrar label a cada 60 min (independente do slot)
    return Array.from({ length: n }, (_, i) => {
      const min = horaInicioMin + i * slotMin
      return { label: (min % 60 === 0) ? minutoToTime(min) : '', min }
    })
  }, [horaInicioMin, horaFimMin, slotMin])

  const totalGridH = slotsHora.length * ROW_H

  function normHora(h: string): string { return h?.slice(0, 5) ?? '' }

  // Agrupa e enriquece com col/totalCols por dia
  const porData = useMemo(() => {
    const raw: Record<string, Agendamento[]> = {}
    for (const a of agendamentos) {
      const norm = { ...a, hora_inicio: normHora(a.hora_inicio), hora_fim: normHora(a.hora_fim) }
      if (!raw[norm.data]) raw[norm.data] = []
      raw[norm.data].push(norm)
    }
    const result: Record<string, ReturnType<typeof computeColumns<Agendamento>>> = {}
    for (const iso in raw) result[iso] = computeColumns(raw[iso])
    return result
  }, [agendamentos])

  // Converte "YYYY-MM-DD" (ou "YYYY-MM-DDT...") em inteiro 20260407
  // Evita qualquer problema de timezone ou formato retornado pelo Supabase
  function dateNum(d: string): number {
    return parseInt((d ?? '').slice(0, 10).replace(/-/g, ''), 10) || 0
  }

  function isDiaBloqueado(iso: string): AgendaBloqueio | undefined {
    const n = dateNum(iso)
    return bloqueios.find(b =>
      !b.hora_inicio &&
      n >= dateNum(b.data_inicio) &&
      n <= dateNum(b.data_fim)
    )
  }

  function abrirNovo(data: string, hora: string) {
    if (isDiaBloqueado(data)) return   // guarda: dia bloqueado não abre modal
    setEditando(null); setDataModal(data); setHoraModal(hora); setModalAberto(true)
  }
  function abrirEditar(ag: Agendamento) {
    if (ag.origem === 'plano') { setPlanoBlock(ag); return }
    setEditando(ag); setDataModal(undefined); setHoraModal(undefined); setModalAberto(true)
  }
  function fecharModal() { setModalAberto(false); setEditando(null) }

  const semanaLabel = `${formatDiaMes(semanaInicio)} — ${formatDiaMes(addDias(semanaInicio, 5))}`

  return (
    <div className="space-y-3">
      {/* Navegação */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => setSemanaInicio(d => addDias(d, -7))}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[140px] text-center">{semanaLabel}</span>
          <button onClick={() => setSemanaInicio(d => addDias(d, 7))}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setSemanaInicio(isoSemanaInicio(hoje))}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors">
            Hoje
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setConfigAberto(true)}
            className="flex items-center gap-1.5 text-sm border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 text-slate-600 transition-colors">
            <Settings className="w-4 h-4" />
            Config. Agenda
          </button>
          <button onClick={() => abrirNovo(toISO(hoje), config.hora_inicio)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Novo agendamento
          </button>
        </div>
      </div>

      {/* Grade */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: '700px' }}>

            {/* Cabeçalho dias */}
            <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: '56px repeat(6, 1fr)' }}>
              <div className="py-2" />
              {diasSemana.map((dia, i) => {
                const iso = toISO(dia)
                const isHoje = iso === toISO(hoje)
                const ehAtivo = config.dias_ativos.includes(dia.getDay())
                const bloqueio = isDiaBloqueado(iso)
                const ehPassado = iso < toISO(hoje)
                const isHovered = hoveredDi === i
                return (
                  <div key={i} className={cn(
                    'py-2 px-1 text-center border-l border-slate-100 transition-colors',
                    isHoje && 'bg-brand-50',
                    (!ehAtivo || bloqueio || ehPassado) && !isHoje && 'bg-slate-50 opacity-60',
                    isHovered && !isHoje && ehAtivo && !bloqueio && !ehPassado && 'bg-sky-50',
                  )}>
                    <p className={cn('text-xs font-medium', isHoje ? 'text-brand-600' : 'text-slate-500')}>
                      {DIAS[(semanaInicio.getDay() + i) % 7]}
                    </p>
                    <p className={cn('text-sm font-bold leading-tight', isHoje ? 'text-brand-700' : 'text-slate-700')}>
                      {dia.getDate()}
                    </p>
                    {bloqueio ? (
                      <p className="text-[9px] font-medium text-red-500 mt-0.5">{bloqueio.motivo ?? 'Bloqueado'}</p>
                    ) : (
                      <p className="text-[10px] text-slate-400">{porData[iso]?.length ?? 0} ag.</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Área de slots + overlay */}
            <div className="relative" style={{ height: totalGridH }}>

              {/* Linhas de background (clicáveis) */}
              {slotsHora.map((slot, si) => (
                <div key={si} className="absolute left-0 right-0 grid border-b border-slate-50"
                  style={{ gridTemplateColumns: '56px repeat(6, 1fr)', top: si * ROW_H, height: ROW_H }}>
                  <div className={cn('px-2 flex items-start pt-0.5 transition-colors', hoveredSi === si && 'bg-sky-50')}>
                    {slot.label && (
                      <span className={cn('text-[10px] leading-none transition-colors', hoveredSi === si ? 'text-sky-500 font-semibold' : 'text-slate-400')}>
                        {slot.label}
                      </span>
                    )}
                  </div>
                  {diasSemana.map((dia, di) => {
                    const iso = toISO(dia)
                    const isHoje = iso === toISO(hoje)
                    const ehAtivo = config.dias_ativos.includes(dia.getDay())
                    const bloqueio = isDiaBloqueado(iso)
                    const ehPassado = iso < toISO(hoje)
                    const hora = minutoToTime(slot.min)

                    if (!ehAtivo || bloqueio || ehPassado) {
                      return <div key={di} className="border-l border-slate-100 bg-slate-100/50" />
                    }

                    const isHover = hoveredDi === di && hoveredSi === si

                    return (
                      <div key={di}
                        className={cn(
                          'border-l border-slate-100 cursor-pointer transition-colors',
                          isHoje && 'bg-brand-50/30',
                          hoveredDi === di && hoveredSi !== si && 'bg-sky-50/40',
                          hoveredSi === si && hoveredDi !== di && 'bg-sky-50/40',
                          isHover && 'bg-sky-100/60',
                        )}
                        onClick={() => abrirNovo(iso, hora)}
                        onMouseEnter={() => { setHoveredDi(di); setHoveredSi(si) }}
                        onMouseLeave={() => { setHoveredDi(null); setHoveredSi(null) }}
                      >
                        <div className={cn('w-full h-full flex items-center justify-center transition-opacity', isHover ? 'opacity-100' : 'opacity-0')}>
                          <Plus className="w-3 h-3 text-sky-300" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* Overlay de agendamentos — absolutamente posicionado */}
              <div className="absolute inset-0 pointer-events-none"
                style={{ display: 'grid', gridTemplateColumns: '56px repeat(6, 1fr)' }}>
                <div /> {/* espaço coluna de horários */}
                {diasSemana.map((dia, di) => {
                  const iso = toISO(dia)
                  const dayAgs = porData[iso] ?? []
                  return (
                    <div key={di} className="relative">
                      {dayAgs.map(ag => {
                        const startMin = timeToMin(ag.hora_inicio)
                        const endMin   = timeToMin(ag.hora_fim)
                        const topPx    = (startMin - horaInicioMin) / slotMin * ROW_H
                        const heightPx = Math.max(ROW_H - 2, (endMin - startMin) / slotMin * ROW_H - 2)
                        const color    = STATUS_COLOR[ag.status] ?? '#94a3b8'
                        const leftPct  = (ag.col / ag.totalCols) * 100
                        const widthPct = (1 / ag.totalCols) * 100

                        return (
                          <div key={ag.id}
                            onClick={e => { e.stopPropagation(); abrirEditar(ag) }}
                            className="absolute rounded-md px-1.5 py-0.5 cursor-pointer hover:brightness-95 transition-all overflow-hidden pointer-events-auto"
                            style={{
                              top:    topPx + 1,
                              height: heightPx,
                              left:   `calc(${leftPct}% + 2px)`,
                              width:  `calc(${widthPct}% - 4px)`,
                              backgroundColor: color + '22',
                              borderLeft: `3px solid ${color}`,
                            }}
                            title={`${ag.hora_inicio}–${ag.hora_fim} · ${ag.paciente_nome}`}
                          >
                            <div className="flex items-center gap-1 flex-wrap">
                              <p className="text-[10px] font-semibold text-slate-800 leading-tight truncate">
                                {ag.paciente_nome}
                              </p>
                              {ag.origem === 'plano' && (
                                <span className="text-[8px] font-bold uppercase tracking-wide text-violet-600 bg-violet-100 px-1 py-0.5 rounded leading-none shrink-0">
                                  plano
                                </span>
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

            </div>{/* fim área slots+overlay */}
          </div>
        </div>
      </div>

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
      {planoBlock && (
        <PlanoBlockModal agendamento={planoBlock} onCancelar={() => setPlanoBlock(null)} />
      )}
      {configAberto && (
        <AgendaConfigModal
          onClose={fecharConfigModal}
          onSaved={(cfg, bl) => { setConfig(cfg); setBloqueios(bl) }}
        />
      )}
    </div>
  )
}
