'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { X, Loader2, Plus, Trash2, Lock } from 'lucide-react'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import type { ProntuarioConsulta, ProntuarioPrescricao } from '@/types'

interface ConsultaFormProps {
  prontuarioId: string
  editando: ProntuarioConsulta | null
  onClose: () => void
}

interface PrescricaoForm {
  id?: string
  medicamento: string
  dosagem: string
  frequencia: string
  duracao: string
  instrucoes: string
}

const CAMPOS_CONSULTA: { key: keyof ProntuarioConsulta; label: string; placeholder: string }[] = [
  { key: 'queixa_principal',      label: 'Queixa principal',        placeholder: 'Motivo da consulta...' },
  { key: 'historia_doenca_atual', label: 'História da doença atual', placeholder: 'Descrição detalhada...' },
  { key: 'exame_fisico',          label: 'Exame físico',             placeholder: 'Achados do exame físico...' },
  { key: 'hipotese_diagnostica',  label: 'Hipótese diagnóstica',     placeholder: 'CID, hipótese clínica...' },
  { key: 'conduta',               label: 'Conduta',                  placeholder: 'Tratamento, orientações...' },
  { key: 'evolucao',              label: 'Evolução',                  placeholder: 'Notas de evolução livres...' },
]

function formatarDataHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ConsultaForm({ prontuarioId, editando, onClose }: ConsultaFormProps) {
  const supabase = createClient()
  const router   = useRouter()

  const finalizado = editando?.status === 'finalizado'

  const hoje = new Date().toISOString().slice(0, 10)

  const [data, setData]                         = useState(hoje)
  const [profissionalNome, setProfissionalNome] = useState('')
  const [campos, setCampos] = useState({
    queixa_principal:      '',
    historia_doenca_atual: '',
    exame_fisico:          '',
    hipotese_diagnostica:  '',
    conduta:               '',
    evolucao:              '',
  })
  const [prescricoes, setPrescricoes]           = useState<PrescricaoForm[]>([])
  const [saving, setSaving]                     = useState(false)
  const [erro, setErro]                         = useState('')
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false)

  // Preencher ao editar
  useEffect(() => {
    if (editando) {
      setData(editando.data)
      setProfissionalNome(editando.profissional_nome ?? '')
      setCampos({
        queixa_principal:      editando.queixa_principal ?? '',
        historia_doenca_atual: editando.historia_doenca_atual ?? '',
        exame_fisico:          editando.exame_fisico ?? '',
        hipotese_diagnostica:  editando.hipotese_diagnostica ?? '',
        conduta:               editando.conduta ?? '',
        evolucao:              editando.evolucao ?? '',
      })
      setPrescricoes((editando.prescricoes ?? []).map(p => ({
        id:          p.id,
        medicamento: p.medicamento,
        dosagem:     p.dosagem ?? '',
        frequencia:  p.frequencia ?? '',
        duracao:     p.duracao ?? '',
        instrucoes:  p.instrucoes ?? '',
      })))
    }
  }, [editando])

  function addPrescricao() {
    setPrescricoes(prev => [...prev, { medicamento: '', dosagem: '', frequencia: '', duracao: '', instrucoes: '' }])
  }

  function removePrescricao(i: number) {
    setPrescricoes(prev => prev.filter((_, j) => j !== i))
  }

  function updatePrescricao(i: number, key: keyof PrescricaoForm, val: string) {
    setPrescricoes(prev => prev.map((p, j) => j === i ? { ...p, [key]: val } : p))
  }

  async function salvar() {
    if (finalizado) return  // Registros finalizados são imutáveis
    setErro('')
    setSaving(true)

    const payload = {
      prontuario_id:         prontuarioId,
      data,
      profissional_nome:     profissionalNome.trim() || null,
      queixa_principal:      campos.queixa_principal.trim() || null,
      historia_doenca_atual: campos.historia_doenca_atual.trim() || null,
      exame_fisico:          campos.exame_fisico.trim() || null,
      hipotese_diagnostica:  campos.hipotese_diagnostica.trim() || null,
      conduta:               campos.conduta.trim() || null,
      evolucao:              campos.evolucao.trim() || null,
    }

    let consultaId: string

    if (editando) {
      const { error } = await supabase.from('prontuario_consultas')
        .update({ ...payload, atualizado_em: new Date().toISOString() })
        .eq('id', editando.id)
      if (error) { setErro('Erro: ' + error.message); setSaving(false); return }
      consultaId = editando.id

      // Deletar prescrições antigas e reinserir
      await supabase.from('prontuario_prescricoes').delete().eq('consulta_id', consultaId)
    } else {
      const { data: nova, error } = await supabase.from('prontuario_consultas')
        .insert(payload).select().single()
      if (error || !nova) { setErro('Erro: ' + (error?.message ?? 'sem retorno')); setSaving(false); return }
      consultaId = nova.id
    }

    // Inserir prescrições
    const precsValidas = prescricoes.filter(p => p.medicamento.trim())
    if (precsValidas.length > 0) {
      await supabase.from('prontuario_prescricoes').insert(
        precsValidas.map((p, i) => ({
          consulta_id: consultaId,
          medicamento: p.medicamento.trim(),
          dosagem:     p.dosagem.trim() || null,
          frequencia:  p.frequencia.trim() || null,
          duracao:     p.duracao.trim() || null,
          instrucoes:  p.instrucoes.trim() || null,
          ordem:       i,
        }))
      )
    }

    setSaving(false)
    router.refresh()
    onClose()
  }

  async function excluir() {
    if (!editando || finalizado) return
    await supabase.from('prontuario_consultas').delete().eq('id', editando.id)
    router.refresh()
    onClose()
  }

  // ESC fecha
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div className="flex items-center gap-2">
            {finalizado && <Lock className="w-4 h-4 text-slate-400" />}
            <h3 className="font-semibold text-slate-800">
              {finalizado ? 'Consulta finalizada' : editando ? 'Editar Consulta' : 'Nova Consulta'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Banner de registro finalizado */}
          {finalizado && (
            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <Lock className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-emerald-800 space-y-0.5">
                <p className="font-semibold">Registro protegido — somente leitura</p>
                {editando?.finalizado_em && (
                  <p>Finalizado em {formatarDataHora(editando.finalizado_em)}
                    {editando.duracao_minutos != null && ` · duração: ${editando.duracao_minutos} min`}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Data + Profissional */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data</label>
              {finalizado
                ? <p className="text-sm text-slate-700 py-1">{data ? data.split('-').reverse().join('/') : '—'}</p>
                : <input type="date" className="input" value={data} onChange={e => setData(e.target.value)} />
              }
            </div>
            <div>
              <label className="label">Profissional</label>
              {finalizado
                ? <p className="text-sm text-slate-700 py-1">{profissionalNome || '—'}</p>
                : <input className="input" placeholder="Nome do médico..." value={profissionalNome} onChange={e => setProfissionalNome(e.target.value)} />
              }
            </div>
          </div>

          {/* Campos clínicos */}
          {CAMPOS_CONSULTA.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="label">{label}</label>
              {finalizado
                ? <p className={cn('text-sm py-1', (campos as any)[key] ? 'text-slate-700 whitespace-pre-wrap' : 'text-slate-400 italic')}>
                    {(campos as any)[key] || 'Não informado'}
                  </p>
                : <textarea
                    className="input resize-none text-sm"
                    rows={3}
                    placeholder={placeholder}
                    value={(campos as any)[key]}
                    onChange={e => setCampos(prev => ({ ...prev, [key]: e.target.value }))}
                  />
              }
            </div>
          ))}

          {/* Prescrições */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Prescrições</label>
              {!finalizado && (
                <button
                  onClick={addPrescricao}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar medicamento
                </button>
              )}
            </div>

            {prescricoes.length === 0 && (
              <p className="text-xs text-slate-400 italic">
                {finalizado ? 'Nenhuma prescrição registrada.' : 'Nenhuma prescrição. Clique em "Adicionar medicamento".'}
              </p>
            )}

            <div className="space-y-3">
              {prescricoes.map((p, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Medicamento {i + 1}</span>
                    {!finalizado && (
                      <button onClick={() => removePrescricao(i)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {finalizado ? (
                    <>
                      <p className="text-sm font-semibold text-slate-800">{p.medicamento}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {p.dosagem    && <span className="text-xs text-slate-600">{p.dosagem}</span>}
                        {p.frequencia && <span className="text-xs text-slate-600">{p.frequencia}</span>}
                        {p.duracao    && <span className="text-xs text-slate-600">por {p.duracao}</span>}
                      </div>
                      {p.instrucoes && <p className="text-xs text-slate-500 italic">{p.instrucoes}</p>}
                    </>
                  ) : (
                    <>
                      <input
                        className="input text-sm"
                        placeholder="Nome do medicamento *"
                        value={p.medicamento}
                        onChange={e => updatePrescricao(i, 'medicamento', e.target.value)}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input className="input text-sm" placeholder="Dosagem"    value={p.dosagem}    onChange={e => updatePrescricao(i, 'dosagem',    e.target.value)} />
                        <input className="input text-sm" placeholder="Frequência" value={p.frequencia} onChange={e => updatePrescricao(i, 'frequencia', e.target.value)} />
                        <input className="input text-sm" placeholder="Duração"    value={p.duracao}    onChange={e => updatePrescricao(i, 'duracao',    e.target.value)} />
                      </div>
                      <input className="input text-sm" placeholder="Instruções adicionais" value={p.instrucoes} onChange={e => updatePrescricao(i, 'instrucoes', e.target.value)} />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 pb-6">
          {finalizado ? (
            <button onClick={onClose} className="btn-secondary flex-1">Fechar</button>
          ) : (
            <>
              {editando && (
                <button
                  onClick={() => setConfirmandoExcluir(true)}
                  className="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                  title="Excluir consulta"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={salvar} disabled={saving} className="btn-primary flex-1">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : editando ? 'Salvar alterações' : 'Registrar consulta'}
              </button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmandoExcluir}
        mensagem="Excluir este registro de consulta?"
        detalhe="As prescrições vinculadas também serão removidas."
        onConfirmar={() => { excluir(); setConfirmandoExcluir(false) }}
        onCancelar={() => setConfirmandoExcluir(false)}
      />
    </div>
  )
}
