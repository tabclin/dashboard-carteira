'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/ckex/card'
import { Button } from '@/components/ui/ckex/button'
import { Badge } from '@/components/ui/ckex/badge'
import { ResultRow } from './result-row'
import { cn } from '@/lib/utils'
import {
  CheckCircle2, Loader2, Plus, FlaskConical,
  AlertTriangle, Link2, X, Search, BookPlus
} from 'lucide-react'
import type { Result, $Enums } from '@prisma/client'
type AnalysisStatus = $Enums.AnalysisStatus
import type { MatchedRef } from '@/lib/exam/normalize'

interface CatalogEntry {
  id: string
  displayName: string
  slug: string
  category: string | null
  unit: string | null
  refMinMale: number | null
  refMaxMale: number | null
  refMinFemale: number | null
  refMaxFemale: number | null
}

function catalogRefFields(entry: CatalogEntry) {
  const refMin = entry.refMinMale ?? entry.refMinFemale ?? null
  const refMax = entry.refMaxMale ?? entry.refMaxFemale ?? null
  const hasBoth = entry.refMinMale != null && entry.refMinFemale != null
    && (entry.refMinMale !== entry.refMinFemale || entry.refMaxMale !== entry.refMaxFemale)
  const refText = hasBoth
    ? `M: ${entry.refMinMale}–${entry.refMaxMale} | F: ${entry.refMinFemale}–${entry.refMaxFemale}`
    : refMin != null && refMax != null ? `${refMin} – ${refMax}` : null
  return { refMin, refMax, refText }
}

interface CatalogRefs {
  refMinMale: number | null
  refMaxMale: number | null
  refMinFemale: number | null
  refMaxFemale: number | null
  unit: string | null
}

type ResultWithCatalog = Result & { catalog: CatalogRefs | null; matchedRef?: MatchedRef | null }

interface ResultsTableProps {
  analysisId: string
  results: ResultWithCatalog[]
  analysisStatus: AnalysisStatus
  patientSex?: string | null
}

