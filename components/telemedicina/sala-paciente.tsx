'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatarData } from '@/lib/utils'
import { Video, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'

interface AgendamentoPublico {
  id: string
  paciente_nome: string
  data: string
  hora_inicio: string
  hora_fim: string
  servico_nome: string | null
  telemedicina_cpf_rg: string | null
  telemedicina_token: string | null
  status: string
}

interface Props {
  agendamento: AgendamentoPublico
  token: string
}

type Etapa = 'validar' | 'termo' | 'sala'

function normalizar(v: string) {
  return v.toLowerCase().replace(/[.\-/\s]/g, '')
}

export default function SalaPaciente({ agendamento, token }: Props) {
  const supabase = createClient()

  const [etapa, setEtapa]       = useState<Etapa>('validar')
  const [cpfRg, setCpfRg]       = useState('')
  const [erroId, setErroId]     = useState('')
  const [aceito, setAceito]     = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroTermo, setErroTermo] = useState('')

  const hoje = new Date().toLocaleDateString('pt-BR')

  function validarIdentidade() {
    if (!cpfRg.trim()) { setErroId('Informe seu CPF ou RG.'); return }
    if (normalizar(cpfRg) !== normalizar(agendamento.telemedicina_cpf_rg ?? '')) {
      setErroId('CPF/RG não corresponde ao cadastrado para esta consulta.')
      return
    }
    setErroId('')
    setEtapa('termo')
  }

  async function confirmarTermo() {
    if (!aceito) { setErroTermo('Você precisa aceitar o termo para continuar.'); return }
    setSalvando(true)
    await supabase.from('telemedicina_consentimentos').insert({
      agendamento_id: agendamento.id,
      paciente_nome:  agendamento.paciente_nome,
      cpf_rg:         cpfRg.trim(),
    })
    setSalvando(false)
    setEtapa('sala')
  }

  // ── Etapa 1: Validação ────────────────────────────────────────
  if (etapa === 'validar') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Video className="w-7 h-7 text-violet-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Consulta por Telemedicina</h1>
            <p className="text-sm text-slate-500 mt-1">Confirme sua identidade para acessar</p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 space-y-1">
            <p className="text-sm font-semibold text-slate-700">{agendamento.paciente_nome}</p>
            <p className="text-xs text-slate-500">
              {formatarData(agendamento.data)} · {agendamento.hora_inicio}
              {agendamento.hora_fim ? ` – ${agendamento.hora_fim}` : ''}
            </p>
            {agendamento.servico_nome && (
              <p className="text-xs text-slate-500">{agendamento.servico_nome}</p>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Seu CPF ou RG</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="000.000.000-00 ou RG"
                value={cpfRg}
                onChange={e => { setCpfRg(e.target.value); setErroId('') }}
                onKeyDown={e => e.key === 'Enter' && validarIdentidade()}
              />
            </div>

            {erroId && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {erroId}
              </div>
            )}

            <button
              onClick={validarIdentidade}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-2.5 rounded-xl transition-colors"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Etapa 2: Termo de consentimento ───────────────────────────
  if (etapa === 'termo') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8 space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-emerald-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">Termo de Consentimento</h1>
            <p className="text-sm text-slate-500 mt-1">Leia e aceite para entrar na consulta</p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 space-y-3 max-h-64 overflow-y-auto leading-relaxed">
            <p className="font-semibold text-slate-800">TERMO DE CONSENTIMENTO PARA ATENDIMENTO POR TELEMEDICINA</p>
            <p>
              Eu, <strong>{agendamento.paciente_nome}</strong>, CPF/RG <strong>{cpfRg}</strong>,
              concordo com os termos abaixo para realização de consulta médica por meio de plataforma digital:
            </p>
            <ul className="space-y-1.5 list-none">
              {[
                'Atendimento médico remoto via plataforma digital segura',
                'Transmissão de dados de saúde necessários para a condução da consulta',
                'Ciência das limitações inerentes ao atendimento à distância',
                'Que o registro desta consulta poderá ser utilizado para fins clínicos',
                'Tratamento dos meus dados pessoais e de saúde conforme a LGPD (Lei nº 13.709/2018)',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-400 pt-1">Data: {hoje}</p>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aceito}
                onChange={e => { setAceito(e.target.checked); setErroTermo('') }}
                className="mt-0.5 accent-violet-600 w-4 h-4 flex-shrink-0"
              />
              <span className="text-sm text-slate-700">
                Li e concordo com todos os termos acima para participar da consulta por telemedicina.
              </span>
            </label>

            {erroTermo && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {erroTermo}
              </div>
            )}

            <button
              onClick={confirmarTermo}
              disabled={salvando}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-70 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {salvando ? <><Loader2 className="w-4 h-4 animate-spin" /> Aguarde...</> : 'Entrar na consulta'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Etapa 3: Sala de vídeo ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Topo */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 text-white">
        <div className="flex items-center gap-3">
          <Video className="w-5 h-5 text-violet-400" />
          <div>
            <p className="text-sm font-semibold">{agendamento.paciente_nome}</p>
            <p className="text-xs text-slate-400">
              {formatarData(agendamento.data)} · {agendamento.hora_inicio}
              {agendamento.servico_nome ? ` · ${agendamento.servico_nome}` : ''}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Consulta ativa
        </span>
      </div>

      {/* Jitsi iframe */}
      <div className="flex-1">
        <iframe
          src={`https://meet.jit.si/${token}#userInfo.displayName="${encodeURIComponent(agendamento.paciente_nome)}"&config.prejoinPageEnabled=false&config.startWithAudioMuted=false`}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="w-full h-full min-h-[calc(100vh-56px)]"
          style={{ border: 'none' }}
        />
      </div>
    </div>
  )
}
