'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatarMoeda } from '@/lib/utils'
import { calcularAgendamentoConsulta, calcularAlertaConsulta } from '@/lib/planos-utils'
import { CheckCircle2, Circle, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import AgendaEmbedModal from './agenda-embed-modal'
import type { PlanoConsulta, Servico, Profissional } from '@/types'

interface PlanoConsultaRowProps {
  consulta: PlanoConsulta
  index: number
  pacienteNome: string
  antecedencia_dias?: number
  servicos: Servico[]
  profissionais: Profissional[]
  onUpdated: (id: string, changes: Partial<PlanoConsulta>) => void
}

const AGENDAMENTO_BADGE = {
  concluida:    { label: 'Concluída',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  agendada:     { label: 'Agendada',      cls: 'bg-blue-50    text-blue-700    border-blue-200'    },
  nao_agendada: { label: 'Não agendada',  cls: 'bg-slate-100  text-slate-500   border-slate-200'   },
}

export default function PlanoConsultaRow({
  consulta, index, pacienteNome, antecedencia_dias = 30,
  servicos, profissionais, onUpdated,
}: PlanoConsultaRowProps) {
  const supabase = createClient()
  const router = useRouter()
  const [local, setLocal] = useState(consulta)
  const [savingRealizada, setSavingRealizada] = useState(false)
  const [agendaAberta, setAgendaAberta] = useState(false)
  const [expandido, setExpandido] = useState(false)

  const agStatus = calcularAgendamentoConsulta(local.realizada, local.data_agendamento)
  const badge = AGENDAMENTO_BADGE[agStatus]
  const economia = local.valor_cheio - local.valor_com_plano
  const alerta = calcularAlertaConsulta(local.realizada, local.data_sugerida, local.data_agendamento, antecedencia_dias)

  async function toggleRealizada() {
    setSavingRealizada(true)
    const novoValor = !local.realizada
    await supabase.from('plano_consultas').update({ realizada: novoValor }).eq('id', local.id)
    setSavingRealizada(false)
    const updated = { ...local, realizada: novoValor }
    setLocal(updated)
    onUpdated(local.id, { realizada: novoValor })
    router.refresh()
  }

  async function handleAgendamento(novaData: string, novoAgendamentoId?: string) {
    const valorFinal = novaData || null
    const idFinal = novoAgendamentoId ?? null

    // Remover agendamento anterior para evitar duplicatas
    if (local.agendamento_id && local.agendamento_id !== idFinal) {
      // Caso normal: temos o ID exato
      await supabase.from('agendamentos').delete().eq('id', local.agendamento_id)
    } else if (!local.agendamento_id && local.data_agendamento && idFinal) {
      // Fallback para registros criados antes da migração (sem agendamento_id):
      // busca pelo nome do paciente + data antiga
      await supabase
        .from('agendamentos')
        .delete()
        .eq('paciente_nome', pacienteNome)
        .eq('data', local.data_agendamento)
    }

    setLocal(prev => ({ ...prev, data_agendamento: valorFinal, agendamento_id: idFinal }))
    const { error } = await supabase
      .from('plano_consultas')
      .update({ data_agendamento: valorFinal, agendamento_id: idFinal })
      .eq('id', local.id)
    if (error) return
    onUpdated(local.id, { data_agendamento: valorFinal, agendamento_id: idFinal })
    router.refresh()
  }

  return (
    <>
      <div className={cn(
        'flex items-start gap-3 p-3 rounded-xl transition-all',
        local.realizada
          ? 'bg-emerald-50/50'
          : alerta === 'atrasado'
            ? 'bg-red-50'
            : 'bg-slate-50',
      )}>
        {/* Checkbox realizada */}
        <button
          onClick={toggleRealizada}
          disabled={savingRealizada}
          className="mt-0.5 flex-shrink-0 transition-colors"
          title={local.realizada ? 'Marcar como pendente' : 'Marcar como realizada'}
        >
          {local.realizada
            ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            : <Circle className="w-5 h-5 text-slate-300 hover:text-emerald-400" />
          }
        </button>

        {/* Coluna central */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Linha 1: nome + badge */}
          <div className="flex items-center gap-2 flex-wrap">
            {alerta === 'atrasado' && (
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Atrasado — agende imediatamente" />
            )}
            {alerta === 'precisa_agendar' && (
              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Precisa agendar em breve" />
            )}
            <p className={cn(
              'text-sm font-medium',
              local.realizada ? 'line-through text-slate-400' : 'text-slate-800'
            )}>
              {local.servico_nome}
            </p>
            <span className={cn(
              'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border',
              badge.cls
            )}>
              {badge.label}
            </span>
          </div>

          {/* Linha 2: observação colapsável */}
          {local.observacao && (
            <div>
              <button
                onClick={() => setExpandido(v => !v)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                {expandido
                  ? <ChevronUp className="w-3 h-3" />
                  : <ChevronDown className="w-3 h-3" />
                }
                <span>{expandido ? 'Recolher descrição' : 'Ver descrição'}</span>
              </button>
              {expandido && (
                <p className="mt-1.5 text-xs text-slate-500 italic leading-relaxed">{local.observacao}</p>
              )}
            </div>
          )}

          {/* Linha 3: datas + botão agendar */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Data sugerida */}
            {local.data_sugerida && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <span className="font-medium text-slate-500">Prevista:</span>
                {local.data_sugerida.split('-').reverse().join('/')}
              </div>
            )}

            {/* Botão agendar ou data agendada */}
            {!local.realizada && (
              <div className="flex items-center gap-2">
                {local.data_agendamento ? (
                  <>
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="font-medium">
                        {local.data_agendamento.split('-').reverse().join('/')}
                      </span>
                    </div>
                    <button
                      onClick={() => setAgendaAberta(true)}
                      className="text-[11px] text-slate-400 hover:text-brand-600 underline underline-offset-2 transition-colors"
                    >
                      alterar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setAgendaAberta(true)}
                    className={cn(
                      'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors',
                      alerta === 'atrasado'
                        ? 'border-red-300 text-red-600 bg-white hover:bg-red-50'
                        : 'border-brand-200 text-brand-600 bg-white hover:bg-brand-50',
                    )}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Agendar
                  </button>
                )}
              </div>
            )}

            {local.realizada && local.data_agendamento && (
              <div className="flex items-center gap-1 text-xs text-emerald-600">
                <Calendar className="w-3.5 h-3.5" />
                Realizada em: {local.data_agendamento.split('-').reverse().join('/')}
              </div>
            )}
          </div>
        </div>

        {/* Coluna direita: valores */}
        <div className="text-right flex-shrink-0">
          <div className="flex items-center justify-end gap-2">
            {economia > 0 && (
              <span className="text-xs text-slate-400 line-through">{formatarMoeda(local.valor_cheio)}</span>
            )}
            <span className="text-sm font-semibold text-slate-800">
              {formatarMoeda(local.valor_com_plano)}
            </span>
          </div>
          {local.cashback_gerado > 0 && (
            <p className="text-xs text-purple-600">+{formatarMoeda(local.cashback_gerado)} cashback</p>
          )}
          {local.cashback_utilizado > 0 && (
            <p className="text-xs text-blue-600">-{formatarMoeda(local.cashback_utilizado)} usado</p>
          )}
        </div>
      </div>

      {/* Modal de agenda */}
      {agendaAberta && (
        <AgendaEmbedModal
          pacienteNome={pacienteNome}
          dataSugerida={local.data_sugerida}
          agendamentoIdAtual={local.agendamento_id}
          servicos={servicos}
          profissionais={profissionais}
          onClose={() => setAgendaAberta(false)}
          onAgendado={(data, agendamentoId) => {
            handleAgendamento(data, agendamentoId)
            setAgendaAberta(false)
          }}
        />
      )}
    </>
  )
}
