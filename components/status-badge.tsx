import { cn } from '@/lib/utils'
import type { StatusPaciente } from '@/types'

interface StatusBadgeProps {
  status: StatusPaciente | string
  size?: 'sm' | 'md'
}

const config: Record<string, { label: string; classes: string; dot: string }> = {
  Ok: {
    label: 'Ok',
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot:     'bg-emerald-500',
  },
  Atenção: {
    label: 'Atenção',
    classes: 'bg-amber-50 text-amber-700 border-amber-200',
    dot:     'bg-amber-500',
  },
  Perigo: {
    label: 'Perigo',
    classes: 'bg-red-50 text-red-700 border-red-200',
    dot:     'bg-red-500',
  },
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const cfg = config[status] ?? {
    label: status,
    classes: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border font-medium',
      cfg.classes,
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
    )}>
      <span className={cn('rounded-full flex-shrink-0', cfg.dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      {cfg.label}
    </span>
  )
}