export function ResultsTable({ analysisId, results: initialResults, analysisStatus, patientSex }: ResultsTableProps) {
  const router = useRouter()
  const [results, setResults] = useState(initialResults)
  const [finalizing, setFinalizing] = useState(false)
  type ActiveFilter = null | 'unlinked' | 'duplicates' | number
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null)

  // ── Add exam modal ──────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false)
  const [addCatQuery, setAddCatQuery] = useState('')
  const [addCatResults, setAddCatResults] = useState<CatalogEntry[]>([])
  const [addCatLoading, setAddCatLoading] = useState(false)
  const [addCatSearched, setAddCatSearched] = useState(false)
  const [addAdding, setAddAdding] = useState(false)

  // Quick register inside add modal
  const [showQR, setShowQR] = useState(false)
  const [qrForm, setQrForm] = useState({
    displayName: '', category: '', unit: '',
    refMinMale: '', refMaxMale: '', refMinFemale: '', refMaxFemale: '',
  })
  const [qrSaving, setQrSaving] = useState(false)

  const isFinalized = analysisStatus === 'FINALIZED'

  function handleFilterByGroup(group: number) {
    setActiveFilter((prev) => prev === group ? null : group)
  }

  // Debounced catalog search for the add modal
  useEffect(() => {
    if (!addCatQuery.trim()) { setAddCatResults([]); setAddCatSearched(false); return }
    setAddCatLoading(true)
    setAddCatSearched(false)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ckex/catalog?q=${encodeURIComponent(addCatQuery)}`)
        setAddCatResults(await res.json())
        setAddCatSearched(true)
      } finally {
        setAddCatLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [addCatQuery])

  function openAddModal() {
    setAddCatQuery('')
    setAddCatResults([])
    setAddCatSearched(false)
    setShowQR(false)
    setQrForm({ displayName: '', category: '', unit: '', refMinMale: '', refMaxMale: '', refMinFemale: '', refMaxFemale: '' })
    setShowAddModal(true)
  }

  async function handleAddFromCatalog(entry: CatalogEntry) {
    setAddAdding(true)
    try {
      const { refMin, refMax, refText } = catalogRefFields(entry)
      const res = await fetch(`/api/ckex/analyses/${analysisId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examName: entry.displayName,
          examSlug: entry.slug,
          catalogId: entry.id,
          category: entry.category ?? 'Outros',
          unit: entry.unit ?? undefined,
          refMin: refMin ?? undefined,
          refMax: refMax ?? undefined,
          refText: refText ?? undefined,
          sortOrder: results.length,
        }),
      })
      if (!res.ok) throw new Error()
      const newResult = await res.json()
      setResults((prev) => [...prev, newResult])
      setShowAddModal(false)
      toast.success(`${entry.displayName} adicionado!`)
    } catch {
      toast.error('Erro ao adicionar exame')
    } finally {
      setAddAdding(false)
    }
  }

  async function handleQuickRegisterAndAdd() {
    if (!qrForm.displayName.trim()) { toast.error('Nome obrigatório'); return }
    setQrSaving(true)
    try {
      const refMinMale   = qrForm.refMinMale   !== '' ? parseFloat(qrForm.refMinMale)   : null
      const refMaxMale   = qrForm.refMaxMale   !== '' ? parseFloat(qrForm.refMaxMale)   : null
      const refMinFemale = qrForm.refMinFemale !== '' ? parseFloat(qrForm.refMinFemale) : null
      const refMaxFemale = qrForm.refMaxFemale !== '' ? parseFloat(qrForm.refMaxFemale) : null
      const catRes = await fetch('/api/ckex/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: qrForm.displayName.trim(),
          category: qrForm.category.trim() || undefined,
          unit: qrForm.unit.trim() || undefined,
          aliases: [],
          refMinMale, refMaxMale, refMinFemale, refMaxFemale,
        }),
      })
      if (!catRes.ok) throw new Error()
      const created: CatalogEntry = await catRes.json()
      await handleAddFromCatalog(created)
    } catch {
      toast.error('Erro ao cadastrar exame')
      setQrSaving(false)
    }
  }

  // Atualiza resultado localmente + persiste na API
  const handleUpdate = useCallback(async (
    resultId: string,
    field: string,
    value: string | number | null
  ) => {
    // Otimistic update
    setResults((prev) =>
      prev.map((r) => r.id === resultId ? { ...r, [field]: value } : r)
    )

    try {
      const res = await fetch(`/api/ckex/results/${resultId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('Erro ao salvar. Recarregue a página.')
      // Reverte
      setResults(initialResults)
    }
  }, [initialResults])

  // Vincular resultado ao catálogo
  const handleLink = useCallback(async (
    resultId: string,
    entry: { id: string; displayName: string; slug: string }
  ) => {
    setResults((prev) =>
      prev.map((r) => r.id === resultId
        ? { ...r, catalogId: entry.id, examName: entry.displayName, examSlug: entry.slug }
        : r
      )
    )
    try {
      const res = await fetch(`/api/ckex/results/${resultId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogId: entry.id, examName: entry.displayName }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('Erro ao vincular ao catálogo')
      setResults(initialResults)
    }
  }, [initialResults])

  // Remover resultado
  const handleDelete = useCallback(async (resultId: string) => {
    setResults((prev) => prev.filter((r) => r.id !== resultId))
    try {
      await fetch(`/api/ckex/results/${resultId}`, { method: 'DELETE' })
    } catch {
      toast.error('Erro ao remover')
      setResults(initialResults)
    }
  }, [initialResults])

  // Finalizar análise
  async function handleFinalize() {
    if (unlinked > 0) {
      toast.warning(`${unlinked} exame(s) não vinculado(s) ao catálogo. Vincule todos antes de finalizar.`)
      return
    }
    if (hasDuplicates) {
      toast.warning(`Existem exames duplicados na análise. Remova os repetidos antes de finalizar.`)
      return
    }
    if (unclassified > 0) {
      toast.warning(`${unclassified} exame(s) ainda sem classificação. Classifique todos antes de finalizar.`)
      return
    }

    setFinalizing(true)
    try {
      const res = await fetch(`/api/ckex/analyses/${analysisId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FINALIZED' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Análise finalizada!')
      router.refresh()
    } catch {
      toast.error('Erro ao finalizar')
    } finally {
      setFinalizing(false)
    }
  }

  const totalDanger = results.filter((r) => r.status === 'DANGER').length
  const totalAttention = results.filter((r) => r.status === 'ATTENTION').length
  const totalNormal = results.filter((r) => r.status === 'NORMAL').length
  const unclassified = results.filter((r) => r.status === 'NOT_EVALUATED').length
  const unlinked = results.filter((r) => !r.catalogId).length
  const linkedToCatalog = results.length - unlinked

  // Detecta duplicatas: agrupa por catalogId (se vinculado) ou examSlug (fallback)
  const keyToIds = new Map<string, string[]>()
  for (const r of results) {
    const key = r.catalogId ?? r.examSlug
    if (!keyToIds.has(key)) keyToIds.set(key, [])
    keyToIds.get(key)!.push(r.id)
  }
  const duplicateIds = new Set<string>()
  // Atribui número sequencial a cada grupo de duplicatas (1, 2, 3…)
  const dupGroupByResultId = new Map<string, number>()
  let dupGroupCounter = 1
  for (const ids of Array.from(keyToIds.values())) {
    if (ids.length > 1) {
      ids.forEach((id) => {
        duplicateIds.add(id)
        dupGroupByResultId.set(id, dupGroupCounter)
      })
      dupGroupCounter++
    }
  }

  // Resultados visíveis (aplica filtro ativo) — DEVE ficar após dupGroupByResultId
  const visibleResults =
    typeof activeFilter === 'number'
      ? results.filter((r) => dupGroupByResultId.get(r.id) === activeFilter)
      : activeFilter === 'unlinked'
      ? results.filter((r) => !r.catalogId)
      : activeFilter === 'duplicates'
      ? results.filter((r) => duplicateIds.has(r.id))
      : results

  const visibleCategories = visibleResults.reduce<Record<string, ResultWithCatalog[]>>((acc, r) => {
    const cat = r.category ?? 'Outros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(r)
    return acc
  }, {})
  const hasDuplicates = duplicateIds.size > 0
  const duplicateGroupCount = dupGroupCounter - 1

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <div className="rounded-full bg-muted p-4">
          <FlaskConical className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="font-medium">Nenhum exame nesta análise</p>
        <Button size="sm" onClick={openAddModal}>
          <Plus className="h-4 w-4" /> Adicionar exame
        </Button>
      </div>
    )
  }

  const classified = totalDanger + totalAttention + totalNormal
  const total = results.length

  return (
    <div className="space-y-4">
      {/* Barra de progresso — sempre atualizada com o estado do cliente */}
      <div className="border rounded-xl bg-card px-5 py-3 space-y-2">
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <span className="text-muted-foreground">
            <strong className="text-foreground">{classified}</strong>/{total} classificados
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Link2 className="h-3.5 w-3.5" />
            <strong className={linkedToCatalog < total ? 'text-amber-600' : 'text-green-600'}>
              {linkedToCatalog}
            </strong>/{total} no catálogo
          </span>
          {totalDanger > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <strong className="text-red-600">{totalDanger}</strong>
              <span className="text-muted-foreground">perigo</span>
            </span>
          )}
          {totalAttention > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-yellow-500" />
              <strong className="text-yellow-600">{totalAttention}</strong>
              <span className="text-muted-foreground">atenção</span>
            </span>
          )}
          {totalNormal > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <strong className="text-green-600">{totalNormal}</strong>
              <span className="text-muted-foreground">normal</span>
            </span>
          )}
          <div className="ml-auto flex gap-2">
            {!isFinalized && (
              <>
                <Button variant="outline" size="sm" onClick={openAddModal}>
                  <Plus className="h-4 w-4" /> Exame
                </Button>
                <Button
                  size="sm"
                  onClick={handleFinalize}
                  disabled={finalizing}
                  className={cn(
                    'text-white',
                    unclassified === 0 ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                  )}
                >
                  {finalizing
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Finalizando...</>
                    : <><CheckCircle2 className="h-4 w-4" /> Finalizar análise</>
                  }
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: total > 0 ? `${(classified / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Banner de filtro ativo */}
      {typeof activeFilter === 'number' && (
        <div className="flex items-center gap-3 text-sm bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-2.5">
          <span className="h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
            {activeFilter}
          </span>
          <span>
            Filtrando duplicatas do grupo <strong>{activeFilter}</strong> — {visibleResults.length} exame(s)
          </span>
          <button
            onClick={() => setActiveFilter(null)}
            className="ml-auto flex items-center gap-1 font-medium hover:text-red-900 transition-colors"
          >
            <X className="h-3.5 w-3.5" /> Limpar filtro
          </button>
        </div>
      )}
      {activeFilter === 'duplicates' && (
        <div className="flex items-center gap-3 text-sm bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>Exibindo apenas <strong>{visibleResults.length} exame(s) duplicado(s)</strong></span>
          <button
            onClick={() => setActiveFilter(null)}
            className="ml-auto flex items-center gap-1 font-medium hover:text-red-900 transition-colors"
          >
            <X className="h-3.5 w-3.5" /> Limpar filtro
          </button>
        </div>
      )}
      {activeFilter === 'unlinked' && (
        <div className="flex items-center gap-3 text-sm bg-amber-50 border border-amber-300 text-amber-700 rounded-lg px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>Exibindo apenas <strong>{visibleResults.length} exame(s) não vinculado(s)</strong></span>
          <button
            onClick={() => setActiveFilter(null)}
            className="ml-auto flex items-center gap-1 font-medium hover:text-amber-900 transition-colors"
          >
            <X className="h-3.5 w-3.5" /> Limpar filtro
          </button>
        </div>
      )}

      {/* Avisos de bloqueio */}
      {isFinalized && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Análise finalizada. Para editar, reabra a análise nas configurações.
        </div>
      )}
      {!isFinalized && hasDuplicates && activeFilter === null && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>{duplicateGroupCount} exame(s) duplicado(s)</strong> na análise (destacados em vermelho). Remova os repetidos antes de finalizar.
          </span>
          {activeFilter !== 'duplicates' && (
            <button
              onClick={() => setActiveFilter('duplicates')}
              className="ml-auto flex-shrink-0 cursor-pointer text-xs font-medium underline underline-offset-2 hover:text-red-900 transition-colors"
            >
              Ver duplicados
            </button>
          )}
        </div>
      )}
      {!isFinalized && unlinked > 0 && activeFilter === null && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>{unlinked} exame(s)</strong> não vinculado(s) ao catálogo. Clique no ícone âmbar para vincular antes de finalizar.
          </span>
          {activeFilter !== 'unlinked' && (
            <button
              onClick={() => setActiveFilter('unlinked')}
              className="ml-auto flex-shrink-0 cursor-pointer text-xs font-medium underline underline-offset-2 hover:text-amber-900 transition-colors"
            >
              Ver não vinculados
            </button>
          )}
        </div>
      )}
      {!isFinalized && unclassified > 0 && activeFilter === null && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Clique no status de cada exame para classificar. Você precisa classificar todos para finalizar.
        </div>
      )}

      {/* Tabela por categoria */}
      {Object.entries(visibleCategories).map(([category, catResults]) => (
        <Card key={category} className="overflow-hidden">
          {/* Header da categoria */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b">
            <span className="text-sm font-semibold">{category}</span>
            <div className="flex gap-1">
              {catResults.filter(r => r.status === 'DANGER').length > 0 && (
                <Badge variant="danger">{catResults.filter(r => r.status === 'DANGER').length} perigo</Badge>
              )}
              {catResults.filter(r => r.status === 'ATTENTION').length > 0 && (
                <Badge variant="attention">{catResults.filter(r => r.status === 'ATTENTION').length} atenção</Badge>
              )}
            </div>
          </div>

          {/* Cabeçalho da tabela */}
          <div className="grid grid-cols-[2fr_100px_70px_130px_140px_40px] gap-2 px-4 py-2 border-b bg-muted/20 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span>Exame</span>
            <span className="text-center">Valor</span>
            <span className="text-center">Un.</span>
            <span className="text-center">Referência</span>
            <span className="text-center">Status</span>
            <span />
          </div>

          {/* Linhas */}
          <div className="divide-y">
            {catResults.map((result) => (
              <ResultRow
                key={result.id}
                result={result}
                patientSex={patientSex}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onLink={handleLink}
                isDuplicate={duplicateIds.has(result.id)}
                dupGroup={dupGroupByResultId.get(result.id)}
                onFilterByGroup={handleFilterByGroup}
                readOnly={isFinalized}
              />
            ))}
          </div>
        </Card>
      ))}

      {/* ── Modal: Adicionar exame do catálogo ── */}
      {showAddModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40"
            onClick={() => !addAdding && !qrSaving && setShowAddModal(false)}
          />
          <div
            className="fixed z-50 bg-white border rounded-xl shadow-xl w-[480px]"
            style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h4 className="font-semibold">Adicionar exame</h4>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground"
                disabled={addAdding || qrSaving}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!showQR ? (
              <>
                {/* Busca de catálogo */}
                <div className="px-4 py-3 border-b flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <input
                    autoFocus
                    value={addCatQuery}
                    onChange={(e) => setAddCatQuery(e.target.value)}
                    placeholder="Buscar exame no catálogo..."
                    className="flex-1 text-sm bg-transparent focus:outline-none"
                  />
                  {addCatLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>

                <div className="max-h-64 overflow-y-auto py-1">
                  {addCatResults.length === 0 ? (
                    <div className="px-5 py-4 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {addCatSearched ? 'Nenhum resultado encontrado.' : 'Digite para buscar no catálogo.'}
                      </p>
                      {addCatSearched && (
                        <button
                          onClick={() => {
                            setQrForm((f) => ({ ...f, displayName: addCatQuery }))
                            setShowQR(true)
                          }}
                          className="flex items-center gap-2 text-sm text-red-600 underline font-medium hover:text-red-700"
                        >
                          <BookPlus className="h-4 w-4" />
                          Cadastrar &quot;{addCatQuery}&quot; no catálogo
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {addCatResults.map((entry) => (
                        <button
                          key={entry.id}
                          onClick={() => handleAddFromCatalog(entry)}
                          disabled={addAdding}
                          className="w-full text-left px-5 py-2.5 hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                          <p className="text-sm font-medium">{entry.displayName}</p>
                          {(entry.category || entry.unit) && (
                            <p className="text-xs text-muted-foreground">
                              {[entry.category, entry.unit].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </button>
                      ))}
                      <div className="border-t mt-1 px-5 py-2.5">
                        <button
                          onClick={() => {
                            setQrForm((f) => ({ ...f, displayName: addCatQuery }))
                            setShowQR(true)
                          }}
                          className="flex items-center gap-2 text-sm text-red-600 underline font-medium hover:text-red-700"
                        >
                          <BookPlus className="h-4 w-4" />
                          Não encontrou? Cadastrar novo exame
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="px-5 py-3 border-t flex justify-end">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1.5 text-sm border rounded-md hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              /* Quick register form */
              <div className="p-5 space-y-3">
                <button
                  onClick={() => setShowQR(false)}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  ← Voltar à busca
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome padrão *</label>
                    <input
                      value={qrForm.displayName}
                      onChange={(e) => setQrForm((f) => ({ ...f, displayName: e.target.value }))}
                      className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Categoria</label>
                    <input
                      value={qrForm.category}
                      onChange={(e) => setQrForm((f) => ({ ...f, category: e.target.value }))}
                      placeholder="Ex: Hemograma"
                      className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Unidade</label>
                    <input
                      value={qrForm.unit}
                      onChange={(e) => setQrForm((f) => ({ ...f, unit: e.target.value }))}
                      placeholder="Ex: g/dL"
                      className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ref. masculino (mín – máx)</label>
                    <div className="flex gap-1.5">
                      <input type="number" placeholder="Mín" value={qrForm.refMinMale}
                        onChange={(e) => setQrForm((f) => ({ ...f, refMinMale: e.target.value }))}
                        className="w-full text-sm border rounded-md px-2 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                      <input type="number" placeholder="Máx" value={qrForm.refMaxMale}
                        onChange={(e) => setQrForm((f) => ({ ...f, refMaxMale: e.target.value }))}
                        className="w-full text-sm border rounded-md px-2 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ref. feminino (mín – máx)</label>
                    <div className="flex gap-1.5">
                      <input type="number" placeholder="Mín" value={qrForm.refMinFemale}
                        onChange={(e) => setQrForm((f) => ({ ...f, refMinFemale: e.target.value }))}
                        className="w-full text-sm border rounded-md px-2 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                      <input type="number" placeholder="Máx" value={qrForm.refMaxFemale}
                        onChange={(e) => setQrForm((f) => ({ ...f, refMaxFemale: e.target.value }))}
                        className="w-full text-sm border rounded-md px-2 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1.5 text-sm border rounded-md hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleQuickRegisterAndAdd}
                    disabled={qrSaving}
                    className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {qrSaving ? 'Salvando...' : 'Cadastrar e adicionar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
