'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { X, Plus, Trash2, Settings, Loader2 } from 'lucide-react'
import type { AgendaConfig, AgendaBloqueio } from '@/types'

const DIAS_SEMANA = [
  { label: 'Dom', value: 0 },
  { label: 'Seg', value: 1 },
  { label: 'Ter', value: 2 },
  { label: 'Qua', value: 3 },
  { label: 'Qui', value: 4 },
  { label: 'Sex', value: 5 },
  { label: 'Sáb', value: 6 },
]

const DEFAULT_CONFIG: Omit<AgendaConfig, 'id'> = {
  hora_inicio: '07:00',
  hora_fim:    '20:00',
  dias_ativos: [1, 2, 3, 4, 5, 6],
  slot_min:    30,
}

const SLOT_OPTIONS = [5, 10, 15, 20, 30, 45, 60]

interface NovoBloqueio {
  data_inicio: string
  data_fim:    string
  motivo:      string
}

interface Props {
  onClose: () => void
  onSaved: (config: AgendaConfig, bloqueios: AgendaBloqueio[]) => void
}

export default function AgendaConfigModal({ onClose, onSaved }: Props) {
  const supabase = createClient()

  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [configId, setConfigId]     = useState<string | null>(null)
  const [horaInicio, setHoraInicio] = useState(DEFAULT_CONFIG.hora_inicio)
  const [horaFim, setHoraFim]       = useState(DEFAULT_CONFIG.hora_fim)
  const [diasAtivos, setDiasAtivos] = useState<number[]>(DEFAULT_CONFIG.dias_ativos)
  const [slotMin, setSlotMin]       = useState<number>(DEFAULT_CONFIG.slot_min)
  const [bloqueios, setBloqueios]   = useState<AgendaBloqueio[]>([])
  const [showNovoBloqueio, setShowNovoBloqueio] = useState(false)
  const [novo, setNovo] = useState<NovoBloqueio>({
    data_inicio: '', data_fim: '', motivo: '',
  })
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      const { data: cfg } = await supabase.from('agenda_config').select('*').maybeSingle()
      if (cfg) {
        setConfigId(cfg.id)
        setHoraInicio(cfg.hora_inicio)
        setHoraFim(cfg.hora_fim)
        setDiasAtivos(cfg.dias_ativos ?? DEFAULT_CONFIG.dias_ativos)
        setSlotMin(cfg.slot_min ?? DEFAULT_CONFIG.slot_min)
      }
      const { data: bl } = await supabase
        .from('agenda_bloqueios')
        .select('*')
        .order('data_inicio', { ascending: true })
      setBloqueios(bl ?? [])
      setLoading(false)
    }
    fetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleDia(dia: number) {
    setDiasAtivos(prev =>
      prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia].sort()
    )
  }

  async function salvar() {
    if (horaFim <= horaInicio) { setErro('Horário de fim deve ser após o início.'); return }
    if (diasAtivos.length === 0) { setErro('Selecione pelo menos um dia de atendimento.'); return }
    setErro('')
    setSaving(true)

    const payload = { hora_inicio: horaInicio, hora_fim: horaFim, dias_ativos: diasAtivos, slot_min: slotMin }

    let savedCfg: AgendaConfig | null = null
    if (configId) {
      const { data } = await supabase
        .from('agenda_config')
        .update({ ...payload, atualizado_em: new Date().toISOString() })
        .eq('id', configId)
        .select()
        .single()
      savedCfg = data
    } else {
      const { data } = await supabase
        .from('agenda_config')
        .insert(payload)
        .select()
        .single()
      savedCfg = data
      if (data) setConfigId(data.id)
    }

    setSaving(false)
    if (savedCfg) {
      onSaved(savedCfg, bloqueios)
      onClose()
    }
  }

  async function adicionarBloqueio() {
    if (!novo.data_inicio || !novo.data_fim) { setErro('Informe as datas do bloqueio.'); return }
    if (novo.data_fim < novo.data_inicio) { setErro('Data fim deve ser igual ou posterior à data início.'); return }
    setErro('')

    const payload = {
      data_inicio: novo.data_inicio,
      data_fim:    novo.data_fim,
      hora_inicio: null,
      hora_fim:    null,
      motivo:      novo.motivo.trim() || null,
    }

    const { data } = await supabase.from('agenda_bloqueios').insert(payload).select().single()
    if (data) {
      setBloqueios(prev => [...prev, data].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio)))
      setShowNovoBloqueio(false)
      setNovo({ data_inicio: '', data_fim: '', motivo: '' })
    }
  }

  async function excluirBloqueio(id: string) {
    await supabase.from('agenda_bloqueios').delete().eq('id', id)
    setBloqueios(prev => prev.filter(b => b.id !== id))
  }

  function formatDate(iso: string) {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  // ESC fecha
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-800">Configuração de Agenda</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          </div>
        ) : (
          <div className="p-6 space-y-6">

            {/* Horário global */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Horário de atendimento</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Início</label>
                  <input type="time" className="input" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
                </div>
                <div>
                  <label className="label">Fim</label>
                  <input type="time" className="input" value={horaFim} onChange={e => setHoraFim(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">Define a faixa de horários exibida na grade da agenda.</p>

              <div className="mt-3">
                <label className="label">Duração do slot (intervalo da grade)</label>
                <select className="input" value={slotMin} onChange={e => setSlotMin(Number(e.target.value))}>
                  {SLOT_OPTIONS.map(v => (
                    <option key={v} value={v}>{v} minutos</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">Cada linha da grade representa esse intervalo de tempo.</p>
              </div>
            </div>

            {/* Dias ativos */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Dias de atendimento</h4>
              <div className="flex gap-2 flex-wrap">
                {DIAS_SEMANA.map(d => (
                  <button
                    key={d.value}
                    onClick={() => toggleDia(d.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                      diasAtivos.includes(d.value)
                        ? 'bg-brand-600 border-brand-600 text-white'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">Dias marcados aparecem ativos na grade; os demais ficam acinzentados.</p>
            </div>

            {/* Bloqueios */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-700">Bloqueios de agenda</h4>
                <button
                  onClick={() => setShowNovoBloqueio(s => !s)}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar bloqueio
                </button>
              </div>

              {showNovoBloqueio && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 mb-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Data início *</label>
                      <input type="date" className="input"
                        value={novo.data_inicio}
                        onChange={e => setNovo(p => ({ ...p, data_inicio: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Data fim *</label>
                      <input type="date" className="input"
                        value={novo.data_fim}
                        onChange={e => setNovo(p => ({ ...p, data_fim: e.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <label className="label">Motivo (opcional)</label>
                    <input className="input" placeholder="Ex: Férias, Congresso..."
                      value={novo.motivo}
                      onChange={e => setNovo(p => ({ ...p, motivo: e.target.value }))} />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowNovoBloqueio(false)}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
                      Cancelar
                    </button>
                    <button onClick={adicionarBloqueio}
                      className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors">
                      Bloquear
                    </button>
                  </div>
                </div>
              )}

              {bloqueios.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-xl">
                  Nenhum bloqueio cadastrado
                </p>
              ) : (
                <div className="space-y-2">
                  {bloqueios.map(b => (
                    <div key={b.id} className="flex items-center justify-between px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {formatDate(b.data_inicio)}
                          {b.data_fim !== b.data_inicio && ` – ${formatDate(b.data_fim)}`}
                        </p>
                        <p className="text-xs text-slate-400">
                          {b.hora_inicio && b.hora_fim
                            ? `${b.hora_inicio}–${b.hora_fim}`
                            : 'Dia inteiro'}
                          {b.motivo && ` · ${b.motivo}`}
                        </p>
                      </div>
                      <button
                        onClick={() => excluirBloqueio(b.id)}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Erro */}
            {erro && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
            )}
          </div>
        )}

        {/* Footer */}
        {!loading && (
          <div className="flex gap-2 px-6 pb-6">
            <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={salvar} disabled={saving} className="btn-primary flex-1">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : 'Salvar configurações'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
