'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, formatarData } from '@/lib/utils'
import {
  ArrowLeft, User, FlaskConical, TrendingUp, Compass,
  StopCircle, Loader2, FileText,
} from 'lucide-react'
import Link from 'next/link'
import AnamneseForm from './anamnese-form'
import ConsultasListagem from './consultas-listagem'
import ExamesList from './exames-list'
import CurvaCrescimento from './curva-crescimento'
import ConsultaTimer from './consulta-timer'
import OrientacaoForm from './orientacao-form'
import ConsultaForm from './consulta-form'
import VideoRoom from '@/components/telemedicina/video-room'
import StatusBadge from '@/components/agenda/status-badge'
import type {
  Prontuario, ProntuarioConsulta, ProntuarioExame,
  AnamneseTemplate, CrescimentoMedicao, Agendamento,
} from '@/types'

type ViewMode = 'lista' | 'consulta'
type Tab = 'anamnese' | 'exames' | 'crescimento' | 'orientacao'

interface PacienteBasico {
  paciente: string
  nascimento: string | null
  idade_dias: number | null
  recencia_dias: number | null
  status: string | null
  qtd_at: number | null
  ultimo_atendimento: string | null
}

interface ProntuarioViewProps {
  paciente: PacienteBasico
  prontuario: Prontuario | null
  consultas: ProntuarioConsulta[]
  agendamentos: Agendamento[]
  exames: ProntuarioExame[]
  templates: AnamneseTemplate[]
  medicoesCrescimento: CrescimentoMedicao[]
}

const STATUS_BADGE: Record<string, string> = {
  Ok:      'bg-emerald-100 text-emerald-700',
  Atenção: 'bg-amber-100 text-amber-700',
  Perigo:  'bg-red-100 text-red-700',
}

