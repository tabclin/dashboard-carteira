'use client'

import { useEditor, EditorContent, Extension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import { useState } from 'react'
import {
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo2, Redo2, Eraser,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Extensão custom: tamanho de fonte ────────────────────────────
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] } },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: el => el.style.fontSize?.replace(/['"]+/g, '') || null,
          renderHTML: attrs => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }]
  },
  addCommands() {
    return {
      setFontSize:   (size: string) => ({ chain }: any) => chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: ()             => ({ chain }: any) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    } as any
  },
})

// ── Constantes do toolbar ────────────────────────────────────────

const FONT_FAMILIES = [
  { label: 'Padrão',           value: '' },
  { label: 'Arial',            value: 'Arial, sans-serif' },
  { label: 'Times New Roman',  value: 'Times New Roman, serif' },
  { label: 'Courier New',      value: 'Courier New, monospace' },
  { label: 'Georgia',          value: 'Georgia, serif' },
  { label: 'Trebuchet MS',     value: 'Trebuchet MS, sans-serif' },
]

const FONT_SIZES = ['8pt', '9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '20pt', '24pt', '32pt']

const TEXT_COLORS = [
  '#000000', '#374151', '#9ca3af', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
]

const BG_COLORS = [
  '',        '#fef9c3', '#fce7f3', '#e0f2fe', '#dcfce7',
  '#fef3c7', '#f3e8ff', '#fee2e2', '#e0e7ff', '#fff7ed',
]

// ── Botão do toolbar ─────────────────────────────────────────────

function Btn({
  onClick, active = false, disabled = false, title, children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1 rounded transition-colors flex-shrink-0',
        active   ? 'bg-brand-100 text-brand-700'
                 : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
        disabled && 'opacity-30 cursor-not-allowed pointer-events-none',
      )}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="w-px h-4 bg-slate-200 mx-0.5 flex-shrink-0" />
}

// ── Color picker popup ───────────────────────────────────────────

