import { createClient } from '@/lib/supabase/server'
import SemanaView from '@/components/agenda/semana-view'
import type { Agendamento, Servico, Profissional } from '@/types'

export const revalidate = 0

export default async function AgendaPage() {
  const supabase = createClient()

  // Calcular semana atual (Seg-Sáb)
  const hoje = new Date()
  const diaSemana = hoje.getDay()
  const diffSeg = diaSemana === 0 ? -6 : 1 - diaSemana
  const seg = new Date(hoje)
  seg.setDate(hoje.getDate() + diffSeg)
  const sab = new Date(seg)
  sab.setDate(seg.getDate() + 6)

  const dataInicio = seg.toISOString().slice(0, 10)
  const dataFim    = sab.toISOString().slice(0, 10)

  const [
    { data: agendamentosData },
    { data: servicosData },
    { data: profissionaisData },
  ] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('*')
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('hora_inicio'),
    supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
    supabase.from('profissionais').select('*').eq('ativo', true).order('nome'),
  ])

  return (
    <SemanaView
      agendamentos={(agendamentosData ?? []) as Agendamento[]}
      servicos={(servicosData ?? []) as Servico[]}
      profissionais={(profissionaisData ?? []) as Profissional[]}
    />
  )
}
