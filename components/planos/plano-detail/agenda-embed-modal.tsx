'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { X, ChevronLeft, ChevronRight, Plus, Calendar, Clock } from 'lucide-react'
import AgendamentoModal from '@/components/agenda/agendamento-modal'
import type { Agendamento, Servico, Profissional } from '@/types'

interface Props {
  pacienteNome: string
  pacienteId?: string | null
  dataSugerida?: string | null
  agendamentoIdAtual?: string | null  // agendamento anterior a ser removido ao criar novo
  servicos: Servico[]
  profissionais: Profissional[]
  onClose: () => void
  onAgendado: (data: string, agendamentoId: string) => void
}

function semanaInicioDe(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDias(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function AgendaEmbedModal({
  pacienteNome, pacienteId, dataSugerida, agendamentoIdAtual,
  servicos, profissionais, onClose, onAgendado,
}: Props) {
  const supabase = createClient()
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)

  const initDate = dataSugerida ? new Date(dataSugerida + 'T12:00:00') : hoje
  const [semana, setSemana] = useState(() => semanaInicioDe(initDate))
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(false)
  const [novoAberto, setNovoAberto] = useState(false)
  const [dataClicada, setDataClicada] = useState<string>(dataSugerida ?? toISO(hoje))

  const dias = Array.from({ length: 6 }, (_, i) => addDias(semana, i))
  const semanaFim = dias[5]

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('agendamentos')
      .select('id, paciente_nome, hora_inicio, hora_fim, data, status, servico_nome')
      .gte('data', toISO(semana))
      .lte('data', toISO(semanaFim))
      .neq('status', 'cancelado')
      .order('hora_inicio', { ascending: true })
    setAgendamentos(
      (data ?? []).map((a: any) => ({
        ...a,
        hora_inicio: a.hora_inicio?.slice(0, 5) ?? a.hora_inicio,
        hora_fim:    a.hora_fim?.slice(0, 5)    ?? a.hora_fim,
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

  function abrirNovo(data: string) {
    setDataClicada(data)
    setNovoAberto(true)
  }

  function handleAgendado(data: string, novoId: string) {
    setNovoAberto(false)
    onAgendado(data, novoId)
    carregar()
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3"
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col animate-fade-in" style={{ maxHeight: '88vh' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <div>
              <h3 className="font-semibold text-slate-800">Agendar consulta</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Paciente: <span className="font-medium text-brand-600">{pacienteNome}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => abrirNovo(dataSugerida ?? toISO(hoje))}
                className="btn-primary text-sm"
              >
                <Plus className="w-4 h-4" /> Novo Agendamento
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Week nav */}
          <div className="flex items-center justify-between px-6 py-2.5 border-b border-slate-100 bg-slate-50 shrink-0">
            <button
              onClick={() => setSemana(prev => addDias(prev, -7))}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="font-medium">{labelSemana()}</span>
              {loading && <span className="text-xs text-slate-400 ml-1">carregando…</span>}
            </div>
            <button
              onClick={() => setSemana(prev => addDias(prev, 7))}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-6 divide-x divide-slate-100 h-full">
              {dias.map((dia, i) => {
                const iso = toISO(dia)
                const ehHoje = iso === toISO(hoje)
                const ehSugerida = iso === dataSugerida
                const ags = agendamentos.filter(a => a.data === iso)

                return (
                  <div key={iso} className={cn('flex flex-col min-h-[300px]', ehSugerida && 'bg-brand-50/30')}>
                    {/* Day header */}
                    <div className={cn(
                      'text-center px-2 py-2.5 border-b border-slate-100 sticky top-0 z-10',
                      ehSugerida ? 'bg-brand-50' : 'bg-white',
                    )}>
                      <p className={cn('text-xs font-semibold', ehHoje ? 'text-brand-600' : 'text-slate-400')}>
                        {DIAS[i]}
                      </p>
                      <p className={cn('text-sm font-bold', ehHoje ? 'text-brand-700' : 'text-slate-800')}>
                        {String(dia.getDate()).padStart(2, '0')}/{String(dia.getMonth() + 1).padStart(2, '0')}
                      </p>
                      {ehSugerida && (
                        <span className="inline-block text-[9px] font-medium text-brand-600 bg-brand-100 px-1.5 py-0.5 rounded-full mt-0.5">
                          Prevista
                        </span>
                      )}
                    </div>

                    {/* Appointments */}
                    <div className="flex-1 p-1.5 space-y-1.5">
                      {ags.map(ag => (
                        <div key={ag.id} className="bg-slate-50 rounded-lg px-2 py-1.5 text-[11px] leading-tight">
                          <div className="flex items-center gap-1 text-slate-400 mb-0.5">
                            <Clock className="w-2.5 h-2.5 shrink-0" />
                            <span>{ag.hora_inicio}–{ag.hora_fim}</span>
                          </div>
                          <p className="font-medium text-slate-700 truncate">{ag.paciente_nome}</p>
                          {ag.servico_nome && <p className="text-slate-400 truncate">{ag.servico_nome}</p>}
                        </div>
                      ))}

                      {/* Add slot */}
                      <button
                        onClick={() => abrirNovo(iso)}
                        className="w-full py-2 text-[11px] text-slate-300 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
                      >
                        + agendar aqui
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de novo agendamento (z-index maior) */}
      {novoAberto && (
        <div className="relative z-[60]">
          <AgendamentoModal
            editando={null}
            dataInicial={dataClicada}
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
