'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { X, ChevronLeft, ChevronRight, Plus, Calendar } from 'lucide-react'
import AgendamentoModal from '@/components/agenda/agendamento-modal'
import { STATUS_COLOR } from '@/components/agenda/status-badge'
import type { Agendamento, Servico, Profissional, AgendaConfig, AgendaBloqueio } from '@/types'

interface Props {
  pacienteNome: string
  pacienteId?: string | null
  dataSugerida?: string | null
  agendamentoIdAtual?: string | null
  servicos: Servico[]
  profissionais: Profissional[]
  onClose: () => void
  onAgendado: (data: string, agendamentoId: string) => void
}

const DEFAULT_SLOT_MIN = 30
const ROW_H = 32
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const DEFAULT_CONFIG: AgendaConfig = {
  id: '', hora_inicio: '07:00', hora_fim: '20:00', dias_ativos: [1, 2, 3, 4, 5, 6], slot_min: DEFAULT_SLOT_MIN,
}

function minutoToTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}
function timeToMin(t: string): number { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function normHora(h: string): string { return h?.slice(0, 5) ?? '' }

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
    let maxCol = colAssigned[i]
    for (let j = 0; j < sorted.length; j++) {
      if (i !== j && sorted[j].hora_inicio < ag.hora_fim && sorted[j].hora_fim > ag.hora_inicio) {
        maxCol = Math.max(maxCol, colAssigned[j])
      }
    }
    return { ...ag, col: colAssigned[i], totalCols: maxCol + 1 }
  })
}

function semanaInicioDe(date: Date): Date {
  const d = new Date(date); const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); d.setHours(0, 0, 0, 0); return d
}
function addDias(date: Date, n: number): Date { const d = new Date(date); d.setDate(d.getDate() + n); return d }
function toISO(d: Date): string { return d.toISOString().slice(0, 10) }

