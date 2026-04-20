'use client'

import { useState, useRef } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, X, ImagePlus, ZoomIn, ZoomOut } from 'lucide-react'
import type { SecaoTemplate, TipoSecao } from '@/lib/orientacoes/types'
import { TIPO_LABELS } from '@/lib/orientacoes/types'
import { VARIABLES } from '@/lib/orientacoes/variables'
import { parseImageValor, serializeImageValor } from './secao-input'
import { RichTextEditor } from './editor'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

interface Props {
  secoes:   SecaoTemplate[]
  onChange: (secoes: SecaoTemplate[]) => void
}

export function TemplateBuilder({ secoes, onChange }: Props) {
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function add() {
    if (secoes.length >= 20) return
    const newId = uid()
    onChange([...secoes, { id: newId, titulo: '', tipo: 'texto_longo', valor: '' }])
    setFocusedId(newId)
  }

  function remove(id: string) {
    onChange(secoes.filter(s => s.id !== id))
  }

  function move(idx: number, dir: -1 | 1) {
    const arr = [...secoes]
    const tgt = idx + dir
    if (tgt < 0 || tgt >= arr.length) return
    ;[arr[idx], arr[tgt]] = [arr[tgt], arr[idx]]
    onChange(arr)
  }

  function update(id: string, patch: Partial<SecaoTemplate>) {
    onChange(secoes.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  function changeType(id: string, tipo: TipoSecao) {
    // Clear valor and opcoes when switching type
    update(id, { tipo, valor: '', opcoes: undefined })
  }

  function addOpcao(id: string) {
    const s = secoes.find(x => x.id === id)
    if (!s) return
    update(id, { opcoes: [...(s.opcoes ?? []), ''] })
  }

  function updateOpcao(id: string, i: number, val: string) {
    const s = secoes.find(x => x.id === id)
    if (!s) return
    const opcoes = [...(s.opcoes ?? [])]
    opcoes[i] = val
    update(id, { opcoes })
  }

  function removeOpcao(id: string, i: number) {
    const s = secoes.find(x => x.id === id)
    if (!s) return
    update(id, { opcoes: (s.opcoes ?? []).filter((_, j) => j !== i) })
  }

  function insertVar(id: string, variable: string, tipo: TipoSecao) {
    const s = secoes.find(x => x.id === id)
    if (!s) return
    if (tipo === 'texto_longo') {
      // For rich text, append as a text node inline
      update(id, { valor: s.valor + variable })
    } else {
      update(id, { valor: (s.valor ?? '') + variable })
    }
  }

  return (
    <div className="space-y-4">
      {secoes.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
          Nenhuma seção ainda. Clique em "Adicionar seção" para começar.
        </p>
      )}

      {secoes.map((s, i) => (
        <div
          key={s.id}
          className={`border rounded-xl overflow-hidden transition-colors ${
            focusedId === s.id ? 'border-indigo-300 shadow-sm' : 'border-slate-200'
          }`}
          onClick={() => setFocusedId(s.id)}
        >
          {/* Section header */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border-b border-slate-200">
            <span className="text-xs text-slate-400 font-mono w-5">{i + 1}</span>

            <input
              className="flex-1 text-sm font-semibold bg-transparent border-none outline-none placeholder-slate-400 text-slate-700"
              placeholder="Título da seção..."
              value={s.titulo}
              onChange={e => update(s.id, { titulo: e.target.value })}
            />

            <select
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-300"
              value={s.tipo}
              onChange={e => changeType(s.id, e.target.value as TipoSecao)}
            >
              {(Object.keys(TIPO_LABELS) as TipoSecao[]).map(t => (
                <option key={t} value={t}>{TIPO_LABELS[t]}</option>
              ))}
            </select>

            <div className="flex items-center gap-0.5">
              <button onClick={(e) => { e.stopPropagation(); move(i, -1) }} disabled={i === 0}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors" title="Subir">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); move(i, 1) }} disabled={i === secoes.length - 1}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors" title="Descer">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); remove(s.id) }}
                className="p-1 text-red-400 hover:text-red-600 transition-colors" title="Remover">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Content area */}
          <div className="p-3 bg-white space-y-2">
            {/* Variable buttons */}
            {s.tipo !== 'selecao_unica' && s.tipo !== 'imagem' && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-slate-400">Inserir variável:</span>
                {VARIABLES.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); insertVar(s.id, v.key, s.tipo) }}
                    className="px-2 py-0.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded font-mono transition-colors border border-indigo-100"
                    title={v.label}
                  >
                    {v.key}
                  </button>
                ))}
              </div>
            )}

            {/* texto_curto: plain textarea */}
            {s.tipo === 'texto_curto' && (
              <textarea
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none bg-white"
                rows={4}
                placeholder="Conteúdo padrão desta seção (pode usar variáveis)..."
                value={s.valor}
                onChange={e => update(s.id, { valor: e.target.value })}
              />
            )}

            {/* texto_longo: rich text editor */}
            {s.tipo === 'texto_longo' && (
              <RichTextEditor
                key={s.id}
                content={s.valor}
                onChange={html => update(s.id, { valor: html })}
                placeholder="Conteúdo padrão desta seção (pode usar variáveis)..."
              />
            )}

            {/* selecao_unica: option list */}
            {s.tipo === 'selecao_unica' && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium">Opções do dropdown:</p>
                {(s.opcoes ?? []).map((op, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <input
                      className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      placeholder={`Opção ${j + 1}`}
                      value={op}
                      onChange={e => updateOpcao(s.id, j, e.target.value)}
                    />
                    <button onClick={() => removeOpcao(s.id, j)} className="text-red-400 hover:text-red-600 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addOpcao(s.id)}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar opção
                </button>
              </div>
            )}

            {/* imagem: file upload */}
            {s.tipo === 'imagem' && (() => {
              const { src, largura } = parseImageValor(s.valor)
              return (
                <div className="space-y-3">
                  {src ? (
                    <>
                      <div className="relative" style={{ width: `${largura}%` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={s.titulo} className="w-full rounded-lg border border-slate-200 object-contain" />
                        <button type="button" onClick={() => update(s.id, { valor: '' })}
                          className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow text-red-400 hover:text-red-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <ZoomOut className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <input
                          type="range"
                          min={20}
                          max={100}
                          step={5}
                          value={largura}
                          onChange={e => update(s.id, { valor: serializeImageValor(src, Number(e.target.value)) })}
                          className="flex-1 accent-indigo-600"
                        />
                        <ZoomIn className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="text-xs font-mono text-slate-500 w-10 text-right">{largura}%</span>
                      </div>

                      <button type="button" onClick={() => fileRefs.current[s.id]?.click()}
                        className="text-xs text-indigo-600 hover:underline">
                        Trocar imagem
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => fileRefs.current[s.id]?.click()}
                      className="flex flex-col items-center gap-2 w-full py-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors">
                      <ImagePlus className="w-7 h-7" />
                      <span className="text-sm">Clique para inserir imagem padrão</span>
                      <span className="text-xs">PNG, JPG, WEBP — máx. 3 MB</span>
                    </button>
                  )}
                  <input
                    ref={el => { fileRefs.current[s.id] = el }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 3 * 1024 * 1024) { alert('Imagem muito grande. Máximo 3 MB.'); return }
                      const reader = new FileReader()
                      reader.onload = ev => update(s.id, { valor: serializeImageValor(ev.target?.result as string, largura) })
                      reader.readAsDataURL(file)
                    }}
                  />
                </div>
              )
            })()}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        disabled={secoes.length >= 20}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40"
      >
        <Plus className="w-4 h-4" />
        Adicionar seção
      </button>
    </div>
  )
}
