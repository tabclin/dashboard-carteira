'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Sparkles, Loader2 } from 'lucide-react'
import type { AnalysisStatus } from '@prisma/client'

interface AnalysisNotesProps {
  analysisId: string
  initialNotes: string | null
  analysisStatus: AnalysisStatus
}

export function AnalysisNotes({ analysisId, initialNotes, analysisStatus }: AnalysisNotesProps) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isFinalized = analysisStatus === 'FINALIZED'

  // Auto-expand
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [notes])

  async function save() {
    if (notes === (initialNotes ?? '')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/ckex/analyses/${analysisId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() || null }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('Erro ao salvar observações')
    } finally {
      setSaving(false)
    }
  }

  async function handleSuggest() {
    setSuggesting(true)
    try {
      const res = await fetch(`/api/ckex/analyses/${analysisId}/suggest-notes`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error()
      const { suggestion } = await res.json()
      setNotes(suggestion)
    } catch {
      toast.error('Erro ao gerar sugestão')
    } finally {
      setSuggesting(false)
    }
  }

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
      <textarea
        ref={textareaRef}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder:text-slate-400 overflow-hidden"
        rows={3}
        placeholder="Adicione observações clínicas gerais sobre esta análise..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={save}
        disabled={saving || suggesting || isFinalized}
        readOnly={isFinalized}
      />
      {saving && (
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
        </p>
      )}
    </div>
  )
}
