'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/ckex/button'
import { Input } from '@/components/ui/ckex/input'
import { Label } from '@/components/ui/ckex/label'
import { Card, CardContent } from '@/components/ui/ckex/card'
import { Badge } from '@/components/ui/ckex/badge'
import {
  Plus, Search, Pencil, Trash2, X, ChevronDown, ChevronUp, BookOpen,
} from 'lucide-react'

interface CatalogEntry {
  id: string
  slug: string
  displayName: string
  category: string | null
  unit: string | null
  aliases: string[]
  refMinMale: number | null
  refMaxMale: number | null
  refMinFemale: number | null
  refMaxFemale: number | null
  description: string | null
}

interface RefWithOverride {
  id: string
  unit: string
  sex: string
  ageMinMonths: number | null
  ageMaxMonths: number | null
  globalRefMin: number | null
  globalRefMax: number | null
  override: { id: string; refMin: number | null; refMax: number | null } | null
}

type RefType = 'between' | 'gte' | 'lte'

interface DisplayRef {
  examReferenceId: string
  sex: 'M' | 'F' | 'U'
  ageMinMonths: number | null
  ageMaxMonths: number | null
  refMin: number | null
  refMax: number | null
  isGlobalOnly: boolean
  overrideId: string | null
}

type RefForm = {
  catalogId: string
  examReferenceId: string | null
  sex: 'M' | 'F' | 'U'
  unit: string
  ageMin: string
  ageMax: string
  refMin: string
  refMax: string
  refType: RefType
}

function detectRefType(refMin: string | number | null, refMax: string | number | null): RefType {
  const hasMin = refMin != null && refMin !== ''
  const hasMax = refMax != null && refMax !== ''
  if (hasMin && !hasMax) return 'gte'
  if (!hasMin && hasMax) return 'lte'
  return 'between'
}

function ageRangeText(min: number | null, max: number | null): string {
  if (min === null && max === null) return ''
  const fmt = (m: number) => m < 12 ? `${m}m` : Number.isInteger(m / 12) ? `${m / 12}a` : `${(m / 12).toFixed(1)}a`
  if (min !== null && max !== null) return `${fmt(min)}–${fmt(max)}`
  if (min !== null) return `≥${fmt(min)}`
  return `≤${fmt(max!)}`
}

const AGE_PRESETS = [
  { label: 'Neonato', ageMin: '0', ageMax: '0' },
  { label: 'Lactente', ageMin: '1', ageMax: '23' },
  { label: 'Pré-escolar', ageMin: '24', ageMax: '71' },
  { label: 'Escolar', ageMin: '72', ageMax: '143' },
  { label: 'Adolescente', ageMin: '144', ageMax: '215' },
  { label: 'Adulto', ageMin: '216', ageMax: '' },
] as const

const SEX_LABEL: Record<string, string> = { M: 'Masculino', F: 'Feminino', U: 'Unissex' }

const EMPTY_FORM = {
  displayName: '',
  category: '',
  unit: '',
  description: '',
  aliases: [] as string[],
}

function refRangeText(min: number | null, max: number | null): string {
  if (min != null && max != null) return `${min} a ${max}`
  if (min != null) return `≥ ${min}`
  if (max != null) return `≤ ${max}`
  return '—'
}

