'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/ckex/button'
import { Input } from '@/components/ui/ckex/input'
import { Label } from '@/components/ui/ckex/label'
import { Card, CardContent } from '@/components/ui/ckex/card'
import { Badge } from '@/components/ui/ckex/badge'
import {
  UploadCloud, FileText, X, CheckCircle2,
  Loader2, AlertTriangle, Plus, Search, BookPlus, UserPlus, AlertCircle,
} from 'lucide-react'

function normalizeForSearch(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
import type { ExtractedResult } from '@/lib/pdf/parser'
import { autoEvaluate } from '@/lib/exam/evaluate'
import type { ResultStatus } from '@prisma/client'

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

// ExtractedResult enriquecido com status pré-avaliado
type ReviewResult = ExtractedResult & { status: ResultStatus }

interface PatientOption {
  id: string
  name: string
  sex: string | null
  birthDate: Date | null
}

interface NewAnalysisFormProps {
  patients: PatientOption[]
  preselectedPatientId?: string
}

export function NewAnalysisForm({ patients, preselectedPatientId }: NewAnalysisFormProps) {
  const router = useRouter()

  const [allPatients, setAllPatients] = useState<PatientOption[]>(patients)
  const [selectedPatientId, setSelectedPatientId] = useState(preselectedPatientId ?? '')
  const selectedPatient = allPatients.find((p) => p.id === selectedPatientId) ?? null
  const patientId = selectedPatientId

  // ── Autocomplete paciente ─────────────────────────────────────────
  const [patientSearch, setPatientSearch] = useState(
    preselectedPatientId ? (patients.find((p) => p.id === preselectedPatientId)?.name ?? '') : ''
  )
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)
  const patientRef = useRef<HTMLDivElement>(null)

  const filteredPatients = patientSearch.trim()
    ? allPatients.filter((p) =>
        normalizeForSearch(p.name).includes(normalizeForSearch(patientSearch))
      )
    : allPatients

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (patientRef.current && !patientRef.current.contains(e.target as Node)) {
        setShowPatientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectPatient(p: PatientOption) {
    setSelectedPatientId(p.id)
    setPatientSearch(p.name)
    setShowPatientDropdown(false)
  }

  function clearPatient() {
    setSelectedPatientId('')
    setPatientSearch('')
  }

  // ── Modal cadastro de paciente ────────────────────────────────────
  const [showPatientModal, setShowPatientModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNascimento, setNewNascimento] = useState('')
  const [newSex, setNewSex] = useState<'M' | 'F' | ''>('')
  const [patientSaving, setPatientSaving] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<{ id: string; name: string } | null>(null)

  function openPatientModal() {
    setNewName(patientSearch)
    setNewNascimento('')
    setNewSex('')
    setDuplicateWarning(null)
    setShowPatientModal(true)
  }

  useEffect(() => {
    if (!newName.trim()) { setDuplicateWarning(null); return }
    const normalized = normalizeForSearch(newName)
    const dup = allPatients.find((p) => normalizeForSearch(p.name) === normalized)
    setDuplicateWarning(dup ?? null)
  }, [newName, allPatients])

  async function handleCreatePatient() {
    if (!newName.trim()) { toast.error('Nome é obrigatório'); return }
    if (duplicateWarning) { toast.error('Já existe um paciente com esse nome'); return }
    setPatientSaving(true)
    try {
      const res = await fetch('/api/ckex/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          birthDate: newNascimento || null,
          sex: newSex || null,
        }),
      })
      const data = await res.json()
      if (res.status === 409) {
        setDuplicateWarning({ id: data.existingId, name: data.existingName })
        return
      }
      if (!res.ok) throw new Error(data.error ?? 'Erro ao cadastrar')
      const newPatient: PatientOption = {
        id: data.id,
        name: data.name,
        sex: data.sex ?? null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
      }
      setAllPatients((prev) => [...prev, newPatient].sort((a, b) => a.name.localeCompare(b.name)))
      selectPatient(newPatient)
      setShowPatientModal(false)
      toast.success('Paciente cadastrado e selecionado!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setPatientSaving(false)
    }
  }
  const patientSex = selectedPatient?.sex ?? null
  const patientBirthDate = selectedPatient?.birthDate ?? null

  const [step, setStep] = useState<'form' | 'review'>('form')
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const [labName, setLabName] = useState('')
  const [collectedAt, setCollectedAt] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [results, setResults] = useState<ReviewResult[]>([])
  const [rawText, setRawText] = useState<string>('')
  const [showRaw, setShowRaw] = useState(false)
  const [usedAI, setUsedAI] = useState(false)

  // ── Catalog modal (add exam manually) ──────────────────────────
  const [showAddModal, setShowAddModal] = useState(false)
  const [addCatQuery, setAddCatQuery] = useState('')
  const [addCatResults, setAddCatResults] = useState<CatalogEntry[]>([])
  const [addCatLoading, setAddCatLoading] = useState(false)
  const [addCatSearched, setAddCatSearched] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrForm, setQrForm] = useState({
    displayName: '', category: '', unit: '',
    refMinMale: '', refMaxMale: '', refMinFemale: '', refMaxFemale: '',
  })
  const [qrSaving, setQrSaving] = useState(false)

  // ─── Upload e extração ───────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Selecione um arquivo PDF')
      return
    }
    setPdfFile(file)
    setExtracting(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (patientSex) formData.append('patientSex', patientSex)
      if (patientBirthDate) formData.append('patientBirthDate', new Date(patientBirthDate).toISOString())

      const res = await fetch('/api/ckex/pdf/extract', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      if (data.results.length === 0) {
        toast.warning('Nenhum exame reconhecido automaticamente. Adicione manualmente.')
      } else {
        const aiLabel = data.usedAI ? ' (via IA)' : ''
        toast.success(`${data.results.length} exame(s) extraído(s) com sucesso${aiLabel}!`)
      }

      setResults((data.results as ExtractedResult[]).map((r) => ({
        ...r,
        status: autoEvaluate(
          r.valueNumeric,
          r.matchedRef?.refMin ?? r.refMin,
          r.matchedRef?.refMax ?? r.refMax,
        ),
      })))
      setRawText(data.rawText ?? '')
      setUsedAI(data.usedAI ?? false)
      setStep('review')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao processar PDF')
    } finally {
      setExtracting(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  // ─── Edição dos resultados ───────────────────────────────────────────────────

  function updateResult(index: number, field: keyof ReviewResult, value: string | number | null) {
    setResults((prev) => prev.map((r, i) => {
      if (i !== index) return r
      const updated = { ...r, [field]: value }
      // Reavalia automaticamente se valor ou referência mudou
      if (field === 'valueNumeric' || field === 'refMin' || field === 'refMax') {
        updated.status = autoEvaluate(
          updated.valueNumeric,
          updated.matchedRef?.refMin ?? updated.refMin,
          updated.matchedRef?.refMax ?? updated.refMax,
        )
      }
      return updated
    }))
  }

  function removeResult(index: number) {
    setResults((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Catalog search debounce ──────────────────────────────────────
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

  function addFromCatalog(entry: CatalogEntry) {
    const { refMin, refMax, refText } = catalogRefFields(entry)
    setResults((prev) => [...prev, {
      examName: entry.displayName,
      examSlug: entry.slug,
      catalogId: entry.id,
      category: entry.category ?? 'Outros',
      value: '',
      valueNumeric: null,
      unit: entry.unit ?? '',
      refMin,
      refMax,
      refText: refText ?? '',
      status: 'NOT_EVALUATED' as ResultStatus,
    }])
    setShowAddModal(false)
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
      addFromCatalog(created)
      toast.success('Exame cadastrado!')
    } catch {
      toast.error('Erro ao cadastrar exame')
    } finally {
      setQrSaving(false)
    }
  }

  // ─── Salvar análise ──────────────────────────────────────────────────────────

  async function handleSave() {
    if (!collectedAt) {
      toast.error('Informe a data da coleta')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/ckex/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          collectedAt,
          labName: labName || null,
          results: results.filter((r) => r.examName.trim()),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar')

      toast.success('Análise criada!')
      router.push(`/check-exames/analises/${data.id}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado')
      setLoading(false)
    }
  }

  // ─── STEP 1: Formulário + Upload ─────────────────────────────────────────────

  // ── JSX do modal de cadastro de paciente (reutilizado nos dois steps) ──────────
  const patientModal = showPatientModal ? (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={() => !patientSaving && setShowPatientModal(false)} />
      <div
        className="fixed z-50 bg-white border rounded-xl shadow-xl w-[420px]"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-blue-600" />
            <h4 className="font-semibold">Cadastrar paciente</h4>
          </div>
          <button onClick={() => setShowPatientModal(false)} disabled={patientSaving} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nome completo *</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Maria da Silva"
              className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {duplicateWarning && (
              <div className="flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  Já existe <strong>{duplicateWarning.name}</strong> cadastrado.{' '}
                  <button
                    type="button"
                    className="underline font-medium"
                    onClick={() => {
                      const p = allPatients.find((x) => x.id === duplicateWarning.id)
                      if (p) { selectPatient(p); setShowPatientModal(false) }
                    }}
                  >
                    Selecionar este paciente
                  </button>
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data de nascimento</label>
            <input
              type="date"
              value={newNascimento}
              onChange={(e) => setNewNascimento(e.target.value)}
              className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sexo biológico</label>
            <div className="flex gap-3">
              {(['M', 'F'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setNewSex((prev) => prev === s ? '' : s)}
                  className={`flex-1 py-2 text-sm rounded-md border font-medium transition-colors ${
                    newSex === s
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {s === 'M' ? 'Masculino' : 'Feminino'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2 justify-end">
          <button
            onClick={() => setShowPatientModal(false)}
            disabled={patientSaving}
            className="px-4 py-2 text-sm border rounded-md hover:bg-accent transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreatePatient}
            disabled={patientSaving || !!duplicateWarning || !newName.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {patientSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" />Salvando...</> : 'Cadastrar e selecionar'}
          </button>
        </div>
      </div>
    </>
  ) : null

  if (step === 'form') {
    return (
      <>
      <div className="max-w-xl space-y-5">
        <Card>
          <CardContent className="p-6 space-y-5">
            {/* Paciente */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Paciente *</Label>
                <button
                  type="button"
                  onClick={openPatientModal}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Cadastrar paciente
                </button>
              </div>
              <div ref={patientRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value)
                      setSelectedPatientId('')
                      setShowPatientDropdown(true)
                    }}
                    onFocus={() => setShowPatientDropdown(true)}
                    placeholder="Digite para buscar paciente..."
                    className="w-full text-sm border border-input rounded-md pl-8 pr-8 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {patientSearch && (
                    <button
                      type="button"
                      onClick={clearPatient}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {showPatientDropdown && (
                  <div className="absolute z-30 top-full mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
                    {filteredPatients.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground">
                        Nenhum paciente encontrado.{' '}
                        <button
                          type="button"
                          onClick={() => { setShowPatientDropdown(false); openPatientModal() }}
                          className="text-blue-600 underline font-medium"
                        >
                          Cadastrar novo
                        </button>
                      </div>
                    ) : (
                      filteredPatients.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); selectPatient(p) }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${
                            p.id === selectedPatientId ? 'bg-blue-50 font-medium text-blue-700' : ''
                          }`}
                        >
                          {p.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Laboratório */}
            <div className="space-y-1.5">
              <Label htmlFor="labName">Laboratório</Label>
              <Input
                id="labName"
                placeholder="Ex: Fleury, Sabin, DASA..."
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Data da coleta */}
            <div className="space-y-1.5">
              <Label htmlFor="collectedAt">Data da coleta *</Label>
              <Input
                id="collectedAt"
                type="date"
                value={collectedAt}
                onChange={(e) => setCollectedAt(e.target.value)}
                required
              />
            </div>

            {/* Upload de PDF */}
            <div className="space-y-1.5">
              <Label>Laudo em PDF</Label>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => document.getElementById('pdf-input')?.click()}
                className={`
                  relative flex flex-col items-center justify-center gap-3
                  rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors
                  ${dragOver
                    ? 'border-primary bg-accent'
                    : 'border-border hover:border-primary/50 hover:bg-accent/30'}
                `}
              >
                {extracting ? (
                  <>
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    <p className="text-sm font-medium">Extraindo exames do PDF...</p>
                  </>
                ) : pdfFile ? (
                  <>
                    <FileText className="h-8 w-8 text-green-500" />
                    <p className="text-sm font-medium text-green-700">{pdfFile.name}</p>
                    <p className="text-xs text-muted-foreground">Clique para trocar</p>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Arraste o PDF aqui</p>
                      <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Máximo 20MB</p>
                  </>
                )}
                <input
                  id="pdf-input"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={() => {
                  if (!selectedPatientId) { toast.error('Selecione um paciente'); return }
                  if (!collectedAt) { toast.error('Informe a data da coleta'); return }
                  setStep('review')
                }}
              >
                Continuar sem PDF
              </Button>
              <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
      {patientModal}
      </>
    )
  }

  // ─── STEP 2: Revisar resultados extraídos ────────────────────────────────────

  const categories = Array.from(new Set(results.map((r) => r.category)))

  return (
    <div className="space-y-4">
      {/* Cabeçalho da revisão — linha única */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Lado esquerdo */}
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          {pdfFile && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 rounded-md px-2.5 py-1.5 max-w-[200px] flex-shrink-0">
              <FileText className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{pdfFile.name}</span>
            </div>
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            {results.length > 0
              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              : <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
            }
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {results.length} exame{results.length !== 1 ? 's' : ''}
            </span>
          </div>
          {usedAI && (
            <span className="flex-shrink-0 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full whitespace-nowrap">
              ✦ IA
            </span>
          )}
        </div>

        {/* Lado direito */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {rawText && (
            <button
              onClick={() => setShowRaw((s) => !s)}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors whitespace-nowrap"
            >
              {showRaw ? 'Ocultar texto' : 'Ver texto'}
            </button>
          )}
          <button
            onClick={() => setStep('form')}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            Voltar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando...</> : 'Salvar análise'}
          </button>
        </div>
      </div>

      {/* Texto bruto extraído do PDF (debug) */}
      {showRaw && rawText && (
        <Card className="border-dashed border-yellow-400">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-yellow-50">
            <span className="text-xs font-semibold text-yellow-700">Texto bruto extraído do PDF (primeiras 1500 chars)</span>
            <span className="text-xs text-yellow-600">Cole isso para o Claude ajustar o parser</span>
          </div>
          <CardContent className="p-0">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap p-4 max-h-64 overflow-y-auto font-mono leading-relaxed">
              {rawText}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Tabela de revisão por categoria */}
      {results.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto" />
            <p className="font-medium">Nenhum exame extraído automaticamente</p>
            <p className="text-sm text-muted-foreground">
              O formato deste laudo não foi reconhecido. Adicione os exames manualmente.
            </p>
            <Button size="sm" onClick={openAddModal}>
              <Plus className="h-4 w-4" /> Adicionar exame
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <Card key={category}>
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                <span className="text-sm font-semibold">{category}</span>
                <div className="flex items-center gap-1.5">
                  {results.filter((r) => r.category === category && r.status === 'ATTENTION').length > 0 && (
                    <Badge variant="attention">
                      {results.filter((r) => r.category === category && r.status === 'ATTENTION').length} atenção
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    {results.filter((r) => r.category === category).length} exames
                  </Badge>
                </div>
              </div>
              <div className="divide-y">
                {results.map((result, i) => {
                  if (result.category !== category) return null
                  const statusDot = result.status === 'NORMAL' ? 'bg-green-500'
                    : result.status === 'ATTENTION' ? 'bg-yellow-500'
                    : result.status === 'DANGER' ? 'bg-red-500'
                    : 'bg-slate-300'
                  return (
                    <div key={i} className="grid grid-cols-[1fr_90px_70px_140px_24px_36px] gap-2 px-4 py-2.5 items-center">
                      {/* Nome */}
                      <input
                        className="text-sm font-medium bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 py-0.5 w-full"
                        value={result.examName}
                        onChange={(e) => updateResult(i, 'examName', e.target.value)}
                        placeholder="Nome do exame"
                      />
                      {/* Valor */}
                      <input
                        className="text-sm text-center bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 py-0.5 w-full"
                        value={result.value ?? ''}
                        onChange={(e) => updateResult(i, 'value', e.target.value)}
                        placeholder="Valor"
                      />
                      {/* Unidade */}
                      <input
                        className="text-xs text-center text-muted-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 py-0.5 w-full"
                        value={result.unit ?? ''}
                        onChange={(e) => updateResult(i, 'unit', e.target.value)}
                        placeholder="Un."
                      />
                      {/* Referência */}
                      <input
                        className="text-xs text-center text-muted-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 py-0.5 w-full"
                        value={result.refText ?? ''}
                        onChange={(e) => updateResult(i, 'refText', e.target.value)}
                        placeholder="Referência"
                      />
                      {/* Status dot */}
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 mx-auto ${statusDot}`} title={result.status} />
                      {/* Remover */}
                      <button
                        onClick={() => removeResult(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Salvar */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</> : 'Salvar análise'}
        </button>
        <button
          onClick={() => router.back()}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>

      {patientModal}

      {/* ── Modal: Adicionar exame do catálogo ── */}
      {showAddModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40"
            onClick={() => !qrSaving && setShowAddModal(false)}
          />
          <div
            className="fixed z-50 bg-card border rounded-xl shadow-xl w-[480px]"
            style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h4 className="font-semibold">Adicionar exame</h4>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground"
                disabled={qrSaving}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!showQR ? (
              <>
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
                          onClick={() => addFromCatalog(entry)}
                          className="w-full text-left px-5 py-2.5 hover:bg-accent transition-colors"
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
                    className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
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
                    className="px-3 py-1.5 text-sm border rounded-md hover:bg-accent transition-colors"
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
