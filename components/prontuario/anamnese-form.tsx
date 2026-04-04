'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Save, CheckCircle2, Loader2, Settings2, Lock,
  Plus, Pencil, Trash2, ArrowLeft, Star,
} from 'lucide-react'
import AnamneseConfigurador from './anamnese-configurador'
import RichTextEditor from './rich-text-editor'
import type { Prontuario, AnamneseTemplate, CampoAnamnese } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────

function calcImc(p: number, a: number): string {
  return p > 0 && a > 0 ? (p / (a * a)).toFixed(1) : ''
}

function classificarImc(imc: string): string {
  const n = parseFloat(imc)
  if (!n)       return ''
  if (n < 18.5) return 'Abaixo do peso'
  if (n < 25)   return 'Peso normal'
  if (n < 30)   return 'Sobrepeso'
  if (n < 35)   return 'Obesidade grau I'
  if (n < 40)   return 'Obesidade grau II'
  return 'Obesidade grau III'
}

// ─── Textarea auto-expansível ─────────────────────────────────────

function AutoTextarea({ value, onChange, placeholder }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <textarea
      className="input resize-none text-sm overflow-hidden"
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={e => {
        e.target.style.height = 'auto'
        e.target.style.height = e.target.scrollHeight + 'px'
        onChange(e.target.value)
      }}
      onFocus={e => {
        e.target.style.height = 'auto'
        e.target.style.height = e.target.scrollHeight + 'px'
      }}
    />
  )
}

// ─── Renderizador de campo por tipo ──────────────────────────────

function CampoInput({ campo, valor, onChange, disabled = false }: {
  campo: CampoAnamnese
  valor: any
  onChange: (v: any) => void
  disabled?: boolean
}) {
  switch (campo.tipo) {
    case 'texto_curto':
      return (
        <AutoTextarea
          value={valor ?? ''}
          onChange={disabled ? () => {} : onChange}
          placeholder={disabled ? '' : `Digite ${campo.titulo.toLowerCase()}...`}
        />
      )

    case 'texto_longo':
      return (
        <RichTextEditor
          value={valor ?? ''}
          onChange={disabled ? () => {} : onChange}
          placeholder={disabled ? '' : `Digite ${campo.titulo.toLowerCase()}...`}
        />
      )

    case 'data':
      return (
        <input type="date" className="input text-sm" style={{ width: '200px' }}
          disabled={disabled} value={valor ?? ''} onChange={e => onChange(e.target.value)} />
      )

    case 'imc': {
      const v      = valor ?? {}
      const peso   = parseFloat(v.peso   ?? '') || 0
      const altura = parseFloat(v.altura ?? '') || 0
      const imcStr = v.imc || calcImc(peso, altura)
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Peso (kg)</label>
              <input type="number" step="0.1" min="0" className="input text-sm"
                value={v.peso ?? ''} placeholder="70.0"
                onChange={e => {
                  const p = parseFloat(e.target.value) || 0
                  onChange({ ...v, peso: e.target.value, imc: calcImc(p, altura) })
                }} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Altura (m)</label>
              <input type="number" step="0.01" min="0" className="input text-sm"
                value={v.altura ?? ''} placeholder="1.70"
                onChange={e => {
                  const a = parseFloat(e.target.value) || 0
                  onChange({ ...v, altura: e.target.value, imc: calcImc(peso, a) })
                }} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">IMC</label>
              <div className="input text-sm bg-slate-50 text-slate-700 font-semibold flex items-center h-10">
                {imcStr || '—'}
              </div>
            </div>
          </div>
          {imcStr && (
            <p className="text-xs text-slate-500">
              Classificação: <span className="font-medium text-slate-700">{classificarImc(imcStr)}</span>
            </p>
          )}
        </div>
      )
    }

    case 'selecao_unica':
      return (
        <select className="input text-sm" disabled={disabled} value={valor ?? ''} onChange={e => onChange(e.target.value)}>
          <option value="">Selecione...</option>
          {(campo.opcoes ?? []).map(op => <option key={op} value={op}>{op}</option>)}
        </select>
      )

    case 'multipla_escolha': {
      const sel: string[] = Array.isArray(valor) ? valor : []
      return (
        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
          {(campo.opcoes ?? []).map(op => (
            <label key={op} className={`flex items-center gap-2 text-sm select-none ${disabled ? 'cursor-default opacity-70' : 'cursor-pointer'}`}>
              <input type="checkbox" checked={sel.includes(op)} disabled={disabled}
                className="w-4 h-4 rounded border-slate-300 accent-brand-600"
                onChange={e => {
                  if (disabled) return
                  const next = e.target.checked ? [...sel, op] : sel.filter(s => s !== op)
                  onChange(next)
                }} />
              <span className="text-slate-700">{op}</span>
            </label>
          ))}
        </div>
      )
    }

    default: return null
  }
}

