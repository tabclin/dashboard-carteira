'use client'

import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'
import type { AlinhamentoImagem as Alinhamento } from '@/lib/orientacoes/imagem'
import { cn } from '@/lib/utils'

const OPCOES = [
  { valor: 'esquerda', icone: AlignLeft,   titulo: 'Imagem à esquerda' },
  { valor: 'centro',   icone: AlignCenter, titulo: 'Imagem centralizada' },
  { valor: 'direita',  icone: AlignRight,  titulo: 'Imagem à direita' },
] as const

export const JUSTIFICA_IMAGEM: Record<Alinhamento, string> = { esquerda: 'justify-start', centro: 'justify-center', direita: 'justify-end' }

export function AlinhamentoImagem({ valor, onChange }: { valor: Alinhamento; onChange: (a: Alinhamento) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 p-0.5 flex-shrink-0" role="group" aria-label="Alinhamento da imagem">
      {OPCOES.map(({ valor: v, icone: Icone, titulo }) => (
        <button key={v} type="button" onClick={() => onChange(v)} title={titulo} aria-label={titulo} aria-pressed={valor === v}
          className={cn('p-1 rounded transition-colors', valor === v ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600')}>
          <Icone className="w-4 h-4" />
        </button>
      ))}
    </div>
  )
}
