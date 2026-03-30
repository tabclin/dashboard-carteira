import { createClient } from '@/lib/supabase/server'
import PatientTable from '@/components/patient-table'
import type { Paciente } from '@/types'
import { RefreshCw } from 'lucide-react'

export const revalidate = 60

export default async function CarteiraPage() {
  const supabase = createClient()

  const [{ data: carteira }, { data: comPlanoData }] = await Promise.all([
    supabase.from('carteira').select('*').order('recencia_dias', { ascending: false }),
    supabase
      .from('plano_pacientes')
      .select('nome, nascimento, planos_acompanhamento!inner(status)')
      .eq('planos_acompanhamento.status', 'em_andamento'),
  ])

  const pacientes = (carteira ?? []) as Paciente[]

  const nomesComPlano = new Set<string>(
    (comPlanoData ?? []).map((p: { nome: string; nascimento: string | null }) => `${p.nome}|${p.nascimento ?? ''}`)
  )

  const total   = pacientes.length
  const ok      = pacientes.filter(p => p.status === 'Ok').length
  const atencao = pacientes.filter(p => p.status === 'Atenção').length
  const perigo  = pacientes.filter(p => p.status === 'Perigo').length

  return (
    <div className="space-y-5">
      {/* Botão de atualizar */}
      <div className="flex justify-end">
        <a
          href="/carteira"
          className="btn-secondary text-xs"
          title="Atualizar dados"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Atualizar
        </a>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',    valor: total,   cls: 'border-brand-500 text-brand-700 bg-brand-50'    },
          { label: 'Ok',       valor: ok,      cls: 'border-emerald-500 text-emerald-700 bg-emerald-50' },
          { label: 'Atenção',  valor: atencao, cls: 'border-amber-500 text-amber-700 bg-amber-50'    },
          { label: 'Perigo',   valor: perigo,  cls: 'border-red-500 text-red-700 bg-red-50'          },
        ].map(item => (
          <div
            key={item.label}
            className={`rounded-xl border-l-4 px-4 py-3 ${item.cls}`}
          >
            <p className="text-xs font-medium opacity-70">{item.label}</p>
            <p className="text-2xl font-bold mt-0.5">{item.valor}</p>
          </div>
        ))}
      </div>

      {/* Tabela interativa (client component) */}
      <PatientTable pacientes={pacientes} nomesComPlano={nomesComPlano} />
    </div>
  )
}
