'use client'

import { useState } from 'react'
import { Video, Minus, X, Maximize2, Minimize2 } from 'lucide-react'

interface Props {
  token: string
  pacienteNome: string
}

type Tamanho = 'normal' | 'grande' | 'fullscreen'

const TAMANHO_CONFIG: Record<Tamanho, { width: string; height: number }> = {
  normal:     { width: 'w-80',    height: 240 },
  grande:     { width: 'w-[560px]', height: 400 },
  fullscreen: { width: 'w-[calc(100vw-2rem)]', height: -1 }, // -1 = usa CSS
}

export default function VideoRoom({ token, pacienteNome }: Props) {
  const [colapsado, setColapsado] = useState(false)
  const [fechado, setFechado]     = useState(false)
  const [tamanho, setTamanho]     = useState<Tamanho>('normal')

  if (fechado) return null

  const iframeSrc = `https://meet.jit.si/${token}#config.prejoinPageEnabled=false&userInfo.displayName="M%C3%A9dico"`

  if (colapsado) {
    return (
      <button
        onClick={() => setColapsado(false)}
        className="fixed bottom-4 right-4 z-40 bg-violet-600 hover:bg-violet-700 text-white rounded-full px-4 py-2.5 shadow-lg flex items-center gap-2 text-sm font-medium transition-colors"
      >
        <Video className="w-4 h-4" />
        Vídeo
      </button>
    )
  }

  function proximoTamanho() {
    setTamanho(t => t === 'normal' ? 'grande' : t === 'grande' ? 'fullscreen' : 'normal')
  }

  const cfg = TAMANHO_CONFIG[tamanho]
  const isFullscreen = tamanho === 'fullscreen'

  return (
    <div
      className={`fixed z-40 shadow-2xl rounded-2xl overflow-hidden border border-violet-200 transition-all duration-300
        ${isFullscreen
          ? 'bottom-2 right-2 left-2 top-2'
          : `bottom-4 right-4 ${cfg.width}`
        }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between bg-violet-600 text-white px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Video className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium truncate">{pacienteNome}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={proximoTamanho}
            title={tamanho === 'normal' ? 'Expandir' : tamanho === 'grande' ? 'Tela cheia' : 'Reduzir'}
            className="p-1 rounded hover:bg-violet-500 transition-colors"
          >
            {tamanho === 'fullscreen'
              ? <Minimize2 className="w-4 h-4" />
              : <Maximize2 className="w-4 h-4" />
            }
          </button>
          <button
            onClick={() => setColapsado(true)}
            title="Minimizar"
            className="p-1 rounded hover:bg-violet-500 transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setFechado(true)}
            title="Fechar vídeo"
            className="p-1 rounded hover:bg-violet-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Jitsi iframe */}
      <iframe
        src={iframeSrc}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        style={{
          width: '100%',
          height: isFullscreen ? 'calc(100% - 40px)' : `${cfg.height}px`,
          border: 'none',
          display: 'block',
        }}
      />
    </div>
  )
}