export default function ProntuarioView({
  paciente, prontuario, consultas, agendamentos,
  exames, templates, medicoesCrescimento,
}: ProntuarioViewProps) {
  const supabase = createClient()
  const router   = useRouter()

  const [modo, setModo]                       = useState<ViewMode>('lista')
  const [tab, setTab]                         = useState<Tab>('anamnese')
  const [agendamentoAtivo, setAgendamentoAtivo] = useState<Agendamento | null>(null)
  const [consultaAtiva, setConsultaAtiva]     = useState<ProntuarioConsulta | null>(null)
  const [iniciando, setIniciando]             = useState(false)
  const [finalizando, setFinalizando]         = useState(false)
  const [notasAberto, setNotasAberto]         = useState(false)

  const idadeAnos = paciente.idade_dias ? Math.floor(paciente.idade_dias / 365) : null

  async function iniciarConsulta(ag: Agendamento) {
    if (!prontuario) return
    setIniciando(true)
    const agora = new Date().toISOString()
    const { data: nova } = await supabase
      .from('prontuario_consultas')
      .insert({
        prontuario_id:    prontuario.id,
        agendamento_id:   ag.id,
        data:             ag.data,
        profissional_nome: ag.profissional?.nome ?? null,
        status:           'em_atendimento',
        iniciado_em:      agora,
      })
      .select()
      .single()

    await supabase
      .from('agendamentos')
      .update({ status: 'em_consulta', atualizado_em: agora })
      .eq('id', ag.id)

    setIniciando(false)
    if (nova) {
      setConsultaAtiva(nova as ProntuarioConsulta)
      setAgendamentoAtivo(ag)
      setTab('anamnese')
      setModo('consulta')
    }
    router.refresh()
  }

  function continuarConsulta(ag: Agendamento, consulta: ProntuarioConsulta) {
    setAgendamentoAtivo(ag)
    setConsultaAtiva(consulta)
    setTab('anamnese')
    setModo('consulta')
  }

  function verConsulta(ag: Agendamento, consulta: ProntuarioConsulta) {
    setAgendamentoAtivo(ag)
    setConsultaAtiva(consulta)
    setTab('anamnese')
    setModo('consulta')
  }

  async function finalizarConsulta() {
    if (!consultaAtiva || !agendamentoAtivo) return
    setFinalizando(true)
    const agora    = new Date()
    const inicio   = new Date(consultaAtiva.iniciado_em!)
    const duracao  = Math.round((agora.getTime() - inicio.getTime()) / 60000)

    await supabase
      .from('prontuario_consultas')
      .update({
        status:          'finalizado',
        finalizado_em:   agora.toISOString(),
        duracao_minutos: duracao,
        atualizado_em:   agora.toISOString(),
      })
      .eq('id', consultaAtiva.id)

    // Sincronizar com plano: se agendamento veio de plano, marcar consulta como realizada
    if (agendamentoAtivo.origem === 'plano') {
      await supabase
        .from('plano_consultas')
        .update({ realizada: true })
        .eq('agendamento_id', agendamentoAtivo.id)
    }

    await supabase
      .from('agendamentos')
      .update({ status: 'realizado', atualizado_em: agora.toISOString() })
      .eq('id', agendamentoAtivo.id)

    setFinalizando(false)
    setModo('lista')
    setConsultaAtiva(null)
    setAgendamentoAtivo(null)
    router.refresh()
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'anamnese',    label: 'Anamnese',    icon: User       },
    { key: 'exames',      label: 'Exames',      icon: FlaskConical },
    { key: 'crescimento', label: 'Crescimento', icon: TrendingUp },
    { key: 'orientacao',  label: 'Orientação',  icon: Compass    },
  ]

  const finalizado = consultaAtiva?.status === 'finalizado'

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Breadcrumb */}
      {modo === 'lista' ? (
        <Link href="/prontuario" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 w-fit">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
      ) : (
        <button
          onClick={() => { setModo('lista'); setConsultaAtiva(null); setAgendamentoAtivo(null) }}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Consultas
        </button>
      )}

      {/* Cabeçalho do paciente */}
      <div className="card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-800">{paciente.paciente}</h2>
              {paciente.status && (
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_BADGE[paciente.status] ?? 'bg-slate-100 text-slate-600')}>
                  {paciente.status}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
              {paciente.nascimento && (
                <p className="text-sm text-slate-500">
                  <span className="text-slate-400">Nasc.:</span> {formatarData(paciente.nascimento)}
                  {idadeAnos !== null && <span className="ml-1 text-slate-400">({idadeAnos} anos)</span>}
                </p>
              )}
              {paciente.ultimo_atendimento && (
                <p className="text-sm text-slate-500">
                  <span className="text-slate-400">Último atend.:</span> {formatarData(paciente.ultimo_atendimento)}
                  {paciente.recencia_dias !== null && <span className="ml-1 text-slate-400">({paciente.recencia_dias} dias atrás)</span>}
                </p>
              )}
              {paciente.qtd_at != null && (
                <p className="text-sm text-slate-500">
                  <span className="text-slate-400">Consultas:</span> {paciente.qtd_at}
                </p>
              )}
            </div>
          </div>
          <Link href="/carteira" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            Ver na carteira →
          </Link>
        </div>
      </div>

      {/* ── MODO LISTA ──────────────────────────────────────────── */}
      {modo === 'lista' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Consultas</h3>
            <p className="text-xs text-slate-400">{agendamentos.length} agendamento{agendamentos.length !== 1 ? 's' : ''}</p>
          </div>

          {iniciando && (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Iniciando consulta...
            </div>
          )}

          {!prontuario ? (
            <div className="card text-center py-10">
              <p className="text-slate-500 text-sm">Erro ao carregar prontuário. Tente recarregar.</p>
            </div>
          ) : (
            <ConsultasListagem
              agendamentos={agendamentos}
              consultas={consultas}
              onIniciar={iniciarConsulta}
              onContinuar={continuarConsulta}
              onVer={verConsulta}
            />
          )}
        </div>
      )}

      {/* ── MODO CONSULTA ───────────────────────────────────────── */}
      {modo === 'consulta' && (
        <div className="space-y-4">
          {/* Info da consulta selecionada */}
          {agendamentoAtivo && (
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={agendamentoAtivo.status} />
              <span className="text-sm text-slate-700 font-medium">
                {formatarData(agendamentoAtivo.data)}
                {agendamentoAtivo.hora_inicio && ` · ${agendamentoAtivo.hora_inicio}`}
              </span>
              {agendamentoAtivo.servico_nome && (
                <span className="text-sm text-slate-500">{agendamentoAtivo.servico_nome}</span>
              )}
            </div>
          )}

          {/* Barra de atendimento ativo */}
          {consultaAtiva?.status === 'em_atendimento' && consultaAtiva.iniciado_em && (
            <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <span className="text-sm font-semibold text-emerald-800">Em atendimento</span>
                <ConsultaTimer iniciado_em={consultaAtiva.iniciado_em} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setNotasAberto(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-100 text-sm font-medium transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Notas clínicas
                </button>
                <button
                  onClick={finalizarConsulta}
                  disabled={finalizando}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-70"
                >
                  {finalizando
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <StopCircle className="w-4 h-4" />
                  }
                  Finalizar consulta
                </button>
              </div>
            </div>
          )}

          {/* Banner de consulta finalizada */}
          {finalizado && (
            <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex-wrap">
              <span className="text-sm text-slate-600 font-medium">Consulta finalizada</span>
              <button
                onClick={() => setNotasAberto(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white text-sm font-medium transition-colors"
              >
                <FileText className="w-4 h-4" />
                Ver notas clínicas
              </button>
            </div>
          )}

          {/* Abas */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  tab === key
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Conteúdo das abas */}
          {prontuario ? (
            <>
              {tab === 'anamnese'    && <AnamneseForm prontuario={prontuario} templates={templates} bloqueado={finalizado} />}
              {tab === 'exames'      && <ExamesList exames={exames} prontuarioId={prontuario.id} bloqueado={finalizado} />}
              {tab === 'crescimento' && (
                <CurvaCrescimento
                  medicoes={medicoesCrescimento}
                  prontuarioId={prontuario.id}
                  nascimento={paciente.nascimento}
                  bloqueado={finalizado}
                />
              )}
              {tab === 'orientacao'  && (
                <OrientacaoForm
                  consultaId={consultaAtiva?.id}
                  orientacao={consultaAtiva?.orientacao}
                />
              )}
            </>
          ) : (
            <div className="card text-center py-10">
              <p className="text-slate-500 text-sm">Erro ao carregar prontuário. Tente recarregar.</p>
            </div>
          )}
        </div>
      )}

      {/* Sala de vídeo flutuante — telemedicina */}
      {agendamentoAtivo?.telemedicina && agendamentoAtivo.telemedicina_token &&
       consultaAtiva?.status === 'em_atendimento' && (
        <VideoRoom
          token={agendamentoAtivo.telemedicina_token}
          pacienteNome={agendamentoAtivo.paciente_nome}
        />
      )}

      {/* Modal de notas clínicas */}
      {notasAberto && consultaAtiva && (
        <ConsultaForm
          prontuarioId={prontuario?.id ?? ''}
          editando={consultaAtiva}
          onClose={() => setNotasAberto(false)}
        />
      )}
    </div>
  )
}
