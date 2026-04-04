'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatarData } from '@/lib/utils'
import { formatarMesAno } from '@/lib/planos-utils'
import PlanoStatusBadge from '@/components/planos/plano-status-badge'
import PlanoAgendamentoBadge from './plano-agendamento-badge'
import { Search, ChevronRight } from 'lucide-react'
import type { PlanoAcompanhamento, PlanoAgendamentoAlerta, PlanoAgendamentoInfo } from '@/types'

// ── Filtros ──────────────────────────────────────────────────────

type NivelKey = 'todos' | 'nivel1' | 'nivel2' | 'nivel3'

const NIVEIS: { key: NivelKey; label: string }[] = [
  { key: 'todos',  label: 'Todos'      },
  { key: 'nivel1', label: 'Nível 1'    },
  { key: 'nivel2', label: 'Nível 2'    },
  { key: 'nivel3', label: 'Nível 3'    },
]

const NIVEL_LABELS: Record<NivelKey, string> = {
  todos:  'Todos',
  nivel1: 'Rascunho · Proposta Enviada',
  nivel2: 'Em Andamento',
  nivel3: 'Não Aderido · Concluído',
}

const FILTROS_AGENDAMENTO: { key: PlanoAgendamentoAlerta; label: string; color: string }[] = [
  { key: 'atrasado',        label: '🔴 Atrasados',       color: 'bg-red-50    text-red-700    border-red-200'      },
  { key: 'precisa_agendar', label: '⚠️ Precisa Agendar', color: 'bg-amber-50  text-amber-700  border-amber-200'    },
  { key: 'em_dia',          label: '✅ Em Dia',           color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
]

// ── Componente ───────────────────────────────────────────────────

interface PlanosListProps {
  planos: PlanoAcompanhamento[]
  agendamentoMap: Record<string, PlanoAgendamentoInfo>
}

export default function PlanosList({ planos, agendamentoMap }: PlanosListProps) {
  const [busca, setBusca] = useState('')
  const [nivel, setNivel] = useState<NivelKey>('todos')
  const [filtroAgendamento, setFiltroAgendamento] = useState<PlanoAgendamentoAlerta | null>(null)

  function selecionarNivel(n: NivelKey) {
    setNivel(n)
    setFiltroAgendamento(null)
  }

  const filtrados = planos.filter(p => {
    const nomesPacientes = (p.plano_pacientes ?? []).map((pac: any) => pac.nome).join(' ')
    const matchBusca = nomesPacientes.toLowerCase().includes(busca.toLowerCase())
    if (!matchBusca) return false

    if (nivel === 'nivel1' && p.status !== 'rascunho' && p.status !== 'proposta_enviada') return false
    if (nivel === 'nivel2' && p.status !== 'em_andamento') return false
    if (nivel === 'nivel3' && p.status !== 'nao_aderido' && p.status !== 'concluido') return false

    if (nivel === 'nivel2' && filtroAgendamento) {
      const info = agendamentoMap[p.id]
      return info?.alerta === filtroAgendamento
    }

    return true
  })

  const mostrarStatus      = nivel !== 'nivel2'
  const mostrarAgendamento = nivel === 'nivel2'

  return (
    <div className="card">
      {/* Busca */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por paciente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        {/* Filtros por Nível */}
        <div className="flex gap-1 flex-wrap items-center">
          {NIVEIS.map(n => (
            <button
              key={n.key}
              onClick={() => selecionarNivel(n.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                nivel === n.key
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {n.label}
            </button>
          ))}
          {nivel !== 'todos' && (
            <span className="text-xs text-slate-400 ml-1">{NIVEL_LABELS[nivel]}</span>
          )}
        </div>

        {/* Sub-filtros de agendamento — só no Nível 2 */}
        {nivel === 'nivel2' && (
          <div className="flex gap-1 flex-wrap items-center">
            <span className="text-xs text-slate-400 font-medium mr-1">Agendamento:</span>
            {FILTROS_AGENDAMENTO.map(f => (
              <button
                key={f.key}
                onClick={() => setFiltroAgendamento(filtroAgendamento === f.key ? null : f.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  filtroAgendamento === f.key
                    ? `${f.color} font-semibold`
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabela */}
      {filtrados.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <p className="text-sm">Nenhum plano encontrado.</p>
          {planos.length === 0 && (
            <p className="text-xs mt-1">Clique em "Novo Plano" para criar o primeiro.</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Responsável</th>
                <th className="table-th">Paciente(s)</th>
                {mostrarStatus      && <th className="table-th">Status</th>}
                {mostrarAgendamento && <th className="table-th">Agendamento</th>}
                <th className="table-th">Próxima Ação</th>
                <th className="table-th text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => {
                const info = agendamentoMap[p.id]
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="table-td">
                      <p className="font-medium text-slate-800">{p.responsavel_nome}</p>
                      {p.data_inicio && p.data_fim && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatarData(p.data_inicio)} → {formatarData(p.data_fim)}
                        </p>
                      )}
                    </td>

                    <td className="table-td">
                      {(p.plano_pacientes ?? []).length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {(p.plano_pacientes as any[]).map((pac, i) => (
                            <span key={i} className="text-xs text-slate-400">{pac.nome}</span>
                          ))}
                        </div>
                      )}
                    </td>

                    {mostrarStatus && (
                      <td className="table-td">
                        <PlanoStatusBadge status={p.status} />
                      </td>
                    )}

                    {mostrarAgendamento && (
                      <td className="table-td">
                        {info ? (
                          <PlanoAgendamentoBadge alerta={info.alerta} />
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    )}

                    <td className="table-td">
                      {info?.proxima_data_sugerida ? (
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            {formatarMesAno(info.proxima_data_sugerida)}
                          </p>
                          <p className={`text-xs mt-0.5 ${
                            info.proxima_agendada ? 'text-blue-600' : 'text-amber-600'
                          }`}>
                            {info.proxima_agendada ? '✓ Agendada' : '· Não agendada'}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    <td className="table-td">
                      <div className="flex justify-end">
                        <Link
                          href={`/planos/${p.id}`}
                          className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700 font-medium transition-colors"
                        >
                          Ver <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="text-xs text-slate-400 px-4 py-3">
            {filtrados.length} plano{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
