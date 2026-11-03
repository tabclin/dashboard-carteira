import Link from 'next/link'
import { ListChecks, FlaskConical, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma/client'
import { obterProfissional } from '@/lib/profissional'
import { hojeSP, dataDoBanco } from '@/lib/tarefas'
import { GRUPOS, grupoDoPrazo, somarDias, type Grupo } from '@/lib/tarefas-regras'
import { dataBR } from '@/lib/idade'
import { ANALYSIS_STATUS_CONFIG } from '@/types'
import { cn } from '@/lib/utils'
import { ListaTarefas, type TarefaVista } from '@/components/tarefas/lista-tarefas'
import { NovaTarefa } from '@/components/tarefas/nova-tarefa'

const DIAS_FEITAS = 14
const dia = (d: Date) => d.toISOString().slice(0, 10)
const vista = (t: { id: string; tipo: string; prazo: Date; observacao: string | null; status: string; concluidaComo: string | null; patient: { id: string; name: string } }): TarefaVista =>
  ({ id: t.id, tipo: t.tipo, prazo: dia(t.prazo), observacao: t.observacao, status: t.status, concluidaComo: t.concluidaComo, paciente: { id: t.patient.id, nome: t.patient.name } })

export default async function TarefasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const prof = await obterProfissional(user)
  if (!prof) return null
  const hoje = hojeSP()
  const sel = { id: true, tipo: true, prazo: true, observacao: true, status: true, concluidaComo: true, patient: { select: { id: true, name: true } } }

  const [pendentes, feitas, emAndamento] = await Promise.all([
    prisma.tarefa.findMany({ where: { professionalId: prof.id, status: 'pendente' }, select: sel, orderBy: [{ prazo: 'asc' }, { createdAt: 'asc' }] }),
    prisma.tarefa.findMany({ where: { professionalId: prof.id, status: 'feita', concluidaEm: { gte: dataDoBanco(somarDias(hoje, -DIAS_FEITAS)) } }, select: sel, orderBy: { concluidaEm: 'desc' } }),
    prisma.analysis.findMany({
      where: { professionalId: prof.id, status: { in: ['DRAFT', 'IN_REVIEW'] } },
      select: { id: true, status: true, collectedAt: true, updatedAt: true, patient: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
  ])
  const porGrupo = new Map<Grupo, TarefaVista[]>()
  for (const t of pendentes.map(vista)) {
    const g = grupoDoPrazo(t.prazo, hoje)
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), t])
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b bg-white px-6 py-5 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
              <ListChecks className="w-4 h-4 text-white" aria-hidden />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">Tarefas</h1>
              <p className="text-xs text-slate-500">O que fazer, para quem e até quando · {pendentes.length} pendente{pendentes.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <NovaTarefa />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-5 max-w-5xl">
        {pendentes.length === 0 && (
          <div className="rounded-xl border border-dashed bg-white px-6 py-10 text-center text-sm text-slate-500">
            Nenhuma tarefa pendente. Crie uma aqui ou pela ficha do paciente (botão &quot;Nova tarefa&quot;).
          </div>
        )}

        {GRUPOS.map(({ grupo, titulo }) => {
          const lista = porGrupo.get(grupo)
          if (!lista?.length) return null
          return (
            <section key={grupo} aria-label={titulo} className={cn('rounded-xl border bg-white px-5 pt-4 pb-1', grupo === 'atrasadas' && 'border-red-200')}>
              <h2 className={cn('font-semibold', grupo === 'atrasadas' ? 'text-red-700' : 'text-slate-800')}>
                {titulo} <span className="font-normal text-slate-400">({lista.length})</span>
              </h2>
              <ListaTarefas tarefas={lista} hoje={hoje} />
            </section>
          )
        })}

        {emAndamento.length > 0 && (
          <section aria-label="Análises em andamento" className="rounded-xl border bg-white px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800">
              <FlaskConical className="w-4 h-4 text-blue-600" aria-hidden /> Análises em andamento no Check Exames <span className="font-normal text-slate-400">({emAndamento.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mb-2">Começadas e ainda não finalizadas.</p>
            <ul className="divide-y">
              {emAndamento.map((a) => {
                const st = ANALYSIS_STATUS_CONFIG[a.status as keyof typeof ANALYSIS_STATUS_CONFIG]
                return (
                  <li key={a.id}>
                    <Link href={`/check-exames/analises/${a.id}`} className="flex items-center gap-3 py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-800">{a.patient.name}</span>
                        <span className="block text-xs text-slate-500">Coleta em {dataBR(a.collectedAt)} · mexida por último em {dataBR(a.updatedAt)}</span>
                      </span>
                      {st && <span className={cn('text-xs font-medium rounded-full px-2 py-0.5', st.bg, st.color)}>{st.label}</span>}
                      <span className="text-xs font-medium text-blue-700">Continuar</span>
                      <ChevronRight className="w-4 h-4 text-slate-300" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {feitas.length > 0 && (
          <details className="rounded-xl border bg-white px-5 py-4">
            <summary className="cursor-pointer font-semibold text-slate-700">Feitas nos últimos {DIAS_FEITAS} dias <span className="font-normal text-slate-400">({feitas.length})</span></summary>
            <ListaTarefas tarefas={feitas.map(vista)} hoje={hoje} />
          </details>
        )}
      </div>
    </div>
  )
}
