'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Flame, Calculator, Info, RotateCcw, Lock, Pencil, Save, Sparkles, Apple, UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'
import PatientSearchInput from '@/components/dri/patient-search-input'
import {
  calculateEER,
  isGFVariable,
  suggestGF,
  ACTIVITY_LABELS,
  ACTIVITY_DESCRIPTIONS,
  GROWTH_FACTOR_TABLE,
  type EERInput,
  type EERResult,
  type ActivityLevel,
  type SexSelection,
} from '@/lib/dri/formulas'
import { calcMacros, type MacroResult } from '@/lib/dri/macros'

const SEX_OPTIONS = [
  { value: 'M',    label: 'Masculino'     },
  { value: 'F',    label: 'Feminino'      },
  { value: 'both', label: 'Ambos (M e F)' },
]

const ACTIVITY_LEVELS = Object.keys(ACTIVITY_LABELS) as ActivityLevel[]
const MONTHS_OPTIONS  = Array.from({ length: 12 }, (_, i) => i)

interface FormState {
  sex:            SexSelection
  ageYears:       string
  ageMonths:      string
  weightKg:       string
  heightCm:       string
  activityLevel:  ActivityLevel
  growthFactorM:  string
  growthFactorF:  string
  patientName:    string
  intakeKcal:     string
}

const DEFAULT: FormState = {
  sex: 'both', ageYears: '', ageMonths: '0',
  weightKg: '', heightCm: '', activityLevel: 'sedentary',
  growthFactorM: '', growthFactorF: '',
  patientName: '', intakeKcal: '',
}

function fmtKcal(n: number)   { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtKcalKg(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 5 }) }
function fmtG(n: number)      { return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }

