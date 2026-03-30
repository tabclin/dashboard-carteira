'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { STATUS_LABELS, STATUS_TRANSITIONS, STATUS_COLORS } from '@/lib/planos-utils'
import { ChevronDown } from 'lucide-react'
import type { PlanoStatus } from '@/types'

interface PlanoStatusSelectProps {
  planoId: string
  currentStatus: PlanoStatus
  onUpdated: (newStatus: PlanoStatus) => void
}

export default function PlanoStatusSelect({ planoId, currentStatus, onUpdated }: PlanoStatusSelectProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const transitions = STATUS_TRANSITIONS[currentStatus]

  if (transitions.length === 0) return null

  async function handleChange(newStatus: PlanoStatus) {
    setLoading(true)
    await supabase
      .from('planos_acompanhamento')
      .update({ status: newStatus })
      .eq('id', planoId)
    setLoading(false)
    onUpdated(newStatus)
  }

  return (
    <div className="relative">
      <select
        className="input pr-8 text-sm appearance-none cursor-pointer"
        value=""
        disabled={loading}
        onChange={e => handleChange(e.target.value as PlanoStatus)}
      >
        <option value="" disabled>Avançar status...</option>
        {transitions.map(s => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
    </div>
  )
}
