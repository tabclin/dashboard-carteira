'use client'

import { useState } from 'react'
import { cn, formatarData } from '@/lib/utils'
import { Plus, CheckCircle2, Clock, UserX, XCircle, ExternalLink } from 'lucide-react'
import StatusBadge from './status-badge'
import AgendamentoModal from './agendamento-modal'
import PlanoBlockModal from './plano-block-modal'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Agendamento, AgendaStatus, Servico, Profissional } from '@/types'

interface DiaListProps {
  agendamentos: Agendamento[]
  servicos: Servico[]
  profissionais: Profissional[]
  dataHoje: string  // ISO date
}

const STATUS_RAPIDO: { status: AgendaStatus; label: string; icon: React.ElementType; cor: string }[] = [
  { status: 'confirmado', label: 'Confirmar', icon: CheckCircle2, cor: 'text-violet-600 hover:bg-violet-50' },
  { status: 'realizado',  label: 'Realizado',  icon: CheckCircle2, cor: 'text-emerald-600 hover:bg-emerald-50' },
  { status: 'faltou',    label: 'Faltou',    icon: UserX,        cor: 'text-amber-600 hover:bg-amber-50' },
  { status: 'cancelado', label: 'Cancelar',  icon: XCircle,      cor: 'text-slate-500 hover:bg-slate-50' },
]

export default function DiaList({ agendamentos: agendamentosRaw, servicos, profissionais, dataHoje }: DiaListProps) {
  // Normalizar horas (Supabase TIME retorna "HH:MM:SS")
  const agendamentos = agendamentosRaw.map(a => ({
    ...a,
    hora_inicio: a.hora_inicio?.slice(0, 5) ?? a.hora_inicio,
    hora_fim:    a.hora_fim?.slice(0, 5)    ?? a.hora_fim,
  }))
  const supabase = createClient()
  const router   = useRouter()

  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando]       = useState<Agendamento | null>(null)
  const [atualizando, setAtualizando] = useState<string | null>(null)
  const [planoBlock, setPlanoBlock]   = useState<Agendamento | null>(null)

  const kpis = {
    total:      agendamentos.length,
    confirmado: agendamentos.filter(a => a.status === 'confirmado').length,
    realizado:  agendamentos.filter(a => a.status === 'realizado').length,
    faltou:     agendamentos.filter(a => a.status === 'faltou').length,
  }

  async function mudarStatus(ag: Agendamento, status: AgendaStatus) {
    setAtualizando(ag.id)
    await supabase.from('agendamentos')
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq('id', ag.id)

    // Se realizado → atualizar ultimo_atendimento
    if (status === 'realizado' && ag.paciente_nome) {
      await supabase.from('pacientes')
        .update({ ultimo_atendimento: ag.data })
        .eq('paciente', ag.paciente_nome)
    }
    setAtualizando(null)
    router.refresh()
  }

  function abrirEditar(ag: Agendamento) {
    if (ag.origem === 'plano') { setPlanoBlock(ag); return }
    setEditando(ag)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(null)
  }

  return (
    <div className="space-y-4">
      {/* KPIs do dia */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total hoje',  valor: kpis.total,       cor: 'text-slate-700' },
          { label: 'Confirmados', valor: kpis.confirmado,  cor: 'text-violet-600' },
          { label: 'Realizados',  valor: kpis.realizado,   cor: 'text-emerald-600' },
          { label: 'Faltaram',    valor: kpis.faltou,      cor: 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="card py-3 text-center">
            <p className={cn('text-2xl font-bold', k.cor)}>{k.valor}</p>
            <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">
            Agenda de {formatarData(dataHoje)}
          </h3>
          <p className="text-xs text-slate-400">{agendamentos.length} agendamento{agendamentos.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setEditando(null); setModalAberto(true) }}
          className="btn-primary text-sm"
        >
          <Plus className="w-4 h-4" /> Novo agendamento
        </button>
      </div>

      {/* Lista de agendamentos */}
      {agendamentos.length === 0 ? (
        <div className="card text-center py-12">
          <Clock className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm font-medium">Nenhum agendamento hoje</p>
          <p className="text-xs text-slate-400 mt-1">Clique em "Novo agendamento" para começar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {agendamentos
            .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
            .map(ag => (
              <div
                key={ag.id}
                className={cn(
                  'card flex items-start gap-3 p-4 transition-opacity',
                  ag.status === 'cancelado' && 'opacity-50'
                )}
              >
                {/* Horário */}
                <div className="text-center flex-shrink-0 w-14">
                  <p className="text-sm font-bold text-slate-800">{ag.hora_inicio}</p>
                  <p className="text-xs text-slate-400">{ag.hora_fim}</p>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800 truncate">{ag.paciente_nome}</p>
                    <StatusBadge status={ag.status} />
                    {ag.origem === 'plano' && (
                      <span className="text-[9px] font-bold uppercase tracking-wide text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded leading-none">plano</span>
                    )}
                  </div>
                  {ag.servico_nome && (
                    <p className="text-xs text-slate-500 mt-0.5">{ag.servico_nome}</p>
                  )}
                  {ag.observacoes && (
                    <p className="text-xs text-slate-400 mt-0.5 italic truncate">{ag.observacoes}</p>
                  )}

                  {/* Ações rápidas de status */}
                  {ag.status !== 'realizado' && ag.status !== 'cancelado' && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {STATUS_RAPIDO
                        .filter(s => s.status !== ag.status)
                        .map(({ status, label, icon: Icon, cor }) => (
                          <button
                            key={status}
                            disabled={atualizando === ag.id}
                            onClick={() => mudarStatus(ag, status)}
                            className={cn(
                              'flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg border border-transparent transition-colors',
                              cor
                            )}
                          >
                            <Icon className="w-3 h-3" /> {label}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {ag.status === 'realizado' && (
                    <a
                      href={`/prontuario/${encodeURIComponent(ag.paciente_nome)}`}
                      className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-600 transition-colors"
                      title="Abrir prontuário"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => abrirEditar(ag)}
                    className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    Editar
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Modal de agendamento normal */}
      {modalAberto && (
        <AgendamentoModal
          editando={editando}
          dataInicial={dataHoje}
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
