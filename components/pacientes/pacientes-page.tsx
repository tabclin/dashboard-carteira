'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  UserRound, Plus, Search, Pencil, Trash2, X, ChevronDown,
  Phone, Mail, FileText, Calendar, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Patient {
  id:          string
  name:        string
  birthDate:   string | null
  sex:         string | null
  email:       string | null
  phone:       string | null
  notes:       string | null
  clinikpiId:  string | null
  createdAt:   string
  _count:      { analyses: number }
}

interface FormData {
  name:      string
  birthDate: string
  sex:       string
  email:     string
  phone:     string
  notes:     string
}

const EMPTY_FORM: FormData = { name: '', birthDate: '', sex: '', email: '', phone: '', notes: '' }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcAge(birthDate: string): string {
  const birth = new Date(birthDate)
  if (isNaN(birth.getTime())) return '—'
  const now    = new Date()
  let years    = now.getFullYear() - birth.getFullYear()
  let months   = now.getMonth()    - birth.getMonth()
  if (months < 0) { years--; months += 12 }
  if (now.getDate() < birth.getDate()) months = Math.max(0, months - 1)
  if (years === 0) return `${months} ${months === 1 ? 'mês' : 'meses'}`
  if (months === 0) return `${years} ${years === 1 ? 'ano' : 'anos'}`
  return `${years}a ${months}m`
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

function sexLabel(s: string | null) {
  if (s === 'M') return { label: 'Masc',    cls: 'bg-blue-100 text-blue-700'  }
  if (s === 'F') return { label: 'Fem',     cls: 'bg-rose-100 text-rose-700'  }
  return              { label: 'N/inf',    cls: 'bg-slate-100 text-slate-500' }
}

// ─── Modal de Formulário ──────────────────────────────────────────────────────

function PatientModal({
  mode, initial, onClose, onSaved,
}: {
  mode:    'add' | 'edit'
  initial: Partial<FormData> & { id?: string }
  onClose: () => void
  onSaved: (p: Patient) => void
}) {
  const [form,    setForm]    = useState<FormData>({ ...EMPTY_FORM, ...initial })
  const [saving,  setSaving]  = useState(false)
  const [dupWarn, setDupWarn] = useState<string | null>(null)
  const [errors,  setErrors]  = useState<Partial<FormData>>({})

  function setField(k: keyof FormData, v: string) {
    setForm(p => ({ ...p, [k]: v }))
    setErrors(p => ({ ...p, [k]: '' }))
    setDupWarn(null)
  }

  async function handleSubmit() {
    if (!form.name.trim() || form.name.trim().length < 2) {
      setErrors({ name: 'Nome deve ter ao menos 2 caracteres.' }); return
    }

    setSaving(true)
    try {
      const url    = mode === 'add' ? '/api/pacientes' : `/api/pacientes/${initial.id}`
      const method = mode === 'add' ? 'POST' : 'PATCH'

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:      form.name.trim(),
          birthDate: form.birthDate || null,
          sex:       form.sex || null,
          email:     form.email.trim() || null,
          phone:     form.phone.trim() || null,
          notes:     form.notes.trim() || null,
        }),
      })

      if (res.status === 409) {
        const data = await res.json()
        if (data.error === 'duplicate') {
          setDupWarn(`Já existe um paciente com nome similar: "${data.existingName}"`)
          return
        }
      }

      if (!res.ok) throw new Error(await res.text())
      const patient = await res.json()
      toast.success(mode === 'add' ? 'Paciente cadastrado com sucesso!' : 'Paciente atualizado!')
      onSaved(patient)
    } catch (e) {
      console.error(e)
      toast.error('Erro ao salvar paciente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <UserRound className="w-4 h-4 text-brand-500" />
            {mode === 'add' ? 'Novo Paciente' : 'Editar Paciente'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Aviso de duplicata */}
          {dupWarn && (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {dupWarn}
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Nome completo <span className="text-red-400">*</span>
            </label>
            <input
              type="text" placeholder="Ex: Maria da Silva"
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ${
                errors.name ? 'border-red-300' : 'border-slate-200'
              }`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Nascimento + Sexo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Data de Nascimento
              </label>
              <input
                type="date"
                value={form.birthDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => setField('birthDate', e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {form.birthDate && (
                <p className="text-xs text-slate-400 mt-1">{calcAge(form.birthDate)}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Sexo</label>
              <div className="relative">
                <select
                  value={form.sex}
                  onChange={e => setField('sex', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none pr-8"
                >
                  <option value="">Não informado</option>
                  <option value="F">Feminino</option>
                  <option value="M">Masculino</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Email + Telefone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                <Mail className="w-3 h-3" /> E-mail
              </label>
              <input
                type="email" placeholder="exemplo@email.com"
                value={form.email}
                onChange={e => setField('email', e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                <Phone className="w-3 h-3" /> Telefone
              </label>
              <input
                type="tel" placeholder="(11) 99999-9999"
                value={form.phone}
                onChange={e => setField('phone', e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Observações
            </label>
            <textarea
              rows={3} placeholder="Diagnóstico, alergias, observações clínicas…"
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando…' : mode === 'add' ? 'Cadastrar' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de Confirmação de Exclusão ─────────────────────────────────────────

function DeleteModal({
  patient, onClose, onDeleted,
}: {
  patient:   Patient
  onClose:   () => void
  onDeleted: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/pacientes/${patient.id}`, { method: 'DELETE' })
      if (res.status === 409) {
        const data = await res.json()
        toast.error(`Não é possível excluir: paciente possui ${data.count} análise(s) vinculada(s).`)
        onClose()
        return
      }
      if (!res.ok) throw new Error()
      toast.success('Paciente removido.')
      onDeleted(patient.id)
    } catch {
      toast.error('Erro ao remover paciente.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Remover paciente</h3>
            <p className="text-sm text-slate-500 mt-1">
              Tem certeza que deseja remover <strong>{patient.name}</strong>?
              Esta ação não pode ser desfeita.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {deleting ? 'Removendo…' : 'Remover'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function PacientesPage() {
  const [patients,  setPatients]  = useState<Patient[]>([])
  const [filtered,  setFiltered]  = useState<Patient[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [modal,     setModal]     = useState<'add' | 'edit' | null>(null)
  const [editing,   setEditing]   = useState<Patient | null>(null)
  const [deleting,  setDeleting]  = useState<Patient | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/pacientes')
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      setPatients(list)
      setFiltered(list)
    } catch {
      toast.error('Erro ao carregar pacientes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!search.trim()) { setFiltered(patients); return }
    const q = search.toLowerCase()
    setFiltered(patients.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.includes(q)
    ))
  }, [search, patients])

  function openEdit(p: Patient) {
    setEditing(p)
    setModal('edit')
  }

  function handleSaved(saved: Patient) {
    setPatients(prev => {
      const idx = prev.findIndex(p => p.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], ...saved }
        return next.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      }
      return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    })
    setModal(null)
    setEditing(null)
  }

  function handleDeleted(id: string) {
    setPatients(prev => prev.filter(p => p.id !== id))
    setDeleting(null)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou telefone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent shadow-sm"
          />
        </div>
        <button
          onClick={() => setModal('add')}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Novo Paciente
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {loading ? 'Carregando…' : `${filtered.length} ${filtered.length === 1 ? 'paciente' : 'pacientes'}`}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            Carregando pacientes…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UserRound className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-500">
              {search ? 'Nenhum paciente encontrado para esta busca.' : 'Nenhum paciente cadastrado ainda.'}
            </p>
            {!search && (
              <button
                onClick={() => setModal('add')}
                className="mt-3 text-sm text-brand-500 hover:underline font-medium"
              >
                Cadastrar primeiro paciente
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(p => {
              const sex = sexLabel(p.sex)
              return (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors group">

                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-sm ${
                    p.sex === 'M' ? 'bg-blue-100 text-blue-600' :
                    p.sex === 'F' ? 'bg-rose-100 text-rose-600' :
                                    'bg-slate-100 text-slate-500'
                  }`}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Nome + dados */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sex.cls}`}>
                        {sex.label}
                      </span>
                      {p._count.analyses > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 font-medium">
                          {p._count.analyses} {p._count.analyses === 1 ? 'análise' : 'análises'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {p.birthDate && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {fmtDate(p.birthDate)} · {calcAge(p.birthDate)}
                        </span>
                      )}
                      {p.email && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {p.email}
                        </span>
                      )}
                      {p.phone && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {p.phone}
                        </span>
                      )}
                      {!p.birthDate && !p.email && !p.phone && (
                        <span className="text-xs text-slate-300 italic">Sem dados de contato</span>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(p)}
                      title="Editar"
                      className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleting(p)}
                      title="Remover"
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modais */}
      {modal === 'add' && (
        <PatientModal
          mode="add"
          initial={EMPTY_FORM}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {modal === 'edit' && editing && (
        <PatientModal
          mode="edit"
          initial={{
            id:        editing.id,
            name:      editing.name,
            birthDate: editing.birthDate ? editing.birthDate.split('T')[0] : '',
            sex:       editing.sex    ?? '',
            email:     editing.email  ?? '',
            phone:     editing.phone  ?? '',
            notes:     editing.notes  ?? '',
          }}
          onClose={() => { setModal(null); setEditing(null) }}
          onSaved={handleSaved}
        />
      )}

      {deleting && (
        <DeleteModal
          patient={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
