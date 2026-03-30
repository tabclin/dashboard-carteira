'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, X } from 'lucide-react'

interface PacienteSearchResult {
  id: string
  paciente: string
  nascimento: string | null
}

interface PacienteSearchProps {
  onSelect: (nome: string, nascimento: string, id: string) => void
  placeholder?: string
}

export default function PacienteSearch({ onSelect, placeholder = 'Buscar paciente existente...' }: PacienteSearchProps) {
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PacienteSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const timerRef = useRef<NodeJS.Timeout>()
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleChange(v: string) {
    setQuery(v)
    clearTimeout(timerRef.current)
    if (v.length < 2) { setResults([]); setOpen(false); return }

    timerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('pacientes')
        .select('id, paciente, nascimento')
        .ilike('paciente', `%${v}%`)
        .limit(8)
      setResults((data ?? []) as PacienteSearchResult[])
      setOpen(true)
    }, 300)
  }

  function handleSelect(r: PacienteSearchResult) {
    onSelect(r.paciente, r.nascimento ?? '', r.id)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="input pl-9 pr-9"
          placeholder={placeholder}
          value={query}
          onChange={e => handleChange(e.target.value)}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-fade-in">
          {results.map(r => (
            <button
              key={r.paciente}
              onClick={() => handleSelect(r)}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
            >
              <p className="text-sm font-medium text-slate-800">{r.paciente}</p>
              {r.nascimento && (
                <p className="text-xs text-slate-400">
                  Nasc.: {r.nascimento.split('-').reverse().join('/')}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 animate-fade-in">
          <p className="text-sm text-slate-400">Nenhum paciente encontrado.</p>
        </div>
      )}
    </div>
  )
}
