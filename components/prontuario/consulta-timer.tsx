'use client'

import { useState, useEffect } from 'react'
import { Timer, Eye, EyeOff } from 'lucide-react'

interface Props {
  iniciado_em: string  // ISO timestamp
}

export default function ConsultaTimer({ iniciado_em }: Props) {
  const [visivel, setVisivel] = useState(true)
  const [seg, setSeg] = useState(0)

  useEffect(() => {
    function tick() {
      setSeg(Math.floor((Date.now() - new Date(iniciado_em).getTime()) / 1000))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [iniciado_em])

  const hh = String(Math.floor(seg / 3600)).padStart(2, '0')
  const mm = String(Math.floor((seg % 3600) / 60)).padStart(2, '0')
  const ss = String(seg % 60).padStart(2, '0')

  return (
    <div className="flex items-center gap-2">
      <Timer className="w-4 h-4 text-emerald-600" />
      {visivel
        ? <span className="text-sm font-mono font-semibold text-emerald-700">{hh}:{mm}:{ss}</span>
        : <span className="text-sm text-slate-400">oculto</span>
      }
      <button
        onClick={() => setVisivel(v => !v)}
        className="text-slate-400 hover:text-slate-600 transition-colors"
        title={visivel ? 'Ocultar cronômetro' : 'Mostrar cronômetro'}
      >
        {visivel ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}