function adequacyStatus(pct: number): { label: string; color: string; bg: string } {
  if (pct < 70)  return { label: 'Risco',    color: 'text-red-700',    bg: 'bg-red-50 border-red-200'    }
  if (pct < 90)  return { label: 'Atenção',  color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' }
  return              { label: 'Adequado', color: 'text-green-700',  bg: 'bg-green-50 border-green-200' }
}

export default function DRICalculator() {
  const [form,           setForm]           = useState<FormState>(DEFAULT)
  const [results,        setResults]        = useState<EERResult[] | null>(null)
  const [macros,         setMacros]         = useState<MacroResult[] | null>(null)
  const [error,          setError]          = useState<string | null>(null)
  const [saving,         setSaving]         = useState(false)
  const [conduta,        setConduta]        = useState<string | null>(null)
  const [loadingConduta, setLoadingConduta] = useState(false)

  const ageYearsN   = parseInt(form.ageYears  || '0')
  const ageMonthsN  = parseInt(form.ageMonths || '0')
  const totalMonths = ageYearsN * 12 + ageMonthsN

  const needsActivity = totalMonths >= 36
  const gfVarM = (form.sex === 'M' || form.sex === 'both') && isGFVariable('M', totalMonths)
  const gfVarF = (form.sex === 'F' || form.sex === 'both') && isGFVariable('F', totalMonths)
  const showGFSection = gfVarM || gfVarF

  const intakeN   = parseFloat(form.intakeKcal) || null
  const eerRefM   = results?.find(r => r.sex === 'M')?.kcal ?? null
  const eerRefF   = results?.find(r => r.sex === 'F')?.kcal ?? null
  const eerSingle = eerRefM ?? eerRefF
  const adequacyPct = intakeN != null && eerSingle != null
    ? Math.round((intakeN / eerSingle) * 100)
    : null

  useEffect(() => {
    const y = parseInt(form.ageYears  || '0')
    const m = parseInt(form.ageMonths || '0')
    const tot = y * 12 + m
    setForm(p => ({
      ...p,
      growthFactorM: isGFVariable('M', tot) ? String(suggestGF('M', y, m)) : p.growthFactorM,
      growthFactorF: isGFVariable('F', tot) ? String(suggestGF('F', y, m)) : p.growthFactorF,
    }))
  }, [form.ageYears, form.ageMonths, form.sex])

  function set(field: keyof FormState, value: string) {
    setForm(p => ({ ...p, [field]: value }))
    setError(null)
  }

  function handleCalc() {
    const weight  = parseFloat(form.weightKg)
    const height  = parseFloat(form.heightCm)
    const months  = ageYearsN * 12 + ageMonthsN

    if (isNaN(weight) || weight <= 0)  { setError('Informe um peso válido (kg).'); return }
    if (isNaN(height) || height <= 0)  { setError('Informe a estatura (cm).'); return }
    if (months < 0 || months > 227)    { setError('Idade fora do intervalo suportado (0 a <19 anos).'); return }

    if (gfVarM && isNaN(parseFloat(form.growthFactorM))) {
      setError('Informe o Fator de Crescimento (Masculino).'); return
    }
    if (gfVarF && isNaN(parseFloat(form.growthFactorF))) {
      setError('Informe o Fator de Crescimento (Feminino).'); return
    }

    const input: EERInput = {
      sex: form.sex, ageYears: ageYearsN, ageMonths: ageMonthsN,
      weightKg: weight, heightCm: height, activityLevel: form.activityLevel,
      growthFactorM: gfVarM ? parseFloat(form.growthFactorM) : undefined,
      growthFactorF: gfVarF ? parseFloat(form.growthFactorF) : undefined,
    }

    const res = calculateEER(input)
    setResults(res)
    setMacros(res.map(r => calcMacros(r.kcal, weight, months)))
    setConduta(null)
  }

  function handleReset() {
    setForm(DEFAULT)
    setResults(null)
    setMacros(null)
    setError(null)
    setConduta(null)
  }

  async function handleSave() {
    if (!results) return
    setSaving(true)
    try {
      const eerM  = results.find(r => r.sex === 'M')
      const eerF  = results.find(r => r.sex === 'F')
      const res   = await fetch('/api/dri/avaliacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName:   form.patientName || null,
          ageMonths:     totalMonths,
          weightKg:      parseFloat(form.weightKg),
          heightCm:      parseFloat(form.heightCm),
          sexInput:      form.sex,
          activityLevel: form.activityLevel,
          growthFactorM: gfVarM ? parseFloat(form.growthFactorM) : null,
          growthFactorF: gfVarF ? parseFloat(form.growthFactorF) : null,
          intakeKcal:    intakeN,
          eerMasc:       eerM?.kcal    ?? null,
          eerFem:        eerF?.kcal    ?? null,
          kcalPerKgMasc: eerM?.kcalPerKg ?? null,
          kcalPerKgFem:  eerF?.kcalPerKg ?? null,
          ageCategory:   results[0].ageCategory,
          notes:         null,
          conduta:       conduta ?? null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('[DRI save]', res.status, err)
        toast.error(`Erro ao salvar (${res.status}): ${err.detail ?? err.error ?? 'verifique o console'}`)
        return
      }
      toast.success('Avaliação salva no histórico')
    } catch (e) {
      console.error('[DRI save]', e)
      toast.error('Erro de rede ao salvar avaliação')
    } finally {
      setSaving(false)
    }
  }

  async function handleSugerirConduta() {
    if (!results) return
    setLoadingConduta(true)
    setConduta(null)
    try {
      const eerM = results.find(r => r.sex === 'M')
      const eerF = results.find(r => r.sex === 'F')
      const res  = await fetch('/api/dri/sugerir-conduta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName:   form.patientName || null,
          ageMonths:     totalMonths,
          weightKg:      parseFloat(form.weightKg),
          heightCm:      parseFloat(form.heightCm),
          sexInput:      form.sex,
          activityLevel: form.activityLevel,
          eerMasc:       eerM?.kcal    ?? null,
          eerFem:        eerF?.kcal    ?? null,
          kcalPerKgMasc: eerM?.kcalPerKg ?? null,
          kcalPerKgFem:  eerF?.kcalPerKg ?? null,
          intakeKcal:    intakeN,
          ageCategory:   results[0].ageCategory,
          notes:         null,
        }),
      })
      if (!res.ok) throw new Error('Falha')
      const data = await res.json()
      setConduta(data.suggestion)
    } catch {
      toast.error('Erro ao gerar sugestão de conduta')
    } finally {
      setLoadingConduta(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ─── Coluna principal ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Formulário */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-5 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-blue-500" />
              Dados do Paciente
            </h2>

            <div className="grid grid-cols-2 gap-4">

              {/* Nome do paciente */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Paciente (opcional)</label>
                <PatientSearchInput
                  value={form.patientName}
                  onChange={(name, patient) => {
                    setForm(p => ({ ...p, patientName: name }))
                    if (patient?.birthDate) {
                      const birth = new Date(patient.birthDate)
                      if (!isNaN(birth.getTime())) {
                        const now    = new Date()
                        let years    = now.getFullYear() - birth.getFullYear()
                        let months   = now.getMonth()    - birth.getMonth()
                        if (months < 0) { years--; months += 12 }
                        if (now.getDate() < birth.getDate()) months = Math.max(0, months - 1)
                        const sexVal = patient.sex === 'M' ? 'M' : patient.sex === 'F' ? 'F' : form.sex
                        setForm(p => ({
                          ...p,
                          patientName: patient.name,
                          ageYears:    String(years),
                          ageMonths:   String(months),
                          sex:         sexVal as SexSelection,
                        }))
                      }
                    }
                  }}
                />
              </div>

              {/* Sexo */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Sexo</label>
                <select
                  value={form.sex}
                  onChange={e => set('sex', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {SEX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Idade */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Idade</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="number" min="0" max="18" placeholder="0"
                      value={form.ageYears}
                      onChange={e => set('ageYears', e.target.value)}
                      className="w-full px-3 py-2.5 pr-12 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">anos</span>
                  </div>
                  <select
                    value={form.ageMonths}
                    onChange={e => set('ageMonths', e.target.value)}
                    className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {MONTHS_OPTIONS.map(m => <option key={m} value={m}>{m} {m === 1 ? 'mês' : 'meses'}</option>)}
                  </select>
                </div>
              </div>

              {/* Peso */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Peso</label>
                <div className="relative">
                  <input
                    type="number" min="0" step="0.1" placeholder="0,0"
                    value={form.weightKg}
                    onChange={e => set('weightKg', e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">kg</span>
                </div>
              </div>

              {/* Estatura */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Estatura</label>
                <div className="relative">
                  <input
                    type="number" min="0" step="0.1" placeholder="0,0"
                    value={form.heightCm}
                    onChange={e => set('heightCm', e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">cm</span>
                </div>
              </div>

              {/* Nível de atividade */}
              {needsActivity && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-2">Nível de Atividade Física</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ACTIVITY_LEVELS.map(lv => (
                      <button
                        key={lv}
                        type="button"
                        onClick={() => set('activityLevel', lv)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          form.activityLevel === lv
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        <p className="text-xs font-semibold leading-tight">{ACTIVITY_LABELS[lv]}</p>
                        <p className="text-xs opacity-60 mt-0.5 leading-snug">{ACTIVITY_DESCRIPTIONS[lv]}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Fator de Crescimento */}
              {showGFSection ? (
                <div className="col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Pencil className="w-3.5 h-3.5 text-amber-500" />
                    <label className="text-xs font-medium text-slate-600">
                      Fator de Crescimento
                      <span className="ml-1.5 text-amber-600 font-semibold text-xs bg-amber-50 px-1.5 py-0.5 rounded">variável</span>
                    </label>
                  </div>
                  <div className={`grid gap-3 ${gfVarM && gfVarF ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'}`}>
                    {gfVarM && (
                      <div>
                        {gfVarF && <p className="text-xs text-blue-600 font-medium mb-1">Masculino</p>}
                        <div className="relative">
                          <input
                            type="number" min="0" step="1"
                            value={form.growthFactorM}
                            onChange={e => set('growthFactorM', e.target.value)}
                            className="w-full px-3 py-2.5 pr-16 text-sm border border-amber-200 rounded-lg bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">kcal/dia</span>
                        </div>
                      </div>
                    )}
                    {gfVarF && (
                      <div>
                        {gfVarM && <p className="text-xs text-rose-600 font-medium mb-1">Feminino</p>}
                        <div className="relative">
                          <input
                            type="number" min="0" step="1"
                            value={form.growthFactorF}
                            onChange={e => set('growthFactorF', e.target.value)}
                            className="w-full px-3 py-2.5 pr-16 text-sm border border-amber-200 rounded-lg bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">kcal/dia</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">Valor sugerido pela tabela DRI 2023. Consulte a referência ao lado para ajustar.</p>
                </div>
              ) : (totalMonths > 0 && (
                <div className="col-span-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                    <Lock className="w-3 h-3 flex-shrink-0" />
                    <span>Fator de crescimento fixo para esta faixa etária (definido pelo DRI 2023)</span>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={handleCalc}
                className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Flame className="w-4 h-4" />
                Calcular Necessidade Energética
              </button>
              {results && (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    title="Salvar no histórico"
                    className="px-3 py-2.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-50 flex items-center gap-1.5 text-sm font-medium"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Salvando…' : 'Salvar'}
                  </button>
                  <Link
                    href={`/dri/plano?eer=${eerSingle ?? ''}&age=${totalMonths}&patient=${encodeURIComponent(form.patientName)}`}
                    title="Criar Plano Alimentar"
                    className="px-3 py-2.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 transition-colors flex items-center gap-1.5 text-sm font-medium"
                  >
                    <UtensilsCrossed className="w-4 h-4" />
                    Plano
                  </Link>
                  <button
                    onClick={handleReset}
                    title="Limpar"
                    className="px-3 py-2.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Resultados */}
          {results && results.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-5 flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                Resultado — Necessidade Energética Total (NET)
              </h2>

              {/* Cards de resumo */}
              <div className={`grid gap-4 mb-6 ${results.length > 1 ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'}`}>
                {results.map(r => (
                  <div
                    key={r.sex}
                    className={`rounded-xl p-4 border ${
                      r.sex === 'M' ? 'bg-blue-50 border-blue-100' : 'bg-rose-50 border-rose-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${
                        r.sex === 'M' ? 'bg-blue-500' : 'bg-rose-500'
                      }`}>
                        {r.sex === 'M' ? 'MASCULINO' : 'FEMININO'}
                      </span>
                      <span className="text-xs text-slate-500">{r.ageCategory}</span>
                      {r.gfVariable ? (
                        <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">FC {r.usedC5} kcal</span>
                      ) : (
                        <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">FC {r.usedC5} kcal (fixo)</span>
                      )}
                    </div>
                    <p className={`text-3xl font-bold ${r.sex === 'M' ? 'text-blue-700' : 'text-rose-700'}`}>
                      {fmtKcal(r.kcal)}
                      <span className="text-base font-medium ml-1.5 opacity-70">kcal/dia</span>
                    </p>
                    <p className={`text-sm mt-1 ${r.sex === 'M' ? 'text-blue-500' : 'text-rose-500'}`}>
                      {fmtKcalKg(r.kcalPerKg)} kcal/kg
                    </p>
                  </div>
                ))}
              </div>

              {/* Fórmula detalhada */}
              <div className="mb-5 p-3 bg-slate-50 rounded-lg space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 mb-1">Verificação do cálculo:</p>
                {results.map(r => (
                  <div key={r.sex} className="flex items-start gap-2">
                    <span className={`text-xs font-bold mt-0.5 flex-shrink-0 ${r.sex === 'M' ? 'text-blue-600' : 'text-rose-600'}`}>{r.sex}:</span>
                    <p className="text-xs text-slate-500 font-mono leading-relaxed break-all">
                      {r.formulaDetail} = <span className="font-bold text-slate-700">{fmtKcal(r.kcal)} kcal</span>
                    </p>
                  </div>
                ))}
                <p className="text-xs text-slate-400 pt-1.5 border-t border-slate-200 mt-1">
                  C1 + C2 × Idade(anos) + C3 × Estatura(cm) + C4 × Peso(kg) + C5 (FC)
                </p>
              </div>

              {/* Adequação alimentar */}
              <div className="border-t border-slate-100 pt-5">
                <h3 className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
                  <Apple className="w-3.5 h-3.5 text-green-500" />
                  Adequação Alimentar (opcional)
                </h3>
                <div className="flex items-start gap-3">
                  <div className="flex-1 max-w-xs">
                    <label className="block text-xs text-slate-400 mb-1.5">Ingestão estimada atual</label>
                    <div className="relative">
                      <input
                        type="number" min="0" step="1" placeholder="Ex: 1200"
                        value={form.intakeKcal}
                        onChange={e => set('intakeKcal', e.target.value)}
                        className="w-full px-3 py-2 pr-16 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">kcal/dia</span>
                    </div>
                  </div>
                  {adequacyPct != null && (() => {
                    const status = adequacyStatus(adequacyPct)
                    const eerRef = eerRefM ?? eerRefF!
                    const gap    = eerRef - (intakeN ?? 0)
                    return (
                      <div className={`flex-1 rounded-lg border px-4 py-3 ${status.bg}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold ${status.color}`}>{status.label}</span>
                          <span className={`text-lg font-bold ${status.color}`}>{adequacyPct}%</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {gap > 0
                            ? `Deficit de ${Math.round(gap)} kcal/dia para atingir o EER`
                            : `Ingestão acima do EER em ${Math.abs(Math.round(gap))} kcal/dia`}
                        </p>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Distribuição de Macronutrientes */}
          {macros && macros.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-5 flex items-center gap-2">
                <Apple className="w-4 h-4 text-green-500" />
                Distribuição de Macronutrientes
                <span className="text-xs font-normal text-slate-400 ml-1">DRI 2023 AMDR</span>
              </h2>

              {macros.map((m, i) => {
                const res  = results![i]
                const isMale = res?.sex === 'M'
                return (
                  <div key={i} className={macros.length > 1 ? 'mb-5 last:mb-0' : ''}>
                    {macros.length > 1 && (
                      <p className={`text-xs font-bold mb-3 flex items-center gap-1.5 ${isMale ? 'text-blue-600' : 'text-rose-600'}`}>
                        <span className={`w-2 h-2 rounded-full inline-block ${isMale ? 'bg-blue-500' : 'bg-rose-500'}`} />
                        {isMale ? 'Masculino' : 'Feminino'} — {fmtKcal(m.eerKcal)} kcal/dia
                      </p>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                      {/* Carboidratos */}
                      <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                        <p className="text-xs font-semibold text-amber-700 mb-2">Carboidratos</p>
                        <p className="text-xs text-amber-600 font-medium">{m.carbs.minPct}–{m.carbs.maxPct}%</p>
                        <p className="text-sm font-bold text-amber-800 mt-1">{fmtG(m.carbs.minG)}–{fmtG(m.carbs.maxG)} g/dia</p>
                        <p className="text-xs text-amber-500 mt-0.5">{fmtG(m.carbs.minKcal)}–{fmtG(m.carbs.maxKcal)} kcal</p>
                      </div>

                      {/* Gorduras */}
                      <div className="bg-violet-50 border border-violet-100 rounded-lg p-3">
                        <p className="text-xs font-semibold text-violet-700 mb-2">Gorduras</p>
                        <p className="text-xs text-violet-600 font-medium">{m.fat.minPct}–{m.fat.maxPct}%</p>
                        <p className="text-sm font-bold text-violet-800 mt-1">{fmtG(m.fat.minG)}–{fmtG(m.fat.maxG)} g/dia</p>
                        <p className="text-xs text-violet-500 mt-0.5">{fmtG(m.fat.minKcal)}–{fmtG(m.fat.maxKcal)} kcal</p>
                      </div>

                      {/* Proteínas */}
                      <div className="bg-sky-50 border border-sky-100 rounded-lg p-3">
                        <p className="text-xs font-semibold text-sky-700 mb-2">Proteínas</p>
                        <p className="text-xs text-sky-600 font-medium">{m.protein.minPct}–{m.protein.maxPct}%</p>
                        <p className="text-sm font-bold text-sky-800 mt-1">{fmtG(m.protein.minG)}–{fmtG(m.protein.maxG)} g/dia</p>
                        <p className="text-xs text-sky-500 mt-0.5">RDA: {fmtG(m.protein.rdaG)} g ({m.label})</p>
                      </div>
                    </div>
                  </div>
                )
              })}

              <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100">
                AMDR = Acceptable Macronutrient Distribution Ranges. Proteína RDA por faixa etária (DRI 2023 NASEM).
              </p>
            </div>
          )}

          {/* IA — Sugestão de Conduta */}
          {results && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  Sugestão de Conduta Nutricional
                  <span className="text-xs font-normal text-slate-400 ml-0.5">via IA</span>
                </h2>
                <button
                  onClick={handleSugerirConduta}
                  disabled={loadingConduta}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {loadingConduta ? 'Gerando…' : conduta ? 'Gerar novamente' : 'Gerar sugestão'}
                </button>
              </div>

              {!conduta && !loadingConduta && (
                <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
                  Clique em &ldquo;Gerar sugestão&rdquo; para obter um rascunho de conduta nutricional baseado nos dados calculados.
                  O texto gerado é um ponto de partida — revise e adapte conforme o contexto clínico.
                </p>
              )}

              {loadingConduta && (
                <div className="flex items-center gap-3 text-xs text-slate-500 bg-violet-50 rounded-lg px-4 py-3 border border-violet-100">
                  <div className="w-3 h-3 rounded-full border-2 border-violet-400 border-t-transparent animate-spin flex-shrink-0" />
                  Analisando dados nutricionais…
                </div>
              )}

              {conduta && (
                <div className="text-sm text-slate-700 bg-violet-50/40 border border-violet-100 rounded-lg px-4 py-3 leading-relaxed whitespace-pre-line">
                  {conduta}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Coluna lateral: tabelas de referência ───────────────────── */}
        <div className="space-y-4">

          {/* Fator de Crescimento */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-500" />
              Fator de Crescimento
              <span className="font-normal text-amber-500 normal-case ml-1">(variável)</span>
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-1 rounded mb-1.5">Meninas</p>
                <table className="w-full">
                  <tbody>
                    {GROWTH_FACTOR_TABLE.girls.map(row => (
                      <tr key={row.range} className="border-b border-slate-50 last:border-0">
                        <td className="py-1.5 text-xs text-slate-600">{row.range}</td>
                        <td className="py-1.5 text-xs font-semibold text-slate-700 text-right">{row.kcal} kcal/dia</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded mb-1.5">Meninos</p>
                <table className="w-full">
                  <tbody>
                    {GROWTH_FACTOR_TABLE.boys.map(row => (
                      <tr key={row.range} className="border-b border-slate-50 last:border-0">
                        <td className="py-1.5 text-xs text-slate-600">{row.range}</td>
                        <td className="py-1.5 text-xs font-semibold text-slate-700 text-right">{row.kcal} kcal/dia</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-400 pt-1 border-t border-slate-100">
                Aplicado às faixas: 6m–3y (Fem) e 3–14 anos (ambos).
              </p>
            </div>
          </div>

          {/* Faixas com C5 fixo */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Fator Fixo (automático)
            </h3>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs text-slate-400 font-medium pb-1.5">Faixa</th>
                  <th className="text-center text-xs text-blue-500 font-semibold pb-1.5">M</th>
                  <th className="text-center text-xs text-rose-500 font-semibold pb-1.5">F</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: '0 – <3 meses',  m: 200, f: 180 },
                  { label: '3 – <6 meses',  m:  50, f:  60 },
                  { label: '6m – <3 anos',  m:  20, f: '—' },
                  { label: '14 – <19 anos', m:  20, f:  20 },
                ].map(row => (
                  <tr key={row.label} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 text-xs text-slate-600">{row.label}</td>
                    <td className="py-1.5 text-xs font-semibold text-blue-600 text-center">{row.m}</td>
                    <td className="py-1.5 text-xs font-semibold text-rose-600 text-center">{row.f}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Níveis de atividade */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-500" />
              Níveis de Atividade
              <span className="font-normal text-slate-400 normal-case ml-1">≥3 anos</span>
            </h3>
            <div className="space-y-1.5">
              {ACTIVITY_LEVELS.map(lv => (
                <div key={lv} className="flex flex-col py-1 border-b border-slate-50 last:border-0">
                  <span className="text-xs font-semibold text-slate-700">{ACTIVITY_LABELS[lv]}</span>
                  <span className="text-xs text-slate-400">{ACTIVITY_DESCRIPTIONS[lv]}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
