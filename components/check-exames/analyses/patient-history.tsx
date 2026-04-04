'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { ANALYSIS_STATUS_CONFIG } from '@/types'
import type { AnalysisStatus } from '@prisma/client'
import { TrendingUp, FlaskConical, ChevronRight } from 'lucide-react'

interface ResultPoint {
  id: string
  examName: string
  examSlug: string
  catalogId: string | null
  category: string | null
  value: string | null
  valueNumeric: number | null
  unit: string | null
  refMin: number | null
  refMax: number | null
  status: string
}

interface AnalysisPoint {
  id: string
  collectedAt: string
  labName: string | null
  status: string
  notes: string | null
  results: ResultPoint[]
}

interface PatientInfo {
  id: string
  name: string
  sex: string | null
  birthDate: string | null
}

interface PatientHistoryProps {
  patient: PatientInfo
  analyses: AnalysisPoint[]
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

export function PatientHistory({ patient, analyses }: PatientHistoryProps) {
  // Monta lista de exames com pelo menos 2 pontos numéricos
  const examOptions = useMemo(() => {
    const map = new Map<string, { slug: string; name: string; unit: string | null; count: number }>()
    for (const a of analyses) {
      for (const r of a.results) {
        if (r.valueNumeric == null) continue
        const key = r.catalogId ?? r.examSlug
        if (!map.has(key)) {
          map.set(key, { slug: key, name: r.examName, unit: r.unit, count: 0 })
        }
        map.get(key)!.count++
      }
    }
    return Array.from(map.values())
      .filter((e) => e.count >= 1)
      .sort((a, b) => b.count - a.count)
  }, [analyses])

  const [selectedExam, setSelectedExam] = useState<string>(examOptions[0]?.slug ?? '')

  const selectedMeta = examOptions.find((e) => e.slug === selectedExam)

  // Pontos para o gráfico do exame selecionado
  const chartData = useMemo(() => {
    if (!selectedExam) return []
    return analyses
      .map((a) => {
        const r = a.results.find((r) => (r.catalogId ?? r.examSlug) === selectedExam)
        if (!r || r.valueNumeric == null) return null
        return {
          date: formatDate(a.collectedAt),
          value: r.valueNumeric,
          refMin: r.refMin,
          refMax: r.refMax,
          status: r.status,
          analysisId: a.id,
        }
      })
      .filter(Boolean) as { date: string; value: number; refMin: number | null; refMax: number | null; status: string; analysisId: string }[]
  }, [analyses, selectedExam])

  const refMin = chartData.find((d) => d.refMin != null)?.refMin ?? null
  const refMax = chartData.find((d) => d.refMax != null)?.refMax ?? null

  const dotColor = (status: string) => {
    if (status === 'NORMAL') return '#16a34a'
    if (status === 'ATTENTION') return '#d97706'
    if (status === 'DANGER') return '#dc2626'
    return '#94a3b8'
  }

  return (
    <div className="space-y-6">
      {/* Gráfico de evolução */}
      <div className="border rounded-xl bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-800">Evolução de exames</h3>
          </div>
          {examOptions.length > 0 && (
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
            >
              {examOptions.map((e) => (
                <option key={e.slug} value={e.slug}>
                  {e.name}{e.unit ? ` (${e.unit})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {chartData.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <TrendingUp className="w-8 h-8 text-slate-200 mb-2" />
            <p className="text-sm text-slate-400">
              {analyses.length === 0
                ? 'Nenhuma análise registrada ainda.'
                : chartData.length === 1
                ? 'Apenas 1 coleta deste exame. Necessário pelo menos 2 para exibir gráfico.'
                : 'Selecione um exame com pelo menos 2 coletas numéricas.'}
            </p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#cbd5e1" />
                <YAxis tick={{ fontSize: 11 }} stroke="#cbd5e1" width={45} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(v: number) => [`${v} ${selectedMeta?.unit ?? ''}`, selectedMeta?.name]}
                />
                {refMin != null && (
                  <ReferenceLine y={refMin} stroke="#86efac" strokeDasharray="4 2" label={{ value: `Mín ${refMin}`, fontSize: 10, fill: '#16a34a', position: 'insideBottomLeft' }} />
                )}
                {refMax != null && (
                  <ReferenceLine y={refMax} stroke="#fca5a5" strokeDasharray="4 2" label={{ value: `Máx ${refMax}`, fontSize: 10, fill: '#dc2626', position: 'insideTopLeft' }} />
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props
                    return (
                      <circle
                        key={`dot-${payload.analysisId}`}
                        cx={cx} cy={cy} r={5}
                        fill={dotColor(payload.status)}
                        stroke="white"
                        strokeWidth={1.5}
                      />
                    )
                  }}
                  activeDot={{ r: 7 }}
                  name={selectedMeta?.name}
                />
                <Legend iconSize={0} formatter={() => (
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    {selectedMeta?.name} {selectedMeta?.unit ? `(${selectedMeta.unit})` : ''}
                  </span>
                )} />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 justify-center">
              {[
                { color: '#16a34a', label: 'Normal' },
                { color: '#d97706', label: 'Atenção' },
                { color: '#dc2626', label: 'Perigo' },
                { color: '#94a3b8', label: 'Não avaliado' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-slate-400">{item.label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Lista de análises */}
      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b bg-slate-50">
          <FlaskConical className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">
            Análises realizadas ({analyses.length})
          </h3>
        </div>

        {analyses.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            Nenhuma análise registrada para este paciente.
          </div>
        ) : (
          <div className="divide-y">
            {[...analyses].reverse().map((a) => {
              const cfg = ANALYSIS_STATUS_CONFIG[a.status as AnalysisStatus]
              const danger = a.results.filter((r) => r.status === 'DANGER').length
              const attention = a.results.filter((r) => r.status === 'ATTENTION').length
              return (
                <Link
                  key={a.id}
                  href={`/check-exames/analises/${a.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{formatDate(a.collectedAt)}</span>
                      {a.labName && (
                        <span className="text-xs text-slate-400">· {a.labName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{a.results.length} exame{a.results.length !== 1 ? 's' : ''}</span>
                      {danger > 0 && (
                        <span className="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">{danger} perigo</span>
                      )}
                      {attention > 0 && (
                        <span className="text-xs font-medium text-yellow-700 bg-yellow-50 px-1.5 py-0.5 rounded-full">{attention} atenção</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
