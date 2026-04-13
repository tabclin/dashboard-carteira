'use client'

import { useState } from 'react'
import Link from 'next/link'
import { User, Search, X, FlaskConical, Plus } from 'lucide-react'
import type { $Enums } from '@prisma/client'
type AnalysisStatus = $Enums.AnalysisStatus

interface PatientItem {
  id: string
  name: string
  analysisCount: number
  statuses: AnalysisStatus[]
}

type FilterStatus = 'todos' | 'DRAFT' | 'IN_REVIEW' | 'FINALIZED'

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'todos',     label: 'Todos' },
  { value: 'DRAFT',     label: 'Rascunho' },
  { value: 'IN_REVIEW', label: 'Em revisão' },
  { value: 'FINALIZED', label: 'Finalizado' },
]

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function getMainStatus(statuses: AnalysisStatus[]): AnalysisStatus | null {
  if (statuses.some((s) => s === 'FINALIZED')) return 'FINALIZED'
  if (statuses.some((s) => s === 'IN_REVIEW')) return 'IN_REVIEW'
  if (statuses.some((s) => s === 'DRAFT')) return 'DRAFT'
  return null
}

function StatusBadge({ statuses }: { statuses: AnalysisStatus[] }) {
  const main = getMainStatus(statuses)
  if (!main) return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
      Sem análises
    </span>
  )
  if (main === 'FINALIZED') return (
    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Finalizada
    </span>
  )
  if (main === 'IN_REVIEW') return (
    <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
      Em revisão
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
      Rascunho
    </span>
  )
}

export function PacientesList({ patients }: { patients: PatientItem[] }) {
  const [query, setQuery]   = useState('')
  const [filter, setFilter] = useState<FilterStatus>('todos')

  const filtered = patients.filter((p) => {
    const matchQuery = !query.trim() || normalize(p.name).includes(normalize(query))
    const matchFilter = filter === 'todos' || getMainStatus(p.statuses) === filter
    return matchQuery && matchFilter
  })

  return (
    <div className="space-y-3">
      {/* Linha: busca + botão */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar paciente..."
            className="w-full text-sm border border-slate-200 rounded-xl pl-9 pr-9 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Link
          href="/check-exames/analises/nova"
          className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova análise
        </Link>
      </div>

      {/* Filtros de status */}
      <div className="flex items-center gap-1.5">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              filter === opt.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">
          {filtered.length} paciente{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <FlaskConical className="h-8 w-8 text-slate-200" />
          <p className="text-sm text-slate-400">
            {query ? `Nenhum paciente encontrado para "${query}"` : 'Nenhum paciente nesta categoria'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((patient) => (
            <Link
              key={patient.id}
              href={`/check-exames/pacientes/${patient.id}`}
              className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{patient.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {patient.analysisCount === 0
                    ? 'Nenhuma análise'
                    : `${patient.analysisCount} análise${patient.analysisCount !== 1 ? 's' : ''}`}
                </p>
              </div>
              <div className="flex-shrink-0">
                <StatusBadge statuses={patient.statuses} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
