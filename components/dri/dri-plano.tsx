'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  UtensilsCrossed, Save, RotateCcw, Sparkles, ArrowLeft,
  Coffee, Sun, Utensils, Cookie, Moon, Calendar, Weight,
  Ruler, Activity, Flame, FileDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { calcPlano, FOOD_GROUPS, type PlanoResult, type GrupoResult } from '@/lib/dri/plano-alimentar'

// ─── Tailwind color maps ──────────────────────────────────────────────────────
const COLOR_MAP: Record<string, { badge: string; dot: string }> = {
  amber:  { badge: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400'  },
  green:  { badge: 'bg-green-100 text-green-700',  dot: 'bg-green-400'  },
  pink:   { badge: 'bg-pink-100 text-pink-700',    dot: 'bg-pink-400'   },
  blue:   { badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400'   },
  red:    { badge: 'bg-red-100 text-red-700',      dot: 'bg-red-400'    },
  orange: { badge: 'bg-orange-100 text-orange-700',dot: 'bg-orange-400' },
  yellow: { badge: 'bg-yellow-100 text-yellow-700',dot: 'bg-yellow-400' },
  purple: { badge: 'bg-purple-100 text-purple-700',dot: 'bg-purple-400' },
}

const MEAL_ICONS: Record<string, React.ElementType> = {
  'Café da manhã':   Coffee,
  'Lanche da manhã': Sun,
  'Almoço':          Utensils,
  'Lanche da tarde': Cookie,
  'Jantar':          Moon,
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface DriAvaliacao {
  id:            string
  patientName:   string | null
  data:          string
  ageMonths:     number
  weightKg:      string
  heightCm:      string
  activityLevel: string
  eerMasc:       string | null
  eerFem:        string | null
  ageCategory:   string
}

interface SavedPlano {
  id:          string
  avaliacaoId: string | null
  patientName: string | null
  eerKcal:     string | number
  ageMonths:   number
  ageGroup:    string
  grupos:      GrupoResult[]
  refeicoes:   { nome: string; pct: number; kcal: number; grupos: string[] }[]
  condutaIa:   string | null
  notes:       string | null
  createdAt:   string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtKcal(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}
function fmtPorcoes(n: number) {
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  })
}
function ageLabel(months: number) {
  const y = Math.floor(months / 12), m = months % 12
  if (y === 0) return `${m} ${m === 1 ? 'mês' : 'meses'}`
  if (m === 0) return `${y} ${y === 1 ? 'ano' : 'anos'}`
  return `${y}a ${m}m`
}
const ACTIVITY_LABEL: Record<string, string> = {
  sedentary: 'Sedentário', low_active: 'Pouco ativo', active: 'Ativo', very_active: 'Muito ativo',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GruposTable({ grupos }: { grupos: GrupoResult[] }) {
  const total = grupos.reduce((s, g) => s + g.kcalTotal, 0)
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Grupo Alimentar</th>
            <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500">Porções/dia</th>
            <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 hidden sm:table-cell">kcal/porção</th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">Total kcal</th>
            <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 hidden sm:table-cell">%</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map(g => {
            const c = COLOR_MAP[g.cor] ?? COLOR_MAP.amber
            return (
              <tr key={g.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                    <div>
                      <p className="text-xs font-medium text-slate-700">{g.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">{g.porcaoDesc}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${c.badge}`}>
                    {fmtPorcoes(g.porcoes)}
                  </span>
                  {g.flexivel && <span className="ml-1 text-xs text-slate-400">✦</span>}
                </td>
                <td className="px-3 py-3 text-center text-xs text-slate-500 hidden sm:table-cell">{g.kcalPorcao}</td>
                <td className="px-4 py-3 text-right text-xs font-semibold text-slate-700">{fmtKcal(g.kcalTotal)}</td>
                <td className="px-4 py-3 text-right hidden sm:table-cell">
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="w-12 bg-slate-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${c.dot}`} style={{ width: `${Math.min(g.pct, 100)}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 w-9 text-right">{g.pct}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 border-t-2 border-slate-200">
            <td className="px-4 py-2.5 text-xs font-bold text-slate-700" colSpan={2}>Total do dia</td>
            <td className="px-3 py-2.5 hidden sm:table-cell" />
            <td className="px-4 py-2.5 text-right text-sm font-bold text-orange-700">{fmtKcal(total)} kcal</td>
            <td className="hidden sm:table-cell" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function RefeicoesList({ refeicoes }: { refeicoes: PlanoResult['refeicoes'] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
      {refeicoes.map(r => {
        const Icon = MEAL_ICONS[r.nome] ?? Utensils
        return (
          <div key={r.nome} className="bg-slate-50 rounded-lg border border-slate-200 p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700 leading-tight">{r.nome}</p>
                <p className="text-xs text-orange-600 font-bold">{fmtKcal(r.kcal)} kcal · {r.pct}%</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {r.grupos.map(g => (
                <span key={g} className="text-xs bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded">{g}</span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DRIPlano({ avaliacaoId }: { avaliacaoId: string }) {
  // Dados da avaliação
  const [avaliacao,   setAvaliacao]   = useState<DriAvaliacao | null>(null)
  const [loadingAv,   setLoadingAv]   = useState(true)

  // Plano existente
  const [savedPlano,  setSavedPlano]  = useState<SavedPlano | null>(null)

  // Form / estado de edição
  const [eerKcal,     setEerKcal]     = useState('')
  const [ageMonths,   setAgeMonths]   = useState('')
  const [observacoes, setObservacoes] = useState('')

  // Resultado calculado
  const [plano,       setPlano]       = useState<PlanoResult | null>(null)

  // Texto IA (editável)
  const [condutaIa,   setCondutaIa]   = useState('')
  const [loadingIA,   setLoadingIA]   = useState(false)

  // Ações
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [editMode,    setEditMode]    = useState(false)

  // ── Carregar avaliação ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoadingAv(true)
    try {
      const [avRes, planoRes] = await Promise.all([
        fetch(`/api/dri/avaliacoes/${avaliacaoId}`),
        fetch(`/api/dri/planos?avaliacaoId=${avaliacaoId}&limit=1`),
      ])
      if (avRes.ok) {
        const av: DriAvaliacao = await avRes.json()
        setAvaliacao(av)
        // pré-preencher EER e idade a partir da avaliação
        const eer = av.eerMasc ? parseFloat(av.eerMasc) : av.eerFem ? parseFloat(av.eerFem) : null
        setEerKcal(eer ? String(Math.round(eer)) : '')
        setAgeMonths(String(av.ageMonths))
      }
      if (planoRes.ok) {
        const planos: SavedPlano[] = await planoRes.json()
        if (planos.length > 0) {
          const p = planos[0]
          setSavedPlano(p)
          setEerKcal(String(Math.round(Number(p.eerKcal))))
          setAgeMonths(String(p.ageMonths))
          setObservacoes(p.notes ?? '')
          setCondutaIa(p.condutaIa ?? '')
          // recalcular distribuição para exibição
          setPlano(calcPlano(Number(p.eerKcal), p.ageMonths))
        }
      }
    } catch {
      toast.error('Erro ao carregar dados da avaliação')
    } finally {
      setLoadingAv(false)
    }
  }, [avaliacaoId])

  useEffect(() => { loadData() }, [loadData])

  // ── Calcular plano ──────────────────────────────────────────────────────────
  function handleCalc() {
    const eer = parseFloat(eerKcal)
    const age = parseInt(ageMonths)
    if (isNaN(eer) || eer <= 0)  { setError('Informe um EER válido (kcal).'); return }
    if (isNaN(age) || age < 12)  { setError('Informe a idade em meses (mínimo 12).'); return }
    setError(null)
    setPlano(calcPlano(eer, age))
  }

  // ── Gerar texto IA ──────────────────────────────────────────────────────────
  async function handleGerarIA() {
    if (!plano) return
    setLoadingIA(true)
    try {
      const res = await fetch('/api/dri/sugerir-plano', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: avaliacao?.patientName ?? null,
          ageMonths:   parseInt(ageMonths),
          eerKcal:     parseFloat(eerKcal),
          ageGroup:    plano.ageGroup,
          grupos:      plano.grupos,
          refeicoes:   plano.refeicoes,
          observacoes: observacoes || null,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCondutaIa(data.suggestion)
    } catch {
      toast.error('Erro ao gerar texto com IA')
    } finally {
      setLoadingIA(false)
    }
  }

  // ── Salvar / Atualizar ──────────────────────────────────────────────────────
  async function handleSave() {
    if (!plano) return
    setSaving(true)
    try {
      const payload = {
        avaliacaoId,
        patientName: avaliacao?.patientName ?? null,
        eerKcal:     plano.eerKcal,
        ageMonths:   parseInt(ageMonths),
        ageGroup:    plano.ageGroup,
        grupos:      plano.grupos,
        refeicoes:   plano.refeicoes,
        condutaIa:   condutaIa || null,
        notes:       observacoes || null,
      }

      let res: Response
      if (savedPlano) {
        res = await fetch(`/api/dri/planos/${savedPlano.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ ...payload, grupos: plano.grupos, refeicoes: plano.refeicoes }),
        })
      } else {
        res = await fetch('/api/dri/planos', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(`Erro ao salvar (${res.status}): ${err.detail ?? err.error ?? 'verifique o console'}`)
        return
      }
      const saved: SavedPlano = await res.json()
      setSavedPlano(saved)
      setEditMode(false)
      toast.success(savedPlano ? 'Plano atualizado' : 'Plano salvo')
    } catch {
      toast.error('Erro de rede ao salvar plano')
    } finally {
      setSaving(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  if (loadingAv) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-orange-500 animate-spin mr-3" />
        Carregando avaliação…
      </div>
    )
  }

  const isEditing = !savedPlano || editMode

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">

      {/* ── Back + Header ────────────────────────────────────────────── */}
      <div>
        <Link
          href="/dri/historico"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao Histórico
        </Link>

        {avaliacao && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0">
                <UtensilsCrossed className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-base font-bold text-slate-800">
                  Plano Alimentar
                  {avaliacao.patientName && <span className="text-slate-500 font-normal"> — {avaliacao.patientName}</span>}
                </h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                    <Calendar className="w-3 h-3" />{fmtDate(avaliacao.data)}
                  </span>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{ageLabel(avaliacao.ageMonths)}</span>
                  <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                    <Weight className="w-3 h-3" />{parseFloat(avaliacao.weightKg).toLocaleString('pt-BR')} kg
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                    <Ruler className="w-3 h-3" />{parseFloat(avaliacao.heightCm).toLocaleString('pt-BR')} cm
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                    <Activity className="w-3 h-3" />{ACTIVITY_LABEL[avaliacao.activityLevel] ?? avaliacao.activityLevel}
                  </span>
                  {avaliacao.eerMasc && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                      <Flame className="w-3 h-3" />EER M: {Math.round(parseFloat(avaliacao.eerMasc))} kcal
                    </span>
                  )}
                  {avaliacao.eerFem && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-1 rounded-md">
                      <Flame className="w-3 h-3" />EER F: {Math.round(parseFloat(avaliacao.eerFem))} kcal
                    </span>
                  )}
                  {savedPlano && !editMode && (
                    <span className="text-xs font-semibold text-teal-600 bg-teal-50 border border-teal-200 px-2 py-1 rounded-md">
                      Plano salvo em {fmtDate(savedPlano.createdAt)}
                    </span>
                  )}
                </div>
              </div>
              {savedPlano && !editMode && (
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/dri/planos/${savedPlano.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Gerar PDF
                  </a>
                  <button
                    onClick={() => setEditMode(true)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                  >
                    Editar plano
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Formulário de configuração ───────────────────────────────── */}
      {isEditing && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-5 flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-orange-500" />
            Configurar Plano
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {/* EER */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Necessidade calórica (EER)
              </label>
              <div className="relative">
                <input
                  type="number" min="0" step="1" placeholder="Ex: 1500"
                  value={eerKcal}
                  onChange={e => { setEerKcal(e.target.value); setError(null) }}
                  className="w-full px-3 py-2.5 pr-16 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">kcal/dia</span>
              </div>
            </div>

            {/* Idade */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Idade</label>
              <div className="relative">
                <input
                  type="number" min="12" max="227" step="1" placeholder="Ex: 36"
                  value={ageMonths}
                  onChange={e => { setAgeMonths(e.target.value); setError(null) }}
                  className="w-full px-3 py-2.5 pr-16 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">meses</span>
              </div>
              {ageMonths && !isNaN(parseInt(ageMonths)) && (
                <p className="text-xs text-slate-400 mt-1">{ageLabel(parseInt(ageMonths))}</p>
              )}
            </div>

            {/* Observações */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Observações e contexto clínico
                <span className="ml-2 text-xs font-normal text-violet-500">usado como contexto para a IA</span>
              </label>
              <textarea
                rows={5}
                placeholder="Ex: criança com preferência por alimentos líquidos, restrição à lactose, objetivo de ganho de 500g/mês, come pouco no jantar…"
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none leading-relaxed"
              />
              <p className="text-xs text-slate-400 mt-1">
                Informe restrições alimentares, preferências, objetivos ou contexto clínico relevante.
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="mt-5 flex gap-3 flex-wrap">
            <button
              onClick={handleCalc}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              <UtensilsCrossed className="w-4 h-4" />
              {plano ? 'Recalcular Plano' : 'Gerar Plano'}
            </button>
            {savedPlano && editMode && (
              <button
                onClick={() => { setEditMode(false); setPlano(calcPlano(Number(savedPlano.eerKcal), savedPlano.ageMonths)) }}
                className="px-3 py-2.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1.5 text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Resultados ───────────────────────────────────────────────── */}
      {plano && (
        <>
          {/* Banner de resultado */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-4 flex-wrap">
            <div className="flex-1">
              <p className="text-sm font-bold text-orange-800">
                {plano.ageGroup} · EER {fmtKcal(plano.eerKcal)} kcal/dia
              </p>
              <p className="text-xs text-orange-600 mt-0.5">
                Total calculado: <strong>{fmtKcal(plano.totalKcal)} kcal</strong>
                {' · '}✦ grupos flexíveis ajustados proporcionalmente
              </p>
            </div>
          </div>

          {/* Tabela de grupos */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Utensils className="w-4 h-4 text-slate-400" />
              Distribuição Diária por Grupo Alimentar
              <span className="text-xs font-normal text-slate-400 ml-1">CFN Resolução 600/2018</span>
            </h3>
            <GruposTable grupos={plano.grupos} />
            <p className="text-xs text-slate-400 mt-3">
              ✦ Cereais, gorduras e açúcares são escalonados para atingir o EER informado.
              Hortaliças, frutas, leite, carnes e leguminosas seguem a recomendação da faixa.
            </p>
          </div>

          {/* Distribuição por refeição */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Coffee className="w-4 h-4 text-slate-400" />
              Distribuição por Refeição
            </h3>
            <RefeicoesList refeicoes={plano.refeicoes} />
            <p className="text-xs text-slate-400 mt-3">
              Café 25% · Lanche manhã 10% · Almoço 30% · Lanche tarde 15% · Jantar 20%
            </p>
          </div>
        </>
      )}

      {/* ── Texto do plano (IA / manual) ─────────────────────────────── */}
      {(plano || savedPlano) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              Texto de Orientação do Plano
              <span className="text-xs font-normal text-slate-400">editável após geração</span>
            </h3>
            {plano && (
              <button
                onClick={handleGerarIA}
                disabled={loadingIA}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {loadingIA ? 'Gerando…' : condutaIa ? 'Regerar com IA' : 'Gerar com IA'}
              </button>
            )}
          </div>

          {loadingIA ? (
            <div className="flex items-center gap-3 text-xs text-slate-500 bg-violet-50 rounded-lg px-4 py-3 border border-violet-100">
              <div className="w-3 h-3 rounded-full border-2 border-violet-400 border-t-transparent animate-spin flex-shrink-0" />
              Analisando distribuição alimentar e observações clínicas…
            </div>
          ) : (
            <textarea
              rows={10}
              placeholder="Clique em 'Gerar com IA' para criar um texto de orientação automaticamente, ou escreva manualmente aqui…"
              value={condutaIa}
              onChange={e => setCondutaIa(e.target.value)}
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none leading-relaxed"
            />
          )}
        </div>
      )}

      {/* ── Botão de salvar ─────────────────────────────────────────── */}
      {(plano || savedPlano) && (isEditing || !savedPlano) && (
        <div className="flex justify-end gap-3 pb-6">
          <button
            onClick={handleSave}
            disabled={saving || !plano}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando…' : savedPlano ? 'Atualizar Plano' : 'Salvar Plano'}
          </button>
        </div>
      )}
    </div>
  )
}
