'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Trash2, ChevronDown, MessageSquare, Link2, Unlink2, Search, BookPlus, X, ListFilter } from 'lucide-react'
import { toast } from 'sonner'
import type { Result, $Enums } from '@prisma/client'
type ResultStatus = $Enums.ResultStatus
import type { MatchedRef } from '@/lib/exam/normalize'

interface CatalogEntry {
  id: string
  displayName: string
  slug: string
  category: string | null
  unit: string | null
  aliases?: string[]
}

interface CatalogRefs {
  refMinMale: number | null
  refMaxMale: number | null
  refMinFemale: number | null
  refMaxFemale: number | null
  unit: string | null
}

type ResultWithCatalog = Result & { catalog: CatalogRefs | null; matchedRef?: MatchedRef | null }

function matchedRefText(ref: MatchedRef): string {
  const { refMin, refMax, unit } = ref
  const u = unit ? ` ${unit}` : ''
  if (refMin != null && refMax != null) return `${refMin} a ${refMax}${u}`
  if (refMin != null) return `≥ ${refMin}${u}`
  if (refMax != null) return `≤ ${refMax}${u}`
  return '—'
}

function normalizeSex(sex: string | null | undefined): 'M' | 'F' | null {
  if (!sex) return null
  const s = sex.trim().toLowerCase()
  if (s === 'm' || s === 'masculino' || s === 'male') return 'M'
  if (s === 'f' || s === 'feminino' || s === 'female') return 'F'
  return null
}

function catalogRefLabel(cat: CatalogRefs, patientSex?: string | null): string | null {
  const hasMale   = cat.refMinMale   != null || cat.refMaxMale   != null
  const hasFemale = cat.refMinFemale != null || cat.refMaxFemale != null
  const diffRefs  = cat.refMinMale !== cat.refMinFemale || cat.refMaxMale !== cat.refMaxFemale
  if (!hasMale || !hasFemale || !diffRefs) return null
  return normalizeSex(patientSex) === 'F' ? 'Ref. Fem.' : 'Ref. Masc.'
}

function catalogRefText(cat: CatalogRefs, patientSex?: string | null): string | null {
  const sex = normalizeSex(patientSex)
  let min: number | null
  let max: number | null

  if (sex === 'F') {
    min = cat.refMinFemale ?? cat.refMinMale ?? null
    max = cat.refMaxFemale ?? cat.refMaxMale ?? null
  } else {
    min = cat.refMinMale ?? cat.refMinFemale ?? null
    max = cat.refMaxMale ?? cat.refMaxFemale ?? null
  }

  const u = cat.unit ? ` ${cat.unit}` : ''
  if (min != null && max != null) return `${min} a ${max}${u}`
  if (min != null) return `≥ ${min}${u}`
  if (max != null) return `≤ ${max}${u}`
  return null
}

const STATUS_OPTIONS: { value: ResultStatus; label: string; dot: string; bg: string; text: string }[] = [
  { value: 'NOT_EVALUATED', label: 'Não avaliado', dot: 'bg-slate-400', bg: 'bg-slate-100', text: 'text-slate-600' },
  { value: 'NORMAL',        label: 'Normal',       dot: 'bg-green-500', bg: 'bg-green-50',  text: 'text-green-700' },
  { value: 'ATTENTION',     label: 'Atenção',      dot: 'bg-yellow-500',bg: 'bg-yellow-50', text: 'text-yellow-700' },
  { value: 'DANGER',        label: 'Perigo',       dot: 'bg-red-500',   bg: 'bg-red-50',    text: 'text-red-700' },
]

interface ResultRowProps {
  result: ResultWithCatalog
  patientSex?: string | null
  onUpdate: (id: string, field: string, value: string | number | null) => void
  onDelete: (id: string) => void
  onLink?: (id: string, entry: { id: string; displayName: string; slug: string }) => void
  isDuplicate?: boolean
  dupGroup?: number
  onFilterByGroup?: (group: number) => void
  readOnly?: boolean
}

