import { createClient } from '@/lib/supabase/server'
import StatusBadge from '@/components/status-badge'
import { formatarData, formatarRecencia, formatarIdade } from '@/lib/utils'
import type { Paciente } from '@/types'
import {
  AlertOctagon, Clock, Star, Baby, TrendingUp, ChevronRight,
} from 'lucide-react'

export const revalidate = 60

async function getIndicadores() {
  const supabase = createClient()
  const { data } = await supabase.from('carteira').select('*')
  const pacientes = (data ?? []) as Paciente[]

  const emPerigo = pacientes
    .filter(p => p.status === 'Perigo')
    .sort((a, b) => (b.recencia_dias ?? 0) - (a.recencia_dias ?? 0))

  const semRetorno = pacientes
    .filter(p => (p.recencia_dias ?? 0) >= 180)
    .sort((a, b) => (b.recencia_dias ?? 0) - (a.recencia_dias ?? 0))

  const bebesEmRisco = pacientes
    .filter(p => (p.idade_dias ?? 9999) < 730 && p.status !== 'Ok')
    .sort((a, b) => (a.recencia_dias ?? 0) - (b.recencia_dias ?? 0))

  const recorrentes = pacientes
    .filter(p => (p.qtd_at ?? 0) >= 5 && p.status === 'Ok')
    .sort((a, b) => (b.qtd_at ?? 0) - (a.qtd_at ?? 0))
    .slice(0, 10)

  const reativacao = pacientes
    .filter(p => p.status === 'Atenção' && (p.qtd_at ?? 0) >= 3)
    .sort((a, b) => (b.qtd_at ?? 0) - (a.qtd_at ?? 0))
    .slice(0, 20)

  return { emPerigo, semRetorno, bebesEmRisco, recorrentes, reativacao }
}

function PacienteRow({ p }: { p: Paciente }) {
  return (
    <tr className="hover:bg-slate-50/60 transition-colors border-b border-slate-50 last:border-0">
      <td className="px-4 py-2.5 text-sm font-medium text-slate-800">{p.paciente}</td>
      <td className="px-4 py-2.5 text-sm text-slate-500">{formatarData(p.ultimo_atendimento)}</td>
      <td className="px-4 py-2.5 text-sm">
        <span className={
          (p.recencia_dias ?? 0) > 180
            ? 'text-red-600 font-medium'
            : (p.recencia_dias ?? 0) > 60
            ? 'text-amber-600 font-medium'
            : 'text-slate-600'
        }>
          {formatarRecencia(p.recencia_dias)}
        </span>
      </td>
      <td className="px-4 py-2.5 text-sm text-slate-500">{p.qtd_at ?? 0} consul.</td>
      <td className="px-4 py-2.5"><StatusBadge status={p.status} size="sm" /></td>
    </tr>
  )
}

interface SecaoProps {
  titulo: string
  descricao: string
  icon: React.ReactNode
  corBorda: string
  pacientes: Paciente[]
  limite?: number
}

function Secao({ titulo, descricao, icon, corBorda, pacientes, limite = 15 }: SecaoProps) {
  const lista = pacientes.slice(0, limite)
  return (
    <div className={`card border-l-4 ${corBorda} p-0 overflow-hidden`}>
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div>{icon}</div>
        <div className="flex-1">
          <h2 className="font-semibold text-slate-800 text-sm">{titulo}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{descricao}</p>
        </div>
        <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
          {pacientes.length}
        </span>
      </div>

      {lista.length === 0 ? (
        <div className="px-5 py-6 text-center text-slate-400 text-sm">
          Nenhum paciente nesta categoria.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/60">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 uppercase tracking-wide">Paciente</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 uppercase tracking-wide">Último Atend.</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 uppercase tracking-wide">Recência</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 uppercase tracking-wide">Consultas</th>
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p, i) => <PacienteRow key={`${p.paciente}-${i}`} p={p} />)}
            </tbody>
          </table>
        </div>
      )}

      {pacientes.length > limite && (
        <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/50">
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <ChevronRight className="w-3 h-3" />
            Mostrando {limite} de {pacientes.length}. Veja todos na aba Carteira de Pacientes.
          </p>
        </div>
      )}
    </div>
  )
}

export default async function IndicadoresPage() {
  const { emPerigo, semRetorno, bebesEmRisco, recorrentes, reativacao } = await getIndicadores()

  return (
    <div className="space-y-5">
      <Secao
        titulo="Pacientes em Perigo"
        descricao="Pacientes classificados como Perigo — risco de abandono imediato"
        icon={<AlertOctagon className="w-5 h-5 text-red-500" />}
        corBorda="border-red-500"
        pacientes={emPerigo}
      />

      <Secao
        titulo="Sem Retorno (≥ 6 meses)"
        descricao="Pacientes que não retornam há 180 dias ou mais"
        icon={<Clock className="w-5 h-5 text-amber-500" />}
        corBorda="border-amber-500"
        pacientes={semRetorno}
      />

      <Secao
        titulo="Bebês e Crianças em Risco"
        descricao="Pacientes com menos de 2 anos em status Atenção ou Perigo"
        icon={<Baby className="w-5 h-5 text-pink-500" />}
        corBorda="border-pink-400"
        pacientes={bebesEmRisco}
      />

      <Secao
        titulo="Potencial de Reativação"
        descricao="Pacientes em Atenção com bom histórico — vale entrar em contato"
        icon={<TrendingUp className="w-5 h-5 text-brand-500" />}
        corBorda="border-brand-500"
        pacientes={reativacao}
      />

      <Secao
        titulo="Pacientes Recorrentes em Dia"
        descricao="Seus melhores pacientes — alta frequência e status Ok"
        icon={<Star className="w-5 h-5 text-yellow-500" />}
        corBorda="border-yellow-400"
        pacientes={recorrentes}
        limite={10}
      />
    </div>
  )
}
