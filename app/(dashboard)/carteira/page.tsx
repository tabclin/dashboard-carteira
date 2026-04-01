import { createClient } from '@/lib/supabase/server'
import PatientTable from '@/components/patient-table'
import type { Paciente, ConfigRetornoFaixa } from '@/types'
import { calcRetornoIdeal, calcStatus } from '@/lib/carteira-config'

export const revalidate = 60

export default async function CarteiraPage() {
  const supabase = createClient()

  const [
    { data: carteira },
    { data: comPlanoData },
    { data: configData },
    { data: pacientesMetaData },
  ] = await Promise.all([
    supabase.from('carteira').select('*').order('recencia_dias', { ascending: false }),
    supabase
      .from('plano_pacientes')
      .select('nome, nascimento, planos_acompanhamento!inner(status)')
      .eq('planos_acompanhamento.status', 'em_andamento'),
    supabase
      .from('carteira_config_retorno')
      .select('*')
      .order('idade_min_dias'),
    supabase
      .from('pacientes')
      .select('paciente, nascimento, ativo, retorno_custom_dias'),
  ])

  const config = (configData ?? []) as ConfigRetornoFaixa[]

  const nomesComPlano = new Set<string>(
    (comPlanoData ?? []).map((p: { nome: string; nascimento: string | null }) =>
      `${p.nome}|${p.nascimento ?? ''}`
    )
  )

  const metaMap = new Map<string, { ativo: boolean; retorno_custom_dias: number | null }>()
  for (const p of (pacientesMetaData ?? []) as any[]) {
    metaMap.set(`${p.paciente}|${p.nascimento ?? ''}`, {
      ativo: p.ativo ?? true,
      retorno_custom_dias: p.retorno_custom_dias ?? null,
    })
  }

  const todosPacientes = (carteira ?? []).map((p: any) => {
    const meta = metaMap.get(`${p.paciente}|${p.nascimento ?? ''}`)
    const retorno_custom_dias = meta?.retorno_custom_dias ?? p.retorno_custom_dias ?? null
    const retorno_ideal_dias = calcRetornoIdeal(p.idade_dias, config, retorno_custom_dias)
    return {
      ...p,
      retorno_custom_dias,
      retorno_ideal_dias,
      ativo: meta?.ativo ?? true,
      status: calcStatus(p.recencia_dias, retorno_ideal_dias),
    } as Paciente
  })

  // Apenas ativos vão para a tabela principal
  const pacientes = todosPacientes.filter(p => p.ativo !== false)

  return (
    <PatientTable pacientes={pacientes} nomesComPlano={nomesComPlano} config={config} />
  )
}