export default function AgendaEmbedModal({
  pacienteNome, pacienteId, dataSugerida,
  servicos, profissionais, onClose, onAgendado,
}: Props) {
  const supabase = createClient()
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)

  const initDate = dataSugerida ? new Date(dataSugerida + 'T12:00:00') : hoje
  const [semana, setSemana]             = useState(() => semanaInicioDe(initDate))
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading]           = useState(false)
  const [novoAberto, setNovoAberto]     = useState(false)
  const [dataClicada, setDataClicada]   = useState<string>(dataSugerida ?? toISO(hoje))
  const [horaClicada, setHoraClicada]   = useState<string>('08:00')
  const [config, setConfig]             = useState<AgendaConfig>(DEFAULT_CONFIG)
  const [bloqueios, setBloqueios]       = useState<AgendaBloqueio[]>([])
  const [hoveredDi, setHoveredDi]       = useState<number | null>(null)
  const [hoveredSi, setHoveredSi]       = useState<number | null>(null)

  const dias = useMemo(() => Array.from({ length: 6 }, (_, i) => addDias(semana, i)), [semana])
  const semanaFim = dias[5]

  useEffect(() => {
    async function fetchConfig() {
      const { data: cfg } = await supabase.from('agenda_config').select('*').maybeSingle()
      if (cfg) setConfig(cfg)
      const { data: bl } = await supabase.from('agenda_bloqueios').select('*').order('data_inicio')
      setBloqueios(bl ?? [])
    }
    fetchConfig()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const horaInicioMin = useMemo(() => timeToMin(config.hora_inicio), [config])
  const horaFimMin    = useMemo(() => timeToMin(config.hora_fim), [config])

  const slotMin = config.slot_min ?? DEFAULT_SLOT_MIN

  const slotsHora = useMemo(() => {
    const n = (horaFimMin - horaInicioMin) / slotMin
    return Array.from({ length: n }, (_, i) => {
      const min = horaInicioMin + i * slotMin
      return { label: (min % 60 === 0) ? minutoToTime(min) : '', min }
    })
  }, [horaInicioMin, horaFimMin, slotMin])

  const totalGridH = slotsHora.length * ROW_H

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

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('agendamentos')
      .select('id, paciente_nome, hora_inicio, hora_fim, data, status, servico_nome, origem')
      .gte('data', toISO(semana))
      .lte('data', toISO(semanaFim))
      .neq('status', 'cancelado')
      .order('hora_inicio', { ascending: true })
    setAgendamentos(
      (data ?? []).map((a: any) => ({
        ...a, hora_inicio: normHora(a.hora_inicio), hora_fim: normHora(a.hora_fim),
      }))
    )
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semana])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !novoAberto) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, novoAberto])

  function labelSemana() {
    const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    return `${fmt(dias[0])} – ${dias[5].toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
  }

  function abrirNovo(data: string, hora: string) {
    setDataClicada(data); setHoraClicada(hora); setNovoAberto(true)
  }

  function handleAgendado(data: string, novoId: string) {
    setNovoAberto(false); onAgendado(data, novoId); carregar()
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3"
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col" style={{ maxHeight: '88vh' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <div>
              <h3 className="font-semibold text-slate-800">Agendar consulta</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Paciente: <span className="font-medium text-brand-600">{pacienteNome}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => abrirNovo(dataSugerida ?? toISO(hoje), config.hora_inicio)} className="btn-primary text-sm">
                <Plus className="w-4 h-4" /> Novo Agendamento
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Week nav */}
          <div className="flex items-center justify-between px-6 py-2.5 border-b border-slate-100 bg-slate-50 shrink-0">
            <button onClick={() => setSemana(prev => addDias(prev, -7))}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="font-medium">{labelSemana()}</span>
              <button onClick={() => setSemana(semanaInicioDe(hoje))}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium px-2 py-0.5 rounded-lg hover:bg-brand-50 transition-colors">
                Hoje
              </button>
              {loading && <span className="text-xs text-slate-400">carregando…</span>}
            </div>
            <button onClick={() => setSemana(prev => addDias(prev, 7))}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Grade */}
          <div className="flex-1 overflow-y-auto">
            <div className="overflow-x-auto">
              <div style={{ minWidth: '700px' }}>

                {/* Cabeçalho dias — sticky */}
                <div className="grid sticky top-0 z-20 bg-white border-b border-slate-100"
                  style={{ gridTemplateColumns: '48px repeat(6, 1fr)' }}>
                  <div />
                  {dias.map((dia, i) => {
                    const iso = toISO(dia)
                    const ehHoje = iso === toISO(hoje)
                    const ehSugerida = iso === dataSugerida
                    const ehAtivo = config.dias_ativos.includes(dia.getDay())
                    const bloqueio = isDiaBloqueado(iso)
                    const ehPassado = iso < toISO(hoje)
                    const isHovered = hoveredDi === i
                    return (
                      <div key={iso} className={cn(
                        'py-2 px-1 text-center border-l border-slate-100 transition-colors',
                        ehSugerida && 'bg-brand-50',
                        ehHoje && !ehSugerida && 'bg-slate-50',
                        (!ehAtivo || bloqueio || ehPassado) && !ehSugerida && !ehHoje && 'opacity-60 bg-slate-50',
                        isHovered && ehAtivo && !bloqueio && !ehPassado && !ehSugerida && !ehHoje && 'bg-sky-50',
                      )}>
                        <p className={cn('text-xs font-semibold', ehHoje ? 'text-brand-600' : 'text-slate-400')}>{DIAS[i]}</p>
                        <p className={cn('text-sm font-bold', ehHoje ? 'text-brand-700' : 'text-slate-800')}>
                          {String(dia.getDate()).padStart(2, '0')}/{String(dia.getMonth() + 1).padStart(2, '0')}
                        </p>
                        {ehSugerida && (
                          <span className="inline-block text-[9px] font-medium text-brand-600 bg-brand-100 px-1.5 py-0.5 rounded-full mt-0.5">
                            Prevista
                          </span>
                        )}
                        {bloqueio ? (
                          <p className="text-[9px] font-medium text-red-500 mt-0.5">{bloqueio.motivo ?? 'Bloqueado'}</p>
                        ) : (
                          <p className="text-[10px] text-slate-400 mt-0.5">{porData[iso]?.length ?? 0} ag.</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Área slots + overlay */}
                <div className="relative" style={{ height: totalGridH }}>

                  {/* Linhas de background (clicáveis) */}
                  {slotsHora.map((slot, si) => (
                    <div key={si} className="absolute left-0 right-0 grid border-b border-slate-50"
                      style={{ gridTemplateColumns: '48px repeat(6, 1fr)', top: si * ROW_H, height: ROW_H }}>
                      <div className={cn('px-1.5 flex items-start pt-0.5 transition-colors', hoveredSi === si && 'bg-sky-50')}>
                        {slot.label && (
                          <span className={cn('text-[10px] leading-none transition-colors', hoveredSi === si ? 'text-sky-500 font-semibold' : 'text-slate-400')}>
                            {slot.label}
                          </span>
                        )}
                      </div>
                      {dias.map((dia, di) => {
                        const iso = toISO(dia)
                        const ehSugerida = iso === dataSugerida
                        const ehAtivo = config.dias_ativos.includes(dia.getDay())
                        const bloqueio = isDiaBloqueado(iso)
                        const ehPassado = iso < toISO(hoje)
                        const hora = minutoToTime(slot.min)
                        const isHover = hoveredDi === di && hoveredSi === si

                        if (!ehAtivo || bloqueio || ehPassado) {
                          return <div key={di} className="border-l border-slate-100 bg-slate-100/50" />
                        }
                        return (
                          <div key={di}
                            className={cn(
                              'border-l border-slate-100 cursor-pointer transition-colors',
                              ehSugerida && 'bg-brand-50/20',
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

                  {/* Overlay de agendamentos */}
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ display: 'grid', gridTemplateColumns: '48px repeat(6, 1fr)' }}>
                    <div />
                    {dias.map((dia, di) => {
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
                            return (
                              <div key={ag.id}
                                onClick={e => e.stopPropagation()}
                                className="absolute rounded-md px-1.5 py-0.5 overflow-hidden pointer-events-auto"
                                style={{
                                  top:    topPx + 1,
                                  height: heightPx,
                                  left:   `calc(${(ag.col / ag.totalCols) * 100}% + 2px)`,
                                  width:  `calc(${(1 / ag.totalCols) * 100}% - 4px)`,
                                  backgroundColor: color + '22',
                                  borderLeft: `3px solid ${color}`,
                                }}
                                title={`${ag.hora_inicio}–${ag.hora_fim} · ${ag.paciente_nome}`}
                              >
                                <p className="text-[10px] font-semibold text-slate-800 leading-tight truncate">{ag.paciente_nome}</p>
                                {ag.servico_nome && (
                                  <p className="text-[10px] text-slate-500 truncate leading-tight">{ag.servico_nome}</p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>

                </div>{/* fim área slots */}
              </div>
            </div>
          </div>
        </div>
      </div>

      {novoAberto && (
        <div className="relative z-[60]">
          <AgendamentoModal
            editando={null}
            dataInicial={dataClicada}
            horaInicial={horaClicada}
            servicos={servicos}
            profissionais={profissionais}
            pacienteNomeInicial={pacienteNome}
            pacienteIdInicial={pacienteId ?? undefined}
            origemInicial="plano"
            onClose={() => setNovoAberto(false)}
            onSalvo={(data, id) => handleAgendado(data, id)}
          />
        </div>
      )}
    </>
  )
}
