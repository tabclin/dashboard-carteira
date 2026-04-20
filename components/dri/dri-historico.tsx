'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  History, Trash2, User, Calendar, Search, Sparkles,
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  Apple, Flame, Activity, Weight, Ruler, X, MessageSquare,
  UtensilsCrossed,
} from 'lucide-react'
import { toast } from 'sonner'
import { calcMacros } from '@/lib/dri/macros'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DriAvaliacao {
  id:            string
  patientName:   string | null
  data:          string
  ageMonths:     number
  weightKg:      string
  heightCm:      string
  sexInput:      string
  activityLevel: string
  eerMasc:       string | null
  eerFem:        string | null
  kcalPerKgMasc: string | null
  kcalPerKgFem:  string | null
  intakeKcal:    string | null
  ageCategory:   string
  conduta:       string | null
  planos:        { id: string }[]
}

interface PatientGroup {
  key:         string
  label:       string
  evaluations: DriAvaliacao[]
  lastDate:    string
  count:       number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACTIVITY_LABEL: Record<string, string> = {
  sedentary: 'Sedentário', low_active: 'Pouco ativo',
  active: 'Ativo', very_active: 'Muito ativo',
}

function ageText(m: number) {
  if (m < 12) return `${m} ${m === 1 ? 'mês' : 'meses'}`
  const y = Math.floor(m / 12), r = m % 12
  return r === 0 ? `${y} ${y === 1 ? 'ano' : 'anos'}` : `${y}a ${r}m`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  })
}

function fmtN(v: string | null, dec = 0) {
  if (!v) return '—'
  const n = parseFloat(v)
  return isNaN(n) ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function primaryEer(a: DriAvaliacao): number | null {
  const m = a.eerMasc ? parseFloat(a.eerMasc) : null
  const f = a.eerFem  ? parseFloat(a.eerFem)  : null
  if (m && f) return (m + f) / 2
  return m ?? f
}

function groupByPatient(list: DriAvaliacao[]): PatientGroup[] {
  const map = new Map<string, DriAvaliacao[]>()
  for (const a of list) {
    const k = a.patientName?.trim() || '__sem__'
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(a)
  }
  return Array.from(map.entries())
    .map(([key, evals]) => {
      const sorted = [...evals].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      return { key, label: key === '__sem__' ? 'Sem paciente identificado' : key, evaluations: sorted, lastDate: sorted[0].data, count: sorted.length }
    })
    .sort((a, b) => {
      if (a.key === '__sem__') return 1
      if (b.key === '__sem__') return -1
      return new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
    })
}

// ─── Trend badge ──────────────────────────────────────────────────────────────

function TrendBadge({ curr, prev }: { curr: DriAvaliacao; prev: DriAvaliacao }) {
  const c = primaryEer(curr), p = primaryEer(prev)
  if (!c || !p) return null
  const pct = ((c - p) / p) * 100
  if (Math.abs(pct) < 2) return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
      <Minus className="w-3 h-3" /> Estável
    </span>
  )
  if (pct > 0) return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
      <TrendingUp className="w-3 h-3" /> +{pct.toFixed(1)}%
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
      <TrendingDown className="w-3 h-3" /> {pct.toFixed(1)}%
    </span>
  )
}

// ─── Evaluation Card ─────────────────────────────────────────────────────────

