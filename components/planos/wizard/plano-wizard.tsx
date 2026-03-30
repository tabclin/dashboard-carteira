'use client'

import { useReducer, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { recalcularTodosPacientes } from '@/lib/planos-utils'
import WizardStepIndicator from './wizard-step-indicator'
import Step1Responsavel from './step1-responsavel'
import Step2Consultas from './step2-consultas'
import Step3Revisao from './step3-revisao'
import { ChevronLeft, ChevronRight, Save } from 'lucide-react'
import type {
  Servico, PlanoPagamento,
  PlanoWizardState, PacienteRascunho, ConsultaRascunho
} from '@/types'

function uuid() {
  return crypto.randomUUID()
}

function emptyPaciente(): PacienteRascunho {
  return { tempId: uuid(), nome: '', nascimento: '', observacao: '', consultas: [] }
}

function emptyConsulta(): ConsultaRascunho {
  return {
    tempId: uuid(), servico_id: null, servico_nome: '', data_sugerida: '',
    valor_cheio: 0, valor_com_plano: 0, cashback_gerado: 0, cashback_utilizado: 0,
    observacao: '',
  }
}

const initialState: PlanoWizardState = {
  responsavel_nome: '',
  responsavel_telefone: '',
  data_inicio: '',
  data_fim: '',
  plano_pagamento_id: null,
  observacao: '',
  pacientes: [],
}

type Action =
  | { type: 'SET_ROOT'; changes: Partial<PlanoWizardState> }
  | { type: 'ADD_PACIENTE' }
  | { type: 'ADD_PACIENTE_COM_DADOS'; nome: string; nascimento: string; carteira_id: string }
  | { type: 'UPDATE_PACIENTE'; tempId: string; changes: Partial<PacienteRascunho> }
  | { type: 'REMOVE_PACIENTE'; tempId: string }
  | { type: 'ADD_CONSULTA'; pacienteTempId: string }
  | { type: 'UPDATE_CONSULTA'; pacienteTempId: string; consultaTempId: string; changes: Partial<ConsultaRascunho> }
  | { type: 'REMOVE_CONSULTA'; pacienteTempId: string; consultaTempId: string }
  | { type: 'REPLACE_CONSULTAS'; pacienteTempId: string; consultas: ConsultaRascunho[] }

function reducer(state: PlanoWizardState, action: Action): PlanoWizardState {
  switch (action.type) {
    case 'SET_ROOT':
      return { ...state, ...action.changes }

    case 'ADD_PACIENTE':
      return { ...state, pacientes: [...state.pacientes, emptyPaciente()] }

    case 'ADD_PACIENTE_COM_DADOS':
      return {
        ...state,
        pacientes: [...state.pacientes, {
          ...emptyPaciente(),
          nome: action.nome,
          nascimento: action.nascimento,
          carteira_id: action.carteira_id,
        }],
      }

    case 'UPDATE_PACIENTE':
      return {
        ...state,
        pacientes: state.pacientes.map(p =>
          p.tempId === action.tempId ? { ...p, ...action.changes } : p
        ),
      }

    case 'REMOVE_PACIENTE':
      return { ...state, pacientes: state.pacientes.filter(p => p.tempId !== action.tempId) }

    case 'ADD_CONSULTA':
      return {
        ...state,
        pacientes: state.pacientes.map(p =>
          p.tempId === action.pacienteTempId
            ? { ...p, consultas: [...p.consultas, emptyConsulta()] }
            : p
        ),
      }

    case 'UPDATE_CONSULTA':
      return {
        ...state,
        pacientes: state.pacientes.map(p =>
          p.tempId === action.pacienteTempId
            ? {
                ...p,
                consultas: p.consultas.map(c =>
                  c.tempId === action.consultaTempId ? { ...c, ...action.changes } : c
                ),
              }
            : p
        ),
      }

    case 'REMOVE_CONSULTA':
      return {
        ...state,
        pacientes: state.pacientes.map(p =>
          p.tempId === action.pacienteTempId
            ? { ...p, consultas: p.consultas.filter(c => c.tempId !== action.consultaTempId) }
            : p
        ),
      }

    case 'REPLACE_CONSULTAS':
      return {
        ...state,
        pacientes: state.pacientes.map(p =>
          p.tempId === action.pacienteTempId
            ? { ...p, consultas: action.consultas }
            : p
        ),
      }

    default:
      return state
  }
}

interface PlanoWizardProps {
  servicos: Servico[]
  planosPagamento: PlanoPagamento[]
}

export default function PlanoWizard({ servicos, planosPagamento }: PlanoWizardProps) {
  const supabase = createClient()
  const router = useRouter()
  const [state, dispatch] = useReducer(reducer, initialState)
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  const planoPagamento = planosPagamento.find(p => p.id === state.plano_pagamento_id) ?? null

  // Consultas com cálculos aplicados (para step2)
  const stateCalculado = {
    ...state,
    pacientes: recalcularTodosPacientes(state.pacientes, planoPagamento),
  }

  function validarStep1() {
    if (!state.responsavel_nome.trim()) return 'Informe o nome do responsável.'
    if (state.pacientes.length === 0) return 'Adicione pelo menos um paciente.'
    for (const p of state.pacientes) {
      if (!p.nome.trim()) return 'Todos os pacientes precisam ter nome.'
    }
    return null
  }

  function validarStep2() {
    for (const p of state.pacientes) {
      if (p.consultas.length === 0) return `${p.nome || 'Um paciente'} não tem consultas.`
      for (const c of p.consultas) {
        if (!c.servico_nome) return `Selecione o serviço em todas as consultas de ${p.nome}.`
        if (c.valor_cheio <= 0) return `Defina o valor em todas as consultas de ${p.nome}.`
      }
    }
    return null
  }

  function handleNext() {
    setErro('')
    if (step === 1) {
      const err = validarStep1()
      if (err) { setErro(err); return }
    }
    if (step === 2) {
      const err = validarStep2()
      if (err) { setErro(err); return }
    }
    setStep(s => s + 1)
  }

  async function handleSave() {
    setErro('')
    setSaving(true)

    const pacientesCalculados = recalcularTodosPacientes(state.pacientes, planoPagamento)

    // 1. Inserir plano
    const { data: plano, error: errPlano } = await supabase
      .from('planos_acompanhamento')
      .insert({
        responsavel_nome:    state.responsavel_nome.trim(),
        responsavel_telefone: state.responsavel_telefone.trim() || null,
        status:              'rascunho',
        data_inicio:         state.data_inicio ? `${state.data_inicio}-01` : null,
        data_fim:            state.data_fim ? `${state.data_fim}-01` : null,
        plano_pagamento_id:  state.plano_pagamento_id || null,
        observacao:          state.observacao.trim() || null,
      })
      .select('id')
      .single()

    if (errPlano || !plano) {
      setSaving(false)
      setErro('Erro ao salvar plano: ' + (errPlano?.message ?? 'desconhecido'))
      return
    }

    // 2. Inserir pacientes
    const { data: pacientesDB, error: errPac } = await supabase
      .from('plano_pacientes')
      .insert(
        pacientesCalculados.map((p, idx) => ({
          plano_id:    plano.id,
          nome:        p.nome.trim(),
          nascimento:  p.nascimento || null,
          observacao:  p.observacao.trim() || null,
          ordem:       idx,
          carteira_id: p.carteira_id ?? null,
        }))
      )
      .select('id')

    if (errPac || !pacientesDB) {
      setSaving(false)
      setErro('Erro ao salvar pacientes: ' + (errPac?.message ?? 'desconhecido'))
      return
    }

    // 3. Inserir consultas
    const consultasPayload = pacientesCalculados.flatMap((p, pidx) =>
      p.consultas.map((c, cidx) => ({
        plano_id:          plano.id,
        paciente_id:       pacientesDB[pidx].id,
        servico_id:        c.servico_id || null,
        servico_nome:      c.servico_nome,
        data_sugerida:     c.data_sugerida || null,
        valor_cheio:       c.valor_cheio,
        valor_com_plano:   c.valor_com_plano,
        cashback_gerado:   c.cashback_gerado,
        cashback_utilizado: c.cashback_utilizado,
        observacao:        c.observacao.trim() || null,
        realizada:         false,
        ordem:             cidx,
      }))
    )

    const { error: errCons } = await supabase.from('plano_consultas').insert(consultasPayload)

    setSaving(false)

    if (errCons) {
      setErro('Erro ao salvar consultas: ' + errCons.message)
      return
    }

    router.push(`/planos/${plano.id}`)
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="card py-5 flex justify-center">
        <WizardStepIndicator currentStep={step} />
      </div>

      {/* Conteúdo do step */}
      {step === 1 && (
        <Step1Responsavel
          state={state}
          onChange={changes => dispatch({ type: 'SET_ROOT', changes })}
          onAddPaciente={() => dispatch({ type: 'ADD_PACIENTE' })}
          onAddPacienteComDados={(nome, nascimento, carteira_id) =>
            dispatch({ type: 'ADD_PACIENTE_COM_DADOS', nome, nascimento, carteira_id })
          }
          onUpdatePaciente={(id, changes) => dispatch({ type: 'UPDATE_PACIENTE', tempId: id, changes })}
          onRemovePaciente={id => dispatch({ type: 'REMOVE_PACIENTE', tempId: id })}
        />
      )}

      {step === 2 && (
        <Step2Consultas
          state={stateCalculado}
          rawState={state}
          servicos={servicos}
          planoPagamento={planoPagamento}
          onAddConsulta={pid => dispatch({ type: 'ADD_CONSULTA', pacienteTempId: pid })}
          onUpdateConsulta={(pid, cid, changes) =>
            dispatch({ type: 'UPDATE_CONSULTA', pacienteTempId: pid, consultaTempId: cid, changes })
          }
          onRemoveConsulta={(pid, cid) =>
            dispatch({ type: 'REMOVE_CONSULTA', pacienteTempId: pid, consultaTempId: cid })
          }
          onReplaceConsultas={(pid, consultas) =>
            dispatch({ type: 'REPLACE_CONSULTAS', pacienteTempId: pid, consultas })
          }
        />
      )}

      {step === 3 && (
        <Step3Revisao
          state={stateCalculado}
          planosPagamento={planosPagamento}
          onChange={changes => dispatch({ type: 'SET_ROOT', changes })}
        />
      )}

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {/* Navegação */}
      <div className="flex items-center justify-between no-print">
        <button
          className="btn-secondary"
          onClick={() => { setErro(''); setStep(s => s - 1) }}
          disabled={step === 1 || saving}
        >
          <ChevronLeft className="w-4 h-4" /> Anterior
        </button>

        <span className="text-xs text-slate-400">Passo {step} de 3</span>

        {step < 3 ? (
          <button className="btn-primary" onClick={handleNext} disabled={saving}>
            Próximo <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Plano'}
          </button>
        )}
      </div>
    </div>
  )
}
