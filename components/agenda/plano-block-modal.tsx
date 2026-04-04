'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, ExternalLink, Loader2, CalendarClock } from 'lucide-react'
import type { Agendamento } from '@/types'

interface Props {
  agendamento: Agendamento
  onCancelar: () => void
}

export default function PlanoBlockModal({ agendamento, onCancelar }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancelar() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancelar])

  async function irParaPlano() {
    setCarregando(true)
    setErro('')

    // Busca o plano_id via plano_consultas.agendamento_id
    const { data } = await supabase
      .from('plano_consultas')
      .select('plano_id')
      .eq('agendamento_id', agendamento.id)
      .maybeSingle()

    if (data?.plano_id) {
      router.push(`/planos/${data.plano_id}`)
      onCancelar()
      return
    }

    // Fallback: busca pelo nome do paciente + data em plano_pacientes → plano_consultas
    const { data: fallback } = await supabase
      .from('plano_consultas')
      .select('plano_id')
      .eq('data_agendamento', agendamento.data)
      .limit(1)
      .maybeSingle()

    if (fallback?.plano_id) {
      router.push(`/planos/${fallback.plano_id}`)
      onCancelar()
      return
    }

    setErro('Não foi possível encontrar o plano. Acesse Planos manualmente.')
    setCarregando(false)
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onCancelar}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center">
              <CalendarClock className="w-4 h-4 text-violet-600" />
            </div>
            <h3 className="font-semibold text-slate-800 text-sm">Consulta vinculada a um plano</h3>
          </div>
          <button onClick={onCancelar} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo */}
        <div className="px-5 pb-2 space-y-2">
          <p className="text-sm text-slate-600">
            Este agendamento faz parte de um plano de acompanhamento e só pode ser alterado na página de Planos.
          </p>
          <div className="bg-slate-50 rounded-xl px-3 py-2 text-xs text-slate-500">
            <p><span className="font-medium text-slate-700">{agendamento.paciente_nome}</span></p>
            <p>{agendamento.data.split('-').reverse().join('/')} · {agendamento.hora_inicio}–{agendamento.hora_fim}</p>
            {agendamento.servico_nome && <p>{agendamento.servico_nome}</p>}
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>

        {/* Botões */}
        <div className="flex gap-2 px-5 py-4">
          <button
            onClick={onCancelar}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={irParaPlano}
            disabled={carregando}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-70"
          >
            {carregando
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <ExternalLink className="w-3.5 h-3.5" />
            }
            Ir para o Plano
          </button>
        </div>
      </div>
    </div>
  )
}
