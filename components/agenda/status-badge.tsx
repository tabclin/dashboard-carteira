'use client'

import { cn } from '@/lib/utils'
import type { AgendaStatus } from '@/types'

const CONFIG: Record<AgendaStatus, { label: string; bg: string; text: string; dot: string }> = {
  agendado:    { label: 'Agendado',    bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-400'   },
  confirmado:  { label: 'Confirmado',  bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  em_consulta: { label: 'Em consulta', bg: 'bg-teal-100',   text: 'text-teal-700',   dot: 'bg-teal-500'   },
  realizado:   { label: 'Realizado',   bg: 'bg-emerald-100',text: 'text-emerald-700',dot: 'bg-emerald-500'},
  faltou:      { label: 'Faltou',      bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  cancelado:   { label: 'Cancelado',   bg: 'bg-slate-100',  text: 'text-slate-500',  dot: 'bg-slate-400'  },
}

export const STATUS_COLOR: Record<AgendaStatus, string> = {
  agendado:    '#3b82f6',
  confirmado:  '#8b5cf6',
  em_consulta: '#0d9488',
  realizado:   '#10b981',
  faltou:      '#f59e0b',
  cancelado:   '#94a3b8',
}

interface StatusBadgeProps {
  status: AgendaStatus
  size?: 'sm' | 'xs'
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const c = CONFIG[status]
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full font-medium',
      c.bg, c.text,
      size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
    )}>
      <span className={cn('rounded-full flex-shrink-0', c.dot, size === 'xs' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      {c.label}
    </span>
  )
}
