'use client'

import { useRef } from 'react'
import { ImagePlus, X, ZoomIn, ZoomOut } from 'lucide-react'
import type { SecaoTemplate, SecaoValor } from '@/lib/orientacoes/types'
import { applyVariables, type VariableContext } from '@/lib/orientacoes/variables'
import { RichTextEditor } from './editor'

type SecaoShape = SecaoTemplate | SecaoValor

interface Props {
  secao:    SecaoShape
  valor:    string
  onChange: (id: string, valor: string) => void
}

// Image valor is stored as JSON: { src: string, largura: number (20-100%) }
// Backward compat: plain base64/URL string → treated as 100% width
export function parseImageValor(valor: string): { src: string; largura: number } {
  try {
    const p = JSON.parse(valor)
    if (p && typeof p.src === 'string') return { src: p.src, largura: p.largura ?? 100 }
  } catch {}
  return { src: valor, largura: 100 }
}

export function serializeImageValor(src: string, largura: number): string {
  return JSON.stringify({ src, largura })
}

export function SecaoInput({ secao, valor, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleImageFile(file: File) {
    if (file.size > 3 * 1024 * 1024) { alert('Imagem muito grande. Máximo 3 MB.'); return }
    const reader = new FileReader()
    reader.onload = e => {
      const { largura } = parseImageValor(valor)
      onChange(secao.id, serializeImageValor(e.target?.result as string, largura))
    }
    reader.readAsDataURL(file)
  }

  const opcoes = 'opcoes' in secao ? (secao.opcoes ?? []) : []

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-slate-700">
        {secao.titulo || <span className="text-slate-400 italic">Seção sem título</span>}
      </label>

      {secao.tipo === 'texto_curto' && (
        <textarea
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
          rows={4}
          value={valor}
          onChange={e => onChange(secao.id, e.target.value)}
        />
      )}

      {secao.tipo === 'texto_longo' && (
        <RichTextEditor
          key={`${secao.id}-editor`}
          content={valor}
          onChange={html => onChange(secao.id, html)}
          placeholder="Digite o conteúdo..."
        />
      )}

      {secao.tipo === 'selecao_unica' && (
        <select
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          value={valor}
          onChange={e => onChange(secao.id, e.target.value)}
        >
          <option value="">Selecionar...</option>
          {opcoes.map(op => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      )}

      {secao.tipo === 'imagem' && (() => {
        const { src, largura } = parseImageValor(valor)
        return (
          <div className="space-y-3">
            {src ? (
              <>
                <div className="relative" style={{ width: `${largura}%` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={secao.titulo}
                    className="w-full rounded-lg border border-slate-200 object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => onChange(secao.id, '')}
                    className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow text-red-400 hover:text-red-600"
                    title="Remover imagem"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Size slider */}
                <div className="flex items-center gap-3">
                  <ZoomOut className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <input
                    type="range"
                    min={20}
                    max={100}
                    step={5}
                    value={largura}
                    onChange={e => onChange(secao.id, serializeImageValor(src, Number(e.target.value)))}
                    className="flex-1 accent-indigo-600"
                  />
                  <ZoomIn className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-slate-500 w-10 text-right">{largura}%</span>
                </div>

                <button type="button" onClick={() => fileRef.current?.click()}
                  className="text-xs text-indigo-600 hover:underline">
                  Trocar imagem
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-2 w-full py-8 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
              >
                <ImagePlus className="w-8 h-8" />
                <span className="text-sm">Clique para inserir imagem</span>
                <span className="text-xs">PNG, JPG, WEBP — máx. 3 MB</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f) }}
            />
          </div>
        )
      })()}
    </div>
  )
}

export function initValores(secoes: SecaoTemplate[], ctx: VariableContext): SecaoValor[] {
  return secoes.map(s => ({
    id:     s.id,
    titulo: s.titulo,
    tipo:   s.tipo,
    valor:  s.tipo === 'imagem' ? s.valor : applyVariables(s.valor ?? '', ctx),
    opcoes: s.opcoes,
  }))
}
