'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import {
  Bold, Italic, UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered,
  Link2, Minus, Undo2, Redo2,
  Highlighter, Type,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export function RichTextEditor({ content, onChange, placeholder }: EditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[320px] px-4 py-3',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  if (!editor) return null

  const btn = (active: boolean) =>
    cn('p-1.5 rounded transition-colors', active
      ? 'bg-indigo-100 text-indigo-700'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
    )

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 bg-slate-50">
        {/* History */}
        <button type="button" onClick={() => editor.chain().focus().undo().run()} className={btn(false)} title="Desfazer">
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} className={btn(false)} title="Refazer">
          <Redo2 className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* Text style */}
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive('bold'))} title="Negrito">
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive('italic'))} title="Itálico">
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive('underline'))} title="Sublinhado">
          <UnderlineIcon className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive('strike'))} title="Tachado">
          <Strikethrough className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* Headings */}
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={cn(btn(editor.isActive('heading', { level: 2 })), 'text-xs font-bold px-2')} title="Título">
          H2
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={cn(btn(editor.isActive('heading', { level: 3 })), 'text-xs font-bold px-2')} title="Subtítulo">
          H3
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* Alignment */}
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btn(editor.isActive({ textAlign: 'left' }))} title="Alinhar à esquerda">
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btn(editor.isActive({ textAlign: 'center' }))} title="Centralizar">
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().setTextAlign('right').run()} className={btn(editor.isActive({ textAlign: 'right' }))} title="Alinhar à direita">
          <AlignRight className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* Lists */}
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive('bulletList'))} title="Lista com marcadores">
          <List className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive('orderedList'))} title="Lista numerada">
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* Highlight + color */}
        <button type="button" onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} className={btn(editor.isActive('highlight'))} title="Destacar texto">
          <Highlighter className="w-3.5 h-3.5" />
        </button>

        {/* Text color picker */}
        <label className={cn(btn(false), 'relative cursor-pointer')} title="Cor do texto">
          <Type className="w-3.5 h-3.5" />
          <input
            type="color"
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            defaultValue="#334155"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        {/* Link */}
        <button
          type="button"
          onClick={() => {
            const url = window.prompt('URL do link')
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          className={btn(editor.isActive('link'))}
          title="Inserir link"
        >
          <Link2 className="w-3.5 h-3.5" />
        </button>

        {/* Divider line */}
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btn(false)} title="Linha divisória">
          <Minus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Editor area */}
      <div className="relative">
        {editor.isEmpty && placeholder && (
          <p className="absolute top-3 left-4 text-slate-400 text-sm pointer-events-none select-none">{placeholder}</p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
