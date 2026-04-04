'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingUp, Plus, Pencil, Trash2, X, Download, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { MODELOS, getWhoData, interpolateWho, labelEixoY } from '@/lib/who-data'
import type { CrescimentoMedicao, CrescimentoModelo } from '@/types'

interface Props {
  medicoes: CrescimentoMedicao[]
  prontuarioId: string
  nascimento: string | null
  bloqueado?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────

function idadeEmMeses(nascimento: string, dataStr: string): number {
  const nasc = new Date(nascimento)
  const data = new Date(dataStr)
  return (data.getFullYear() - nasc.getFullYear()) * 12 +
    (data.getMonth() - nasc.getMonth()) +
    (data.getDate() >= nasc.getDate() ? 0 : -1)
}

function idadeEmSemanas(nascimento: string, dataStr: string): number {
  const nasc = new Date(nascimento)
  const data = new Date(dataStr)
  return Math.floor((data.getTime() - nasc.getTime()) / (7 * 24 * 60 * 60 * 1000))
}

function calcImc(peso: number | null, altura: number | null): number | null {
  if (!peso || !altura || altura <= 0) return null
  return peso / Math.pow(altura / 100, 2)
}

type ChartPoint = {
  x: number
  sd3n?: number; sd2n?: number; sd1n?: number; sd0?: number
  sd1p?: number; sd2p?: number; sd3p?: number
  paciente?: number
}

function buildChartData(
  modelo: CrescimentoModelo,
  medicoes: CrescimentoMedicao[],
  nascimento: string | null,
): ChartPoint[] {
  const whoData = getWhoData(modelo.key)
  const points: Record<number, ChartPoint> = {}

  // WHO reference lines
  for (const row of whoData) {
    points[row.x] = {
      x: row.x,
      sd3n: row.sd3n, sd2n: row.sd2n, sd1n: row.sd1n, sd0: row.sd0,
      sd1p: row.sd1p, sd2p: row.sd2p, sd3p: row.sd3p,
    }
  }

  // Patient measurements
  if (nascimento) {
    for (const m of medicoes) {
      const x = modelo.preterm
        ? (m.idade_gestacional_semanas ?? idadeEmSemanas(nascimento, m.data))
        : idadeEmMeses(nascimento, m.data)

      if (x < 0 || x > modelo.xMax) continue

      let valor: number | null = null
      if (modelo.medida === 'peso') valor = m.peso_kg
      else if (modelo.medida === 'comprimento') valor = m.altura_cm
      else if (modelo.medida === 'pc') valor = m.perimetro_cefalico_cm
      else if (modelo.medida === 'imc') valor = calcImc(m.peso_kg, m.altura_cm)

      if (valor === null) continue

      // Find closest WHO x to snap the patient point
      let closest = whoData[0]?.x ?? x
      let minDiff = Infinity
      for (const row of whoData) {
        const diff = Math.abs(row.x - x)
        if (diff < minDiff) { minDiff = diff; closest = row.x }
      }

      // Use exact x for patient so we can have intermediate points
      if (!points[x]) {
        // Interpolate WHO lines at this x
        const interp = interpolateWho(whoData, x)
        if (interp) {
          points[x] = { x, sd3n: interp.sd3n, sd2n: interp.sd2n, sd1n: interp.sd1n, sd0: interp.sd0, sd1p: interp.sd1p, sd2p: interp.sd2p, sd3p: interp.sd3p }
        } else {
          points[x] = { x }
        }
      }
      points[x].paciente = Math.round(valor * 100) / 100
    }
  }

  return Object.values(points).sort((a, b) => a.x - b.x)
}

// ─── Cores WHO ────────────────────────────────────────────────

const WHO_LINES = [
  { key: 'sd3n', color: '#ef4444', dash: '4 2', label: '-3 DP' },
  { key: 'sd2n', color: '#f97316', dash: '4 2', label: '-2 DP' },
  { key: 'sd1n', color: '#eab308', dash: '4 2', label: '-1 DP' },
  { key: 'sd0',  color: '#22c55e', dash: '',    label: 'Mediana' },
  { key: 'sd1p', color: '#eab308', dash: '4 2', label: '+1 DP' },
  { key: 'sd2p', color: '#f97316', dash: '4 2', label: '+2 DP' },
  { key: 'sd3p', color: '#ef4444', dash: '4 2', label: '+3 DP' },
]

// ─── Componente ───────────────────────────────────────────────

const EMPTY_FORM = {
  data: new Date().toISOString().slice(0, 10),
  peso_kg: '',
  altura_cm: '',
  perimetro_cefalico_cm: '',
  idade_gestacional_semanas: '',
}

export default function CurvaCrescimento({ medicoes: initialMedicoes, prontuarioId, nascimento, bloqueado = false }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()
  const chartRef = useRef<HTMLDivElement>(null)

  const [medicoes, setMedicoes] = useState<CrescimentoMedicao[]>(initialMedicoes)
  const [modeloKey, setModeloKey] = useState(MODELOS[0].key)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const modelo = MODELOS.find(m => m.key === modeloKey) ?? MODELOS[0]
  const chartData = buildChartData(modelo, medicoes, nascimento)
  const imc = calcImc(
    form.peso_kg ? parseFloat(form.peso_kg) : null,
    form.altura_cm ? parseFloat(form.altura_cm) : null,
  )

  // ── Salvar medição ─────────────────────────────────────────

  async function handleSalvar() {
    if (!form.data) { setError('Data é obrigatória'); return }
    setSaving(true); setError(null)

    const payload = {
      prontuario_id: prontuarioId,
      data: form.data,
      peso_kg: form.peso_kg ? parseFloat(form.peso_kg) : null,
      altura_cm: form.altura_cm ? parseFloat(form.altura_cm) : null,
      perimetro_cefalico_cm: form.perimetro_cefalico_cm ? parseFloat(form.perimetro_cefalico_cm) : null,
      idade_gestacional_semanas: form.idade_gestacional_semanas ? parseInt(form.idade_gestacional_semanas) : null,
    }

    let result
    if (editingId) {
      result = await supabase
        .from('crescimento_medicoes')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single()
    } else {
      result = await supabase
        .from('crescimento_medicoes')
        .insert(payload)
        .select()
        .single()
    }

    setSaving(false)
    if (result.error) { setError(result.error.message); return }

    if (editingId) {
      setMedicoes(prev => prev.map(m => m.id === editingId ? result.data as CrescimentoMedicao : m))
    } else {
      setMedicoes(prev => [...prev, result.data as CrescimentoMedicao].sort((a, b) => a.data.localeCompare(b.data)))
    }
    setForm(EMPTY_FORM); setEditingId(null); setShowForm(false)
  }

  // ── Excluir medição ────────────────────────────────────────

  async function handleExcluir(id: string) {
    if (!confirm('Excluir esta medição?')) return
    const { error } = await supabase.from('crescimento_medicoes').delete().eq('id', id)
    if (error) { alert(error.message); return }
    setMedicoes(prev => prev.filter(m => m.id !== id))
  }

  // ── Editar medição ─────────────────────────────────────────

  function handleEditar(m: CrescimentoMedicao) {
    setForm({
      data: m.data,
      peso_kg: m.peso_kg?.toString() ?? '',
      altura_cm: m.altura_cm?.toString() ?? '',
      perimetro_cefalico_cm: m.perimetro_cefalico_cm?.toString() ?? '',
      idade_gestacional_semanas: m.idade_gestacional_semanas?.toString() ?? '',
    })
    setEditingId(m.id)
    setShowForm(true)
  }

  // ── Exportar PDF ───────────────────────────────────────────

  async function handleExportarPDF() {
    if (!chartRef.current) return
    setExporting(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { default: jsPDF } = await import('jspdf')
      const canvas = await html2canvas(chartRef.current, { scale: 2, useCORS: true })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pw = pdf.internal.pageSize.getWidth()
      const ph = pdf.internal.pageSize.getHeight()
      pdf.setFontSize(14)
      pdf.text(`Curva de Crescimento — ${modelo.label}`, 14, 14)
      pdf.addImage(imgData, 'PNG', 14, 20, pw - 28, ph - 30)
      pdf.save(`curva-crescimento-${modeloKey}.pdf`)
    } catch (e) {
      alert('Erro ao exportar PDF')
    } finally {
      setExporting(false)
    }
  }

  // ── Label eixo X ───────────────────────────────────────────

  const labelX = modelo.preterm ? 'Semanas de IG' : 'Meses de idade'
  const labelY = labelEixoY(modelo.medida)

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Controles superiores */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <TrendingUp className="w-5 h-5 text-brand-600 shrink-0" />
            <div className="relative">
              <select
                value={modeloKey}
                onChange={e => setModeloKey(e.target.value)}
                className="appearance-none border border-slate-200 rounded-lg px-3 py-1.5 pr-8 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 cursor-pointer"
              >
                <optgroup label="Menino — Cronológico">
                  {MODELOS.filter(m => m.sexo === 'menino' && !m.preterm).map(m => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Menina — Cronológica">
                  {MODELOS.filter(m => m.sexo === 'menina' && !m.preterm).map(m => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Menino — Pré-termo">
                  {MODELOS.filter(m => m.sexo === 'menino' && m.preterm).map(m => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Menina — Pré-termo">
                  {MODELOS.filter(m => m.sexo === 'menina' && m.preterm).map(m => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </optgroup>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2 top-2 pointer-events-none text-slate-400" />
            </div>
          </div>
          <button
            onClick={handleExportarPDF}
            disabled={exporting}
            className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exportando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {/* Gráfico */}
      <div className="card" ref={chartRef}>
        <p className="text-xs text-slate-400 mb-3 text-right">{modelo.label} — WHO/INTERGROWTH-21st</p>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 25, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[0, modelo.xMax]}
              label={{ value: labelX, position: 'insideBottom', offset: -10, fontSize: 11, fill: '#94a3b8' }}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
            />
            <YAxis
              label={{ value: labelY, angle: -90, position: 'insideLeft', offset: 15, fontSize: 11, fill: '#94a3b8' }}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              width={45}
            />
            <Tooltip
              formatter={(value: any, name: string) => {
                const labels: Record<string, string> = {
                  sd3n: '-3 DP', sd2n: '-2 DP', sd1n: '-1 DP',
                  sd0: 'Mediana', sd1p: '+1 DP', sd2p: '+2 DP', sd3p: '+3 DP',
                  paciente: 'Paciente',
                }
                return [value, labels[name] ?? name]
              }}
              contentStyle={{ fontSize: 12 }}
            />
            {WHO_LINES.map(({ key, color, dash }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={key === 'sd0' ? 2 : 1}
                strokeDasharray={dash || undefined}
                dot={false}
                isAnimationActive={false}
                legendType="none"
              />
            ))}
            <Line
              type="monotone"
              dataKey="paciente"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 5, fill: '#3b82f6', strokeWidth: 0 }}
              activeDot={{ r: 7 }}
              connectNulls={false}
              isAnimationActive={false}
              name="Paciente"
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Legenda manual */}
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {WHO_LINES.map(({ key, color, label }) => (
            <span key={key} className="flex items-center gap-1 text-[11px] text-slate-500">
              <span className="inline-block w-5 h-0.5 rounded" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" />
            Paciente
          </span>
        </div>
      </div>

      {/* Cabeçalho da tabela + botão */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Medições registradas</h3>
        {!bloqueado && (
          <button
            onClick={() => { setShowForm(v => !v); setEditingId(null); setForm(EMPTY_FORM) }}
            className="flex items-center gap-1.5 text-sm bg-brand-600 text-white rounded-lg px-3 py-1.5 hover:bg-brand-700 transition"
          >
            <Plus className="w-4 h-4" />
            Nova medição
          </button>
        )}
      </div>

      {/* Formulário colapsável */}
      {showForm && (
        <div className="card border border-brand-100 bg-brand-50/30 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">{editingId ? 'Editar medição' : 'Nova medição'}</p>
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }}>
              <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Data *</label>
              <input
                type="date"
                value={form.data}
                onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label">Peso (kg)</label>
              <input
                type="number" step="0.001" min="0"
                placeholder="3.500"
                value={form.peso_kg}
                onChange={e => setForm(p => ({ ...p, peso_kg: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label">Comprimento/Altura (cm)</label>
              <input
                type="number" step="0.1" min="0"
                placeholder="50.0"
                value={form.altura_cm}
                onChange={e => setForm(p => ({ ...p, altura_cm: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label">Perímetro Cefálico (cm)</label>
              <input
                type="number" step="0.1" min="0"
                placeholder="34.0"
                value={form.perimetro_cefalico_cm}
                onChange={e => setForm(p => ({ ...p, perimetro_cefalico_cm: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label">Idade Gestacional (sem.)</label>
              <input
                type="number" step="1" min="22" max="50"
                placeholder="40"
                value={form.idade_gestacional_semanas}
                onChange={e => setForm(p => ({ ...p, idade_gestacional_semanas: e.target.value }))}
                className="input"
              />
            </div>
            {imc !== null && (
              <div className="flex flex-col justify-end">
                <label className="label">IMC calculado</label>
                <p className="input bg-slate-50 text-slate-600 flex items-center">{imc.toFixed(1)} kg/m²</p>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSalvar}
              disabled={saving}
              className="btn-primary text-sm px-4 py-1.5"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }}
              className="btn-secondary text-sm px-4 py-1.5"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabela histórica */}
      {medicoes.length === 0 ? (
        <div className="card text-center py-10">
          <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Nenhuma medição registrada.</p>
          <p className="text-xs text-slate-400 mt-1">Clique em "Nova medição" para começar.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Peso (kg)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Comp./Alt. (cm)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">PC (cm)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">IG (sem)</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">IMC</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {[...medicoes].sort((a, b) => b.data.localeCompare(a.data)).map(m => {
                const imcVal = calcImc(m.peso_kg, m.altura_cm)
                return (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 text-slate-700">
                      {new Date(m.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{m.peso_kg ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{m.altura_cm ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{m.perimetro_cefalico_cm ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{m.idade_gestacional_semanas ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{imcVal ? imcVal.toFixed(1) : '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      {!bloqueado && (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleEditar(m)} className="text-slate-400 hover:text-brand-600 transition">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleExcluir(m.id)} className="text-slate-400 hover:text-red-500 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
