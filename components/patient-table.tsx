'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/status-badge'
import { formatarData, formatarRecencia, cn } from '@/lib/utils'
import { calcRetornoIdeal, calcStatus } from '@/lib/carteira-config'
import type { Paciente, StatusPaciente, ConfigRetornoFaixa } from '@/types'
import {
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  Calendar, X, CheckCircle2, Loader2,
  Phone, MapPin, Mail, CreditCard, RotateCcw, FileText,
} from 'lucide-react'

type SortField = 'paciente' | 'ultimo_atendimento' | 'qtd_at' | 'recencia_dias' | 'status'
type SortDir = 'asc' | 'desc'

interface PatientTableProps {
  pacientes: Paciente[]
  nomesComPlano?: Set<string>
  config?: ConfigRetornoFaixa[]
}

interface DetalhesExtra {
  telefone?: string | null
  email?: string | null
  cidade?: string | null
  cpf?: string | null
}

type PacienteComDetalhes = Paciente & DetalhesExtra

// ── Helpers ──────────────────────────────────────────────────────

function calcularIdade(nascimento: string | null): string {
  if (!nascimento) return ''
  const nasc = new Date(nascimento + 'T12:00:00')
  const hoje = new Date()
  const mesesTotal =
    (hoje.getFullYear() - nasc.getFullYear()) * 12 +
    (hoje.getMonth() - nasc.getMonth())
  if (mesesTotal < 0) return ''
  if (mesesTotal < 24) return `${mesesTotal} ${mesesTotal === 1 ? 'mês' : 'meses'}`
  const anos = Math.floor(mesesTotal / 12)
  const meses = mesesTotal % 12
  if (meses === 0) return `${anos} ${anos === 1 ? 'ano' : 'anos'}`
  return `${anos}a ${meses}m`
}

// Atualiza a linha em `pacientes`; se ela não existir, insere.
// Necessário porque nem todo paciente da carteira (view de atendimentos)
// tem obrigatoriamente uma linha na tabela `pacientes`.
async function upsertPaciente(
  supabase: ReturnType<typeof createClient>,
  nome: string,
  nascimento: string | null,
  updates: Record<string, unknown>
): Promise<{ error: any }> {
  // 1) Tenta UPDATE e pede de volta os IDs afetados
  let q = (supabase.from('pacientes') as any).update(updates).eq('paciente', nome)
  if (nascimento) q = q.eq('nascimento', nascimento)
  else            q = q.is('nascimento', null)

  const { data: updated, error: updateError } = await q.select('id')
  if (updateError) return { error: updateError }

  // 2) Nenhuma linha atualizada → cria a linha
  if (!updated || updated.length === 0) {
    const { error: insertError } = await (supabase.from('pacientes') as any).insert({
      paciente: nome,
      nascimento,
      ...updates,
    })
    return { error: insertError }
  }

  return { error: null }
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm text-slate-700 font-medium truncate">{value || '—'}</p>
      </div>
    </div>
  )
}

function InfoBadge({ label, cor }: { label: string; cor: 'blue' | 'amber' | 'slate' }) {
  const cls = {
    blue:  'bg-brand-50 text-brand-700 border-brand-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    slate: 'bg-slate-100 text-slate-400 border-slate-200',
  }[cor]
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border leading-none', cls)}>
      {label}
    </span>
  )
}

function ToggleSwitch({ ativo, onChange, disabled }: { ativo: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200',
        ativo ? 'bg-emerald-500' : 'bg-slate-300',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
    >
      <span className={cn(
        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
        ativo ? 'translate-x-6' : 'translate-x-1'
      )} />
    </button>
  )
}

// ── Componente principal ──────────────────────────────────────────

