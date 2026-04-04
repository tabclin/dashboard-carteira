'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, formatarData } from '@/lib/utils'
import { X, Loader2, Search, UserPlus, Trash2, ExternalLink, Video, Copy, Check } from 'lucide-react'
import StatusBadge from './status-badge'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import type { Agendamento, AgendaStatus, Servico, Profissional } from '@/types'

interface AgendamentoModalProps {
  editando: Agendamento | null
  dataInicial?: string    // ISO date pré-preenchida (ao clicar num slot)
  horaInicial?: string    // HH:MM pré-preenchida
  servicos: Servico[]
  profissionais: Profissional[]
  pacienteNomeInicial?: string   // pré-preenche e bloqueia o campo paciente
  pacienteIdInicial?: string
  origemInicial?: 'manual' | 'plano'  // marca a origem do agendamento
  onClose: () => void
  onSalvo?: (data: string, agendamentoId: string) => void  // chamado após salvar com sucesso
}

const STATUS_LIST: AgendaStatus[] = ['agendado', 'confirmado', 'realizado', 'faltou', 'cancelado']

interface PacienteOpcao {
  id: string
  paciente: string
  nascimento: string | null
  telefone?: string | null
}

export default function AgendamentoModal({
  editando,
  dataInicial,
  horaInicial,
  servicos,
  profissionais,
  pacienteNomeInicial,
  pacienteIdInicial,
  origemInicial = 'manual',
  onClose,
  onSalvo,
}: AgendamentoModalProps) {
  const supabase = createClient()
  const router = useRouter()

  // Campos do agendamento
  const [pacienteId, setPacienteId]           = useState('')
  const [pacienteNome, setPacienteNome]       = useState('')
  const [profissionalId, setProfissionalId]   = useState('')
  const [servicoId, setServicoId]             = useState('')
  const [data, setData]                       = useState(dataInicial ?? new Date().toISOString().slice(0, 10))
  const [horaInicio, setHoraInicio]           = useState(horaInicial ?? '08:00')
  const [horaFim, setHoraFim]                 = useState('09:00')
  const [status, setStatus]                   = useState<AgendaStatus>('agendado')
  const [observacoes, setObservacoes]         = useState('')

  // Busca de paciente
  const [busca, setBusca]                     = useState('')
  const [resultados, setResultados]           = useState<PacienteOpcao[]>([])
  const [buscando, setBuscando]               = useState(false)
  const debounceRef                           = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Novo paciente
  const [novoMode, setNovoMode]               = useState(false)
  const [novoNome, setNovoNome]               = useState('')
  const [novoTelefone, setNovoTelefone]       = useState('')
  const [novoNasc, setNovoNasc]               = useState('')

  // Telemedicina
  const [telemedicina, setTelemedicina]       = useState(false)
  const [teleToken, setTeleToken]             = useState<string | null>(null)
  const [teleCpfRg, setTeleCpfRg]             = useState('')
  const [linkCopiado, setLinkCopiado]         = useState(false)

  // UI states
  const [saving, setSaving]                   = useState(false)
  const [erro, setErro]                       = useState('')
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false)

  // Preencher ao editar ou pré-preencher paciente
  useEffect(() => {
    if (editando) {
      setPacienteId(editando.paciente_id ?? '')
      setPacienteNome(editando.paciente_nome)
      setBusca(editando.paciente_nome)
      setProfissionalId(editando.profissional_id ?? '')
      setServicoId(editando.servico_id ?? '')
      setData(editando.data)
      setHoraInicio(editando.hora_inicio?.slice(0, 5) ?? editando.hora_inicio)
      setHoraFim(editando.hora_fim?.slice(0, 5) ?? editando.hora_fim)
      setStatus(editando.status)
      setObservacoes(editando.observacoes ?? '')
      setTelemedicina(editando.telemedicina ?? false)
      setTeleToken(editando.telemedicina_token ?? null)
      setTeleCpfRg(editando.telemedicina_cpf_rg ?? '')
    } else {
      if (profissionais.length === 1) setProfissionalId(profissionais[0].id)
      if (pacienteNomeInicial) {
        setBusca(pacienteNomeInicial)
        setPacienteNome(pacienteNomeInicial)
        setPacienteId(pacienteIdInicial ?? '')
      }
    }
  }, [editando, profissionais, pacienteNomeInicial, pacienteIdInicial])

  // Auto ajustar hora_fim ao mudar início ou serviço
  useEffect(() => {
    const serv = servicos.find(s => s.id === servicoId)
    const duracaoMin = serv?.antecedencia_dias ? 30 : 30 // default 30 min
    if (horaInicio) {
      const [h, m] = horaInicio.split(':').map(Number)
      const total = h * 60 + m + duracaoMin
      const hf = String(Math.floor(total / 60) % 24).padStart(2, '0')
      const mf = String(total % 60).padStart(2, '0')
      setHoraFim(`${hf}:${mf}`)
    }
  }, [horaInicio, servicoId, servicos])

  // Busca de pacientes com debounce
  const buscarPacientes = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResultados([]); return }
    setBuscando(true)
    const { data } = await supabase
      .from('pacientes')
      .select('id, paciente, nascimento')
      .ilike('paciente', `%${q.trim()}%`)
      .limit(8)
    setResultados(
      (data ?? []).map((p: any) => ({ id: p.id, paciente: p.paciente, nascimento: p.nascimento }))
    )
    setBuscando(false)
  }, [supabase])

  function handleBuscaChange(v: string) {
    setBusca(v)
    setPacienteId('')
    setPacienteNome('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscarPacientes(v), 300)
  }

  function selecionarPaciente(p: PacienteOpcao) {
    setPacienteId(p.id)
    setPacienteNome(p.paciente)
    setBusca(p.paciente)
    setResultados([])
    setNovoMode(false)
  }

  async function criarNovoPaciente(): Promise<{ id: string; nome: string } | null> {
    if (!novoNome.trim()) return null
    const { data: nova, error } = await supabase.from('pacientes').insert({
      paciente: novoNome.trim(),
      nascimento: novoNasc || null,
    }).select('id, paciente').single()
    if (error || !nova) { setErro('Erro ao criar paciente: ' + (error?.message ?? 'sem retorno')); return null }
    return { id: nova.id, nome: nova.paciente }
  }

  function toggleTelemedicina(val: boolean) {
    setTelemedicina(val)
    if (val && !teleToken) {
      setTeleToken(crypto.randomUUID())
    }
  }

  async function salvar() {
    const nomeFinal = novoMode ? novoNome.trim() : pacienteNome.trim()
    if (!nomeFinal) { setErro('Selecione ou crie um paciente.'); return }
    if (!servicoId)  { setErro('Selecione o tipo de consulta.'); return }
    if (!data)       { setErro('Informe a data.'); return }
    if (!horaInicio || !horaFim) { setErro('Informe os horários.'); return }
    if (horaFim <= horaInicio) { setErro('Horário de término deve ser após o início.'); return }
    if (telemedicina && !teleCpfRg.trim()) {
      setErro('CPF ou RG do paciente é obrigatório para telemedicina.')
      return
    }

    setErro('')
    setSaving(true)

    // Criar novo paciente se necessário
    let pidFinal = pacienteId || null
    let nomePacienteFinal = nomeFinal
    if (novoMode) {
      const criado = await criarNovoPaciente()
      if (!criado) { setSaving(false); return }
      pidFinal = criado.id
      nomePacienteFinal = criado.nome
    }

    // Verificar conflito de horário
    if (profissionalId) {
      const { data: conflitos } = await supabase
        .from('agendamentos')
        .select('id')
        .eq('data', data)
        .eq('profissional_id', profissionalId)
        .neq('status', 'cancelado')
        .lt('hora_inicio', horaFim)
        .gt('hora_fim', horaInicio)
        .neq('id', editando?.id ?? '00000000-0000-0000-0000-000000000000')

      if ((conflitos ?? []).length > 0) {
        setErro('Conflito de horário: já existe um agendamento neste período para este profissional.')
        setSaving(false)
        return
      }
    }

    const servicoNome = servicos.find(s => s.id === servicoId)?.nome ?? null
    const payload = {
      paciente_id:     pidFinal || null,
      paciente_nome:   nomePacienteFinal,
      profissional_id: profissionalId || null,
      servico_id:      servicoId || null,
      servico_nome:    servicoNome,
      data,
      hora_inicio:     horaInicio,
      hora_fim:        horaFim,
      status,
      observacoes:          observacoes.trim() || null,
      origem:               editando ? (editando as any).origem ?? origemInicial : origemInicial,
      telemedicina:         telemedicina,
      telemedicina_token:   telemedicina ? teleToken : null,
      telemedicina_cpf_rg:  telemedicina ? teleCpfRg.trim() : null,
    }

    let agendamentoId = editando?.id ?? ''
    let error: any = null

    if (editando) {
      const res = await supabase.from('agendamentos')
        .update({ ...payload, atualizado_em: new Date().toISOString() })
        .eq('id', editando.id)
      error = res.error
    } else {
      const res = await supabase.from('agendamentos')
        .insert(payload)
        .select('id')
        .single()
      error = res.error
      if (res.data) agendamentoId = res.data.id
    }

    // Se marcando como realizado → atualizar ultimo_atendimento
    if (!error && status === 'realizado' && nomePacienteFinal) {
      await supabase.from('pacientes')
        .update({ ultimo_atendimento: data })
        .eq('paciente', nomePacienteFinal)
    }

    setSaving(false)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }
    onSalvo?.(data, agendamentoId)
    router.refresh()
    onClose()
  }

  async function excluir() {
    if (!editando) return
    await supabase.from('agendamentos').delete().eq('id', editando.id)
    router.refresh()
    onClose()
  }

  // Fechar com ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-slate-800">
            {editando ? 'Editar Agendamento' : 'Novo Agendamento'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* ─ Paciente ─ */}
          <div>
            <label className="label">Paciente *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                className="input pl-9"
                placeholder="Buscar paciente pelo nome..."
                value={busca}
                onChange={e => handleBuscaChange(e.target.value)}
                disabled={novoMode || !!pacienteNomeInicial}
              />
              {buscando && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
              )}
            </div>

            {/* Resultados da busca */}
            {resultados.length > 0 && !novoMode && (
              <div className="border border-slate-200 rounded-xl mt-1 overflow-hidden shadow-sm">
                {resultados.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selecionarPaciente(p)}
                    className="w-full text-left px-3 py-2 hover:bg-brand-50 transition-colors border-b border-slate-100 last:border-0"
                  >
                    <p className="text-sm font-medium text-slate-800">{p.paciente}</p>
                    {p.nascimento && (
                      <p className="text-xs text-slate-400">{formatarData(p.nascimento)}</p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Mini-form novo paciente */}
            {novoMode ? (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-blue-700">Novo paciente</p>
                <input className="input text-sm" placeholder="Nome completo *" value={novoNome} onChange={e => setNovoNome(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="input text-sm" placeholder="Telefone" value={novoTelefone} onChange={e => setNovoTelefone(e.target.value)} />
                  <input className="input text-sm" type="date" placeholder="Nascimento" value={novoNasc} onChange={e => setNovoNasc(e.target.value)} />
                </div>
                <button onClick={() => setNovoMode(false)} className="text-xs text-slate-500 hover:text-slate-700">← Cancelar e buscar paciente existente</button>
              </div>
            ) : (
              <button
                onClick={() => { setNovoMode(true); setBusca(''); setResultados([]) }}
                className="mt-1.5 flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                <UserPlus className="w-3.5 h-3.5" /> Criar novo paciente
              </button>
            )}
          </div>

          {/* ─ Data e horários ─ */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="label">Data *</label>
              <input type="date" className="input" value={data} onChange={e => setData(e.target.value)} />
            </div>
            <div>
              <label className="label">Início *</label>
              <input type="time" className="input" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} />
            </div>
            <div>
              <label className="label">Término *</label>
              <input type="time" className="input" value={horaFim} onChange={e => setHoraFim(e.target.value)} />
            </div>
          </div>

          {/* ─ Tipo de consulta ─ */}
          <div>
            <label className="label">Tipo de consulta *</label>
            <select
              className={cn('input', !servicoId && erro ? 'border-red-400 ring-1 ring-red-300' : '')}
              value={servicoId}
              onChange={e => setServicoId(e.target.value)}
            >
              <option value="">Selecionar...</option>
              {servicos.filter(s => s.ativo).map(s => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>

          {/* ─ Telemedicina ─ */}
          <div className="flex items-center justify-between py-2 border border-slate-200 rounded-xl px-3">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-violet-600" />
              <span className="text-sm font-medium text-slate-700">Telemedicina</span>
            </div>
            <button
              type="button"
              onClick={() => toggleTelemedicina(!telemedicina)}
              className={cn(
                'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
                telemedicina ? 'bg-violet-600' : 'bg-slate-200'
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                telemedicina ? 'translate-x-5' : ''
              )} />
            </button>
          </div>

          {telemedicina && (
            <div className="space-y-3 bg-violet-50 border border-violet-200 rounded-xl p-3">
              <div>
                <label className="label">CPF ou RG do paciente *</label>
                <input
                  className="input"
                  placeholder="000.000.000-00 ou RG"
                  value={teleCpfRg}
                  onChange={e => setTeleCpfRg(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">Necessário para validar o acesso do paciente</p>
              </div>

              {teleToken && (
                <div>
                  <label className="label">Link da consulta</label>
                  <div className="flex items-center gap-2">
                    <p className="input text-xs text-slate-600 truncate flex-1 bg-white">
                      {typeof window !== 'undefined' ? `${window.location.origin}/telemedicina/${teleToken}` : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/telemedicina/${teleToken}`)
                        setLinkCopiado(true)
                        setTimeout(() => setLinkCopiado(false), 2000)
                      }}
                      className="flex-shrink-0 p-2 rounded-lg border border-slate-200 hover:bg-white transition-colors"
                      title="Copiar link"
                    >
                      {linkCopiado
                        ? <Check className="w-4 h-4 text-emerald-600" />
                        : <Copy className="w-4 h-4 text-slate-500" />
                      }
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─ Profissional ─ */}
          {profissionais.length > 1 && (
            <div>
              <label className="label">Profissional</label>
              <select className="input" value={profissionalId} onChange={e => setProfissionalId(e.target.value)}>
                <option value="">Selecionar...</option>
                {profissionais.filter(p => p.ativo).map(p => (
                  <option key={p.id} value={p.id}>{p.nome}{p.especialidade ? ` — ${p.especialidade}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {/* ─ Status ─ */}
          <div>
            <label className="label">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_LIST.map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                    status === s ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <StatusBadge status={s} size="xs" />
                </button>
              ))}
            </div>
          </div>

          {/* ─ Observações ─ */}
          <div>
            <label className="label">Observações</label>
            <textarea
              className="input resize-none text-sm"
              rows={2}
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Anotações sobre o agendamento..."
            />
          </div>

          {/* ─ Link prontuário ─ */}
          {editando?.paciente_id && (
            <a
              href={`/prontuario/${encodeURIComponent(editando.paciente_nome)}`}
              className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
              onClick={onClose}
            >
              <ExternalLink className="w-3.5 h-3.5" /> Abrir prontuário do paciente
            </a>
          )}

          {/* ─ Erro ─ */}
          {erro && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 pb-6">
          {editando && (
            <button
              onClick={() => setConfirmandoExcluir(true)}
              className="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
              title="Excluir agendamento"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="btn-primary flex-1">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : editando ? 'Salvar alterações' : 'Agendar'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmandoExcluir}
        mensagem="Excluir este agendamento?"
        detalhe="O registro será removido permanentemente."
        onConfirmar={() => { excluir(); setConfirmandoExcluir(false) }}
        onCancelar={() => setConfirmandoExcluir(false)}
      />
    </div>
  )
}
