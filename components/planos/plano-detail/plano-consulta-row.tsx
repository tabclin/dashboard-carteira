'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatarMoeda } from '@/lib/utils'
import { calcularAgendamentoConsulta, calcularAlertaConsulta } from '@/lib/planos-utils'
import { CheckCircle2, Circle, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PlanoConsulta } from '@/types'

interface PlanoConsultaRowProps {
  consulta: PlanoConsulta
  index: number
  antecedencia_dias?: number
  onUpdated: (id: string, changes: Partial<PlanoConsulta>) => void
}

const AGENDAMENTO_BADGE = {
  concluida:    { label: 'Concluída',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  agendada:     { label: 'Agendada',      cls: 'bg-blue-50    text-blue-700    border-blue-200'    },
  nao_agendada: { label: 'Não agendada',  cls: 'bg-slate-100  text-slate-500   border-slate-200'   },
}

export default function PlanoConsultaRow({ consulta, index, antecedencia_dias = 30, onUpdated }: PlanoConsultaRowProps) {
  const supabase = createClient()
  const router = useRouter()
  const [local, setLocal] = useState(consulta)
  const [savingRealizada, setSavingRealizada] = useState(false)
  const [savingAgendamento, setSavingAgendamento] = useState(false)

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

  async function handleAgendamento(novaData: string) {
    const valorFinal = novaData || null
    setLocal(prev => ({ ...prev, data_agendamento: valorFinal }))
    setSavingAgendamento(true)
    const { error } = await supabase
      .from('plano_consultas')
      .update({ data_agendamento: valorFinal })
      .eq('id', local.id)
    setSavingAgendamento(false)
    if (error) return
    onUpdated(local.id, { data_agendamento: valorFinal })
    router.refresh()
  }

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-xl transition-all',
      local.realizada ? 'bg-emerald-50/50' : 'bg-slate-50'
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

      {/* Coluna central: nome + datas */}
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

        {/* Linha 2: observação */}
        {local.observacao && (
          <p className="text-xs text-slate-500 italic">{local.observacao}</p>
        )}

        {/* Linha 3: datas lado a lado */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Data sugerida (só leitura) */}
          {local.data_sugerida && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span className="font-medium text-slate-500">Prevista:</span>
              {local.data_sugerida.split('-').reverse().join('/')}
            </div>
          )}

          {/* Data de agendamento (editável) */}
          {!local.realizada && (
            <div className="flex items-center gap-1">
              <Calendar className={cn(
                'w-3.5 h-3.5 flex-shrink-0',
                local.data_agendamento ? 'text-blue-500' : 'text-slate-400'
              )} />
              <span className="text-xs font-medium text-slate-500">Agendar:</span>
              <input
                type="date"
                className={cn(
                  'text-xs border rounded-md px-2 py-0.5 transition-colors outline-none',
                  'focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
                  local.data_agendamento
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600'
                )}
                value={local.data_agendamento ?? ''}
                onChange={e => handleAgendamento(e.target.value)}
                title="Data de agendamento"
              />
              {savingAgendamento && (
                <span className="text-xs text-slate-400">salvando...</span>
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
  )
}
