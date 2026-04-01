'use client'

import { useEffect } from 'react'
import { Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  mensagem: string
  detalhe?: string
  carregando?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

export default function ConfirmDialog({
  open,
  mensagem,
  detalhe,
  carregando = false,
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancelar()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancelar])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onCancelar}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        {/* Ícone */}
        <div className="flex justify-center pt-7 pb-4">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <Trash2 className="w-7 h-7 text-red-500" />
          </div>
        </div>

        {/* Conteúdo */}
        <div className="px-6 pb-2 text-center space-y-2">
          <h3 className="font-semibold text-slate-800 text-base">Confirmar exclusão</h3>
          <p className="text-sm text-slate-600">{mensagem}</p>
          {detalhe && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              {detalhe}
            </p>
          )}
        </div>

        {/* Botões */}
        <div className="flex gap-2 px-6 py-5">
          <button
            onClick={onCancelar}
            disabled={carregando}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={carregando}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
            Excluir
          </button>
        </div>
      </div>
    </div>
  )
}
