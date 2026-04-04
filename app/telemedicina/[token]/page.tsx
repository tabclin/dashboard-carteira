import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SalaPaciente from '@/components/telemedicina/sala-paciente'

interface PageProps {
  params: { token: string }
}

export default async function TelemedicinaPacientePage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: agendamento } = await supabase
    .from('agendamentos')
    .select('id, paciente_nome, data, hora_inicio, hora_fim, servico_nome, telemedicina_cpf_rg, telemedicina_token, status')
    .eq('telemedicina_token', params.token)
    .maybeSingle()

  if (!agendamento) notFound()

  return <SalaPaciente agendamento={agendamento} token={params.token} />
}
