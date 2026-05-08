'use client'

import { useState, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import FontFamily from '@tiptap/extension-font-family'
import { toast } from 'sonner'
import {
  Sparkles, Loader2,
  Bold as BoldIcon, Italic as ItalicIcon, Underline as UnderlineIcon,
  Strikethrough, List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Highlighter,
} from 'lucide-react'
import type { $Enums } from '@prisma/client'
type AnalysisStatus = $Enums.AnalysisStatus

const FONT_OPTIONS = [
  { label: 'Padrão', value: '' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Mono', value: 'Courier New, monospace' },
]

interface AnalysisNotesProps {
  analysisId: string
  initialNotes: string | null
  analysisStatus: AnalysisStatus
}

export function AnalysisNotes({ analysisId, initialNotes, analysisStatus }: AnalysisNotesProps) {
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const savedRef = useRef<string>(initialNotes ?? '')
  const colorInputRef = useRef<HTMLInputElement>(null)

  const isFinalized = analysisStatus === 'FINALIZED'

  const saveHtml = useCallback(async (html: string) => {
    const normalized = html === '<p></p>' ? '' : html
    if (normalized === savedRef.current) return
    setSaving(true)
    try {
      const res = await fetch(`/api/ckex/analyses/${analysisId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: normalized || null }),
      })
      if (!res.ok) throw new Error()
      savedRef.current = normalized
    } catch {
      toast.error('Erro ao salvar observações')
    } finally {
      setSaving(false)
    }
  }, [analysisId])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      FontFamily,
    ],
    immediatelyRender: false,
    content: initialNotes ?? '',
    editable: !isFinalized,
    editorProps: {
      attributes: {
        'data-placeholder': 'Adicione observações clínicas gerais sobre esta análise...',
      },
    },
    onBlur: ({ editor }) => {
      saveHtml(editor.getHTML())
    },
  })

  const handleSuggest = async () => {
    setSuggesting(true)
    try {
      const res = await fetch(`/api/ckex/analyses/${analysisId}/suggest-notes`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error()
      const { suggestion } = await res.json()
      const html = (suggestion as string)
        .split(/\n\n+/)
        .map((p: string) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('')
      editor?.commands.setContent(html)
      editor?.commands.focus('end')
    } catch {
      toast.error('Erro ao gerar sugestão')
    } finally {
      setSuggesting(false)
    }
  }

  const currentColor = editor?.getAttributes('textStyle').color as string | undefined

  return (
    <div className="mt-6 border-t pt-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Observações gerais
        </p>
        {!isFinalized && (
          <button
            type="button"
            onClick={handleSuggest}
            disabled={suggesting || saving}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {suggesting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Sparkles className="h-3.5 w-3.5" />}
            {suggesting ? 'Gerando...' : 'Sugerir com IA'}
          </button>
        )}
      </div>

      <div className={`rounded-md border overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 ${
        isFinalized ? 'border-slate-100 bg-slate-50' : 'border-slate-200 bg-white'
      }`}>
        {/* Toolbar */}
        {!isFinalized && editor && (
          <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 bg-slate-50">
            <ToolbarBtn
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Negrito (Ctrl+B)"
            >
              <BoldIcon className="w-3.5 h-3.5" />
            </ToolbarBtn>

            <ToolbarBtn
              active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Itálico (Ctrl+I)"
            >
              <ItalicIcon className="w-3.5 h-3.5" />
            </ToolbarBtn>

            <ToolbarBtn
              active={editor.isActive('underline')}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              title="Sublinhado (Ctrl+U)"
            >
              <UnderlineIcon className="w-3.5 h-3.5" />
            </ToolbarBtn>

            <ToolbarBtn
              active={editor.isActive('strike')}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              title="Tachado"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </ToolbarBtn>

            <Divider />

            {/* Font family */}
            <select
              title="Fonte"
              className="text-xs border-0 bg-transparent text-slate-600 focus:outline-none cursor-pointer hover:bg-slate-100 rounded px-1.5 py-1"
              value={editor.getAttributes('textStyle').fontFamily ?? ''}
              onChange={(e) => {
                if (e.target.value) {
                  editor.chain().focus().setFontFamily(e.target.value).run()
                } else {
                  editor.chain().focus().unsetFontFamily().run()
                }
              }}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            <Divider />

            {/* Text color */}
            <div className="relative">
              <ToolbarBtn
                active={false}
                onClick={() => colorInputRef.current?.click()}
                title="Cor do texto"
              >
                <span className="flex flex-col items-center gap-px">
                  <span className="text-[10px] font-bold leading-none text-slate-700">A</span>
                  <span
                    className="h-1 w-3.5 rounded-sm"
                    style={{ backgroundColor: currentColor ?? '#1e293b' }}
                  />
                </span>
              </ToolbarBtn>
              <input
                ref={colorInputRef}
                type="color"
                className="absolute opacity-0 w-0 h-0 pointer-events-none"
                value={currentColor ?? '#1e293b'}
                onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              />
            </div>

            {/* Highlight */}
            <ToolbarBtn
              active={editor.isActive('highlight')}
              onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
              title="Realce"
            >
              <Highlighter className="w-3.5 h-3.5" />
            </ToolbarBtn>

            <Divider />

            <ToolbarBtn
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Lista"
            >
              <List className="w-3.5 h-3.5" />
            </ToolbarBtn>

            <ToolbarBtn
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Lista numerada"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </ToolbarBtn>

            <Divider />

            <ToolbarBtn
              active={editor.isActive({ textAlign: 'left' })}
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              title="Alinhar à esquerda"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </ToolbarBtn>

            <ToolbarBtn
              active={editor.isActive({ textAlign: 'center' })}
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              title="Centralizar"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </ToolbarBtn>

            <ToolbarBtn
              active={editor.isActive({ textAlign: 'right' })}
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              title="Alinhar à direita"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </ToolbarBtn>
          </div>
        )}

        {/* Editor */}
        <EditorContent editor={editor} />
      </div>

      {saving && (
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
        </p>
      )}
    </div>
  )
}

function ToolbarBtn({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  title: string
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="w-px h-4 bg-slate-200 mx-0.5 shrink-0" />
}
