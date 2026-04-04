'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, FileText, Loader2, ChevronRight } from 'lucide-react'
import { formatarData } from '@/lib/utils'

interface PacienteRecente {
  paciente_id: string
  atualizado_em: string
  prontuario_consultas?: { data: string }[]
}

interface PacienteDado {
  id: string
  paciente: string
  nascimento: string | null
}

interface ProntuarioBuscaProps {
  recentes: PacienteRecente[]
  pacientesData: PacienteDado[]
}

interface ResultadoBusca {
  nome: string
  nascimento: string | null
}

export default function ProntuarioBusca({ recentes, pacientesData }: ProntuarioBuscaProps) {
  const supabase = createClient()
  const router   = useRouter()

  const [busca, setBusca]           = useState('')
  const [resultados, setResultados] = useState<ResultadoBusca[]>([])
  const [buscando, setBuscando]     = useState(false)
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buscarPacientes = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResultados([]); return }
    setBuscando(true)
    const { data } = await supabase
      .from('pacientes')
      .select('paciente, nascimento')
      .ilike('paciente', `%${q.trim()}%`)
      .limit(10)
    setResultados((data ?? []).map((p: any) => ({ nome: p.paciente, nascimento: p.nascimento })))
    setBuscando(false)
  }, [supabase])

  function handleBusca(v: string) {
    setBusca(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscarPacientes(v), 300)
  }

  function abrirProntuario(nome: string) {
    router.push(`/prontuario/${encodeURIComponent(nome)}`)
  }

  // Mapa por UUID para lookup nos recentes
  const pacienteMap = new Map(pacientesData.map(p => [p.id, p]))

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Busca */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Buscar paciente</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            className="input pl-9"
            placeholder="Digite o nome do paciente..."
            value={busca}
            onChange={e => handleBusca(e.target.value)}
            autoFocus
          />
          {buscando && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
          )}
        </div>

        {resultados.length > 0 && (
          <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
            {resultados.map(p => (
              <button
                key={p.nome}
                onClick={() => abrirProntuario(p.nome)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-brand-50 transition-colors border-b border-slate-100 last:border-0 text-left"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{p.nome}</p>
                  {p.nascimento && (
                    <p className="text-xs text-slate-400">{formatarData(p.nascimento)}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Prontuários recentes */}
      {recentes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Prontuários recentes</h3>
          <div className="space-y-1.5">
            {recentes.map(r => {
              const p = pacienteMap.get(r.paciente_id)
              const ultimaConsulta = r.prontuario_consultas?.[0]?.data ?? null
              return (
                <button
                  key={r.paciente_id}
                  onClick={() => abrirProntuario(pacienteMap.get(r.paciente_id)?.paciente ?? r.paciente_id)}
                  className="w-full card flex items-center gap-3 p-3 hover:border-brand-200 hover:bg-brand-50/30 transition-colors text-left"
                >
                  <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p?.paciente ?? r.paciente_id}</p>
                    <p className="text-xs text-slate-400">
                      {ultimaConsulta ? `Última consulta: ${formatarData(ultimaConsulta)}` : 'Sem consultas registradas'}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {recentes.length === 0 && !busca && (
        <div className="card text-center py-12">
          <FileText className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">Nenhum prontuário ainda.</p>
          <p className="text-xs text-slate-400 mt-1">Busque um paciente acima para criar o primeiro prontuário.</p>
        </div>
      )}
    </div>
  )
}
