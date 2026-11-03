'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, FlaskConical, Flame, ScrollText, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dataBR } from '@/lib/idade'

export type LinhaPaciente = {
  id: string
  nome: string
  idade: string | null
  ultimaConsulta: string | null
  exames: number
  dri: number
  orientacoes: number
}

const POR_PAGINA = 100
const chave = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const FERRAMENTAS = [
  { campo: 'exames', rotulo: 'Check Exames', icone: FlaskConical, cor: 'bg-blue-50 text-blue-700 ring-blue-200', um: 'análise de exames', varios: 'análises de exames' },
  { campo: 'dri', rotulo: 'DRI', icone: Flame, cor: 'bg-orange-50 text-orange-700 ring-orange-200', um: 'avaliação DRI', varios: 'avaliações DRI' },
  { campo: 'orientacoes', rotulo: 'Orientações', icone: ScrollText, cor: 'bg-indigo-50 text-indigo-700 ring-indigo-200', um: 'orientação', varios: 'orientações' },
] as const

type Filtro = 'todos' | (typeof FERRAMENTAS)[number]['campo']

/** Selos de cada ferramenta: coloridos com a quantidade quando já foi feita, apagados quando não. */
export function Indicadores({ p }: { p: Pick<LinhaPaciente, 'exames' | 'dri' | 'orientacoes'> }) {
  return (
    <div className="flex gap-1.5">
      {FERRAMENTAS.map(({ campo, rotulo, icone: Icone, cor, um, varios }) => {
        const n = p[campo]
        const texto = n ? `${n} ${n === 1 ? um : varios}` : `Sem ${rotulo}`
        return (
          <span key={campo} title={texto} aria-label={texto}
            className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1',
              n ? cor : 'bg-white text-slate-300 ring-slate-200')}>
            <Icone className="w-3.5 h-3.5" aria-hidden />{n || '–'}
          </span>
        )
      })}
    </div>
  )
}

export function TabelaPacientes({ linhas }: { linhas: LinhaPaciente[] }) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [limite, setLimite] = useState(POR_PAGINA)

  const indice = useMemo(() => linhas.map((l) => ({ l, k: chave(l.nome) })), [linhas])
  const filtradas = useMemo(() => {
    const termos = chave(busca).split(' ').filter(Boolean)
    return indice
      .filter(({ l, k }) => termos.every((t) => k.includes(t)) && (filtro === 'todos' || l[filtro] > 0))
      .map(({ l }) => l)
  }, [indice, busca, filtro])
  const contagem = (f: Filtro) => (f === 'todos' ? linhas.length : linhas.filter((l) => l[f] > 0).length)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
          <input type="search" value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(POR_PAGINA) }}
            placeholder="Buscar paciente pelo nome" aria-label="Buscar paciente"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40" />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar">
          {(['todos', ...FERRAMENTAS.map((f) => f.campo)] as Filtro[]).map((f) => (
            <button key={f} type="button" onClick={() => { setFiltro(f); setLimite(POR_PAGINA) }} aria-pressed={filtro === f}
              className={cn('rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                filtro === f ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>
              {f === 'todos' ? 'Todos' : `Com ${FERRAMENTAS.find((x) => x.campo === f)!.rotulo}`} ({contagem(f)})
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Paciente</th>
              <th className="px-4 py-3 font-semibold">Última consulta</th>
              <th className="px-4 py-3 font-semibold">Ferramentas</th>
              <th className="px-4 py-3"><span className="sr-only">Detalhes</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtradas.slice(0, limite).map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`/pacientes/${p.id}`} className="font-medium text-slate-800 hover:text-brand-600">{p.nome}</Link>
                  {p.idade && <span className="block text-xs text-slate-500">{p.idade}</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{dataBR(p.ultimaConsulta) ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-2.5"><Indicadores p={p} /></td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/pacientes/${p.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
                    Detalhes <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                  </Link>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                {linhas.length === 0 ? 'Nenhum paciente ainda. Atualize pelo Gestão DS ou importe uma planilha em Configurações.' : 'Nenhum paciente encontrado.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {filtradas.length > limite && (
        <div className="text-center">
          <button type="button" onClick={() => setLimite((l) => l + POR_PAGINA)} className="text-sm font-medium text-brand-600 hover:underline">
            Mostrar mais ({filtradas.length - limite} restantes)
          </button>
        </div>
      )}
    </div>
  )
}