function EvaluationCard({
  avaliacao, prevAvaliacao, onDelete, deleting,
}: {
  avaliacao:     DriAvaliacao
  prevAvaliacao: DriAvaliacao | null
  onDelete:      (id: string) => void
  deleting:      string | null
}) {
  const [expanded, setExpanded] = useState(false)

  const a    = avaliacao
  const hasM = !!a.eerMasc
  const hasF = !!a.eerFem

  const intakePct = a.intakeKcal && (a.eerMasc || a.eerFem)
    ? Math.round(parseFloat(a.intakeKcal) / parseFloat(a.eerMasc ?? a.eerFem!) * 100)
    : null

  const macrosM = hasM ? calcMacros(parseFloat(a.eerMasc!), parseFloat(a.weightKg), a.ageMonths) : null
  const macrosF = hasF ? calcMacros(parseFloat(a.eerFem!),  parseFloat(a.weightKg), a.ageMonths) : null

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

      {/* Header do card */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">

          {/* Data + metadados */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
              <Calendar className="w-3 h-3" />
              {fmtDate(a.data)}
            </span>
            <span className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md">{ageText(a.ageMonths)}</span>
            <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md">
              <Weight className="w-3 h-3" />{parseFloat(a.weightKg).toLocaleString('pt-BR')} kg
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md">
              <Ruler className="w-3 h-3" />{parseFloat(a.heightCm).toLocaleString('pt-BR')} cm
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-md">
              <Activity className="w-3 h-3" />{ACTIVITY_LABEL[a.activityLevel] ?? a.activityLevel}
            </span>
            {prevAvaliacao && <TrendBadge curr={a} prev={prevAvaliacao} />}
          </div>

          {/* EER chips */}
          <div className="flex flex-wrap gap-2">
            {hasM && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
                <div>
                  <p className="text-xs text-blue-500 font-medium leading-tight">EER Masc</p>
                  <p className="text-sm font-bold text-blue-700 leading-tight">{fmtN(a.eerMasc)} <span className="text-xs font-normal opacity-70">kcal/dia</span></p>
                  {a.kcalPerKgMasc && <p className="text-xs text-blue-400">{parseFloat(a.kcalPerKgMasc).toFixed(2)} kcal/kg</p>}
                </div>
              </div>
            )}
            {hasF && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-lg px-3 py-1.5">
                <div>
                  <p className="text-xs text-rose-500 font-medium leading-tight">EER Fem</p>
                  <p className="text-sm font-bold text-rose-700 leading-tight">{fmtN(a.eerFem)} <span className="text-xs font-normal opacity-70">kcal/dia</span></p>
                  {a.kcalPerKgFem && <p className="text-xs text-rose-400">{parseFloat(a.kcalPerKgFem).toFixed(2)} kcal/kg</p>}
                </div>
              </div>
            )}
            {intakePct != null && (
              <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border ${
                intakePct < 70  ? 'bg-red-50 border-red-100' :
                intakePct < 90  ? 'bg-amber-50 border-amber-100' :
                                  'bg-green-50 border-green-100'
              }`}>
                <div>
                  <p className={`text-xs font-medium leading-tight ${intakePct < 70 ? 'text-red-500' : intakePct < 90 ? 'text-amber-500' : 'text-green-500'}`}>Adequação</p>
                  <p className={`text-sm font-bold leading-tight ${intakePct < 70 ? 'text-red-700' : intakePct < 90 ? 'text-amber-700' : 'text-green-700'}`}>
                    {intakePct}% <span className="text-xs font-normal opacity-70">{fmtN(a.intakeKcal)} kcal</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Link
            href={`/dri/plano/${a.id}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              a.planos?.length > 0
                ? 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                : 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            {a.planos?.length > 0 ? 'Ver Plano' : 'Plano Alimentar'}
          </Link>
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Detalhes
          </button>
          <button
            onClick={() => onDelete(a.id)}
            disabled={deleting === a.id}
            title="Remover avaliação"
            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Painel de detalhes (expandido) */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-4">

          {/* Macronutrientes */}
          {(macrosM || macrosF) && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Apple className="w-3.5 h-3.5 text-green-500" /> Distribuição de Macronutrientes (AMDR DRI 2023)
              </p>
              <div className="space-y-3">
                {[macrosM && { m: macrosM, label: 'Masculino', color: 'blue' }, macrosF && { m: macrosF, label: 'Feminino', color: 'rose' }]
                  .filter(Boolean)
                  .map((item) => {
                    const { m, label, color } = item!
                    const isMale = color === 'blue'
                    return (
                      <div key={label}>
                        {macrosM && macrosF && (
                          <p className={`text-xs font-semibold mb-2 ${isMale ? 'text-blue-600' : 'text-rose-600'}`}>{label} — {fmtN(isMale ? a.eerMasc : a.eerFem)} kcal/dia</p>
                        )}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-center">
                            <p className="text-xs font-semibold text-amber-700">Carboidratos</p>
                            <p className="text-xs text-amber-600 mt-0.5">{m.carbs.minPct}–{m.carbs.maxPct}%</p>
                            <p className="text-sm font-bold text-amber-800">{m.carbs.minG.toFixed(0)}–{m.carbs.maxG.toFixed(0)} g</p>
                          </div>
                          <div className="bg-violet-50 border border-violet-100 rounded-lg p-2.5 text-center">
                            <p className="text-xs font-semibold text-violet-700">Gorduras</p>
                            <p className="text-xs text-violet-600 mt-0.5">{m.fat.minPct}–{m.fat.maxPct}%</p>
                            <p className="text-sm font-bold text-violet-800">{m.fat.minG.toFixed(0)}–{m.fat.maxG.toFixed(0)} g</p>
                          </div>
                          <div className="bg-sky-50 border border-sky-100 rounded-lg p-2.5 text-center">
                            <p className="text-xs font-semibold text-sky-700">Proteínas</p>
                            <p className="text-xs text-sky-600 mt-0.5">{m.protein.minPct}–{m.protein.maxPct}%</p>
                            <p className="text-sm font-bold text-sky-800">{m.protein.minG.toFixed(0)}–{m.protein.maxG.toFixed(0)} g</p>
                            <p className="text-xs text-sky-500 mt-0.5">RDA: {m.protein.rdaG.toFixed(1)} g</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Conduta Nutricional (salva no momento da criação) */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-violet-500" /> Sugestão de Conduta Nutricional
            </p>
            {a.conduta ? (
              <div className="text-sm text-slate-700 bg-violet-50/50 border border-violet-100 rounded-lg px-4 py-3 leading-relaxed whitespace-pre-line">
                {a.conduta}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-100 rounded-lg px-3 py-2.5">
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                Nenhuma conduta foi gerada no momento do salvamento desta avaliação.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Painel do Paciente ───────────────────────────────────────────────────────

function PatientTimeline({
  group, onDelete, deleting,
}: {
  group:    PatientGroup
  onDelete: (id: string) => void
  deleting: string | null
}) {
  const evals = group.evaluations // já ordenados newest first

  return (
    <div className="flex-1 overflow-y-auto p-5">
      {/* Header do paciente */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-brand-500" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">{group.label}</h2>
          <p className="text-xs text-slate-400">
            {group.count} {group.count === 1 ? 'avaliação' : 'avaliações'} · última em {fmtDate(group.lastDate)}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Linha vertical */}
        {evals.length > 1 && (
          <div className="absolute left-[18px] top-8 bottom-8 w-px bg-slate-200" />
        )}
        <div className="space-y-4">
          {evals.map((a, i) => (
            <div key={a.id} className="flex gap-4">
              {/* Ponto da timeline */}
              <div className="flex flex-col items-center flex-shrink-0 pt-5">
                <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center z-10 ${
                  i === 0
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'bg-white border-slate-300 text-slate-400'
                }`}>
                  <Flame className="w-4 h-4" />
                </div>
              </div>
              {/* Card */}
              <div className="flex-1 min-w-0">
                <EvaluationCard
                  avaliacao={a}
                  prevAvaliacao={evals[i + 1] ?? null}
                  onDelete={onDelete}
                  deleting={deleting}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Componente Principal ────────────────────────────────────────────────────

export default function DRIHistorico() {
  const [avaliacoes,    setAvaliacoes]    = useState<DriAvaliacao[]>([])
  const [loading,       setLoading]       = useState(true)
  const [deleting,      setDeleting]      = useState<string | null>(null)
  const [search,        setSearch]        = useState('')
  const [selectedKey,   setSelectedKey]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/dri/avaliacoes?limit=100')
      const data = await res.json()
      setAvaliacoes(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Erro ao carregar histórico')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const groups = groupByPatient(avaliacoes)
  const filtered = search.trim()
    ? groups.filter(g => g.key === '__sem__' ? false : g.label.toLowerCase().includes(search.toLowerCase()))
    : groups

  const selectedGroup = groups.find(g => g.key === selectedKey) ?? null

  // Auto-seleciona primeiro grupo ao carregar
  useEffect(() => {
    if (!loading && groups.length > 0 && !selectedKey) {
      setSelectedKey(groups[0].key)
    }
  }, [loading, groups, selectedKey])

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/dri/avaliacoes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setAvaliacoes(prev => {
        const next = prev.filter(a => a.id !== id)
        // Se o grupo ficou vazio, deselecionar
        const remaining = groupByPatient(next)
        if (selectedKey && !remaining.find(g => g.key === selectedKey)) {
          setSelectedKey(remaining[0]?.key ?? null)
        }
        return next
      })
      toast.success('Avaliação removida')
    } catch {
      toast.error('Erro ao remover avaliação')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Carregando histórico…
      </div>
    )
  }

  if (avaliacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
        <History className="w-10 h-10 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">Nenhuma avaliação salva ainda</p>
        <p className="text-xs text-slate-400">Calcule a necessidade energética na aba Calculadora e clique em &ldquo;Salvar&rdquo;.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── Painel esquerdo: lista de pacientes ── */}
      <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
        {/* Busca */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar paciente…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Lista de pacientes */}
        <div className="flex-1 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-400 px-4 py-3">Nenhum resultado.</p>
          ) : filtered.map(g => {
            const active = selectedKey === g.key
            return (
              <button
                key={g.key}
                onClick={() => setSelectedKey(g.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  active ? 'bg-orange-50 border-r-2 border-orange-500' : 'hover:bg-slate-50'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  g.key === '__sem__'
                    ? 'bg-slate-100 text-slate-400'
                    : active ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {g.key === '__sem__' ? '?' : g.label.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${active ? 'text-orange-700' : 'text-slate-700'}`}>
                    {g.label}
                  </p>
                  <p className="text-xs text-slate-400">
                    {g.count} {g.count === 1 ? 'avaliação' : 'avaliações'} · {fmtDate(g.lastDate)}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Rodapé com total */}
        <div className="px-4 py-2.5 border-t border-slate-100">
          <p className="text-xs text-slate-400">{avaliacoes.length} avaliações · {groups.length} pacientes</p>
        </div>
      </div>

      {/* ── Painel direito: timeline do paciente selecionado ── */}
      {selectedGroup ? (
        <PatientTimeline
          group={selectedGroup}
          onDelete={handleDelete}
          deleting={deleting}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          Selecione um paciente à esquerda.
        </div>
      )}
    </div>
  )
}
