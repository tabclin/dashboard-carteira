'use client'

import { useState } from 'react'
import { Plus, Sparkles, RotateCcw } from 'lucide-react'
import ConsultaRow from './consulta-row'
import CashbackTimeline from './cashback-timeline'
import type {
  PlanoWizardState, PacienteRascunho, ConsultaRascunho, Servico, PlanoPagamento
} from '@/types'

interface Step2Props {
  state: PlanoWizardState
  rawState: PlanoWizardState
  servicos: Servico[]
  planoPagamento: PlanoPagamento | null
  onAddConsulta: (pacienteTempId: string) => void
  onUpdateConsulta: (pacienteTempId: string, consultaTempId: string, changes: Partial<ConsultaRascunho>) => void
  onRemoveConsulta: (pacienteTempId: string, consultaTempId: string) => void
  onReplaceConsultas: (pacienteTempId: string, consultas: ConsultaRascunho[]) => void
}

export default function Step2Consultas({
  state, rawState, servicos, planoPagamento,
  onAddConsulta, onUpdateConsulta, onRemoveConsulta, onReplaceConsultas,
}: Step2Props) {
  const [gerandoIA, setGerandoIA] = useState(false)
  const [erroIA, setErroIA] = useState('')
  const [instrucoes, setInstrucoes] = useState('')

  // Mapa local de serviços para buscar valores corretos sem depender da IA
  const servicoMap = Object.fromEntries(servicos.map(s => [s.id, s]))

  async function handleGerarIA() {
    setErroIA('')
    setGerandoIA(true)

    try {
      const res = await fetch('/api/planos/gerar-consultas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responsavel_nome: rawState.responsavel_nome,
          data_inicio: rawState.data_inicio,
          data_fim: rawState.data_fim,
          observacao: rawState.observacao,
          pacientes: rawState.pacientes.map(p => ({
            tempId: p.tempId,
            nome: p.nome,
            nascimento: p.nascimento,
            observacao: p.observacao,
          })),
          servicos: servicos.map(s => ({
            id: s.id,
            nome: s.nome,
            descricao: s.descricao,
            valor_cheio: s.valor_cheio,
            valor_recorrente: s.valor_recorrente,
          })),
          instrucoes_adicionais: instrucoes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `Erro ${res.status}`)
      }

      const resultado: {
        pacientes: {
          tempId: string
          consultas: {
            servico_id: string
            servico_nome: string
            data_sugerida: string
            valor_cheio: number
            observacao: string
          }[]
        }[]
      } = await res.json()

      // Mapear por índice — não confiar no tempId retornado pela IA
      resultado.pacientes.forEach((pacIA, idx) => {
        const paciente = rawState.pacientes[idx]
        if (!paciente) return

        const consultas: ConsultaRascunho[] = pacIA.consultas.map(c => {
          // Buscar valor do serviço local (em centavos) em vez de usar o que a IA retornou
          const servicoLocal = servicoMap[c.servico_id]
          const valorCheio = servicoLocal
            ? (servicoLocal.valor_recorrente ?? servicoLocal.valor_cheio)
            : c.valor_cheio
          return {
            tempId: crypto.randomUUID(),
            servico_id: c.servico_id,
            servico_nome: c.servico_nome,
            data_sugerida: c.data_sugerida,
            valor_cheio: valorCheio,
            valor_com_plano: valorCheio,
            cashback_gerado: 0,
            cashback_utilizado: 0,
            observacao: c.observacao,
          }
        })
        onReplaceConsultas(paciente.tempId, consultas)
      })
    } catch (e) {
      setErroIA(e instanceof Error ? e.message : 'Erro ao chamar a IA')
    } finally {
      setGerandoIA(false)
    }
  }

  if (state.pacientes.length === 0) {
    return (
      <div className="card text-center py-12 text-slate-400">
        <p className="text-sm">Nenhum paciente no plano.</p>
        <p className="text-xs mt-1">Volte ao passo 1 e adicione pacientes.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Painel de geração por IA */}
      <div className="card border-brand-100 bg-gradient-to-br from-brand-50/40 to-white">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-500" />
              Gerar plano com IA
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              A IA analisa os pacientes, idades e observações para sugerir as consultas automaticamente.
              Você pode editar qualquer campo após a geração.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <textarea
            className="input resize-none text-xs"
            rows={2}
            placeholder="Instruções adicionais para a IA (opcional) — ex: 3 consultas por paciente, intervalos de 2 meses, focar em desenvolvimento neuromotor..."
            value={instrucoes}
            onChange={e => setInstrucoes(e.target.value)}
            disabled={gerandoIA}
          />

          <div className="flex items-center gap-3">
            <button
              className="btn-primary"
              onClick={handleGerarIA}
              disabled={gerandoIA}
            >
              {gerandoIA ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Analisando e gerando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Gerar com IA
                </>
              )}
            </button>

            {state.pacientes.some(p => p.consultas.length > 0) && !gerandoIA && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <RotateCcw className="w-3 h-3" />
                Gerar novamente substituirá as consultas existentes
              </span>
            )}
          </div>

          {erroIA && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {erroIA}
            </p>
          )}
        </div>
      </div>

      {/* Pacientes e consultas */}
      {state.pacientes.map((paciente, pidx) => (
        <div key={paciente.tempId} className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {paciente.nome || `Paciente ${pidx + 1}`}
              </h3>
              {paciente.nascimento && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Nasc.: {paciente.nascimento.split('-').reverse().join('/')}
                </p>
              )}
            </div>
            <button
              className="btn-secondary text-xs"
              onClick={() => onAddConsulta(paciente.tempId)}
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar Consulta
            </button>
          </div>

          {paciente.consultas.length === 0 ? (
            <div className="text-center py-6 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
              <p className="text-sm">Nenhuma consulta adicionada.</p>
              <p className="text-xs mt-1">Use "Gerar com IA" ou adicione manualmente.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paciente.consultas.map((c, cidx) => (
                <ConsultaRow
                  key={c.tempId}
                  consulta={c}
                  index={cidx}
                  servicos={servicos}
                  onUpdate={(tempId, changes) => onUpdateConsulta(paciente.tempId, tempId, changes)}
                  onRemove={(tempId) => onRemoveConsulta(paciente.tempId, tempId)}
                  showCalculado={!!planoPagamento}
                />
              ))}
            </div>
          )}

          {paciente.consultas.length > 0 && (
            <CashbackTimeline
              consultas={paciente.consultas}
              plano={planoPagamento}
              pacienteNome={paciente.nome || `Paciente ${pidx + 1}`}
            />
          )}
        </div>
      ))}
    </div>
  )
}