export function CatalogManager() {
  const [items, setItems] = useState<CatalogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const [showNewForm, setShowNewForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [aliasInput, setAliasInput] = useState('')
  const [saving, setSaving] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [refsMap, setRefsMap] = useState<Record<string, RefWithOverride[]>>({})
  const [refsLoading, setRefsLoading] = useState<string | null>(null)

  const [refForm, setRefForm] = useState<RefForm | null>(null)
  const [refSaving, setRefSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/ckex/catalog${q ? `?q=${encodeURIComponent(q)}` : ''}`)
    setItems(await res.json())
    setLoading(false)
  }, [q])

  useEffect(() => { load() }, [load])

  async function loadRefs(catalogId: string) {
    setRefsLoading(catalogId)
    try {
      const res = await fetch(`/api/ckex/catalog/${catalogId}/references`)
      if (res.ok) {
        const data = await res.json()
        setRefsMap((prev) => ({ ...prev, [catalogId]: data }))
      }
    } finally {
      setRefsLoading(null)
    }
  }

  function toggleExpand(itemId: string) {
    if (expandedId === itemId) {
      setExpandedId(null)
      setRefForm(null)
    } else {
      setExpandedId(itemId)
      setRefForm(null)
      loadRefs(itemId)
    }
  }

  function openNew() {
    setEditingId(null)
    setShowNewForm(true)
    setForm(EMPTY_FORM)
    setAliasInput('')
  }

  function closeForm() {
    setShowNewForm(false)
    setEditingId(null)
  }

  function openEdit(item: CatalogEntry) {
    setShowNewForm(false)
    setExpandedId(null)
    setRefForm(null)
    setEditingId(item.id)
    setForm({
      displayName: item.displayName,
      category: item.category ?? '',
      unit: item.unit ?? '',
      description: item.description ?? '',
      aliases: item.aliases,
    })
    setAliasInput('')
  }

  function addAlias() {
    const v = aliasInput.trim()
    if (!v || form.aliases.includes(v)) return
    setForm((f) => ({ ...f, aliases: [...f.aliases, v] }))
    setAliasInput('')
  }

  function removeAlias(alias: string) {
    setForm((f) => ({ ...f, aliases: f.aliases.filter((a) => a !== alias) }))
  }

  async function handleSave() {
    if (!form.displayName.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    try {
      const payload = {
        displayName: form.displayName.trim(),
        category: form.category.trim() || undefined,
        unit: form.unit.trim() || undefined,
        description: form.description.trim() || undefined,
        aliases: form.aliases,
      }
      const isEditing = editingId !== null
      const res = await fetch(isEditing ? `/api/ckex/catalog/${editingId}` : '/api/ckex/catalog', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      toast.success(isEditing ? 'Exame atualizado' : 'Exame cadastrado')
      closeForm()
      load()
    } catch {
      toast.error('Erro ao salvar exame')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir "${name}" do catálogo?`)) return
    await fetch(`/api/ckex/catalog/${id}`, { method: 'DELETE' })
    toast.success('Exame removido')
    load()
  }

  async function saveRef() {
    if (!refForm) return
    setRefSaving(true)
    try {
      const refMin = refForm.refType !== 'lte' && refForm.refMin !== '' ? parseFloat(refForm.refMin) : null
      const refMax = refForm.refType !== 'gte' && refForm.refMax !== '' ? parseFloat(refForm.refMax) : null
      const body = refForm.examReferenceId !== null
        ? { examReferenceId: refForm.examReferenceId, refMin, refMax }
        : {
            unit: refForm.unit,
            sex: refForm.sex,
            ageMinMonths: refForm.ageMin !== '' ? parseInt(refForm.ageMin) : null,
            ageMaxMonths: refForm.ageMax !== '' ? parseInt(refForm.ageMax) : null,
            refMin,
            refMax,
          }
      const res = await fetch(`/api/ckex/catalog/${refForm.catalogId}/references`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success(refForm.examReferenceId ? 'Referência salva' : 'Referência adicionada')
      const catalogId = refForm.catalogId
      setRefForm(null)
      await loadRefs(catalogId)
    } catch {
      toast.error('Erro ao salvar referência')
    } finally {
      setRefSaving(false)
    }
  }

  async function deleteOverride(catalogId: string, overrideId: string) {
    const res = await fetch(`/api/ckex/catalog/${catalogId}/references/${overrideId}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Erro ao remover personalização'); return }
    toast.success('Personalização removida')
    await loadRefs(catalogId)
  }

  const grouped = items.reduce<Record<string, CatalogEntry[]>>((acc, item) => {
    const cat = item.category ?? 'Outros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  function renderForm(isNew: boolean) {
    return (
      <div className="pt-5 pb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{isNew ? 'Novo exame' : 'Editar exame'}</h3>
          <button onClick={closeForm}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nome padrão *</Label>
            <Input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="Ex: Ferritina" />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Ex: Ferro / Anemia" />
          </div>
          <div className="space-y-1.5">
            <Label>Unidade</Label>
            <Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="Ex: ng/mL" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Nomenclaturas alternativas</Label>
            <div className="flex gap-2">
              <Input value={aliasInput} onChange={(e) => setAliasInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())} placeholder="Ex: Ferritina sérica — pressione Enter" />
              <Button type="button" variant="outline" onClick={addAlias}>Adicionar</Button>
            </div>
            {form.aliases.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {form.aliases.map((a) => (
                  <Badge key={a} variant="secondary" className="gap-1">
                    {a}
                    <button onClick={() => removeAlias(a)}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Descrição (para relatório)</Label>
            <textarea className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Explique o que este exame avalia..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={closeForm}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : isNew ? 'Cadastrar exame' : 'Salvar alterações'}</Button>
        </div>
      </div>
    )
  }

  function renderRefsSection(item: CatalogEntry) {
    const refs = refsMap[item.id] ?? []

    const displayRefs: DisplayRef[] = refs
      .filter(r =>
        (r.override?.refMin != null || r.override?.refMax != null)
        || (r.override == null && (r.globalRefMin != null || r.globalRefMax != null))
      )
      .map(r => ({
        examReferenceId: r.id,
        sex: r.sex as 'M' | 'F' | 'U',
        ageMinMonths: r.ageMinMonths,
        ageMaxMonths: r.ageMaxMonths,
        refMin: r.override?.refMin ?? r.globalRefMin,
        refMax: r.override?.refMax ?? r.globalRefMax,
        isGlobalOnly: r.override == null,
        overrideId: r.override?.id ?? null,
      }))

    const isFormOpen = refForm?.catalogId === item.id
    const isNew = isFormOpen && refForm!.examReferenceId === null

    return (
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Referências</p>
          {!isFormOpen && !refsLoading && (
            <button
              onClick={() => setRefForm({ catalogId: item.id, examReferenceId: null, sex: 'U', unit: item.unit ?? '', ageMin: '', ageMax: '', refMin: '', refMax: '', refType: 'between' })}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Adicionar
            </button>
          )}
        </div>

        {refsLoading === item.id ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : (
          <>
            {displayRefs.length === 0 && !isFormOpen && (
              <p className="text-xs text-muted-foreground italic">Nenhuma referência cadastrada.</p>
            )}

            <div className="space-y-0.5">
              {displayRefs.map((ref) => {
                const isEditingThis = isFormOpen && refForm!.examReferenceId === ref.examReferenceId
                if (isEditingThis) {
                  return (
                    <div key={ref.examReferenceId} className="flex flex-wrap items-center gap-2 p-2 rounded bg-background border">
                      <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{SEX_LABEL[ref.sex]}</span>
                      {ageRangeText(ref.ageMinMonths, ref.ageMaxMonths) && (
                        <span className="text-xs text-muted-foreground/70 w-20 flex-shrink-0">{ageRangeText(ref.ageMinMonths, ref.ageMaxMonths)}</span>
                      )}
                      <select value={refForm!.refType} onChange={(e) => setRefForm((f) => f ? { ...f, refType: e.target.value as RefType } : f)} className="h-7 text-xs rounded border bg-background px-1">
                        <option value="between">Entre X e Y</option>
                        <option value="gte">≥ X</option>
                        <option value="lte">≤ Y</option>
                      </select>
                      {refForm!.refType !== 'lte' && (
                        <Input type="number" placeholder="Mín" value={refForm!.refMin} onChange={(e) => setRefForm((f) => f ? { ...f, refMin: e.target.value } : f)} className="h-7 text-xs w-20" />
                      )}
                      {refForm!.refType === 'between' && <span className="text-xs text-muted-foreground">a</span>}
                      {refForm!.refType !== 'gte' && (
                        <Input type="number" placeholder="Máx" value={refForm!.refMax} onChange={(e) => setRefForm((f) => f ? { ...f, refMax: e.target.value } : f)} className="h-7 text-xs w-20" />
                      )}
                      <Button size="sm" className="h-7 text-xs px-2" onClick={saveRef} disabled={refSaving}>{refSaving ? '...' : 'Salvar'}</Button>
                      <button onClick={() => setRefForm(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  )
                }
                return (
                  <div key={ref.examReferenceId} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-background/60 group">
                    <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{SEX_LABEL[ref.sex]}</span>
                    <span className="text-xs text-muted-foreground/70 w-20 flex-shrink-0">{ageRangeText(ref.ageMinMonths, ref.ageMaxMonths) || '—'}</span>
                    <span className="text-xs flex-1">
                      {refRangeText(ref.refMin, ref.refMax)}
                      {item.unit && <span className="ml-1 text-muted-foreground">{item.unit}</span>}
                    </span>
                    {ref.isGlobalOnly && (
                      <Badge variant="outline" className="text-xs px-1 py-0 h-4 text-muted-foreground font-normal">padrão</Badge>
                    )}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setRefForm({
                          catalogId: item.id,
                          examReferenceId: ref.examReferenceId,
                          sex: ref.sex,
                          unit: item.unit ?? '',
                          ageMin: ref.ageMinMonths?.toString() ?? '',
                          ageMax: ref.ageMaxMonths?.toString() ?? '',
                          refMin: ref.refMin?.toString() ?? '',
                          refMax: ref.refMax?.toString() ?? '',
                          refType: detectRefType(ref.refMin, ref.refMax),
                        })}
                        className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {!ref.isGlobalOnly && (
                        <button
                          onClick={() => deleteOverride(item.id, ref.overrideId!)}
                          className="p-0.5 rounded hover:bg-muted text-destructive"
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {isNew && (
              <div className="p-2 rounded bg-background border mt-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select value={refForm!.sex} onChange={(e) => setRefForm((f) => f ? { ...f, sex: e.target.value as 'M' | 'F' | 'U' } : f)} className="h-7 text-xs rounded border bg-background px-1">
                    <option value="U">Unissex</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                  <select value={refForm!.refType} onChange={(e) => setRefForm((f) => f ? { ...f, refType: e.target.value as RefType } : f)} className="h-7 text-xs rounded border bg-background px-1">
                    <option value="between">Entre X e Y</option>
                    <option value="gte">≥ X</option>
                    <option value="lte">≤ Y</option>
                  </select>
                  {refForm!.refType !== 'lte' && (
                    <Input type="number" placeholder="Mín" value={refForm!.refMin} onChange={(e) => setRefForm((f) => f ? { ...f, refMin: e.target.value } : f)} className="h-7 text-xs w-20" />
                  )}
                  {refForm!.refType === 'between' && <span className="text-xs text-muted-foreground">a</span>}
                  {refForm!.refType !== 'gte' && (
                    <Input type="number" placeholder="Máx" value={refForm!.refMax} onChange={(e) => setRefForm((f) => f ? { ...f, refMax: e.target.value } : f)} className="h-7 text-xs w-20" />
                  )}
                  <Button size="sm" className="h-7 text-xs px-2" onClick={saveRef} disabled={refSaving}>{refSaving ? '...' : 'Salvar'}</Button>
                  <button onClick={() => setRefForm(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Idade:</span>
                  <Input type="number" placeholder="De (meses)" value={refForm!.ageMin} onChange={(e) => setRefForm((f) => f ? { ...f, ageMin: e.target.value } : f)} className="h-7 text-xs w-28" />
                  <span className="text-xs text-muted-foreground">a</span>
                  <Input type="number" placeholder="Até (meses)" value={refForm!.ageMax} onChange={(e) => setRefForm((f) => f ? { ...f, ageMax: e.target.value } : f)} className="h-7 text-xs w-28" />
                </div>
                <div className="flex flex-wrap gap-1">
                  {AGE_PRESETS.map(p => (
                    <button
                      key={p.label}
                      onClick={() => setRefForm((f) => f ? { ...f, ageMin: p.ageMin, ageMax: p.ageMax } : f)}
                      className="text-xs px-1.5 py-0.5 rounded border hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar exame..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" />
          Novo exame
        </Button>
      </div>

      {showNewForm && (
        <Card className="border-primary/40">
          <CardContent>{renderForm(true)}</CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="font-medium">Catálogo vazio</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Cadastre os exames para padronizar nomenclaturas e habilitar o histórico de evolução.</p>
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Cadastrar primeiro exame</Button>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, entries]) => (
          <div key={cat}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{cat}</p>
            <div className="space-y-1">
              {entries.map((item) => (
                <Card key={item.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-0">
                    {editingId === item.id ? (
                      <div className="px-4 border-primary/40 border rounded-[inherit]">
                        {renderForm(false)}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{item.displayName}</span>
                              {item.unit && <span className="text-xs text-muted-foreground">({item.unit})</span>}
                              {item.aliases.length > 0 && (
                                <Badge variant="secondary" className="text-xs">{item.aliases.length} alias</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => toggleExpand(item.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                              {expandedId === item.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                            <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDelete(item.id, item.displayName)} className="p-1.5 rounded hover:bg-muted text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {expandedId === item.id && (
                          <div className="border-t px-4 py-3 bg-muted/30 space-y-3">
                            {item.aliases.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Aliases:</p>
                                <div className="flex flex-wrap gap-1">
                                  {item.aliases.map((a) => <Badge key={a} variant="outline" className="text-xs">{a}</Badge>)}
                                </div>
                              </div>
                            )}
                            {item.description && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-0.5">Descrição:</p>
                                <p className="text-xs text-foreground">{item.description}</p>
                              </div>
                            )}
                            {renderRefsSection(item)}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
