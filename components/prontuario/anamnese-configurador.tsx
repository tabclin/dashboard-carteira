'use client'

import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Settings2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { CampoAnamnese, CampoAnamneseTipo, AnamneseTemplate } from '@/types'

const TIPO_LABELS: Record<CampoAnamneseTipo, string> = {
  texto_curto:      'Texto curto',
  texto_longo:      'Texto longo',
  imc:              'IMC (peso + altura)',
  data:             'Data',
  selecao_unica:    'Seleção única',
  multipla_escolha: 'Múltipla escolha',
}

interface Props {
  template: AnamneseTemplate | null  // null = criar novo
  isFirst?: boolean                  // true = primeiro modelo (será padrão)
  onCancelar: () => void
  onSalvo: (template: AnamneseTemplate) => void
}

function novoId() { return Math.random().toString(36).slice(2, 10) }

export default function AnamneseConfigurador({ template, isFirst = false, onCancelar, onSalvo }: Props) {
  const supabase = createClient()

  const [nome, setNome]     = useState(template?.nome ?? '')
  const [campos, setCampos] = useState<CampoAnamnese[]>(() => template?.campos ?? [])
  const [saving, setSaving] = useState(false)
  const [erro, setErro]     = useState('')

  function adicionarCampo() {
    if (campos.length >= 15) return
    setCampos(prev => [...prev, { id: novoId(), titulo: '', tipo: 'texto_curto' }])
  }

  function atualizarCampo(id: string, patch: Partial<CampoAnamnese>) {
    setCampos(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  function removerCampo(id: string) {
    setCampos(prev => prev.filter(c => c.id !== id))
  }

  function moverCampo(idx: number, dir: -1 | 1) {
    setCampos(prev => {
      const arr = [...prev]
      const tgt = idx + dir
      if (tgt < 0 || tgt >= arr.length) return arr
      ;[arr[idx], arr[tgt]] = [arr[tgt], arr[idx]]
      return arr
    })
  }

  function adicionarOpcao(campoId: string) {
    setCampos(prev => prev.map(c =>
      c.id === campoId ? { ...c, opcoes: [...(c.opcoes ?? []), ''] } : c
    ))
  }

  function atualizarOpcao(campoId: string, i: number, valor: string) {
    setCampos(prev => prev.map(c => {
      if (c.id !== campoId) return c
      const opcoes = [...(c.opcoes ?? [])]
      opcoes[i] = valor
      return { ...c, opcoes }
    }))
  }

  function removerOpcao(campoId: string, i: number) {
    setCampos(prev => prev.map(c => {
      if (c.id !== campoId) return c
      return { ...c, opcoes: (c.opcoes ?? []).filter((_, j) => j !== i) }
    }))
  }

  async function salvar() {
    if (!nome.trim()) {
      setErro('Informe um nome para o modelo.'); return
    }
    for (const c of campos) {
      if (!c.titulo.trim()) {
        setErro('Todos os campos devem ter um título.'); return
      }
      if ((c.tipo === 'selecao_unica' || c.tipo === 'multipla_escolha') &&
          (!c.opcoes || c.opcoes.filter(o => o.trim()).length === 0)) {
        setErro(`O campo "${c.titulo}" precisa ter pelo menos uma opção.`); return
      }
    }
    setErro('')
    setSaving(true)

    const camposLimpos = campos.map(c => ({
      ...c,
      titulo: c.titulo.trim(),
      opcoes: c.opcoes?.filter(o => o.trim()),
    }))

    const payload = {
      nome:         nome.trim(),
      campos:       camposLimpos,
      is_padrao:    template?.is_padrao ?? isFirst,
      atualizado_em: new Date().toISOString(),
    }

    let saved: AnamneseTemplate | null = null

    if (template?.id) {
      const { data } = await supabase
        .from('anamnese_template')
        .update(payload)
        .eq('id', template.id)
        .select()
        .single()
      saved = data
    } else {
      const { data } = await supabase
        .from('anamnese_template')
        .insert(payload)
        .select()
        .single()
      saved = data
    }

    setSaving(false)
    if (saved) onSalvo(saved)
  }

  const podeAdicionar = campos.length < 15

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            {template ? 'Editar modelo' : 'Novo modelo de anamnese'}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">{campos.length}/15 campos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancelar} className="btn-secondary text-sm px-3 py-1.5">
            Cancelar
          </button>
          <button onClick={salvar} disabled={saving} className="btn-primary text-sm px-3 py-1.5">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</> : 'Salvar modelo'}
          </button>
        </div>
      </div>

      {/* Nome do modelo */}
      <div className="card space-y-1">
        <label className="label">Nome do modelo</label>
        <input
          className="input text-sm"
          placeholder="Ex: Primeira Consulta, Retorno, Pediatria..."
          value={nome}
          onChange={e => setNome(e.target.value)}
        />
        {isFirst && (
          <p className="text-xs text-brand-600 mt-1">Este será o modelo padrão.</p>
        )}
      </div>

      {erro && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
      )}

      {/* Empty state */}
      {campos.length === 0 && (
        <div className="card text-center py-10 border-dashed bg-slate-50/50">
          <Settings2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">Nenhum campo ainda.</p>
          <p className="text-xs text-slate-400 mt-0.5">Clique em "Adicionar campo" abaixo para começar.</p>
        </div>
      )}

      {/* Campos */}
      <div className="space-y-3">
        {campos.map((campo, idx) => (
          <div key={campo.id} className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button onClick={() => moverCampo(idx, -1)} disabled={idx === 0}
                  className="p-0.5 rounded text-slate-300 hover:text-slate-500 disabled:opacity-20 transition-colors">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => moverCampo(idx, 1)} disabled={idx === campos.length - 1}
                  className="p-0.5 rounded text-slate-300 hover:text-slate-500 disabled:opacity-20 transition-colors">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                className="input flex-1 text-sm"
                placeholder="Título do campo"
                value={campo.titulo}
                onChange={e => atualizarCampo(campo.id, { titulo: e.target.value })}
              />
              <select
                className="input text-sm flex-shrink-0"
                style={{ width: '180px' }}
                value={campo.tipo}
                onChange={e => atualizarCampo(campo.id, {
                  tipo: e.target.value as CampoAnamneseTipo,
                  opcoes: undefined,
                })}
              >
                {(Object.entries(TIPO_LABELS) as [CampoAnamneseTipo, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
              <button onClick={() => removerCampo(campo.id)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {(campo.tipo === 'selecao_unica' || campo.tipo === 'multipla_escolha') && (
              <div className="pl-8 space-y-2 pt-1">
                <p className="text-xs font-medium text-slate-500">Opções disponíveis:</p>
                {(campo.opcoes ?? []).map((op, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input className="input text-sm flex-1" placeholder={`Opção ${i + 1}`}
                      value={op} onChange={e => atualizarOpcao(campo.id, i, e.target.value)} />
                    <button onClick={() => removerOpcao(campo.id, i)}
                      className="p-1 rounded text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button onClick={() => adicionarOpcao(campo.id)}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 transition-colors">
                  <Plus className="w-3 h-3" /> Adicionar opção
                </button>
              </div>
            )}

            {campo.tipo === 'imc' && (
              <p className="pl-8 text-xs text-slate-400">
                Exibe automaticamente: Peso (kg) + Altura (m) + IMC calculado
              </p>
            )}
          </div>
        ))}
      </div>

      {podeAdicionar && (
        <button onClick={adicionarCampo}
          className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 text-sm text-slate-400 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50/30 transition-colors">
          <Plus className="w-4 h-4" /> Adicionar campo
        </button>
      )}
      {!podeAdicionar && (
        <p className="text-center text-xs text-slate-400">Limite de 15 campos atingido.</p>
      )}
    </div>
  )
}