function InlineEdit({
  value,
  onSave,
  className,
  placeholder,
  readOnly,
}: {
  value: string
  onSave: (v: string) => void
  className?: string
  placeholder?: string
  readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    if (readOnly) return
    setLocal(value)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commit() {
    setEditing(false)
    if (local !== value) onSave(local)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className={cn('w-full bg-accent border border-primary rounded px-1.5 py-0.5 text-sm focus:outline-none', className)}
        autoFocus
      />
    )
  }

  return (
    <span
      onClick={startEdit}
      className={cn(
        'block px-1.5 py-0.5 rounded text-sm truncate',
        !readOnly && 'cursor-pointer hover:bg-slate-100 transition-colors',
        !value && 'text-muted-foreground',
        className
      )}
    >
      {value || placeholder || '—'}
    </span>
  )
}

export function ResultRow({ result, patientSex, onUpdate, onDelete, onLink, isDuplicate = false, dupGroup, onFilterByGroup, readOnly = false }: ResultRowProps) {
  // Cast para acessar campos adicionados via migração (cache do TS pode estar desatualizado)
  const r = result as typeof result & { extractedName?: string | null }
  const [showNote, setShowNote] = useState(!!result.professionalNote)
  const [statusOpen, setStatusOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)

  // ── Catalog search state ──────────────────────────────────────
  const [showCatalogSearch, setShowCatalogSearch] = useState(false)
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogResults, setCatalogResults] = useState<CatalogEntry[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogSearched, setCatalogSearched] = useState(false)
  const [linkedAliases, setLinkedAliases] = useState<string[]>([])
  const catalogPos = useRef({ top: 0, left: 0 })

  // ── Confirmation modal state ──────────────────────────────────
  const [pendingLink, setPendingLink] = useState<CatalogEntry | null>(null)

  // ── Quick register modal state ────────────────────────────────
  const [showQuickRegister, setShowQuickRegister] = useState(false)
  const [qrForm, setQrForm] = useState({
    displayName: '',
    category: '',
    unit: '',
    refMinMale: '',
    refMaxMale: '',
    refMinFemale: '',
    refMaxFemale: '',
  })
  const [qrSaving, setQrSaving] = useState(false)

  // Close catalog search on outside click
  useEffect(() => {
    if (!showCatalogSearch) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      // Don't close if clicking inside any fixed overlay (confirmation modal etc)
      if ((e.target as HTMLElement).closest?.('[data-modal]')) return
      const dropdown = document.getElementById(`catalog-dropdown-${result.id}`)
      if (dropdown && !dropdown.contains(target)) setShowCatalogSearch(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showCatalogSearch, result.id])

  // Debounced catalog search
  useEffect(() => {
    if (!catalogQuery.trim()) { setCatalogResults([]); setCatalogSearched(false); return }
    setCatalogLoading(true)
    setCatalogSearched(false)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ckex/catalog?q=${encodeURIComponent(catalogQuery)}`)
        setCatalogResults(await res.json())
        setCatalogSearched(true)
      } finally {
        setCatalogLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [catalogQuery])

  async function openCatalogSearch(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    catalogPos.current = { top: rect.bottom + 4, left: rect.left }
    setCatalogQuery(result.examName)
    setShowCatalogSearch(true)
    // Busca os aliases do catálogo atualmente vinculado para exibir no dropdown
    if (result.catalogId) {
      try {
        const res = await fetch(`/api/ckex/catalog/${result.catalogId}`)
        if (res.ok) {
          const data = await res.json()
          setLinkedAliases(data.aliases ?? [])
        }
      } catch { /* silencioso */ }
    } else {
      setLinkedAliases([])
    }
  }

  function handleSelectEntry(entry: CatalogEntry) {
    // Show confirmation modal instead of linking immediately
    setPendingLink(entry)
    setShowCatalogSearch(false)
  }

  function confirmLink() {
    if (!pendingLink) return
    onLink?.(result.id, pendingLink)
    setPendingLink(null)
    setCatalogQuery('')
  }

  function openQuickRegister() {
    const refMin = result.refMin != null ? String(result.refMin) : ''
    const refMax = result.refMax != null ? String(result.refMax) : ''
    setQrForm({
      displayName: r.extractedName || result.examName,
      category: result.category ?? '',
      unit: result.unit ?? '',
      refMinMale: refMin,
      refMaxMale: refMax,
      refMinFemale: refMin,
      refMaxFemale: refMax,
    })
    setShowCatalogSearch(false)
    setShowQuickRegister(true)
  }

  async function handleQuickRegister() {
    if (!qrForm.displayName.trim()) { toast.error('Nome obrigatório'); return }
    setQrSaving(true)
    try {
      const payload = {
        displayName: qrForm.displayName.trim(),
        category: qrForm.category.trim() || undefined,
        unit: qrForm.unit.trim() || undefined,
        aliases: [],
        refMinMale: qrForm.refMinMale !== '' ? parseFloat(qrForm.refMinMale) : null,
        refMaxMale: qrForm.refMaxMale !== '' ? parseFloat(qrForm.refMaxMale) : null,
        refMinFemale: qrForm.refMinFemale !== '' ? parseFloat(qrForm.refMinFemale) : null,
        refMaxFemale: qrForm.refMaxFemale !== '' ? parseFloat(qrForm.refMaxFemale) : null,
      }
      const res = await fetch('/api/ckex/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      const created: CatalogEntry = await res.json()
      toast.success('Exame cadastrado e vinculado!')
      onLink?.(result.id, created)
      setShowQuickRegister(false)
    } catch {
      toast.error('Erro ao cadastrar exame')
    } finally {
      setQrSaving(false)
    }
  }

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === result.status) ?? STATUS_OPTIONS[0]

  useEffect(() => {
    if (statusOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      })
    }
  }, [statusOpen])

  const rowBg = isDuplicate
    ? 'bg-red-50/60'
    : {
        NOT_EVALUATED: '',
        NORMAL: '',
        ATTENTION: 'bg-yellow-50/40',
        DANGER: 'bg-red-50/50',
      }[result.status]

  return (
    <div className={cn('group', rowBg, isDuplicate && 'border-l-2 border-red-400')}>
      <div className="grid grid-cols-[2fr_100px_70px_130px_140px_40px] gap-2 px-4 py-2.5 items-center">

        {/* Nome do exame */}
        <div className="min-w-0 flex items-center gap-1">
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            {/* Bolinha de grupo de duplicata — clicável para filtrar */}
            {dupGroup !== undefined && (
              <button
                onClick={() => onFilterByGroup?.(dupGroup)}
                title="Clique para filtrar e ver apenas este grupo de duplicatas"
                className="flex-shrink-0 mt-0.5 flex items-center gap-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 hover:bg-red-600 transition-colors cursor-pointer leading-none"
              >
                <ListFilter className="h-2.5 w-2.5" />
                {dupGroup}
              </button>
            )}
            <div className="flex-1 min-w-0">
              <InlineEdit
                value={result.examName}
                onSave={(v) => onUpdate(result.id, 'examName', v)}
                readOnly={readOnly}
                placeholder="Nome do exame"
                className="font-medium"
              />
              {isDuplicate && (
                <span className="ml-1.5 text-xs font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                  Duplicado — remova um
                </span>
              )}
              {r.extractedName && (
                <span className="block pl-1.5 text-[10px] leading-tight text-muted-foreground/70">
                  Extraído: {r.extractedName}
                </span>
              )}
            </div>
          </div>
          {!readOnly && (
            <div className="flex-shrink-0 relative">
              {result.catalogId ? (
                <button
                  onClick={openCatalogSearch}
                  title={`Vinculado: ${result.examName}. Clique para ver aliases ou re-vincular.`}
                  className="p-1 rounded text-green-500 hover:text-green-600 hover:bg-green-50 transition-colors"
                >
                  <Link2 className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={openCatalogSearch}
                  title="Não identificado no catálogo. Clique para vincular."
                  className="p-1 rounded text-amber-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                >
                  <Unlink2 className="h-3.5 w-3.5" />
                </button>
              )}

              {/* ── Catalog search dropdown ── */}
              {showCatalogSearch && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCatalogSearch(false)} />
                  <div
                    id={`catalog-dropdown-${result.id}`}
                    className="fixed z-50 bg-white border rounded-lg shadow-xl w-96"
                    style={{ top: catalogPos.current.top, left: catalogPos.current.left }}
                  >
                    <div className="px-3 py-2.5 border-b flex items-center gap-2">
                      <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <input
                        autoFocus
                        value={catalogQuery}
                        onChange={(e) => setCatalogQuery(e.target.value)}
                        placeholder="Buscar no catálogo..."
                        className="flex-1 text-sm bg-transparent focus:outline-none"
                      />
                    </div>
                    {result.catalogId && linkedAliases.length > 0 && (
                      <div className="px-3 py-1.5 bg-muted/40 border-b">
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          <span className="font-semibold">Aliases cadastrados:</span>{' '}
                          {linkedAliases.join(' · ')}
                        </p>
                      </div>
                    )}
                    <div className="max-h-60 overflow-y-auto py-1">
                      {catalogLoading ? (
                        <p className="text-xs text-muted-foreground px-4 py-3">Buscando...</p>
                      ) : catalogResults.length === 0 ? (
                        <div className="px-4 py-3 space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {catalogSearched ? 'Nenhum resultado encontrado.' : 'Digite para buscar.'}
                          </p>
                          {catalogSearched && (
                            <button
                              onClick={openQuickRegister}
                              className="flex items-center gap-2 text-xs text-red-600 underline font-medium hover:text-red-700"
                            >
                              <BookPlus className="h-3.5 w-3.5" />
                              Cadastrar &quot;{catalogQuery}&quot; no catálogo
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          {catalogResults.map((entry) => (
                            <button
                              key={entry.id}
                              onClick={() => handleSelectEntry(entry)}
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                            >
                              <p className="text-sm font-medium">{entry.displayName}</p>
                              {(entry.category || entry.unit) && (
                                <p className="text-xs text-muted-foreground">
                                  {[entry.category, entry.unit].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </button>
                          ))}
                          <div className="border-t mt-1 px-4 py-2">
                            <button
                              onClick={openQuickRegister}
                              className="flex items-center gap-2 text-xs text-red-600 underline font-medium hover:text-red-700"
                            >
                              <BookPlus className="h-3.5 w-3.5" />
                              Não encontrou? Cadastrar novo exame
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Valor */}
        <div className="text-center">
          <InlineEdit
            value={result.value ?? ''}
            onSave={(v) => {
              onUpdate(result.id, 'value', v)
              const num = parseFloat(v.replace(',', '.'))
              onUpdate(result.id, 'valueNumeric', isNaN(num) ? null : num)
            }}
            readOnly={readOnly}
            placeholder="—"
            className="text-center font-mono"
          />
        </div>

        {/* Unidade */}
        <div className="text-center">
          <InlineEdit
            value={result.unit ?? ''}
            onSave={(v) => onUpdate(result.id, 'unit', v)}
            readOnly={readOnly}
            placeholder="—"
            className="text-center text-xs text-muted-foreground"
          />
        </div>

        {/* Referência */}
        <div className="text-center">
          {result.matchedRef
            ? (
              // Nova fonte: exam_reference (por unidade + sexo)
              <span className="text-sm text-muted-foreground">
                {matchedRefText(result.matchedRef)}
              </span>
            )
            : result.catalogId && result.catalog
            ? (
              // Fallback: exam_catalog legado (análises existentes antes da migração)
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-sm text-muted-foreground">
                  {catalogRefText(result.catalog, patientSex) ?? '—'}
                </span>
                {catalogRefLabel(result.catalog, patientSex) && (
                  <span className="text-[10px] text-muted-foreground/60">
                    {catalogRefLabel(result.catalog, patientSex)}
                  </span>
                )}
              </div>
            )
            : <InlineEdit
                value={result.refText ?? ''}
                onSave={(v) => onUpdate(result.id, 'refText', v)}
                readOnly={readOnly}
                placeholder="—"
                className="text-center text-xs text-muted-foreground"
              />
          }
        </div>

        {/* Status dropdown */}
        <div className="flex justify-center">
          <button
            ref={buttonRef}
            onClick={() => !readOnly && setStatusOpen((o) => !o)}
            disabled={readOnly}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              currentStatus.bg,
              currentStatus.text,
              !readOnly && 'hover:opacity-80 cursor-pointer'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', currentStatus.dot)} />
            {currentStatus.label}
            {!readOnly && <ChevronDown className="h-3 w-3" />}
          </button>

          {statusOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setStatusOpen(false)} />
              <div
                className="fixed z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[140px]"
                style={{ top: dropdownPos.top, right: dropdownPos.right }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onUpdate(result.id, 'status', option.value)
                      setStatusOpen(false)
                    }}
                    className={cn(
                      'flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-slate-50 transition-colors',
                      result.status === option.value && 'font-semibold'
                    )}
                  >
                    <span className={cn('h-2 w-2 rounded-full', option.dot)} />
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!readOnly && (
            <>
              <button
                onClick={() => setShowNote((s) => !s)}
                className={cn(
                  'cursor-pointer p-1 rounded hover:bg-slate-50 transition-colors',
                  result.professionalNote ? 'text-blue-500' : 'text-muted-foreground'
                )}
                title="Adicionar observação"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(result.id)}
                className="cursor-pointer p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Remover exame"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Nota do profissional (expansível) */}
      {(showNote || result.professionalNote) && (
        <div className="px-4 pb-2.5">
          <textarea
            value={result.professionalNote ?? ''}
            onChange={(e) => onUpdate(result.id, 'professionalNote', e.target.value || null)}
            onBlur={(e) => onUpdate(result.id, 'professionalNote', e.target.value || null)}
            placeholder="Observação clínica..."
            rows={2}
            readOnly={readOnly}
            className="w-full text-xs bg-muted/50 border border-border/50 rounded-md px-3 py-2 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>
      )}

      {/* ── Modal de confirmação de vínculo ── */}
      {/* ── Modal de confirmação de vínculo ── */}
      {pendingLink && (
        <>
          <div data-modal className="fixed inset-0 z-50 bg-black/50" onClick={() => setPendingLink(null)} />
          <div
            data-modal
            className="fixed z-50 bg-white rounded-2xl shadow-2xl w-[360px] overflow-hidden"
            style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Link2 className="h-3.5 w-3.5 text-green-600" />
                </span>
                <h4 className="font-semibold text-sm text-slate-800">Vincular ao catálogo</h4>
              </div>
              <button onClick={() => setPendingLink(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-slate-500">
                O exame <strong className="text-slate-800">{result.examName}</strong> será vinculado a:
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">{pendingLink.displayName}</p>
                {(pendingLink.category || pendingLink.unit) && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {[pendingLink.category, pendingLink.unit].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-5 justify-end">
              <button
                onClick={() => setPendingLink(null)}
                className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmLink}
                className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Vincular
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modal de cadastro rápido ── */}
      {showQuickRegister && (
        <>
          <div data-modal className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowQuickRegister(false)} />
          <div
            data-modal
            className="fixed z-50 bg-white rounded-2xl shadow-2xl w-[500px] overflow-hidden"
            style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <BookPlus className="h-3.5 w-3.5 text-blue-600" />
                </span>
                <h4 className="font-semibold text-sm text-slate-800">Cadastrar exame no catálogo</h4>
              </div>
              <button onClick={() => setShowQuickRegister(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome padrão *</label>
                  <input
                    value={qrForm.displayName}
                    onChange={(e) => setQrForm((f) => ({ ...f, displayName: e.target.value }))}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Categoria</label>
                  <input
                    value={qrForm.category}
                    onChange={(e) => setQrForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="Ex: Hemograma"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Unidade</label>
                  <input
                    value={qrForm.unit}
                    onChange={(e) => setQrForm((f) => ({ ...f, unit: e.target.value }))}
                    placeholder="Ex: g/dL"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ref. masculino (mín – máx)</label>
                  <div className="flex gap-1.5">
                    <input type="number" placeholder="Mín" value={qrForm.refMinMale}
                      onChange={(e) => setQrForm((f) => ({ ...f, refMinMale: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="number" placeholder="Máx" value={qrForm.refMaxMale}
                      onChange={(e) => setQrForm((f) => ({ ...f, refMaxMale: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ref. feminino (mín – máx)</label>
                  <div className="flex gap-1.5">
                    <input type="number" placeholder="Mín" value={qrForm.refMinFemale}
                      onChange={(e) => setQrForm((f) => ({ ...f, refMinFemale: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="number" placeholder="Máx" value={qrForm.refMaxFemale}
                      onChange={(e) => setQrForm((f) => ({ ...f, refMaxFemale: e.target.value }))}
                      className="w-full text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                O exame será cadastrado no catálogo e vinculado automaticamente a este resultado.
              </p>
            </div>

            <div className="flex gap-2 px-5 pb-5 justify-end">
              <button
                onClick={() => setShowQuickRegister(false)}
                className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleQuickRegister}
                disabled={qrSaving}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {qrSaving ? 'Salvando...' : 'Cadastrar e vincular'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
