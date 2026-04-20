'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { User, Search, X } from 'lucide-react'

interface Patient {
  id:        string
  name:      string
  birthDate: string | null
  sex:       string | null
}

interface Props {
  value:    string
  onChange: (name: string, patient?: Patient) => void
}

function calcAgeMonths(birthDate: string): { years: number; months: number } | null {
  const birth = new Date(birthDate)
  if (isNaN(birth.getTime())) return null
  const now    = new Date()
  let years    = now.getFullYear() - birth.getFullYear()
  let months   = now.getMonth()    - birth.getMonth()
  if (months < 0) { years--; months += 12 }
  const dayDiff = now.getDate() - birth.getDate()
  if (dayDiff < 0) months = Math.max(0, months - 1)
  return { years, months }
}

export default function PatientSearchInput({ value, onChange }: Props) {
  const [query,    setQuery]    = useState(value)
  const [results,  setResults]  = useState<Patient[]>([])
  const [open,     setOpen]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef  = useRef<ReturnType<typeof setTimeout>>(undefined)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/dri/patients?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
      setOpen(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleInput(val: string) {
    setQuery(val)
    onChange(val)
    clearTimeout(debounceRef.current)
    if (val.length >= 1) {
      debounceRef.current = setTimeout(() => search(val), 250)
    } else {
      setResults([])
      setOpen(false)
    }
  }

  function handleFocus() {
    if (query.length === 0) search('')
  }

  function handleSelect(patient: Patient) {
    setQuery(patient.name)
    setOpen(false)
    onChange(patient.name, patient)
  }

  function handleClear() {
    setQuery('')
    setResults([])
    setOpen(false)
    onChange('')
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar paciente cadastrado…"
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={handleFocus}
          className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-xs text-slate-400">Buscando…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-4 py-3 text-xs text-slate-400">Nenhum paciente encontrado.</div>
          )}
          {!loading && results.map(p => {
            const age = p.birthDate ? calcAgeMonths(p.birthDate) : null
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{p.name}</p>
                  <p className="text-xs text-slate-400">
                    {age ? `${age.years}a ${age.months}m` : 'Idade não informada'}
                    {p.sex === 'M' ? ' · Masc' : p.sex === 'F' ? ' · Fem' : ''}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
