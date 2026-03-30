import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  titulo: string
  valor: string | number
  subtitulo?: string
  icon: LucideIcon
  cor?: 'blue' | 'green' | 'yellow' | 'red' | 'indigo' | 'default'
  tendencia?: { valor: string; positivo: boolean }
}

const corConfig = {
  default: {
    icon: 'bg-slate-100 text-slate-600',
    accent: 'border-slate-200',
  },
  blue: {
    icon: 'bg-brand-50 text-brand-600',
    accent: 'border-t-brand-500',
  },
  green: {
    icon: 'bg-emerald-50 text-emerald-600',
    accent: 'border-t-emerald-500',
  },
  yellow: {
    icon: 'bg-amber-50 text-amber-600',
    accent: 'border-t-amber-500',
  },
  red: {
    icon: 'bg-red-50 text-red-600',
    accent: 'border-t-red-500',
  },
  indigo: {
    icon: 'bg-indigo-50 text-indigo-600',
    accent: 'border-t-indigo-500',
  },
}

export default function KpiCard({
  titulo,
  valor,
  subtitulo,
  icon: Icon,
  cor = 'default',
  tendencia,
}: KpiCardProps) {
  const config = corConfig[cor]

  return (
    <div className={cn(
      'card border-t-2 transition-shadow hover:shadow-card-hover',
      config.accent
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide truncate">
            {titulo}
          </p>
          <p className="text-3xl font-bold text-slate-800 mt-1 leading-none">
            {valor}
          </p>
          {subtitulo && (
            <p className="text-xs text-slate-400 mt-1.5">{subtitulo}</p>
          )}
          {tendencia && (
            <span className={cn(
              'inline-flex items-center text-xs font-medium mt-2',
              tendencia.positivo ? 'text-emerald-600' : 'text-red-500'
            )}>
              {tendencia.positivo ? '↑' : '↓'} {tendencia.valor}
            </span>
          )}
        </div>
        <div className={cn(
          'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
          config.icon
        )}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}
