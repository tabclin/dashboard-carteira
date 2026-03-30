import { cn } from '@/lib/utils'
import { AGENDAMENTO_ALERTA_COLORS, AGENDAMENTO_ALERTA_LABELS } from '@/lib/planos-utils'
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import type { PlanoAgendamentoAlerta } from '@/types'

interface PlanoAgendamentoBadgeProps {
  alerta: PlanoAgendamentoAlerta
  size?: 'sm' | 'md'
}

const ICONS = {
  em_dia:          CheckCircle2,
  precisa_agendar: Clock,
  atrasado:        AlertCircle,
}

export default function PlanoAgendamentoBadge({ alerta, size = 'md' }: PlanoAgendamentoBadgeProps) {
  const colors = AGENDAMENTO_ALERTA_COLORS[alerta]
  const label  = AGENDAMENTO_ALERTA_LABELS[alerta]
  const Icon   = ICONS[alerta]

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 font-medium rounded-full border',
      colors.bg, colors.text, colors.border,
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
    )}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {label}
    </span>
  )
}
