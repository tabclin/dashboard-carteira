import { createClient } from '@/lib/supabase/server'
import DiaList from '@/components/agenda/dia-list'
import type { Agendamento, Servico, Profissional } from '@/types'

export const revalidate = 0

export default async function AgendaHojePage() {
  const supabase = createClient()
  const dataHoje = new Date().toISOString().slice(0, 10)

  const [
    { data: agendamentosData },
    { data: servicosData },
    { data: profissionaisData },
  ] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('*')
      .eq('data', dataHoje)
      .order('hora_inicio'),
    supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
    supabase.from('profissionais').select('*').eq('ativo', true).order('nome'),
  ])

  return (
    <DiaList
      agendamentos={(agendamentosData ?? []) as Agendamento[]}
      servicos={(servicosData ?? []) as Servico[]}
      profissionais={(profissionaisData ?? []) as Profissional[]}
      dataHoje={dataHoje}
    />
  )
}
