'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import {
  ScrollText, Plus, History, BookTemplate,
  Search, X, Save, FileText, Trash2,
  Sparkles, ChevronDown, Check, Copy, Edit2,
  Loader2, Calendar, User,
} from 'lucide-react'
import { TemplateBuilder } from './template-builder'
import { SecaoInput, initValores } from './secao-input'
import { buildContext, applyVariables } from '@/lib/orientacoes/variables'
import type { SecaoTemplate, SecaoValor, TipoSecao } from '@/lib/orientacoes/types'
import { TIPO_LABELS } from '@/lib/orientacoes/types'

interface Patient    { id: string; name: string }
interface Template   { id: string; title: string; secoes: SecaoTemplate[] | null | undefined; createdAt: string }
interface Orientacao {
  id:             string
  title:          string
  secoes:         SecaoValor[]
  patientName:    string | null
  patientId:      string | null
  orientacaoDate: string | null
  createdAt:      string
  patient:        { id: string; name: string } | null
}

interface OrientacaoGroup {
  key:      string
  label:    string
  items:    Orientacao[]
  lastDate: string
  count:    number
}

type Tab = 'criar' | 'historico' | 'modelos'

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

function groupOrientacoes(list: Orientacao[]): OrientacaoGroup[] {
  const map = new Map<string, Orientacao[]>()
  for (const o of list) {
    const k = o.patientId ?? o.patientName?.trim() ?? '__sem__'
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(o)
  }
  return Array.from(map.entries())
    .map(([key, items]) => {
      const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      const first  = sorted[0]
      const label  = first.patient?.name ?? first.patientName ?? 'Sem paciente identificado'
      return { key, label, items: sorted, lastDate: sorted[0].createdAt, count: sorted.length }
    })
    .sort((a, b) => {
      if (a.key === '__sem__') return 1
      if (b.key === '__sem__') return -1
      return new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
    })
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Returns true only when the user made a meaningful edit compared to the resolved template text
function isMeaningfulEdit(currentHtml: string, resolvedTplHtml: string): boolean {
  const current  = stripHtml(currentHtml)
  const resolved = stripHtml(resolvedTplHtml)

  if (current === resolved) return false

  // Significant length difference (user added/removed >15% of content)
  const maxLen = Math.max(current.length, resolved.length, 1)
  if (Math.abs(current.length - resolved.length) / maxLen > 0.15) return true

  // Word-level comparison: ignore words with ≤2 chars (articles, prepositions)
  const words = (t: string) => new Set(t.toLowerCase().split(/\s+/).filter(w => w.length > 2))
  const cWords = words(current)
  const rWords = words(resolved)

  const changed =
    [...cWords].filter(w => !rWords.has(w)).length +
    [...rWords].filter(w => !cWords.has(w)).length

  const total = Math.max(cWords.size, rWords.size, 1)

  // Meaningful if ≥10% of unique words changed
  return changed / total >= 0.10
}

export function OrientacoesPage() {
  const [tab, setTab] = useState<Tab>('criar')

  // ── Criar state ────────────────────────────────────────────────
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [patientQuery,    setPatientQuery]     = useState('')
  const [patientResults,  setPatientResults]   = useState<Patient[]>([])
  const [showPatientDD,   setShowPatientDD]    = useState(false)
  const [searchingPat,    setSearchingPat]     = useState(false)

  const [orientacaoDate, setOrientacaoDate] = useState(todayISO())

  const [templates,    setTemplates]    = useState<Template[]>([])
  const [selectedTpl,  setSelectedTpl]  = useState<Template | null>(null)
  const [showTplDD,    setShowTplDD]    = useState(false)

  const [secoes,              setSecoes]              = useState<SecaoValor[]>([])
  const [saving,              setSaving]              = useState(false)
  const [improving,           setImproving]           = useState(false)
  const [savedId,             setSavedId]             = useState<string | null>(null)
  const [pendingImprovements, setPendingImprovements] = useState<Record<string, string> | null>(null)

  // ── History ────────────────────────────────────────────────────
  const [orientacoes,      setOrientacoes]      = useState<Orientacao[]>([])
  const [loadingHistory,   setLoadingHistory]   = useState(false)
  const [historyPatientId, setHistoryPatientId] = useState<string | null>(null)
  const [selectedHistKey,  setSelectedHistKey]  = useState<string | null>(null)
  const [histSearch,       setHistSearch]       = useState('')

  // ── Modelos ────────────────────────────────────────────────────
  const [tplTitle,   setTplTitle]   = useState('')
  const [tplSecoes,  setTplSecoes]  = useState<SecaoTemplate[]>([])
  const [tplSaving,  setTplSaving]  = useState(false)
  const [editingTpl, setEditingTpl] = useState<Template | null>(null)

  const patientRef = useRef<HTMLDivElement>(null)
  const tplDDRef   = useRef<HTMLDivElement>(null)

  // Load templates once
  useEffect(() => {
    fetch('/api/orientacoes/templates')
      .then(r => r.json())
      .then((data: Template[]) => setTemplates(data))
      .catch(() => {})
  }, [])

  // Patient search
  const searchPatients = useCallback(async (q: string) => {
    if (q.length < 2) { setPatientResults([]); return }
    setSearchingPat(true)
    try {
      const res = await fetch(`/api/pacientes?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setPatientResults(data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
      }
    } finally { setSearchingPat(false) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchPatients(patientQuery), 300)
    return () => clearTimeout(t)
  }, [patientQuery, searchPatients])

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (patientRef.current && !patientRef.current.contains(e.target as Node)) setShowPatientDD(false)
      if (tplDDRef.current   && !tplDDRef.current.contains(e.target   as Node)) setShowTplDD(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function applyTemplate(tpl: Template) {
    const ctx  = buildContext(selectedPatient, new Date(orientacaoDate))
    const vals = initValores(tpl.secoes ?? [], ctx)
    setSelectedTpl(tpl)
    setSecoes(vals)
    setShowTplDD(false)
    setSavedId(null)
  }

  // Re-apply variables when patient changes (if template already selected)
  useEffect(() => {
    if (!selectedTpl) return
    const ctx  = buildContext(selectedPatient, new Date(orientacaoDate))
    const vals = initValores(selectedTpl.secoes ?? [], ctx)
    setSecoes(vals)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient, orientacaoDate])

  function updateValor(id: string, valor: string) {
    setSecoes(prev => prev.map(s => s.id === id ? { ...s, valor } : s))
  }

  function addExtraSection(tipo: TipoSecao) {
    setSecoes(prev => [...prev, { id: uid(), titulo: '', tipo, valor: '' }])
  }

  function removeSection(id: string) {
    setSecoes(prev => prev.filter(s => s.id !== id))
  }

  function updateSectionTitulo(id: string, titulo: string) {
    setSecoes(prev => prev.map(s => s.id === id ? { ...s, titulo } : s))
  }

  async function handleSave() {
    if (!selectedPatient) { toast.error('Selecione um paciente'); return }
    if (secoes.length === 0) { toast.error('Adicione ao menos uma seção'); return }

    setSaving(true)
    try {
      const method = savedId ? 'PATCH' : 'POST'
      const url    = savedId ? `/api/orientacoes/${savedId}` : '/api/orientacoes'
      const body   = savedId
        ? { secoes, title: selectedTpl?.title ?? 'Orientação' }
        : {
            patientId:      selectedPatient.id,
            patientName:    selectedPatient.name,
            templateId:     selectedTpl?.id ?? null,
            title:          selectedTpl?.title ?? 'Orientação',
            secoes,
            orientacaoDate,
          }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const saved: Orientacao = await res.json()
      setSavedId(saved.id)
      toast.success('Orientação salva!')
      if (selectedPatient) setHistoryPatientId(selectedPatient.id)
      resetForm()
      setTab('historico')
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleImprove() {
    const ctx          = buildContext(selectedPatient, new Date(orientacaoDate))
    const templateSecoes = selectedTpl?.secoes ?? []

    // Only improve sections where the user made a meaningful edit vs the resolved template text
    const toImprove = secoes.filter(s => {
      if (s.tipo !== 'texto_longo' || !s.valor.trim()) return false
      const tplSection = templateSecoes.find(t => t.id === s.id)
      if (!tplSection) return true  // manually added section — always include
      // Resolve variables (#nome, #data, etc.) before comparing so they don't count as edits
      const resolvedTpl = applyVariables(tplSection.valor ?? '', ctx)
      return isMeaningfulEdit(s.valor, resolvedTpl)
    })

    if (toImprove.length === 0) {
      toast.info('Edite ao menos uma seção de texto longo antes de usar a IA.')
      return
    }

    setImproving(true)
    try {
      const res = await fetch('/api/orientacoes/melhorar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       selectedTpl?.title ?? 'Orientação',
          secoes:      toImprove,
          patientName: selectedPatient?.name,
        }),
      })
      if (!res.ok) throw new Error()
      const { secoes: improved }: { secoes: SecaoValor[] } = await res.json()

      // Always show all returned sections as pending — no comparison needed
      const pending: Record<string, string> = {}
      for (const s of improved) pending[s.id] = s.valor

      if (Object.keys(pending).length === 0) {
        toast.error('A IA não retornou sugestões. Tente novamente.')
      } else {
        setPendingImprovements(pending)
        toast.success(`${Object.keys(pending).length} seção(ões) com sugestão da IA. Revise abaixo.`)
      }
    } catch {
      toast.error('Erro ao melhorar texto')
    } finally {
      setImproving(false)
    }
  }

  function acceptImprovement(id: string) {
    if (!pendingImprovements?.[id]) return
    updateValor(id, pendingImprovements[id])
    setPendingImprovements(prev => {
      if (!prev) return null
      const { [id]: _, ...rest } = prev
      return Object.keys(rest).length > 0 ? rest : null
    })
  }

  function rejectImprovement(id: string) {
    setPendingImprovements(prev => {
      if (!prev) return null
      const { [id]: _, ...rest } = prev
      return Object.keys(rest).length > 0 ? rest : null
    })
  }

  function acceptAllImprovements() {
    if (!pendingImprovements) return
    Object.entries(pendingImprovements).forEach(([id, valor]) => updateValor(id, valor))
    setPendingImprovements(null)
    toast.success('Todas as melhorias aplicadas!')
  }

  function rejectAllImprovements() {
    setPendingImprovements(null)
    toast.info('Sugestões descartadas.')
  }

  function resetForm() {
    setSelectedPatient(null)
    setPatientQuery('')
    setSelectedTpl(null)
    setOrientacaoDate(todayISO())
    setSecoes([])
    setSavedId(null)
    setPendingImprovements(null)
  }

  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/orientacoes')
      if (res.ok) setOrientacoes(await res.json())
    } finally { setLoadingHistory(false) }
  }

  useEffect(() => {
    if (tab === 'historico') loadHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // Auto-select patient after save redirect
  useEffect(() => {
    if (historyPatientId && orientacoes.length > 0) {
      setSelectedHistKey(historyPatientId)
    }
  }, [historyPatientId, orientacoes])

  async function deleteOrientacao(id: string) {
    if (!confirm('Excluir esta orientação?')) return
    try {
      await fetch(`/api/orientacoes/${id}`, { method: 'DELETE' })
      setOrientacoes(prev => {
        const next = prev.filter(o => o.id !== id)
        const remaining = groupOrientacoes(next)
        if (selectedHistKey && !remaining.find(g => g.key === selectedHistKey)) {
          setSelectedHistKey(remaining[0]?.key ?? null)
        }
        return next
      })
      toast.success('Excluída')
    } catch { toast.error('Erro') }
  }

  // ── Modelos ──────────────────────────────────────────────────
  async function saveTpl() {
    if (!tplTitle.trim())  { toast.error('Preencha o nome do modelo'); return }
    if (!tplSecoes.length) { toast.error('Adicione ao menos uma seção'); return }

    setTplSaving(true)
    try {
      if (editingTpl) {
        const res = await fetch(`/api/orientacoes/templates/${editingTpl.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body:   JSON.stringify({ title: tplTitle, secoes: tplSecoes }),
        })
        if (!res.ok) throw new Error()
        const updated: Template = await res.json()
        setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t))
        setEditingTpl(null)
      } else {
        const res = await fetch('/api/orientacoes/templates', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body:   JSON.stringify({ title: tplTitle, secoes: tplSecoes }),
        })
        if (!res.ok) throw new Error()
        const created: Template = await res.json()
        setTemplates(prev => [created, ...prev])
      }
      setTplTitle(''); setTplSecoes([])
      toast.success(editingTpl ? 'Modelo atualizado' : 'Modelo salvo!')
    } catch { toast.error('Erro ao salvar modelo')
    } finally { setTplSaving(false) }
  }

  async function deleteTpl(id: string) {
    if (!confirm('Excluir este modelo?')) return
    try {
      await fetch(`/api/orientacoes/templates/${id}`, { method: 'DELETE' })
      setTemplates(prev => prev.filter(t => t.id !== id))
      toast.success('Excluído')
    } catch { toast.error('Erro') }
  }

  function startEditTpl(tpl: Template) {
    setEditingTpl(tpl)
    setTplTitle(tpl.title)
    setTplSecoes(tpl.secoes ?? [])
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'criar',     label: 'Criar Orientação', icon: Plus         },
    { key: 'historico', label: 'Histórico',         icon: History      },
    { key: 'modelos',   label: 'Modelos',            icon: BookTemplate },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Orientações</h1>
            <p className="text-xs text-slate-500">Crie e envie orientações clínicas personalizadas</p>
          </div>
        </div>
        <div className="flex gap-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className={`flex-1 min-h-0 ${tab === 'historico' ? 'overflow-hidden' : 'overflow-y-auto p-6'}`}>

        {/* ─── CRIAR ─────────────────────────────────────────── */}
        {tab === 'criar' && (
          <div className="max-w-2xl mx-auto space-y-5">

            {/* Step 1 — Patient */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">1. Paciente</p>
              <div ref={patientRef} className="relative">
                {selectedPatient ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <span className="flex-1 text-sm font-semibold text-indigo-800">{selectedPatient.name}</span>
                    <button onClick={() => { setSelectedPatient(null); setPatientQuery('') }} className="text-indigo-400 hover:text-indigo-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      placeholder="Buscar paciente pelo nome..."
                      value={patientQuery}
                      onChange={e => { setPatientQuery(e.target.value); setShowPatientDD(true) }}
                      onFocus={() => setShowPatientDD(true)}
                    />
                    {searchingPat && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
                  </div>
                )}
                {showPatientDD && patientResults.length > 0 && !selectedPatient && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    {patientResults.map(p => (
                      <button key={p.id} className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors"
                        onClick={() => { setSelectedPatient(p); setPatientQuery(''); setShowPatientDD(false) }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Step 2 — Date */}
            <div className={`bg-white border rounded-xl p-4 transition-opacity ${
              selectedPatient ? 'border-slate-200' : 'border-slate-100 opacity-40 pointer-events-none select-none'
            }`}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">2. Data da orientação</p>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={orientacaoDate}
                  onChange={e => setOrientacaoDate(e.target.value)}
                  disabled={!selectedPatient}
                />
              </div>
            </div>

            {/* Step 3 — Template */}
            <div className={`bg-white border rounded-xl p-4 transition-opacity ${
              selectedPatient ? 'border-slate-200' : 'border-slate-100 opacity-40 pointer-events-none select-none'
            }`}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">3. Modelo de orientação</p>
              {templates.length === 0 ? (
                <p className="text-sm text-slate-400 italic">
                  Nenhum modelo criado ainda.{' '}
                  <button className="text-indigo-600 underline" onClick={() => setTab('modelos')}>Criar modelo</button>
                </p>
              ) : (
                <div ref={tplDDRef} className="relative">
                  <button type="button" onClick={() => selectedPatient && setShowTplDD(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 border border-slate-200 rounded-lg text-sm hover:border-indigo-300 transition-colors bg-white">
                    <span className={selectedTpl ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                      {selectedTpl ? selectedTpl.title : 'Selecionar modelo...'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
                  {showTplDD && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                      {templates.map(t => (
                        <button key={t.id} className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                          onClick={() => applyTemplate(t)}>
                          <p className="font-semibold text-slate-700 text-sm">{t.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{(t.secoes ?? []).length} seção(ões)</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sections */}
            {secoes.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Seções da orientação</p>
                  {selectedTpl && (
                    <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                      Modelo: {selectedTpl.title}
                    </span>
                  )}
                </div>

                {/* Banner de revisão da IA */}
                {pendingImprovements && Object.keys(pendingImprovements).length > 0 && (
                  <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
                    <Sparkles className="w-4 h-4 text-violet-500 flex-shrink-0" />
                    <p className="text-sm text-violet-700 flex-1">
                      <span className="font-semibold">{Object.keys(pendingImprovements).length} seção(ões)</span> com sugestão de melhoria. Revise e aprove abaixo.
                    </p>
                    <button onClick={acceptAllImprovements}
                      className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors">
                      Aceitar todas
                    </button>
                    <button onClick={rejectAllImprovements}
                      className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                      Descartar todas
                    </button>
                  </div>
                )}

                {secoes.map((s, i) => (
                  <div key={`${s.id}-${i}`} className={`bg-white rounded-xl p-4 space-y-2 border transition-colors ${
                    pendingImprovements?.[s.id] ? 'border-violet-200 shadow-sm shadow-violet-100' : 'border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 text-sm font-semibold border-none outline-none bg-transparent text-slate-700 placeholder-slate-400"
                        placeholder="Título da seção..."
                        value={s.titulo}
                        onChange={e => updateSectionTitulo(s.id, e.target.value)}
                      />
                      {pendingImprovements?.[s.id] && (
                        <span className="flex items-center gap-1 text-xs text-violet-500 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full font-medium">
                          <Sparkles className="w-3 h-3" /> Sugestão
                        </span>
                      )}
                      <button onClick={() => removeSection(s.id)} className="text-slate-300 hover:text-red-400 transition-colors" title="Remover seção">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="border-t border-slate-100 pt-2">
                      {pendingImprovements?.[s.id] ? (
                        <div className="space-y-3">
                          {/* Comparação lado a lado */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Original</p>
                              <div
                                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 leading-relaxed min-h-[80px] prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: s.valor || '<em class="text-slate-400">Vazio</em>' }}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Sugestão da IA
                              </p>
                              <div
                                className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm text-slate-700 leading-relaxed min-h-[80px] prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: pendingImprovements[s.id] }}
                              />
                            </div>
                          </div>
                          {/* Botões de aprovação */}
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => acceptImprovement(s.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors">
                              <Check className="w-3.5 h-3.5" /> Aceitar sugestão
                            </button>
                            <button onClick={() => rejectImprovement(s.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors">
                              <X className="w-3.5 h-3.5" /> Manter original
                            </button>
                          </div>
                        </div>
                      ) : (
                        <SecaoInput
                          key={`${s.id}-input`}
                          secao={s}
                          valor={s.valor}
                          onChange={updateValor}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add extra section */}
            {(secoes.length > 0 || selectedTpl) && (
              <div className="flex gap-2">
                <span className="text-xs text-slate-500 self-center">Adicionar seção:</span>
                {(Object.keys(TIPO_LABELS) as TipoSecao[]).map(tipo => (
                  <button key={tipo} type="button" onClick={() => addExtraSection(tipo)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <Plus className="w-3 h-3" />
                    {TIPO_LABELS[tipo]}
                  </button>
                ))}
              </div>
            )}

            {/* Actions */}
            {secoes.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap pt-1">
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar
                </button>

                <button onClick={handleImprove} disabled={improving || !!pendingImprovements}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
                  title={pendingImprovements ? 'Resolva as sugestões pendentes primeiro' : undefined}>
                  {improving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Melhorar com IA
                </button>

                {savedId && (
                  <a href={`/api/orientacoes/${savedId}/pdf`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-semibold transition-colors">
                    <FileText className="w-4 h-4" />
                    Gerar PDF
                  </a>
                )}

                <button onClick={resetForm}
                  className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-sm transition-colors">
                  <X className="w-4 h-4" />
                  Limpar
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── HISTÓRICO ─────────────────────────────────────── */}
        {tab === 'historico' && (() => {
          const groups  = groupOrientacoes(orientacoes)
          const filtered = histSearch.trim()
            ? groups.filter(g => g.key !== '__sem__' && g.label.toLowerCase().includes(histSearch.toLowerCase()))
            : groups
          const selectedGroup = groups.find(g => g.key === selectedHistKey) ?? null

          if (loadingHistory) return (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando histórico…
            </div>
          )

          if (orientacoes.length === 0) return (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
              <History className="w-10 h-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">Nenhuma orientação salva ainda</p>
              <p className="text-xs text-slate-400">Crie uma orientação na aba Criar Orientação.</p>
            </div>
          )

          return (
            <div className="flex h-full">

              {/* ── Painel esquerdo: lista de pacientes ── */}
              <div className="w-72 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
                {/* Busca */}
                <div className="p-3 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Buscar paciente…"
                      value={histSearch}
                      onChange={e => setHistSearch(e.target.value)}
                      className="w-full pl-8 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                    />
                    {histSearch && (
                      <button onClick={() => setHistSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
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
                    const active = selectedHistKey === g.key
                    return (
                      <button
                        key={g.key}
                        onClick={() => setSelectedHistKey(g.key)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                          active ? 'bg-indigo-50 border-r-2 border-indigo-500' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                          g.key === '__sem__'
                            ? 'bg-slate-100 text-slate-400'
                            : active ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {g.key === '__sem__' ? '?' : g.label.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${active ? 'text-indigo-700' : 'text-slate-700'}`}>
                            {g.label}
                          </p>
                          <p className="text-xs text-slate-400">
                            {g.count} {g.count === 1 ? 'orientação' : 'orientações'} · {fmtDate(g.lastDate)}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Rodapé */}
                <div className="px-4 py-2.5 border-t border-slate-100">
                  <p className="text-xs text-slate-400">{orientacoes.length} orientações · {groups.length} {groups.length === 1 ? 'paciente' : 'pacientes'}</p>
                </div>
              </div>

              {/* ── Painel direito: orientações do paciente ── */}
              {selectedGroup ? (
                <div className="flex-1 overflow-y-auto p-5">
                  {/* Header do paciente */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-800">{selectedGroup.label}</h2>
                      <p className="text-xs text-slate-400">
                        {selectedGroup.count} {selectedGroup.count === 1 ? 'orientação' : 'orientações'} · última em {fmtDate(selectedGroup.lastDate)}
                      </p>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="relative">
                    {selectedGroup.items.length > 1 && (
                      <div className="absolute left-[18px] top-8 bottom-8 w-px bg-slate-200" />
                    )}
                    <div className="space-y-4">
                      {selectedGroup.items.map((o, i) => (
                        <div key={o.id} className="flex gap-4">
                          {/* Ponto da timeline */}
                          <div className="flex flex-col items-center flex-shrink-0 pt-5">
                            <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center z-10 ${
                              i === 0
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'bg-white border-slate-300 text-slate-400'
                            }`}>
                              <ScrollText className="w-4 h-4" />
                            </div>
                          </div>
                          {/* Card */}
                          <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-800 truncate">{o.title}</p>
                                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                                  <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                    <Calendar className="w-3 h-3" />
                                    {o.orientacaoDate
                                      ? fmtDate(o.orientacaoDate)
                                      : fmtDate(o.createdAt)}
                                  </span>
                                  <span className="text-xs text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                                    {(o.secoes ?? []).length} seção(ões)
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <a href={`/api/orientacoes/${o.id}/pdf`} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                                  <FileText className="w-3.5 h-3.5" />
                                  PDF
                                </a>
                                <button
                                  onClick={() => {
                                    setSecoes(o.secoes ?? [])
                                    if (o.patient) setSelectedPatient(o.patient)
                                    if (o.orientacaoDate) setOrientacaoDate(o.orientacaoDate.split('T')[0])
                                    setSavedId(o.id)
                                    setTab('criar')
                                  }}
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Editar">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setSecoes(o.secoes ?? [])
                                    if (o.patient) setSelectedPatient(o.patient)
                                    setSavedId(null)
                                    setTab('criar')
                                  }}
                                  className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Duplicar">
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => deleteOrientacao(o.id)}
                                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                  Selecione um paciente à esquerda.
                </div>
              )}
            </div>
          )
        })()}

        {/* ─── MODELOS ───────────────────────────────────────── */}
        {tab === 'modelos' && (
          <div className="max-w-2xl mx-auto space-y-6">

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4">
                {editingTpl ? `Editando: ${editingTpl.title}` : 'Novo modelo'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nome do modelo</label>
                  <input
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="Ex: Orientação de primeira consulta..."
                    value={tplTitle}
                    onChange={e => setTplTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    Seções{' '}
                    <span className="text-slate-400 font-normal normal-case">— use variáveis como #nome, #nome_completo, #data no conteúdo</span>
                  </label>
                  <TemplateBuilder secoes={tplSecoes} onChange={setTplSecoes} />
                </div>
                <div className="flex gap-3">
                  <button onClick={saveTpl} disabled={tplSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60">
                    {tplSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {editingTpl ? 'Atualizar modelo' : 'Salvar modelo'}
                  </button>
                  {editingTpl && (
                    <button onClick={() => { setEditingTpl(null); setTplTitle(''); setTplSecoes([]) }}
                      className="px-4 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-sm transition-colors">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {templates.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <BookTemplate className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum modelo criado ainda.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Modelos salvos</p>
                {templates.map(t => (
                  <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{t.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {(t.secoes ?? []).length} seção(ões) &middot; {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(t.secoes ?? []).slice(0, 4).map(s => (
                          <span key={s.id} className="px-1.5 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">
                            {s.titulo || 'Sem título'}
                          </span>
                        ))}
                        {(t.secoes ?? []).length > 4 && (
                          <span className="px-1.5 py-0.5 text-xs bg-slate-100 text-slate-400 rounded">
                            +{(t.secoes ?? []).length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => { applyTemplate(t); setTab('criar') }}
                        className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-medium transition-colors">
                        Usar
                      </button>
                      <button onClick={() => startEditTpl(t)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Editar">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteTpl(t.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