export default function PatientTable({
  pacientes,
  nomesComPlano = new Set(),
  config = [],
}: PatientTableProps) {
  const [pacientesLocal, setPacientesLocal] = useState<Paciente[]>(pacientes)
  useEffect(() => { setPacientesLocal(pacientes) }, [pacientes])

  const [filtroStatus, setFiltroStatus] = useState<StatusPaciente | 'Todos'>('Todos')
  const [busca, setBusca]               = useState('')
  const [sortField, setSortField]       = useState<SortField>('recencia_dias')
  const [sortDir, setSortDir]           = useState<SortDir>('desc')
  const [paginaAtual, setPaginaAtual]   = useState(1)

  // Modal de detalhes
  const [detalhePaciente, setDetalhePaciente]   = useState<PacienteComDetalhes | null>(null)
  const [loadingDetalhes, setLoadingDetalhes]   = useState(false)
  const [detalheObsTexto, setDetalheObsTexto]   = useState('')
  const [salvandoDetalhe, setSalvandoDetalhe]   = useState(false)
  const [mensagemDetalhe, setMensagemDetalhe]   = useState('')

  const [customRetornoInput, setCustomRetornoInput] = useState('')
  const [salvandoRetorno, setSalvandoRetorno]       = useState(false)
  const [mensagemRetorno, setMensagemRetorno]       = useState('')

  const [salvandoAtivo, setSalvandoAtivo]   = useState(false)
  const [erroAtivo, setErroAtivo]           = useState<string | null>(null)

  const POR_PAGINA = 20

  // ── Contadores ────────────────────────────────────────────────

  const contadores = useMemo(() => ({
    total:   pacientesLocal.length,
    ok:      pacientesLocal.filter(p => p.status === 'Ok').length,
    atencao: pacientesLocal.filter(p => p.status === 'Atenção').length,
    perigo:  pacientesLocal.filter(p => p.status === 'Perigo').length,
  }), [pacientesLocal])

  const pct = (n: number) =>
    contadores.total > 0 ? `${Math.round((n / contadores.total) * 100)}%` : '—'

  // ── Filtrar + ordenar ─────────────────────────────────────────

  const dadosFiltrados = useMemo(() => {
    let lista = [...pacientesLocal]

    if (busca.trim()) {
      const q = busca.toLowerCase()
      lista = lista.filter(p => p.paciente?.toLowerCase().includes(q))
    }
    if (filtroStatus !== 'Todos') {
      lista = lista.filter(p => p.status === filtroStatus)
    }

    const statusOrdem: Record<StatusPaciente, number> = { Perigo: 0, Atenção: 1, Ok: 2 }
    lista.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'paciente':           cmp = (a.paciente ?? '').localeCompare(b.paciente ?? '', 'pt-BR'); break
        case 'ultimo_atendimento': cmp = (a.ultimo_atendimento ?? '').localeCompare(b.ultimo_atendimento ?? ''); break
        case 'qtd_at':             cmp = (a.qtd_at ?? 0) - (b.qtd_at ?? 0); break
        case 'recencia_dias':      cmp = (a.recencia_dias ?? 9999) - (b.recencia_dias ?? 9999); break
        case 'status':             cmp = (statusOrdem[a.status] ?? 9) - (statusOrdem[b.status] ?? 9); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return lista
  }, [pacientesLocal, busca, filtroStatus, sortField, sortDir])

  const totalPaginas = Math.ceil(dadosFiltrados.length / POR_PAGINA)
  const dadosPagina  = dadosFiltrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPaginaAtual(1)
  }

  function handleFiltro(v: StatusPaciente | 'Todos') {
    setFiltroStatus(v)
    setPaginaAtual(1)
  }

  // ── Modal de detalhes ─────────────────────────────────────────

  async function abrirDetalhes(p: Paciente) {
    setDetalhePaciente({ ...p })
    setDetalheObsTexto(p.observacao ?? '')
    setCustomRetornoInput(p.retorno_custom_dias != null ? String(p.retorno_custom_dias) : '')
    setMensagemDetalhe('')
    setMensagemRetorno('')
    setErroAtivo(null)
    setLoadingDetalhes(true)

    const supabase = createClient()
    let query = (supabase.from('pacientes') as any).select('*').eq('paciente', p.paciente)
    if (p.nascimento) query = query.eq('nascimento', p.nascimento)
    const { data } = await query.limit(1)
    const row = Array.isArray(data) ? data[0] : null
    setDetalhePaciente(prev => prev ? { ...prev, ...(row ?? {}) } : null)
    setLoadingDetalhes(false)
  }

  async function salvarObservacaoDetalhe() {
    if (!detalhePaciente) return
    setSalvandoDetalhe(true)
    setMensagemDetalhe('')
    const supabase = createClient()
    const { error } = await supabase
      .from('observacoes')
      .upsert({ paciente: detalhePaciente.paciente, observacao: detalheObsTexto }, { onConflict: 'paciente' })
    setSalvandoDetalhe(false)
    if (error) setMensagemDetalhe('Erro ao salvar.')
    else { setMensagemDetalhe('Salvo!'); detalhePaciente.observacao = detalheObsTexto }
  }

  // ── Override retorno ──────────────────────────────────────────

  async function salvarRetornoCustom(limpar = false) {
    if (!detalhePaciente) return
    setSalvandoRetorno(true)
    setMensagemRetorno('')

    const novoValor = limpar ? null : (parseInt(customRetornoInput) || null)
    const supabase  = createClient()
    const { error } = await upsertPaciente(
      supabase, detalhePaciente.paciente, detalhePaciente.nascimento,
      { retorno_custom_dias: novoValor }
    )

    setSalvandoRetorno(false)
    if (error) { setMensagemRetorno('Erro ao salvar.'); return }

    if (limpar) setCustomRetornoInput('')
    const novoRetorno = calcRetornoIdeal(detalhePaciente.idade_dias, config, novoValor)
    const novoStatus  = calcStatus(detalhePaciente.recencia_dias, novoRetorno)

    setDetalhePaciente(prev => prev ? { ...prev, retorno_custom_dias: novoValor, retorno_ideal_dias: novoRetorno, status: novoStatus } : null)
    setPacientesLocal(prev => prev.map(p =>
      p.paciente === detalhePaciente.paciente && p.nascimento === detalhePaciente.nascimento
        ? { ...p, retorno_custom_dias: novoValor, retorno_ideal_dias: novoRetorno, status: novoStatus }
        : p
    ))
    setMensagemRetorno(limpar ? 'Voltou para a regra padrão.' : 'Intervalo personalizado salvo!')
  }

  // ── Ativo / Inativo ───────────────────────────────────────────

  async function toggleAtivo() {
    if (!detalhePaciente) return
    const novoAtivo = !(detalhePaciente.ativo ?? true)
    setSalvandoAtivo(true)
    setErroAtivo(null)

    try {
      const supabase  = createClient()
      const { error } = await upsertPaciente(
        supabase, detalhePaciente.paciente, detalhePaciente.nascimento,
        { ativo: novoAtivo }
      )

      if (error) {
        setErroAtivo(
          error.message?.includes('column') || error.message?.includes('coluna')
            ? 'Execute o script CARTEIRA_ATIVO.sql no Supabase para ativar esta função.'
            : `Erro ao salvar: ${error.message}`
        )
        return
      }

      // Se desativado: remove da lista local e fecha o modal
      if (!novoAtivo) {
        setPacientesLocal(prev => prev.filter(p =>
          !(p.paciente === detalhePaciente.paciente && p.nascimento === detalhePaciente.nascimento)
        ))
        setDetalhePaciente(null)
      } else {
        setDetalhePaciente(prev => prev ? { ...prev, ativo: novoAtivo } : null)
        setPacientesLocal(prev => prev.map(p =>
          p.paciente === detalhePaciente.paciente && p.nascimento === detalhePaciente.nascimento
            ? { ...p, ativo: novoAtivo }
            : p
        ))
      }
    } finally {
      setSalvandoAtivo(false)
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 text-slate-400" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-brand-500" />
      : <ChevronDown className="w-3 h-3 text-brand-500" />
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* KPI cards — clicáveis como filtro */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          {
            key: 'Todos',   label: 'Total',   valor: contadores.total, pct: null,
            cls: 'border-brand-500 text-brand-700 bg-brand-50',
            ring: 'ring-brand-400',
          },
          {
            key: 'Ok',      label: 'Ok',      valor: contadores.ok,      pct: pct(contadores.ok),
            cls: 'border-emerald-500 text-emerald-700 bg-emerald-50',
            ring: 'ring-emerald-400',
          },
          {
            key: 'Atenção', label: 'Atenção', valor: contadores.atencao, pct: pct(contadores.atencao),
            cls: 'border-amber-500 text-amber-700 bg-amber-50',
            ring: 'ring-amber-400',
          },
          {
            key: 'Perigo',  label: 'Perigo',  valor: contadores.perigo,  pct: pct(contadores.perigo),
            cls: 'border-red-500 text-red-700 bg-red-50',
            ring: 'ring-red-400',
          },
        ] as const).map(item => (
          <button
            key={item.key}
            onClick={() => handleFiltro(item.key as StatusPaciente | 'Todos')}
            className={cn(
              'rounded-xl border-l-4 px-4 py-3 text-left transition-all duration-150 w-full',
              item.cls,
              filtroStatus === item.key
                ? `ring-2 ring-offset-1 shadow-md ${item.ring}`
                : 'opacity-70 hover:opacity-90 hover:shadow-sm'
            )}
          >
            <p className="text-xs font-medium opacity-70">{item.label}</p>
            <div className="flex items-end gap-2 mt-0.5">
              <p className="text-2xl font-bold leading-none">{item.valor}</p>
              {item.pct && (
                <p className="text-sm font-semibold opacity-50 mb-0.5">{item.pct}</p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={busca}
          onChange={e => { setBusca(e.target.value); setPaginaAtual(1) }}
          placeholder="Buscar paciente por nome..."
          className="input pl-9 pr-9"
        />
        {busca && (
          <button onClick={() => { setBusca(''); setPaginaAtual(1) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Info contagem */}
      <p className="text-xs text-slate-500 -mt-1">
        {dadosFiltrados.length === pacientesLocal.length
          ? `${pacientesLocal.length} pacientes`
          : `${dadosFiltrados.length} de ${pacientesLocal.length} pacientes`}
        {filtroStatus !== 'Todos' && (
          <button onClick={() => handleFiltro('Todos')} className="ml-2 text-brand-500 hover:underline">
            limpar filtro
          </button>
        )}
      </p>

      {/* Tabela */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {([
                  { field: 'paciente',           label: 'Paciente'      },
                  { field: 'ultimo_atendimento', label: 'Último Atend.' },
                  { field: 'qtd_at',             label: 'Consultas'     },
                  { field: 'recencia_dias',      label: 'Recência'      },
                  { field: 'status',             label: 'Status'        },
                ] as { field: SortField; label: string }[]).map(col => (
                  <th key={col.field} className="table-th">
                    <button onClick={() => handleSort(col.field)} className="flex items-center gap-1 hover:text-slate-700 transition-colors">
                      {col.label} <SortIcon field={col.field} />
                    </button>
                  </th>
                ))}
                <th className="table-th">Agendado</th>
                <th className="table-th">Informações</th>
              </tr>
            </thead>
            <tbody>
              {dadosPagina.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 text-sm">
                    Nenhum paciente encontrado.
                  </td>
                </tr>
              ) : (
                dadosPagina.map((p, i) => {
                  const temPlano  = nomesComPlano.has(`${p.paciente}|${p.nascimento ?? ''}`)
                  const temManual = p.retorno_custom_dias != null

                  return (
                    <tr key={`${p.paciente}-${i}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="table-td">
                        <div>
                          <button
                            onClick={() => abrirDetalhes(p)}
                            className="font-medium text-brand-600 hover:text-brand-700 hover:underline text-left transition-colors leading-snug"
                          >
                            {p.paciente ?? '—'}
                          </button>
                          {p.nascimento && (
                            <p className="text-xs text-slate-400 mt-0.5 leading-none">{calcularIdade(p.nascimento)}</p>
                          )}
                        </div>
                      </td>

                      <td className="table-td text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-300" />
                          {formatarData(p.ultimo_atendimento)}
                        </div>
                        {p.origem_ultimo_atend && (
                          <p className="text-[10px] text-slate-300 mt-0.5 leading-none pl-0.5">
                            {p.origem_ultimo_atend === 'agenda' ? 'agenda' : 'import'}
                          </p>
                        )}
                      </td>

                      <td className="table-td">
                        <span className="inline-flex items-center justify-center w-7 h-7 bg-brand-50 text-brand-700 text-xs font-bold rounded-full">
                          {p.qtd_at ?? 0}
                        </span>
                      </td>

                      <td className="table-td">
                        <span className={cn(
                          'text-xs font-medium',
                          (p.recencia_dias ?? 0) > 180 ? 'text-red-600' :
                          (p.recencia_dias ?? 0) > 90  ? 'text-amber-600' : 'text-slate-600'
                        )}>
                          {formatarRecencia(p.recencia_dias)}
                        </span>
                      </td>

                      <td className="table-td">
                        <StatusBadge status={p.status} size="sm" />
                      </td>

                      <td className="table-td">
                        {p.agendado ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {formatarData(p.agendado)}
                            </span>
                            {p.origem_agendado && (
                              <p className="text-[10px] text-slate-300 mt-0.5 leading-none pl-0.5">
                                {p.origem_agendado === 'agenda' ? 'agenda' : 'import'}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Informações */}
                      <td className="table-td">
                        <div className="flex flex-wrap gap-1">
                          {temPlano  && <InfoBadge label="Plano"  cor="blue"  />}
                          {temManual && <InfoBadge label="Manual" cor="amber" />}
                          {!temPlano && !temManual && <InfoBadge label="Padrão" cor="slate" />}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500">Página {paginaAtual} de {totalPaginas}</p>
            <div className="flex gap-1">
              <button onClick={() => setPaginaAtual(p => Math.max(1, p - 1))} disabled={paginaAtual === 1} className="btn-secondary px-2.5 py-1 text-xs disabled:opacity-40">← Anterior</button>
              <button onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))} disabled={paginaAtual === totalPaginas} className="btn-secondary px-2.5 py-1 text-xs disabled:opacity-40">Próxima →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal de detalhes ── */}
      {detalhePaciente && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-start justify-between p-5 border-b border-slate-100">
              <div className="flex-1 min-w-0 pr-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-800 text-lg leading-snug">{detalhePaciente.paciente}</h3>
                  <StatusBadge status={detalhePaciente.status} size="sm" />
                </div>
                {detalhePaciente.nascimento && (
                  <p className="text-sm text-slate-400 mt-1">
                    {calcularIdade(detalhePaciente.nascimento)} · Nasc. {formatarData(detalhePaciente.nascimento)}
                  </p>
                )}
              </div>
              <button onClick={() => setDetalhePaciente(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Contato */}
              {loadingDetalhes ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando informações...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <InfoItem icon={Phone}      label="Telefone" value={detalhePaciente.telefone} />
                  <InfoItem icon={MapPin}     label="Cidade"   value={detalhePaciente.cidade} />
                  <InfoItem icon={Mail}       label="E-mail"   value={detalhePaciente.email} />
                  <InfoItem icon={CreditCard} label="CPF"      value={detalhePaciente.cpf} />
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Consultas',       valor: String(detalhePaciente.qtd_at ?? 0) },
                  { label: 'Último atend.',   valor: formatarData(detalhePaciente.ultimo_atendimento) },
                  { label: 'Recência',        valor: formatarRecencia(detalhePaciente.recencia_dias) },
                  { label: 'Intervalo ideal', valor: detalhePaciente.retorno_ideal_dias != null ? `${detalhePaciente.retorno_ideal_dias} dias` : '—' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 rounded-xl px-2.5 py-2.5 text-center">
                    <p className="text-xs text-slate-400 leading-snug">{s.label}</p>
                    <p className="text-sm font-semibold text-slate-700 mt-0.5 leading-snug">{s.valor}</p>
                  </div>
                ))}
              </div>

              {/* Agendado */}
              {detalhePaciente.agendado && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>Consulta agendada</span>
                </div>
              )}

              {/* Visibilidade */}
              <div className={cn(
                'border rounded-xl px-3.5 py-3 space-y-2',
                erroAtivo ? 'border-red-200 bg-red-50' : 'border-slate-200'
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Visibilidade na carteira</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {(detalhePaciente.ativo ?? true)
                        ? 'Aparece normalmente na lista de pacientes'
                        : 'Oculto da lista — visível na aba "Desativados"'}
                    </p>
                  </div>
                  <ToggleSwitch
                    ativo={detalhePaciente.ativo ?? true}
                    onChange={toggleAtivo}
                    disabled={salvandoAtivo}
                  />
                </div>
                {erroAtivo && (
                  <p className="text-xs text-red-600">{erroAtivo}</p>
                )}
              </div>

              {/* Intervalo personalizado */}
              <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Intervalo personalizado</label>
                  {detalhePaciente.retorno_custom_dias != null && (
                    <InfoBadge label="Personalizado" cor="amber" />
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Defina um intervalo específico para este paciente. Deixe em branco para usar a regra automática.
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={1}
                      value={customRetornoInput}
                      onChange={e => setCustomRetornoInput(e.target.value)}
                      placeholder={`Padrão: ${calcRetornoIdeal(detalhePaciente.idade_dias, config)} dias`}
                      className="input pr-10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">dias</span>
                  </div>
                  {detalhePaciente.retorno_custom_dias != null && (
                    <button
                      onClick={() => salvarRetornoCustom(true)}
                      disabled={salvandoRetorno}
                      title="Remover personalização"
                      className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => salvarRetornoCustom(false)}
                    disabled={salvandoRetorno || !customRetornoInput}
                    className="btn-primary px-4"
                  >
                    {salvandoRetorno ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                  </button>
                </div>
                {mensagemRetorno && (
                  <p className={cn('text-xs', mensagemRetorno.includes('Erro') ? 'text-red-600' : 'text-emerald-600')}>
                    {mensagemRetorno}
                  </p>
                )}
              </div>

              {/* Observação */}
              <div>
                <label className="label">Observação clínica</label>
                <textarea
                  value={detalheObsTexto}
                  onChange={e => setDetalheObsTexto(e.target.value)}
                  rows={3}
                  placeholder="Nenhuma observação registrada..."
                  className="input resize-none"
                />
                {mensagemDetalhe && (
                  <p className={cn('text-xs mt-1', mensagemDetalhe.includes('Erro') ? 'text-red-600' : 'text-emerald-600')}>
                    {mensagemDetalhe}
                  </p>
                )}
              </div>
            </div>

            <div className="px-5 pb-2 pt-2 border-t border-slate-100">
              <a
                href={`/prontuario/${encodeURIComponent(detalhePaciente.paciente)}`}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-brand-200 text-brand-600 text-sm font-medium hover:bg-brand-50 transition-colors mb-2"
                onClick={() => setDetalhePaciente(null)}
              >
                <FileText className="w-4 h-4" /> Abrir Prontuário
              </a>
              <div className="flex gap-2">
                <button onClick={() => setDetalhePaciente(null)} className="btn-secondary flex-1">Fechar</button>
                <button onClick={salvarObservacaoDetalhe} disabled={salvandoDetalhe} className="btn-primary flex-1">
                  {salvandoDetalhe ? 'Salvando...' : 'Salvar Observação'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
