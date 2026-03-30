'use client'

import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/status-badge'
import { formatarData, formatarRecencia, cn } from '@/lib/utils'
import type { Paciente, StatusPaciente } from '@/types'
import {
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  MessageSquare, Calendar, X, CheckCircle2, AlertCircle,
} from 'lucide-react'

type SortField = 'paciente' | 'ultimo_atendimento' | 'qtd_at' | 'recencia_dias' | 'status'
type SortDir = 'asc' | 'desc'

interface PatientTableProps {
  pacientes: Paciente[]
  nomesComPlano?: Set<string>
}

export default function PatientTable({ pacientes, nomesComPlano = new Set() }: PatientTableProps) {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusPaciente | 'Todos'>('Todos')
  const [sortField, setSortField] = useState<SortField>('recencia_dias')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [modalPaciente, setModalPaciente] = useState<Paciente | null>(null)
  const [obsTexto, setObsTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [mensagemSalvo, setMensagemSalvo] = useState('')

  const POR_PAGINA = 20

  // Filtrar + ordenar
  const dadosFiltrados = useMemo(() => {
    let lista = [...pacientes]

    if (busca.trim()) {
      const q = busca.toLowerCase().trim()
      lista = lista.filter(p => p.paciente?.toLowerCase().includes(q))
    }

    if (filtroStatus !== 'Todos') {
      lista = lista.filter(p => p.status === filtroStatus)
    }

    const statusOrdem: Record<StatusPaciente, number> = { Perigo: 0, Atenção: 1, Ok: 2 }

    lista.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'paciente':
          cmp = (a.paciente ?? '').localeCompare(b.paciente ?? '', 'pt-BR')
          break
        case 'ultimo_atendimento':
          cmp = (a.ultimo_atendimento ?? '').localeCompare(b.ultimo_atendimento ?? '')
          break
        case 'qtd_at':
          cmp = (a.qtd_at ?? 0) - (b.qtd_at ?? 0)
          break
        case 'recencia_dias':
          cmp = (a.recencia_dias ?? 9999) - (b.recencia_dias ?? 9999)
          break
        case 'status':
          cmp = (statusOrdem[a.status] ?? 9) - (statusOrdem[b.status] ?? 9)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return lista
  }, [pacientes, busca, filtroStatus, sortField, sortDir])

  const totalPaginas = Math.ceil(dadosFiltrados.length / POR_PAGINA)
  const dadosPagina = dadosFiltrados.slice(
    (paginaAtual - 1) * POR_PAGINA,
    paginaAtual * POR_PAGINA
  )

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
    setPaginaAtual(1)
  }

  function handleBusca(v: string) {
    setBusca(v)
    setPaginaAtual(1)
  }

  function handleFiltro(v: StatusPaciente | 'Todos') {
    setFiltroStatus(v)
    setPaginaAtual(1)
  }

  function abrirModal(p: Paciente) {
    setModalPaciente(p)
    setObsTexto(p.observacao ?? '')
    setMensagemSalvo('')
  }

  async function salvarObservacao() {
    if (!modalPaciente) return
    setSalvando(true)
    setMensagemSalvo('')

    const supabase = createClient()
    const { error } = await supabase
      .from('observacoes')
      .upsert(
        { paciente: modalPaciente.paciente, observacao: obsTexto },
        { onConflict: 'paciente' }
      )

    setSalvando(false)
    if (error) {
      setMensagemSalvo('Erro ao salvar.')
    } else {
      setMensagemSalvo('Salvo com sucesso!')
      // Atualiza local
      modalPaciente.observacao = obsTexto
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 text-slate-400" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-brand-500" />
      : <ChevronDown className="w-3 h-3 text-brand-500" />
  }

  const contadores = useMemo(() => ({
    ok:      pacientes.filter(p => p.status === 'Ok').length,
    atencao: pacientes.filter(p => p.status === 'Atenção').length,
    perigo:  pacientes.filter(p => p.status === 'Perigo').length,
  }), [pacientes])

  return (
    <div>
      {/* Filtros rápidos por status */}
      <div className="flex flex-wrap gap-2 mb-4">
        {([
          { key: 'Todos',   label: `Todos (${pacientes.length})`,     cls: 'bg-slate-800 text-white' },
          { key: 'Ok',      label: `Ok (${contadores.ok})`,            cls: 'bg-emerald-500 text-white' },
          { key: 'Atenção', label: `Atenção (${contadores.atencao})`,  cls: 'bg-amber-500 text-white' },
          { key: 'Perigo',  label: `Perigo (${contadores.perigo})`,    cls: 'bg-red-500 text-white' },
        ] as const).map(btn => (
          <button
            key={btn.key}
            onClick={() => handleFiltro(btn.key as StatusPaciente | 'Todos')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              filtroStatus === btn.key
                ? btn.cls + ' shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
            )}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={busca}
          onChange={e => handleBusca(e.target.value)}
          placeholder="Buscar paciente por nome..."
          className="input pl-9 pr-9"
        />
        {busca && (
          <button
            onClick={() => handleBusca('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Resultado info */}
      <p className="text-xs text-slate-500 mb-3">
        {dadosFiltrados.length === pacientes.length
          ? `${pacientes.length} pacientes no total`
          : `${dadosFiltrados.length} pacientes encontrados de ${pacientes.length}`}
      </p>

      {/* Tabela */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {([
                  { field: 'paciente',           label: 'Paciente'         },
                  { field: 'ultimo_atendimento', label: 'Último Atend.'    },
                  { field: 'qtd_at',             label: 'Consultas'        },
                  { field: 'recencia_dias',      label: 'Recência'         },
                  { field: 'status',             label: 'Status'           },
                ] as { field: SortField; label: string }[]).map(col => (
                  <th key={col.field} className="table-th">
                    <button
                      onClick={() => handleSort(col.field)}
                      className="flex items-center gap-1 hover:text-slate-700 transition-colors"
                    >
                      {col.label}
                      <SortIcon field={col.field} />
                    </button>
                  </th>
                ))}
                <th className="table-th">Agendado</th>
                <th className="table-th">Obs.</th>
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
                dadosPagina.map((p, i) => (
                  <tr
                    key={`${p.paciente}-${i}`}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="table-td font-medium text-slate-800">
                      <span className="flex items-center gap-2 flex-wrap">
                        {p.paciente ?? '—'}
                        {nomesComPlano.has(`${p.paciente}|${p.nascimento ?? ''}`) && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                            Plano
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="table-td text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-300" />
                        {formatarData(p.ultimo_atendimento)}
                      </div>
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
                        (p.recencia_dias ?? 0) > 90  ? 'text-amber-600' :
                        'text-slate-600'
                      )}>
                        {formatarRecencia(p.recencia_dias)}
                      </span>
                    </td>
                    <td className="table-td">
                      <StatusBadge status={p.status} size="sm" />
                    </td>
                    <td className="table-td">
                      {p.agendado ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Sim
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="table-td">
                      <button
                        onClick={() => abrirModal(p)}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors',
                          p.observacao
                            ? 'text-brand-600 bg-brand-50 hover:bg-brand-100'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                        )}
                        title={p.observacao ?? 'Adicionar observação'}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500">
              Página {paginaAtual} de {totalPaginas}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                disabled={paginaAtual === 1}
                className="btn-secondary px-2.5 py-1 text-xs disabled:opacity-40"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual === totalPaginas}
                className="btn-secondary px-2.5 py-1 text-xs disabled:opacity-40"
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de observação */}
      {modalPaciente && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-start justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-800">Observação</h3>
                <p className="text-sm text-slate-500 mt-0.5">{modalPaciente.paciente}</p>
              </div>
              <button
                onClick={() => setModalPaciente(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              <label className="label">Anotação clínica</label>
              <textarea
                value={obsTexto}
                onChange={e => setObsTexto(e.target.value)}
                rows={4}
                placeholder="Digite uma observação sobre o paciente..."
                className="input resize-none"
              />

              {mensagemSalvo && (
                <div className={cn(
                  'flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-sm',
                  mensagemSalvo.includes('Erro')
                    ? 'bg-red-50 text-red-600'
                    : 'bg-emerald-50 text-emerald-600'
                )}>
                  {mensagemSalvo.includes('Erro')
                    ? <AlertCircle className="w-4 h-4" />
                    : <CheckCircle2 className="w-4 h-4" />}
                  {mensagemSalvo}
                </div>
              )}
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setModalPaciente(null)}
                className="btn-secondary flex-1"
              >
                Fechar
              </button>
              <button
                onClick={salvarObservacao}
                disabled={salvando}
                className="btn-primary flex-1"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
