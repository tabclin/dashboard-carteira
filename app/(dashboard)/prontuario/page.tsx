import { createClient } from '@/lib/supabase/server'
import ProntuarioEntrada from '@/components/prontuario/prontuario-entrada'

export const revalidate = 0

export default async function ProntuarioPage() {
  const supabase = createClient()

  const hoje         = new Date().toISOString().slice(0, 10)
  const seteDias     = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    { data: hojeAgs },
    { data: proximosAgs },
    { data: comProntuario },
  ] = await Promise.all([
    // Agendamentos de hoje (abertos)
    supabase
      .from('agendamentos')
      .select('*')
      .eq('data', hoje)
      .in('status', ['agendado', 'confirmado', 'em_consulta'])
      .order('hora_inicio', { ascending: true }),

    // Próximos 7 dias
    supabase
      .from('agendamentos')
      .select('*')
      .gt('data', hoje)
      .lte('data', seteDias)
      .in('status', ['agendado', 'confirmado'])
      .order('data', { ascending: true })
      .order('hora_inicio', { ascending: true }),

    // Prontuários recentes
    supabase
      .from('prontuarios')
      .select('paciente_id, atualizado_em, prontuario_consultas(data)')
      .order('atualizado_em', { ascending: false })
      .limit(15),
  ])

  // Dados dos pacientes dos prontuários recentes
  const ids = (comProntuario ?? []).map((p: any) => p.paciente_id)
  const { data: pacientes } = ids.length > 0
    ? await supabase.from('pacientes').select('id, paciente, nascimento').in('id', ids)
    : { data: [] }

  return (
    <ProntuarioEntrada
      hojeAgendamentos={(hojeAgs ?? []) as any[]}
      proximosAgendamentos={(proximosAgs ?? []) as any[]}
      recentes={(comProntuario ?? []) as any[]}
      pacientesData={(pacientes ?? []) as any[]}
    />
  )
}