function ColorGrid({ colors, onClick }: { colors: string[], onClick: (c: string) => void }) {
  return (
    <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-slate-200 rounded-lg p-2 shadow-xl">
      <div className="grid grid-cols-5 gap-1">
        {colors.map((c, i) => (
          <button
            key={i}
            type="button"
            onMouseDown={e => { e.preventDefault(); onClick(c) }}
            className="w-5 h-5 rounded border border-slate-200 hover:scale-110 transition-transform flex items-center justify-center"
            style={{ backgroundColor: c || 'white' }}
            title={c || 'Sem cor'}
          >
            {!c && <span className="text-[8px] text-slate-400 leading-none select-none">✕</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [colorPicker, setColorPicker] = useState<'text' | 'bg' | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        'data-placeholder': placeholder ?? 'Digite aqui...',
        class: !value ? 'is-empty' : '',
      },
    },
  })

  if (!editor) return null

  function insertLink() {
    const prev = editor!.getAttributes('link').href ?? ''
    const url  = window.prompt('URL do link:', prev)
    if (url === null) return
    if (url === '') { editor!.chain().focus().unsetLink().run(); return }
    editor!.chain().focus().setLink({ href: url }).run()
  }

  const attrs      = editor.getAttributes('textStyle')
  const curFont    = attrs.fontFamily ?? ''
  const curSize    = attrs.fontSize   ?? ''
  const curColor   = attrs.color      ?? '#000000'

  return (
    <div
      className="border border-slate-200 rounded-xl overflow-visible focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all"
      onBlur={() => setColorPicker(null)}
    >
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 bg-slate-50 rounded-t-xl">

        {/* Desfazer / Refazer */}
        <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Desfazer">
          <Undo2 className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Refazer">
          <Redo2 className="w-3.5 h-3.5" />
        </Btn>

        <Sep />

        {/* Fonte */}
        <select
          className="text-xs border-0 bg-transparent text-slate-600 focus:outline-none cursor-pointer"
          style={{ maxWidth: '120px' }}
          value={curFont}
          onMouseDown={e => e.stopPropagation()}
          onChange={e => {
            e.target.value
              ? editor.chain().focus().setFontFamily(e.target.value).run()
              : editor.chain().focus().unsetFontFamily().run()
          }}
        >
          {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>

        {/* Tamanho */}
        <select
          className="text-xs border-0 bg-transparent text-slate-600 focus:outline-none cursor-pointer"
          style={{ maxWidth: '58px' }}
          value={curSize}
          onMouseDown={e => e.stopPropagation()}
          onChange={e => {
            e.target.value
              ? (editor.chain().focus() as any).setFontSize(e.target.value).run()
              : (editor.chain().focus() as any).unsetFontSize().run()
          }}
        >
          <option value="">Tam.</option>
          {FONT_SIZES.map(s => <option key={s} value={s}>{s.replace('pt', '')}</option>)}
        </select>

        <Sep />

        {/* Negrito / Itálico / Sublinhado */}
        <Btn onClick={() => editor.chain().focus().toggleBold().run()}      active={editor.isActive('bold')}      title="Negrito (Ctrl+B)">
          <Bold className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()}    active={editor.isActive('italic')}    title="Itálico (Ctrl+I)">
          <Italic className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Sublinhado (Ctrl+U)">
          <UnderlineIcon className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={insertLink} active={editor.isActive('link')} title="Inserir link">
          <LinkIcon className="w-3.5 h-3.5" />
        </Btn>

        <Sep />

        {/* Alinhamento */}
        <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()}    active={editor.isActive({ textAlign: 'left' })}    title="Alinhar à esquerda">
          <AlignLeft className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()}  active={editor.isActive({ textAlign: 'center' })}  title="Centralizar">
          <AlignCenter className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()}   active={editor.isActive({ textAlign: 'right' })}   title="Alinhar à direita">
          <AlignRight className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justificar">
          <AlignJustify className="w-3.5 h-3.5" />
        </Btn>

        <Sep />

        {/* Listas */}
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()}  active={editor.isActive('bulletList')}  title="Lista com marcadores">
          <List className="w-3.5 h-3.5" />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
          <ListOrdered className="w-3.5 h-3.5" />
        </Btn>

        <Sep />

        {/* Cor do texto */}
        <div className="relative">
          <Btn
            onClick={() => setColorPicker(p => p === 'text' ? null : 'text')}
            active={colorPicker === 'text'}
            title="Cor do texto"
          >
            <span className="flex flex-col items-center gap-px">
              <span className="text-[11px] font-bold leading-none" style={{ color: curColor }}>A</span>
              <span className="w-3.5 h-0.5 rounded-full" style={{ backgroundColor: curColor }} />
            </span>
          </Btn>
          {colorPicker === 'text' && (
            <ColorGrid
              colors={TEXT_COLORS}
              onClick={c => { editor.chain().focus().setColor(c).run(); setColorPicker(null) }}
            />
          )}
        </div>

        {/* Cor de fundo / destaque */}
        <div className="relative">
          <Btn
            onClick={() => setColorPicker(p => p === 'bg' ? null : 'bg')}
            active={colorPicker === 'bg'}
            title="Destaque (cor de fundo)"
          >
            {/* Ícone: "A" com fundo colorido */}
            <span className="flex flex-col items-center gap-px">
              <span className="text-[11px] font-bold leading-none text-slate-700 px-0.5 rounded-sm"
                style={{ backgroundColor: editor.getAttributes('highlight').color || 'transparent' }}>
                A
              </span>
              <span className="w-3.5 h-0.5 rounded-full bg-yellow-400" />
            </span>
          </Btn>
          {colorPicker === 'bg' && (
            <ColorGrid
              colors={BG_COLORS}
              onClick={c => {
                c
                  ? editor.chain().focus().setHighlight({ color: c }).run()
                  : editor.chain().focus().unsetHighlight().run()
                setColorPicker(null)
              }}
            />
          )}
        </div>

        <Sep />

        {/* Limpar formatação */}
        <Btn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Limpar formatação">
          <Eraser className="w-3.5 h-3.5" />
        </Btn>
      </div>

      {/* ── Área de edição ──────────────────────────────────────── */}
      <EditorContent editor={editor} />
    </div>
  )
}
