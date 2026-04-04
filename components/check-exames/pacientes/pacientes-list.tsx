'use client'

import { useState } from 'react'
import Link from 'next/link'
import { User, Search, X, FlaskConical } from 'lucide-react'
import type { AnalysisStatus } from '@prisma/client'

interface PatientItem {
  id: string
  name: string
  analysisCount: number
  statuses: AnalysisStatus[]
}

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function StatusBadge({ statuses }: { statuses: AnalysisStatus[] }) {
  if (statuses.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        Sem análises
      </span>
    )
  }
  if (statuses.some((s) => s === 'FINALIZED')) return (
    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      Finalizada
    </span>
  )
  if (statuses.some((s) => s === 'IN_REVIEW')) return (
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
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? patients.filter((p) => normalize(p.name).includes(normalize(query)))
    : patients

  return (
    <div className="space-y-4">
      {/* Barra de busca */}
      <div className="relative">
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

      {/* Contagem */}
      <p className="text-xs text-slate-400">
        {filtered.length} de {patients.length} paciente{patients.length !== 1 ? 's' : ''}
        {query && ` para "${query}"`}
      </p>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <FlaskConical className="h-8 w-8 text-slate-200" />
          <p className="text-sm text-slate-400">Nenhum paciente encontrado para &quot;{query}&quot;</p>
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
