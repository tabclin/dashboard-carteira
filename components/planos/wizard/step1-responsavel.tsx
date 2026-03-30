'use client'

import { useId, useState } from 'react'
import { UserPlus, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PacienteSearch from './paciente-search'
import type { PlanoWizardState, PacienteRascunho } from '@/types'

interface Step1Props {
  state: PlanoWizardState
  onChange: (changes: Partial<PlanoWizardState>) => void
  onAddPaciente: () => void
  onAddPacienteComDados: (nome: string, nascimento: string, carteira_id: string) => void
  onUpdatePaciente: (tempId: string, changes: Partial<PacienteRascunho>) => void
  onRemovePaciente: (tempId: string) => void
}

export default function Step1Responsavel({
  state, onChange, onAddPaciente, onAddPacienteComDados, onUpdatePaciente, onRemovePaciente
}: Step1Props) {
  const uid = useId()
  const [showModal, setShowModal] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoNasc, setNovoNasc] = useState('')
  const [salvandoNovo, setSalvandoNovo] = useState(false)
  const [erroNovo, setErroNovo] = useState('')

  function handleSearchSelect(tempId: string, nome: string, nascimento: string, carteira_id: string) {
    onUpdatePaciente(tempId, { nome, nascimento, carteira_id })
  }

  async function handleConfirmarNovo() {
    if (!novoNome.trim()) { setErroNovo('Informe o nome do paciente.'); return }
    setErroNovo('')
    setSalvandoNovo(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('pacientes')
      .insert({ paciente: novoNome.trim(), nascimento: novoNasc || null, fonte: 'manual' })
      .select('id')
      .single()
    setSalvandoNovo(false)
    if (error || !data) {
      setErroNovo('Erro ao cadastrar: ' + (error?.message ?? 'desconhecido'))
      return
    }
    onAddPacienteComDados(novoNome.trim(), novoNasc, data.id)
    setNovoNome('')
    setNovoNasc('')
    setShowModal(false)
  }

  return (
    <div className="space-y-6">
      {/* Dados do responsável */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Dados do Responsável</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor={`${uid}-nome`}>Nome do responsável *</label>
            <input
              id={`${uid}-nome`}
              className="input"
              placeholder="Ex: Maria da Silva"
              value={state.responsavel_nome}
              onChange={e => onChange({ responsavel_nome: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor={`${uid}-tel`}>Telefone</label>
            <input
              id={`${uid}-tel`}
              className="input"
              placeholder="(11) 99999-9999"
              value={state.responsavel_telefone}
              onChange={e => onChange({ responsavel_telefone: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor={`${uid}-di`}>Início do plano</label>
            <input
              id={`${uid}-di`}
              type="month"
              className="input"
              value={state.data_inicio}
              onChange={e => onChange({ data_inicio: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor={`${uid}-df`}>Fim do plano</label>
            <input
              id={`${uid}-df`}
              type="month"
              className="input"
              value={state.data_fim}
              onChange={e => onChange({ data_fim: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor={`${uid}-obs`}>Observações gerais</label>
            <textarea
              id={`${uid}-obs`}
              className="input resize-none"
              rows={2}
              placeholder="Contexto clínico, histórico relevante, etc."
              value={state.observacao}
              onChange={e => onChange({ observacao: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Pacientes */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">Pacientes do Plano</h3>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs" onClick={() => { setNovoNome(''); setNovoNasc(''); setErroNovo(''); setShowModal(true) }}>
              <UserPlus className="w-3.5 h-3.5" /> Novo Paciente
            </button>
            <button className="btn-secondary text-xs" onClick={onAddPaciente}>
              <UserPlus className="w-3.5 h-3.5" /> Adicionar Paciente
            </button>
          </div>
        </div>

        {state.pacientes.length === 0 ? (
          <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
            <p className="text-sm">Nenhum paciente adicionado.</p>
            <p className="text-xs mt-1">Clique em "Adicionar Paciente" para incluir.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {state.pacientes.map((p, idx) => (
              <div key={p.tempId} className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Paciente {idx + 1}
                  </span>
                  <button
                    onClick={() => onRemovePaciente(p.tempId)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mb-2">
                  <label className="label">Buscar da carteira</label>
                  <PacienteSearch
                    onSelect={(nome, nasc, id) => handleSearchSelect(p.tempId, nome, nasc, id)}
                    placeholder="Digite o nome para buscar..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Nome *</label>
                    <input
                      className="input"
                      placeholder="Nome completo"
                      value={p.nome}
                      onChange={e => onUpdatePaciente(p.tempId, { nome: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Nascimento</label>
                    <input
                      type="date"
                      className="input"
                      value={p.nascimento}
                      onChange={e => onUpdatePaciente(p.tempId, { nascimento: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Observação do paciente</label>
                  <input
                    className="input"
                    placeholder="Informações clínicas relevantes"
                    value={p.observacao}
                    onChange={e => onUpdatePaciente(p.tempId, { observacao: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Novo Paciente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Cadastrar novo paciente</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Nome *</label>
                <input
                  className="input"
                  placeholder="Nome completo do paciente"
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Nascimento</label>
                <input
                  type="date"
                  className="input"
                  value={novoNasc}
                  onChange={e => setNovoNasc(e.target.value)}
                />
              </div>
              {erroNovo && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erroNovo}</p>
              )}
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleConfirmarNovo} disabled={salvandoNovo} className="btn-primary flex-1">
                {salvandoNovo ? 'Salvando...' : 'Cadastrar e Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