// ─── Componente principal ─────────────────────────────────────────

interface AnamneseFormProps {
  prontuario: Prontuario | null
  templates: AnamneseTemplate[]
  bloqueado?: boolean
}

type Modo = 'form' | 'manager' | 'config'

export default function AnamneseForm({ prontuario, templates: initialTemplates, bloqueado = false }: AnamneseFormProps) {
  const supabase = createClient()
  const router   = useRouter()

  const [modo, setModo]           = useState<Modo>('form')
  const [templates, setTemplates] = useState(initialTemplates)
  const [editandoTemplate, setEditandoTemplate] = useState<AnamneseTemplate | null>(null)

  // Template travado (salvo ao menos uma vez)
  const isLocked      = !!prontuario?.template_id
  const lockedCampos: CampoAnamnese[] =
    prontuario?.template_snapshot ??
    templates.find(t => t.id === prontuario?.template_id)?.campos ?? []

  const defaultTemplate  = templates.find(t => t.is_padrao) ?? templates[0] ?? null
  const [activeId, setActiveId] = useState<string | null>(
    prontuario?.template_id ?? defaultTemplate?.id ?? null
  )
  const templateAtivo = isLocked
    ? templates.find(t => t.id === prontuario?.template_id) ?? null
    : templates.find(t => t.id === activeId) ?? null

  const camposAtivos: CampoAnamnese[] = isLocked ? lockedCampos : (templateAtivo?.campos ?? [])

  const [dados, setDados]     = useState<Record<string, any>>(prontuario?.dados_anamnese ?? {})
  const [saving, setSaving]   = useState(false)
  const [salvo, setSalvo]     = useState(false)
  const [autoSalvo, setAutoSalvo] = useState(false)
  const [erro, setErro]       = useState('')
  const autoSaveTimer         = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender         = useRef(true)

  // Auto-save debounced (2s após última alteração)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (!prontuario || modo !== 'form' || camposAtivos.length === 0 || bloqueado) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      await supabase.from('prontuarios').update({
        dados_anamnese: dados,
        atualizado_em:  new Date().toISOString(),
      }).eq('id', prontuario.id)
      setAutoSalvo(true)
      setTimeout(() => setAutoSalvo(false), 3000)
    }, 2000)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [dados])

  function trocarTemplate(id: string) {
    if (isLocked) return
    const temDados = Object.values(dados).some(v => v !== '' && v !== null && v !== undefined)
    if (temDados && !window.confirm('Trocar o modelo limpará os dados não salvos. Continuar?')) return
    setActiveId(id)
    setDados({})
  }

  async function salvarDados() {
    if (!prontuario || camposAtivos.length === 0) return
    setSaving(true); setErro(''); setSalvo(false)

    const { error } = await supabase
      .from('prontuarios')
      .update({
        dados_anamnese:    dados,
        template_id:       templateAtivo?.id ?? null,
        template_snapshot: camposAtivos,
        atualizado_em:     new Date().toISOString(),
      })
      .eq('id', prontuario.id)

    setSaving(false)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }
    setSalvo(true)
    router.refresh()
    setTimeout(() => setSalvo(false), 3000)
  }

  async function deletarTemplate(t: AnamneseTemplate) {
    if (t.is_padrao) {
      alert('O modelo padrão não pode ser excluído. Defina outro como padrão primeiro.')
      return
    }
    if (!window.confirm(`Excluir o modelo "${t.nome}"?`)) return
    const { error } = await supabase.from('anamnese_template').delete().eq('id', t.id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    const novo = templates.filter(x => x.id !== t.id)
    setTemplates(novo)
    if (activeId === t.id) setActiveId(novo.find(x => x.is_padrao)?.id ?? null)
  }

  async function definirPadrao(t: AnamneseTemplate) {
    if (t.is_padrao) return
    await supabase.from('anamnese_template').update({ is_padrao: false }).neq('id', t.id)
    await supabase.from('anamnese_template').update({ is_padrao: true  }).eq('id', t.id)
    setTemplates(prev => prev.map(x => ({ ...x, is_padrao: x.id === t.id })))
  }

  // ── Modo: editar / criar template ────────────────────────────

  if (modo === 'config') {
    return (
      <AnamneseConfigurador
        template={editandoTemplate}
        isFirst={templates.length === 0}
        onCancelar={() => setModo(templates.length === 0 ? 'form' : 'manager')}
        onSalvo={saved => {
          setTemplates(prev => {
            const idx = prev.findIndex(x => x.id === saved.id)
            if (idx >= 0) {
              const arr = [...prev]; arr[idx] = saved; return arr
            }
            return [...prev, saved]
          })
          if (!activeId) setActiveId(saved.id)
          setModo(templates.length === 0 ? 'form' : 'manager')
        }}
      />
    )
  }

  // ── Modo: gerenciar modelos ──────────────────────────────────

  if (modo === 'manager') {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setModo('form')}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Modelos de Anamnese</h3>
              <p className="text-xs text-slate-400">{templates.length} modelo{templates.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={() => { setEditandoTemplate(null); setModo('config') }}
            className="btn-primary text-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Novo modelo
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="card text-center py-10 border-dashed bg-slate-50/50">
            <Settings2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">Nenhum modelo criado ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map(t => (
              <div key={t.id} className="card flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800 truncate">{t.nome}</span>
                    {t.is_padrao && (
                      <span className="text-xs px-1.5 py-0.5 bg-brand-100 text-brand-700 rounded-full font-medium flex-shrink-0">
                        Padrão
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t.campos.length} campo{t.campos.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!t.is_padrao && (
                    <button onClick={() => definirPadrao(t)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                      title="Definir como padrão">
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => { setEditandoTemplate(t); setModo('config') }}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                    title="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {!t.is_padrao && (
                    <button onClick={() => deletarTemplate(t)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Excluir">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Modo: relatório (consulta finalizada) ────────────────────

  if (bloqueado) {
    const temDados = camposAtivos.some(c => {
      const v = dados[c.id]
      return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
    })

    return (
      <div className="space-y-0">
        {/* Cabeçalho do relatório */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-brand-500" />
            <h3 className="text-sm font-semibold text-slate-700">
              Anamnese{templateAtivo ? ` — ${templateAtivo.nome}` : ''}
            </h3>
          </div>
        </div>

        {!temDados ? (
          <div className="card py-10 text-center">
            <p className="text-sm text-slate-400">Nenhum dado de anamnese registrado nesta consulta.</p>
          </div>
        ) : (
          <div className="card divide-y divide-slate-100 p-0 overflow-hidden">
            {camposAtivos.map(campo => {
              const valor = dados[campo.id]
              const vazio = valor === undefined || valor === null || valor === '' ||
                (Array.isArray(valor) && valor.length === 0)
              if (vazio) return null

              return (
                <div key={campo.id} className="px-5 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                    {campo.titulo}
                  </p>

                  {campo.tipo === 'texto_longo' ? (
                    // HTML do rich text editor
                    <div
                      className="prose prose-sm max-w-none text-slate-700 prose-p:my-1 prose-ul:my-1 prose-ol:my-1"
                      dangerouslySetInnerHTML={{ __html: valor ?? '' }}
                    />
                  ) : campo.tipo === 'imc' ? (
                    <div className="flex flex-wrap gap-6 text-sm text-slate-700">
                      {valor.peso  && <span><span className="text-slate-400">Peso:</span> {valor.peso} kg</span>}
                      {valor.altura && <span><span className="text-slate-400">Altura:</span> {valor.altura} m</span>}
                      {valor.imc   && (
                        <span>
                          <span className="text-slate-400">IMC:</span>{' '}
                          <span className="font-semibold text-brand-700">{valor.imc}</span>
                        </span>
                      )}
                    </div>
                  ) : campo.tipo === 'multipla_escolha' ? (
                    <div className="flex flex-wrap gap-2">
                      {(valor as string[]).map(op => (
                        <span key={op} className="text-xs bg-brand-50 text-brand-700 border border-brand-100 px-2.5 py-1 rounded-full font-medium">
                          {op}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{String(valor)}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Modo: formulário ─────────────────────────────────────────

  if (templates.length === 0) {
    return (
      <div className="card text-center py-14">
        <Settings2 className="w-10 h-10 mx-auto text-slate-300 mb-3" />
        <p className="text-slate-700 font-medium text-sm">Nenhum modelo de anamnese configurado</p>
        <p className="text-xs text-slate-400 mt-1 mb-5">Crie um modelo para começar a registrar anamneses.</p>
        <button onClick={() => { setEditandoTemplate(null); setModo('config') }} className="btn-primary">
          <Plus className="w-4 h-4" /> Criar primeiro modelo
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Seletor de modelo */}
      <div className="flex items-center justify-between gap-3">
        {isLocked ? (
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-sm font-medium text-slate-700">{templateAtivo?.nome ?? 'Modelo'}</span>
            <span className="text-xs text-slate-400">· modelo travado após início</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Modelo:</label>
            <select
              className="input text-sm py-1.5"
              value={activeId ?? ''}
              onChange={e => trocarTemplate(e.target.value)}
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.nome}{t.is_padrao ? ' (padrão)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          onClick={() => setModo('manager')}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors whitespace-nowrap flex-shrink-0"
        >
          <Settings2 className="w-3.5 h-3.5" /> Gerenciar modelos
        </button>
      </div>

      {/* Aviso de modelo travado */}
      {isLocked && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Não é possível alterar o modelo após o início da anamnese.
        </p>
      )}

      {/* Campos ou estado vazio */}
      {camposAtivos.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-sm text-slate-500">Este modelo não tem campos configurados.</p>
          <button onClick={() => setModo('manager')} className="text-xs text-brand-600 mt-2 hover:underline">
            Editar modelo →
          </button>
        </div>
      ) : (
        <div className="card space-y-5">
          {camposAtivos.map(campo => (
            <div key={campo.id}>
              <label className="label">{campo.titulo}</label>
              <CampoInput
                campo={campo}
                valor={dados[campo.id]}
                onChange={v => setDados(prev => ({ ...prev, [campo.id]: v }))}
                disabled={bloqueado}
              />
            </div>
          ))}

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <button onClick={salvarDados} disabled={saving || !prontuario || bloqueado} className="btn-primary">
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                : <><Save className="w-4 h-4" /> Salvar anamnese</>
              }
            </button>
            {salvo && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 className="w-4 h-4" /> Salvo!
              </span>
            )}
            {autoSalvo && !salvo && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Salvo automaticamente
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
