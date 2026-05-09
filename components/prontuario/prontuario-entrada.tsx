'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, CalendarDays, Clock, ChevronRight, History } from 'lucide-react'
import { cn, formatarData } from '@/lib/utils'
import StatusBadge from '@/components/agenda/status-badge'
import type { Agendamento } from '@/types'

interface Paciente {
  id: string
  paciente: string
  nascimento: string | null
}

interface Recente {
  paciente_id: string
  atualizado_em: string
  prontuario_consultas: { data: string }[]
}

interface Props {
  hojeAgendamentos: Agendamento[]
  proximosAgendamentos: Agendamento[]
  recentes: Recente[]
  pacientesData: Paciente[]
}

export default function ProntuarioEntrada({ hojeAgendamentos, proximosAgendamentos, recentes, pacientesData }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Paciente[]>([])
  const [buscando, setBuscando] = useState(false)
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  function onChangeBusca(valor: string) {
    setBusca(valor)
    if (timer) clearTimeout(timer)
    if (!valor.trim()) { setResultados([]); return }
    const t = setTimeout(async () => {
      setBuscando(true)
      const { data } = await supabase
        .from('pacientes')
        .select('id, paciente, nascimento')
        .ilike('paciente', `%${valor.trim()}%`)
        .limit(10)
      setResultados((data ?? []) as Paciente[])
      setBuscando(false)
    }, 300)
    setTimer(t)
  }

  const pacienteMap = Object.fromEntries(pacientesData.map(p => [p.id, p]))

  const proximosPorData: Record<string, Agendamento[]> = {}
  for (const ag of proximosAgendamentos) {
    if (!proximosPorData[ag.data]) proximosPorData[ag.data] = []
    proximosPorData[ag.data].push(ag)
  }

  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Cabeçalho + busca */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Prontuário Eletrônico</h2>
        <p className="text-sm text-slate-500 mt-0.5">Selecione um paciente para acessar o prontuário</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Buscar paciente pelo nome..."
          value={busca}
          onChange={e => onChangeBusca(e.target.value)}
          autoFocus
        />
        {buscando && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Buscando...</span>
        )}
        {busca && resultados.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
            {resultados.map(p => (
              <button
                key={p.id}
                onClick={() => router.push(`/prontuario/${p.id}`)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between transition-colors border-b border-slate-100 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{p.paciente}</p>
                  {p.nascimento && <p className="text-xs text-slate-400">{formatarData(p.nascimento)}</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            ))}
          </div>
        )}
        {busca && !buscando && resultados.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 px-4 py-3">
            <p className="text-sm text-slate-500">Nenhum paciente encontrado.</p>
          </div>
        )}
      </div>

      {/* Grid de duas colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">

        {/* Coluna esquerda — Hoje + Próximos dias */}
        <div className="space-y-5">

          {/* Hoje */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-slate-700">
                Hoje — {formatarData(hoje)}
              </h3>
              <span className="text-xs text-slate-400">
                {hojeAgendamentos.length} agendamento{hojeAgendamentos.length !== 1 ? 's' : ''}
              </span>
            </div>

            {hojeAgendamentos.length === 0 ? (
              <div className="card py-8 text-center">
                <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-400">Nenhum agendamento para hoje.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {hojeAgendamentos.map(ag => (
                  <button
                    key={ag.id}
                    onClick={() => router.push(`/prontuario/${ag.paciente_id ?? encodeURIComponent(ag.paciente_nome)}`)}
                    className="card w-full text-left flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="text-center flex-shrink-0 w-14">
                      <p className="text-sm font-bold text-slate-800">{ag.hora_inicio}</p>
                      <p className="text-xs text-slate-400">{ag.hora_fim}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{ag.paciente_nome}</p>
                      {ag.servico_nome && <p className="text-xs text-slate-500 mt-0.5">{ag.servico_nome}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={ag.status} />
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Próximos dias */}
          {Object.keys(proximosPorData).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Próximos dias</h3>
              <div className="space-y-4">
                {Object.entries(proximosPorData).map(([data, ags]) => (
                  <div key={data}>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                      {formatarData(data)}
                    </p>
                    <div className="space-y-2">
                      {ags.map(ag => (
                        <button
                          key={ag.id}
                          onClick={() => router.push(`/prontuario/${ag.paciente_id ?? encodeURIComponent(ag.paciente_nome)}`)}
                          className="card w-full text-left flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors"
                        >
                          <p className="text-xs text-slate-500 w-12 flex-shrink-0">{ag.hora_inicio}</p>
                          <p className="text-sm font-medium text-slate-700 flex-1 truncate">{ag.paciente_nome}</p>
                          {ag.servico_nome && <p className="text-xs text-slate-400 truncate hidden sm:block">{ag.servico_nome}</p>}
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Coluna direita — Prontuários recentes */}
        {recentes.length > 0 && !busca && (
          <div className="rounded-2xl bg-slate-800 p-4 space-y-3 sticky top-6">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">Prontuários recentes</h3>
            </div>

            <div className="space-y-1">
              {recentes.map((r, i) => {
                const p = pacienteMap[r.paciente_id]
                if (!p) return null
                const ultimaConsulta = r.prontuario_consultas?.[0]?.data
                return (
                  <button
                    key={i}
                    onClick={() => router.push(`/prontuario/${p.id}`)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-700 transition-colors group"
                  >
                    {/* Avatar inicial */}
                    <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-300 group-hover:bg-slate-500 transition-colors">
                      {p.paciente.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate leading-tight">{p.paciente}</p>
                      {ultimaConsulta && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{formatarData(ultimaConsulta)}</p>
                      )}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
