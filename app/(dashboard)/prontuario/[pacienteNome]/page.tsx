import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProntuarioView from '@/components/prontuario/prontuario-view'
import type { Prontuario, ProntuarioConsulta, ProntuarioExame, AnamneseTemplate, CrescimentoMedicao, Agendamento } from '@/types'

export const revalidate = 0

interface Props {
  params: { pacienteNome: string }
}

export default async function ProntuarioPacientePage({ params }: Props) {
  const supabase = createClient()
  const nome = decodeURIComponent(params.pacienteNome)

  // Buscar dados básicos do paciente (apenas colunas que existem na tabela)
  const { data: pacienteData } = await supabase
    .from('pacientes')
    .select('id, paciente, nascimento')
    .eq('paciente', nome)
    .maybeSingle()

  if (!pacienteData) notFound()

  // Queries paralelas: carteira + prontuário + template
  const [
    { data: carteiraData },
    prontuarioResult,
    { data: templateData },
  ] = await Promise.all([
    supabase
      .from('carteira')
      .select('status, recencia_dias, qtd_at, idade_dias, ultimo_atendimento')
      .eq('paciente', nome)
      .maybeSingle(),
    supabase
      .from('prontuarios')
      .select('*')
      .eq('paciente_id', pacienteData.id)
      .maybeSingle(),
    supabase
      .from('anamnese_template')
      .select('*')
      .order('is_padrao', { ascending: false })
      .order('criado_em', { ascending: true }),
  ])

  // Criar prontuário se não existir ainda
  let pront = prontuarioResult.data
  if (!pront) {
    const { data: criado } = await supabase
      .from('prontuarios')
      .insert({ paciente_id: pacienteData.id })
      .select()
      .maybeSingle()
    pront = criado
  }

  // Buscar consultas, exames, medições e agendamentos em paralelo
  const [consultasResult, examesResult, medicoesResult, agendamentosResult] = pront
    ? await Promise.all([
        supabase
          .from('prontuario_consultas')
          .select('*, prontuario_prescricoes(*)')
          .eq('prontuario_id', pront.id)
          .order('data', { ascending: false }),
        supabase
          .from('prontuario_exames')
          .select('*')
          .eq('prontuario_id', pront.id)
          .order('criado_em', { ascending: false }),
        supabase
          .from('crescimento_medicoes')
          .select('*')
          .eq('prontuario_id', pront.id)
          .order('data', { ascending: true }),
        supabase
          .from('agendamentos')
          .select('*, profissional:profissionais(nome)')
          .eq('paciente_nome', nome)
          .order('data', { ascending: false })
          .order('hora_inicio', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]

  const paciente = { ...pacienteData, ...(carteiraData ?? {}) }

  return (
    <ProntuarioView
      paciente={paciente as any}
      prontuario={pront as Prontuario | null}
      consultas={(consultasResult.data ?? []) as ProntuarioConsulta[]}
      agendamentos={(agendamentosResult.data ?? []) as Agendamento[]}
      exames={(examesResult.data ?? []) as ProntuarioExame[]}
      templates={(templateData ?? []) as AnamneseTemplate[]}
      medicoesCrescimento={(medicoesResult.data ?? []) as CrescimentoMedicao[]}
    />
  )
}
