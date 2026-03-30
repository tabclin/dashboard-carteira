'use client'

import { cn } from '@/lib/utils'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/planos-utils'
import type { PlanoStatus } from '@/types'

interface PlanoStatusBadgeProps {
  status: PlanoStatus
  size?: 'sm' | 'md'
}

export default function PlanoStatusBadge({ status, size = 'md' }: PlanoStatusBadgeProps) {
  const colors = STATUS_COLORS[status]
  const label = STATUS_LABELS[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border',
        colors.bg, colors.text, colors.border,
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
      )}
    >
      <span className={cn('rounded-full flex-shrink-0', colors.dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      {label}
    </span>
  )
}
